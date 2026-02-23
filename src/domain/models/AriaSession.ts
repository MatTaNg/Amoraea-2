export type AriaPillarId =
  | 'conflict_regulation_repair'
  | 'attachment_threat'
  | 'accountability_growth'
  | 'reliability_under_inconvenience'
  | 'responsiveness_to_bids'
  | 'desire_mismatch_boundaries';

export interface AriaAnswerRecord {
  pillarId: AriaPillarId;
  usedFallback: boolean;
  answer: string;
}

export interface AriaSession {
  id: string;
  profileId: string;
  answers: AriaAnswerRecord[];
  createdAt: string;
  updatedAt: string;
}
