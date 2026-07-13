import type { MutableRefObject } from 'react';

export type ProcessTurnAudioWithRetryDeps = {
  userId: string;
  interviewSessionIdRef: MutableRefObject<string>;
  supabaseAnonKey: string;
  getResolvedSupabaseUrl: () => string | null | undefined;
  bytesToBase64: (arr: Uint8Array) => string;
  deleteTurnAudioFile: (nativeUri: string | null) => Promise<void>;
};

export type ProcessTurnAudioParams = {
  audioBlob: Blob | null;
  nativeUri: string | null;
  turnIndex: number;
  scenarioNumber: number | null;
};
