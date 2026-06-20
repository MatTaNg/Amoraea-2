import { supabase } from '@data/supabase/client';
import { PROFILES_ROW_SELECT } from '@data/supabase/userInterviewRoutingSelect';
import {
  ASSESSMENT_IDS,
  type AssessmentId,
} from '@/data/services/assessmentService';
import {
  buildDetailedInsightRows,
  getInsightContent,
} from '@/data/assessments/insightContent';
import { TYPOLOGY_ONBOARDING_SECTIONS } from '@/shared/constants/typologyOnboardingOptions';

export type AdminDatingProfilePhoto = {
  url: string;
  source: 'profile_json' | 'profile_photos' | 'avatar';
};

export type AdminDatingTypologyResult = {
  instrument: AssessmentId;
  label: string;
  completedAt: string | null;
  scores: Record<string, number>;
  headline: string;
  body: string;
  growthEdge: string;
  details: Array<{ label: string; value: string; description: string }>;
};

export type AdminDatingProfileBundle = {
  profileRow: {
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  profileJson: Record<string, unknown>;
  photos: AdminDatingProfilePhoto[];
  typologyResults: AdminDatingTypologyResult[];
  optionalTypologyAnswers: Array<{ section: string; label: string; value: string }>;
  personalityDocuments: Array<{ name: string; url: string }>;
  onboardingProgress: {
    currentStep: string | null;
    completedSteps: string[] | null;
    updatedAt: string | null;
  } | null;
  loadWarnings: string[];
};

const INSTRUMENT_LABELS: Record<(typeof ASSESSMENT_IDS)[number], string> = {
  SEXUAL_COMMUNICATION: 'Sexual communication',
  'PVQ-21': 'Core values (Schwartz)',
  'CONFLICT-30': 'Conflict style',
  'ECR-36': 'Attachment style',
};

function isRenderablePhotoUri(uri: string): boolean {
  const t = uri.trim();
  return (
    /^https?:\/\//i.test(t) ||
    t.startsWith('//') ||
    t.startsWith('data:image/') ||
    t.startsWith('blob:')
  );
}

function extractPhotoUrlsFromUnknown(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && isRenderablePhotoUri(item)) {
      out.push(item.trim());
      continue;
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      const cand = o.public_url ?? o.publicUrl ?? o.url ?? o.uri;
      if (typeof cand === 'string' && isRenderablePhotoUri(cand)) out.push(cand.trim());
    }
  }
  return out;
}

