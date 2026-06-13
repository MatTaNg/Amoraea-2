import { supabase } from '@data/supabase/client';
import { computePairCompatibilityScore, type PairCompatibilityResult } from './computePairCompatibilityScore';
import { explainDealbreakerBlockers } from './explainDealbreakerBlockers';
import {
  fetchCompatibilityTestSeedUserIds,
  isCompatibilityTestSeedUser,
} from './compatibilityTestSeedUser';
import { fetchMatchEligibleUserIds } from './adminMatchEligibleProfile';
import { loadMatchmakingUserSnapshot } from './loadMatchmakingUserSnapshot';
import {
  mapMatchmakingUserToCompatibilityInputs,
  type MappedUserCompatibilityInputs,
} from './mapMatchmakingUserToCompatibilityInputs';
import {
  buildMatchInsights,
  computePreDealbreakerFinalScore,
  type MatchInsight,
} from './pairCompatibilityPresentation';

export type AdminCompatDirectoryUser = {
  id: string;
  email: string | null;
  phone: string | null;
  displayLabel: string;
};

export type ResolvedAdminCompatUser = AdminCompatDirectoryUser & {
  mapped: MappedUserCompatibilityInputs;
};

export type AdminPairScoreResult = {
  userA: AdminCompatDirectoryUser;
  userB: AdminCompatDirectoryUser;
  result: PairCompatibilityResult;
  preDealbreakerScore: number;
  effectiveScore: number;
  dealbreakerFailed: boolean;
  dealbreakerReasons: string[];
  insights: MatchInsight[];
};

export type AdminBatchMatchPair = AdminPairScoreResult & {
  rank: number;
};

export type AdminBatchMatchResult = {
  pairs: AdminBatchMatchPair[];
  unmatched: AdminCompatDirectoryUser[];
  notFound: string[];
  profileIncomplete: string[];
  duplicateIdentifiers: string[];
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function displayLabelFromRow(row: {
  email?: string | null;
  display_name?: string | null;
  name?: string | null;
  full_name?: string | null;
}): string {
  return (
    row.display_name?.trim() ||
    row.name?.trim() ||
    row.full_name?.trim() ||
    row.email?.trim() ||
    'Unknown user'
  );
}

export function parseIdentifierList(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function fetchAdminCompatibilityUserRows(): Promise<AdminCompatDirectoryUser[]> {
  const seedUserIds = await fetchCompatibilityTestSeedUserIds(supabase);

  const { data, error } = await supabase
    .from('users')
    .select('id, email, launch_notification_phone, display_name, name, full_name')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) => !isCompatibilityTestSeedUser({ id: row.id, email: row.email }, seedUserIds))
    .map((row) => ({
      id: row.id,
      email: row.email ?? null,
      phone: row.launch_notification_phone ?? null,
      displayLabel: displayLabelFromRow(row),
    }));
}

export async function fetchAdminCompatibilityDirectory(): Promise<AdminCompatDirectoryUser[]> {
  const rows = await fetchAdminCompatibilityUserRows();
  const eligibleIds = await fetchMatchEligibleUserIds(
    supabase,
    rows.map((row) => row.id),
  );
  return rows.filter((row) => eligibleIds.has(row.id));
}

export function filterDirectorySuggestions(
  directory: AdminCompatDirectoryUser[],
  query: string,
  limit = 8,
): AdminCompatDirectoryUser[] {
  const q = query.trim().toLowerCase();
  const phoneQ = normalizePhoneDigits(query);
  if (!q && !phoneQ) return [];

  return directory
    .filter((u) => {
      const emailMatch = u.email?.toLowerCase().includes(q);
      const labelMatch = u.displayLabel.toLowerCase().includes(q);
      const phoneMatch =
        phoneQ.length >= 4 &&
        u.phone != null &&
        normalizePhoneDigits(u.phone).includes(phoneQ);
      return emailMatch || labelMatch || phoneMatch;
    })
    .slice(0, limit);
}

export function resolveDirectoryUser(
  directory: AdminCompatDirectoryUser[],
  identifier: string,
): AdminCompatDirectoryUser | null {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const emailKey = normalizeEmail(trimmed);
  const phoneKey = normalizePhoneDigits(trimmed);

  const byEmail = directory.find((u) => u.email && normalizeEmail(u.email) === emailKey);
  if (byEmail) return byEmail;

  if (phoneKey.length >= 7) {
    const byPhone = directory.find(
      (u) => u.phone && normalizePhoneDigits(u.phone) === phoneKey,
    );
    if (byPhone) return byPhone;

    const byPhoneSuffix = directory.filter(
      (u) => u.phone && normalizePhoneDigits(u.phone).endsWith(phoneKey),
    );
    if (byPhoneSuffix.length === 1) return byPhoneSuffix[0]!;
  }

  const partialEmail = directory.filter(
    (u) => u.email && normalizeEmail(u.email).includes(emailKey),
  );
  if (partialEmail.length === 1) return partialEmail[0]!;

  return null;
}

