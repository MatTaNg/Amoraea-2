/** Jungian brand-archetype ids stored on `profile_json.archetypes` (two or three when set). */
export const ARCHETYPE_IDS = [
  'innocent',
  'sage',
  'explorer',
  'lover',
  'caregiver',
  'everyman',
  'hero',
  'magician',
  'creator',
  'ruler',
  'rebel',
  'jester',
] as const;

export const MIN_PROFILE_ARCHETYPES = 2;
export const MAX_PROFILE_ARCHETYPES = 3;

export function isCompleteArchetypeSelection(count: number): boolean {
  return count >= MIN_PROFILE_ARCHETYPES && count <= MAX_PROFILE_ARCHETYPES;
}

export type ArchetypeId = (typeof ARCHETYPE_IDS)[number];

export type ArchetypeDefinition = {
  id: ArchetypeId;
  name: string;
  /** Lightweight visual marker for onboarding + edit profile cards/chips. */
  icon: string;
  descriptor: string;
};

export const ARCHETYPE_BY_ID: Record<ArchetypeId, ArchetypeDefinition> = {
  innocent: {
    id: 'innocent',
    name: 'Innocent',
    icon: '🌤️',
    descriptor: 'Optimistic, trusting, seeks goodness',
  },
  sage: {
    id: 'sage',
    name: 'Sage',
    icon: '🧠',
    descriptor: 'Truth-seeking, reflective, values wisdom',
  },
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    icon: '🧭',
    descriptor: 'Freedom-driven, adventurous, anti-conformist',
  },
  lover: {
    id: 'lover',
    name: 'Lover',
    icon: '❤️',
    descriptor: 'Passionate, intimate, values deep connection',
  },
  caregiver: {
    id: 'caregiver',
    name: 'Caregiver',
    icon: '🤝',
    descriptor: 'Nurturing, generous, service-oriented',
  },
  everyman: {
    id: 'everyman',
    name: 'Everyman',
    icon: '🏡',
    descriptor: 'Genuine, unpretentious, seeks belonging',
  },
  hero: {
    id: 'hero',
    name: 'Hero',
    icon: '🛡️',
    descriptor: 'Driven, courageous, loves challenge',
  },
  magician: {
    id: 'magician',
    name: 'Magician',
    icon: '✨',
    descriptor: 'Transformative, visionary, sees hidden patterns',
  },
  creator: {
    id: 'creator',
    name: 'Creator',
    icon: '🎨',
    descriptor: 'Expressive, imaginative, builds meaning',
  },
  ruler: {
    id: 'ruler',
    name: 'Ruler',
    icon: '👑',
    descriptor: 'Commanding, responsible, natural leader',
  },
  rebel: {
    id: 'rebel',
    name: 'Rebel',
    icon: '⚡',
    descriptor: 'Iconoclastic, questions everything, fierce autonomy',
  },
  jester: {
    id: 'jester',
    name: 'Jester',
    icon: '🎭',
    descriptor: 'Playful, spontaneous, finds joy in the moment',
  },
};

export const ARCHETYPE_CATEGORIES: {
  title: string;
  archetypeIds: readonly ArchetypeId[];
}[] = [
  {
    title: 'Meaning / Structure',
    archetypeIds: ['innocent', 'sage', 'explorer'],
  },
  {
    title: 'Belonging / Connection',
    archetypeIds: ['lover', 'caregiver', 'everyman'],
  },
  {
    title: 'Mastery / Achievement',
    archetypeIds: ['hero', 'magician', 'creator'],
  },
  {
    title: 'Independence / Disruption',
    archetypeIds: ['ruler', 'rebel', 'jester'],
  },
];

const ARCHETYPE_ID_SET = new Set<string>(ARCHETYPE_IDS);

export function isArchetypeId(value: string): value is ArchetypeId {
  return ARCHETYPE_ID_SET.has(value);
}

/** Map stored label or id (any casing) to canonical id. */
export function archetypeIdFromStored(value: string): ArchetypeId | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '');
  if (isArchetypeId(normalized)) return normalized;
  for (const id of ARCHETYPE_IDS) {
    if (ARCHETYPE_BY_ID[id].name.toLowerCase() === value.trim().toLowerCase()) {
      return id;
    }
  }
  return null;
}

/** Read `archetypes` from merged profile JSON (max three, stable order). */
export function normalizeArchetypesFromProfile(raw: unknown): ArchetypeId[] {
  if (!Array.isArray(raw)) return [];
  const out: ArchetypeId[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const id = archetypeIdFromStored(item);
    if (!id || out.includes(id)) continue;
    out.push(id);
    if (out.length >= MAX_PROFILE_ARCHETYPES) break;
  }
  return out;
}

export function archetypeDisplayNames(ids: ArchetypeId[]): string[] {
  return ids.map((id) => ARCHETYPE_BY_ID[id].name);
}