function resolvePhotosFromProfileJson(
  profileJson: Record<string, unknown>,
  avatarUrl: string | null,
): AdminDatingProfilePhoto[] {
  const keys = ['photos', 'photo_urls', 'photoUrls', 'profilePhotos'] as const;
  let urls: string[] = [];
  for (const k of keys) {
    urls = extractPhotoUrlsFromUnknown(profileJson[k]);
    if (urls.length) break;
  }

  const primaryPick = [
    profileJson.primary_photo_url,
    profileJson.primaryPhotoUrl,
    avatarUrl,
  ].find((x): x is string => typeof x === 'string' && isRenderablePhotoUri(x));
  if (primaryPick && !urls.some((u) => u.trim() === primaryPick.trim())) {
    urls = [primaryPick.trim(), ...urls];
  }

  const seen = new Set<string>();
  return urls
    .filter((u) => {
      const key = u.trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((url) => ({ url, source: 'profile_json' as const }));
}

function parseScores(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function isSkippedOnlyScores(scores: Record<string, number>): boolean {
  const keys = Object.keys(scores);
  return keys.length === 1 && scores.skipped === 1;
}

function hasTypologyScores(scores: Record<string, number>): boolean {
  return Object.keys(scores).length > 0 && !isSkippedOnlyScores(scores);
}

function parsePersonalityDocuments(raw: unknown): Array<{ name: string; url: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ name: string; url: string }> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const url = o.url ?? o.public_url ?? o.publicUrl ?? o.uri;
    const name = o.name ?? o.fileName ?? o.filename ?? o.title ?? 'Document';
    if (typeof url === 'string' && url.trim()) {
      out.push({
        name: typeof name === 'string' && name.trim() ? name.trim() : 'Document',
        url: url.trim(),
      });
    }
  }
  return out;
}

function buildTypologyResult(
  instrument: AssessmentId,
  scores: Record<string, number>,
  completedAt: string | null,
): AdminDatingTypologyResult {
  const insight = getInsightContent(instrument, scores);
  const details = buildDetailedInsightRows(instrument, scores);
  return {
    instrument,
    label: INSTRUMENT_LABELS[instrument],
    completedAt,
    scores,
    headline: insight.headline,
    body: insight.body,
    growthEdge: insight.growthEdge,
    details,
  };
}

type RawAssessmentRow = {
  instrument: string;
  scores: unknown;
  completed_at: string | null;
};

type EdgeDatingProfilePayload = {
  assessments?: RawAssessmentRow[];
  onboarding_progress?: Record<string, unknown> | null;
  profile_photos?: Array<{ public_url?: string; display_order?: number }>;
  warnings?: string[];
};

/** Service-role fallback when RLS blocks admin SELECT on user_assessments (migration not applied yet). */
async function fetchDatingProfileDataViaAdminEdge(
  userId: string,
): Promise<EdgeDatingProfilePayload | null> {
  const { data, error } = await supabase.functions.invoke<EdgeDatingProfilePayload>(
    'admin-fetch-dating-profile-data',
    { body: { userId } },
  );
  if (error) {
    console.warn('[AdminDatingProfile] edge fallback failed:', error.message);
    return null;
  }
  return data ?? null;
}

export async function fetchAdminDatingProfileBundle(
  userId: string,
): Promise<AdminDatingProfileBundle> {
  const loadWarnings: string[] = [];

  const [profileRes, photosRes, assessmentsRes, progressRes] = await Promise.all([
    supabase.from('profiles').select(PROFILES_ROW_SELECT).eq('id', userId).maybeSingle(),
    supabase
      .from('profile_photos')
      .select('public_url, display_order')
      .eq('profile_id', userId)
      .order('display_order', { ascending: true }),
    supabase
      .from('user_assessments')
      .select('instrument, scores, completed_at')
      .eq('user_id', userId),
    supabase
      .from('onboarding_progress')
      .select('current_step, completed_steps, updated_at, onboarding_data')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (profileRes.error) loadWarnings.push(`profiles: ${profileRes.error.message}`);
  if (photosRes.error) loadWarnings.push(`profile_photos: ${photosRes.error.message}`);
  if (assessmentsRes.error) loadWarnings.push(`user_assessments: ${assessmentsRes.error.message}`);
  if (progressRes.error) loadWarnings.push(`onboarding_progress: ${progressRes.error.message}`);

  let assessmentRows: RawAssessmentRow[] = (assessmentsRes.data ?? []) as RawAssessmentRow[];
  let progressRaw = progressRes.data as Record<string, unknown> | null;
  let photoRows = photosRes.data ?? [];

  if (assessmentRows.length === 0 && !assessmentsRes.error) {
    const edge = await fetchDatingProfileDataViaAdminEdge(userId);
    if (edge?.assessments?.length) {
      assessmentRows = edge.assessments;
      loadWarnings.push(
        'user_assessments: loaded via admin edge function (client RLS did not return rows — apply migration 20260710120000_admin_profile_data_rls.sql for direct reads)',
      );
      if (edge.onboarding_progress && !progressRaw) {
        progressRaw = edge.onboarding_progress;
      }
      if (edge.profile_photos?.length && !photoRows.length) {
        photoRows = edge.profile_photos;
      }
    } else if (!edge) {
      loadWarnings.push(
        'user_assessments: no rows visible for this user. Deploy edge function admin-fetch-dating-profile-data and/or apply migration 20260710120000_admin_profile_data_rls.sql.',
      );
    }
    for (const w of edge?.warnings ?? []) {
      if (w.trim()) loadWarnings.push(w);
    }
  }

  const profileRowRaw = profileRes.data as Record<string, unknown> | null;
  const profileJsonFromRow =
    profileRowRaw?.profile_json != null &&
    typeof profileRowRaw.profile_json === 'object' &&
    !Array.isArray(profileRowRaw.profile_json)
      ? (profileRowRaw.profile_json as Record<string, unknown>)
      : typeof profileRowRaw?.profile_json === 'string'
        ? (() => {
            try {
              const p = JSON.parse(profileRowRaw.profile_json as string);
              return p && typeof p === 'object' && !Array.isArray(p)
                ? (p as Record<string, unknown>)
                : {};
            } catch {
              return {};
            }
          })()
        : {};

  const progressRawResolved = progressRaw;
  const onboardingDataRaw =
    progressRawResolved?.onboarding_data != null &&
    typeof progressRawResolved.onboarding_data === 'object' &&
    !Array.isArray(progressRawResolved.onboarding_data)
      ? (progressRawResolved.onboarding_data as Record<string, unknown>)
      : {};

  const profileJson: Record<string, unknown> = {
    ...onboardingDataRaw,
    ...profileJsonFromRow,
  };

  const avatarUrl =
    typeof profileRowRaw?.avatar_url === 'string' ? profileRowRaw.avatar_url : null;

  const photos = resolvePhotosFromProfileJson(profileJson, avatarUrl);

  if (photoRows.length) {
    const seen = new Set(photos.map((p) => p.url));
    for (const row of photoRows) {
      const url =
        typeof (row as { public_url?: unknown }).public_url === 'string'
          ? (row as { public_url: string }).public_url.trim()
          : '';
      if (!url || !isRenderablePhotoUri(url) || seen.has(url)) continue;
      seen.add(url);
      photos.push({ url, source: 'profile_photos' });
    }
  }

  const assessmentByInstrument = new Map<
    string,
    { scores: Record<string, number>; completedAt: string | null }
  >();
  for (const row of assessmentRows) {
    const instrument = typeof row.instrument === 'string' ? row.instrument : '';
    if (!instrument) continue;
    assessmentByInstrument.set(instrument, {
      scores: parseScores(row.scores),
      completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
    });
  }

  const typologyResults = ASSESSMENT_IDS.map((instrument) => {
    const saved = assessmentByInstrument.get(instrument);
    if (!saved) {
      return {
        instrument,
        label: INSTRUMENT_LABELS[instrument],
        completedAt: null,
        scores: {},
        headline: '',
        body: '',
        growthEdge: '',
        details: [],
      } satisfies AdminDatingTypologyResult;
    }
    if (isSkippedOnlyScores(saved.scores)) {
      return {
        instrument,
        label: INSTRUMENT_LABELS[instrument],
        completedAt: saved.completedAt,
        scores: saved.scores,
        headline: 'Skipped',
        body: 'Member chose to skip this section during compatibility onboarding.',
        growthEdge: '',
        details: [],
      } satisfies AdminDatingTypologyResult;
    }
    if (!hasTypologyScores(saved.scores)) {
      return {
        instrument,
        label: INSTRUMENT_LABELS[instrument],
        completedAt: saved.completedAt,
        scores: {},
        headline: '',
        body: '',
        growthEdge: '',
        details: [],
      } satisfies AdminDatingTypologyResult;
    }
    return buildTypologyResult(instrument, saved.scores, saved.completedAt);
  });

  const typologyFromOnboarding =
    onboardingDataRaw.typology != null &&
    typeof onboardingDataRaw.typology === 'object' &&
    !Array.isArray(onboardingDataRaw.typology)
      ? (onboardingDataRaw.typology as Record<string, unknown>)
      : {};

  const questionAnswersFromProfile =
    profileJson.questionAnswers != null &&
    typeof profileJson.questionAnswers === 'object' &&
    !Array.isArray(profileJson.questionAnswers)
      ? (profileJson.questionAnswers as Record<string, unknown>)
      : {};

  const questionAnswers = { ...typologyFromOnboarding, ...questionAnswersFromProfile };

  const optionalTypologyAnswers: Array<{ section: string; label: string; value: string }> = [];
  for (const section of TYPOLOGY_ONBOARDING_SECTIONS) {
    for (const row of section.rows) {
      const raw = questionAnswers[row.key];
      if (typeof raw !== 'string' || !raw.trim()) continue;
      optionalTypologyAnswers.push({
        section: section.title,
        label: row.label,
        value: raw.trim(),
      });
    }
  }

  const personalityDocuments = parsePersonalityDocuments(
    profileJson.personalityDocuments ?? profileJson.personality_documents,
  );

  const onboardingProgress = progressRawResolved
    ? {
        currentStep:
          typeof progressRawResolved.current_step === 'string'
            ? progressRawResolved.current_step
            : null,
        completedSteps: Array.isArray(progressRawResolved.completed_steps)
          ? progressRawResolved.completed_steps.filter(
              (x): x is string => typeof x === 'string',
            )
          : null,
        updatedAt:
          typeof progressRawResolved.updated_at === 'string'
            ? progressRawResolved.updated_at
            : null,
      }
    : null;

  return {
    profileRow: {
      email: typeof profileRowRaw?.email === 'string' ? profileRowRaw.email : null,
      displayName:
        typeof profileRowRaw?.display_name === 'string'
          ? profileRowRaw.display_name
          : typeof profileJson.name === 'string'
            ? profileJson.name
            : null,
      avatarUrl,
      createdAt:
        typeof profileRowRaw?.created_at === 'string' ? profileRowRaw.created_at : null,
      updatedAt:
        typeof profileRowRaw?.updated_at === 'string' ? profileRowRaw.updated_at : null,
    },
    profileJson,
    photos,
    typologyResults,
    optionalTypologyAnswers,
    personalityDocuments,
    onboardingProgress,
    loadWarnings,
  };
}
