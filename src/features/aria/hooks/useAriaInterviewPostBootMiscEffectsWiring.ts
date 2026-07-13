import { useInterviewAttemptEgoRepair } from '@features/aria/hooks/useInterviewAttemptEgoRepair';

export type AriaInterviewPostBootMiscEffectsWiringParams = {
  egoRepair: {
    userId: string;
    isAdmin: boolean;
    typologyContext?: string;
    sourceScreen: string;
    enabled: boolean;
  };
};

/** Post-boot side effects after services sync ctx and before web TTS pre-core wiring. */
export function useAriaInterviewPostBootMiscEffectsWiring(
  params: AriaInterviewPostBootMiscEffectsWiringParams,
): void {
  useInterviewAttemptEgoRepair(params.egoRepair);
}