async function loadMappedUser(user: AdminCompatDirectoryUser): Promise<ResolvedAdminCompatUser> {
  const loaded = await loadMatchmakingUserSnapshot(supabase, user.id);
  return {
    ...user,
    mapped: mapMatchmakingUserToCompatibilityInputs(loaded.snapshot, loaded.extras),
  };
}

export async function scoreAdminPair(
  userA: AdminCompatDirectoryUser,
  userB: AdminCompatDirectoryUser,
): Promise<AdminPairScoreResult> {
  const [resolvedA, resolvedB] = await Promise.all([
    loadMappedUser(userA),
    loadMappedUser(userB),
  ]);

  const result = computePairCompatibilityScore(resolvedA.mapped, resolvedB.mapped);
  const preDealbreakerScore = computePreDealbreakerFinalScore(result);
  const dealbreakerFailed = result.subscores.dealbreakerMultiplier === 0;
  const dealbreakerReasons = dealbreakerFailed
    ? explainDealbreakerBlockers(resolvedA.mapped.dealbreaker, resolvedB.mapped.dealbreaker)
    : [];

  return {
    userA,
    userB,
    result,
    preDealbreakerScore,
    effectiveScore: result.finalScore,
    dealbreakerFailed,
    dealbreakerReasons,
    insights: buildMatchInsights(result),
  };
}

type ScoredPairCandidate = AdminPairScoreResult & { sortScore: number };

function greedyOneToOneMatching(candidates: ScoredPairCandidate[]): AdminBatchMatchPair[] {
  const sorted = [...candidates].sort((a, b) => b.sortScore - a.sortScore);
  const used = new Set<string>();
  const pairs: AdminBatchMatchPair[] = [];
  let rank = 1;

  for (const candidate of sorted) {
    if (used.has(candidate.userA.id) || used.has(candidate.userB.id)) continue;
    used.add(candidate.userA.id);
    used.add(candidate.userB.id);
    pairs.push({ ...candidate, rank: rank++ });
  }

  return pairs;
}

export async function runAdminBatchMatching(rawInput: string): Promise<AdminBatchMatchResult> {
  const identifiers = parseIdentifierList(rawInput);
  const allUsers = await fetchAdminCompatibilityUserRows();
  const eligibleIds = await fetchMatchEligibleUserIds(
    supabase,
    allUsers.map((user) => user.id),
  );

  const seen = new Set<string>();
  const duplicateIdentifiers: string[] = [];
  const uniqueIdentifiers: string[] = [];
  for (const id of identifiers) {
    const key = normalizeEmail(id);
    if (seen.has(key)) {
      duplicateIdentifiers.push(id);
      continue;
    }
    seen.add(key);
    uniqueIdentifiers.push(id);
  }

  const resolved: AdminCompatDirectoryUser[] = [];
  const notFound: string[] = [];
  const profileIncomplete: string[] = [];
  for (const id of uniqueIdentifiers) {
    const user = resolveDirectoryUser(allUsers, id);
    if (!user) {
      notFound.push(id);
      continue;
    }
    if (!eligibleIds.has(user.id)) {
      profileIncomplete.push(id);
      continue;
    }
    if (resolved.some((r) => r.id === user.id)) {
      duplicateIdentifiers.push(id);
      continue;
    }
    resolved.push(user);
  }

  if (resolved.length < 2) {
    return { pairs: [], unmatched: resolved, notFound, profileIncomplete, duplicateIdentifiers };
  }

  const loaded = await Promise.all(resolved.map((u) => loadMappedUser(u)));

  const candidates: ScoredPairCandidate[] = [];
  for (let i = 0; i < loaded.length; i++) {
    for (let j = i + 1; j < loaded.length; j++) {
      const userA = loaded[i]!;
      const userB = loaded[j]!;
      const result = computePairCompatibilityScore(userA.mapped, userB.mapped);
      const preDealbreakerScore = computePreDealbreakerFinalScore(result);
      const dealbreakerFailed = result.subscores.dealbreakerMultiplier === 0;
      const dealbreakerReasons = dealbreakerFailed
        ? explainDealbreakerBlockers(userA.mapped.dealbreaker, userB.mapped.dealbreaker)
        : [];

      candidates.push({
        userA: { id: userA.id, email: userA.email, phone: userA.phone, displayLabel: userA.displayLabel },
        userB: { id: userB.id, email: userB.email, phone: userB.phone, displayLabel: userB.displayLabel },
        result,
        preDealbreakerScore,
        effectiveScore: result.finalScore,
        dealbreakerFailed,
        dealbreakerReasons,
        insights: buildMatchInsights(result),
        sortScore: preDealbreakerScore,
      });
    }
  }

  const pairs = greedyOneToOneMatching(candidates);
  const matchedIds = new Set<string>();
  for (const p of pairs) {
    matchedIds.add(p.userA.id);
    matchedIds.add(p.userB.id);
  }
  const unmatched = resolved.filter((u) => !matchedIds.has(u.id));

  return { pairs, unmatched, notFound, profileIncomplete, duplicateIdentifiers };
}
