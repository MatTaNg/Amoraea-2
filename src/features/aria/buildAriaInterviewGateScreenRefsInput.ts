import type { AriaInterviewGateScreenRefsInput } from '@features/aria/buildAriaInterviewGateScreenScopeInputFromRefs';
import {
  toAriaInterviewGateClosingQuestionRefsScope,
  type AriaInterviewClosingQuestionState,
} from '@features/aria/hooks/useAriaInterviewClosingQuestionState';

export type AriaInterviewGateScreenRefsParams = Omit<AriaInterviewGateScreenRefsInput, 'closing'> & {
  closingQuestion: Pick<
    AriaInterviewClosingQuestionState,
    | 'closingQuestionAskedRef'
    | 'closingQuestionAnsweredRef'
    | 'lastClosingQuestionScenarioRef'
    | 'lastAnsweredClosingScenarioRef'
    | 'waitingForClosingAdditionRef'
  >;
};

/** Group live gate refs for gate sync (maps closing question state to closing scope). */
export function buildAriaInterviewGateScreenRefsInput(
  params: AriaInterviewGateScreenRefsParams,
): AriaInterviewGateScreenRefsInput {
  const { closingQuestion, ...rest } = params;
  return {
    ...rest,
    closing: toAriaInterviewGateClosingQuestionRefsScope(closingQuestion),
  };
}
