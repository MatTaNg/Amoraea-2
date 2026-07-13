import type { GateResult } from '@features/aria/computeGateResult';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';

export type SaveInterviewResultsParams = {
  results: InterviewResults;
  gateResult: GateResult;
  uid: string;
};
