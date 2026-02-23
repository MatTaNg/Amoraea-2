/** Form data schemas for typology inputs stored in typology_data JSONB */

export interface BigFiveFormData {
  openness: number | null;
  conscientiousness: number | null;
  extraversion: number | null;
  agreeableness: number | null;
  neuroticism: number | null;
}

export interface AttachmentFormData {
  avoidant: number | null;
  anxious: number | null;
}

export type SchwartzValueKey =
  | 'universalism'
  | 'benevolence'
  | 'tradition'
  | 'conformity'
  | 'security'
  | 'power'
  | 'achievement'
  | 'hedonism'
  | 'stimulation'
  | 'self_direction';

export interface SchwartzFormData {
  universalism: number | null;
  benevolence: number | null;
  tradition: number | null;
  conformity: number | null;
  security: number | null;
  power: number | null;
  achievement: number | null;
  hedonism: number | null;
  stimulation: number | null;
  self_direction: number | null;
}

export const SCHWARTZ_VALUE_LABELS: Record<SchwartzValueKey, { title: string; description: string }> = {
  universalism: {
    title: 'Universalism',
    description:
      'A deep concern for the well-being of all people and the planet. Driven by a desire to protect life, fairness, and the world we share.',
  },
  benevolence: {
    title: 'Benevolence',
    description:
      'A strong commitment to caring for, supporting, and protecting the people closest to you.',
  },
  tradition: {
    title: 'Tradition',
    description:
      'Respect for inherited customs, values, and ways of life passed down through generations.',
  },
  conformity: {
    title: 'Conformity',
    description:
      'The choice to restrain impulses and desires in order to maintain social harmony and avoid harming others.',
  },
  security: {
    title: 'Security',
    description: 'A need for stability, safety, and peace within yourself, your relationships, and society.',
  },
  power: {
    title: 'Power',
    description: 'A drive to influence, lead, and control resources or people.',
  },
  achievement: {
    title: 'Achievement',
    description: 'The pursuit of excellence, success, and recognition for meaningful accomplishments.',
  },
  hedonism: {
    title: 'Hedonism',
    description: 'A desire to experience pleasure, joy, and enjoyment in life.',
  },
  stimulation: {
    title: 'Stimulation',
    description: 'A craving for excitement, adventure, and intense experiences.',
  },
  self_direction: {
    title: 'Self-Direction',
    description: 'The drive to define your own path, make independent choices, and shape your own life.',
  },
};
