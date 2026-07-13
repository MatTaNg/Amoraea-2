import { useRef, useState } from 'react';

export type ClosingQuestionPhase = 'needed' | 'asked' | 'answered';

export type AriaInterviewClosingQuestionState = {
  closingQuestionState: Record<1 | 2 | 3, ClosingQuestionPhase>;
  closingQuestionPending: boolean;
  closingQuestionScenario: 1 | 2 | 3 | null;
  closingQuestionAskedRef: React.MutableRefObject<Record<number, boolean>>;
  closingQuestionAnsweredRef: React.MutableRefObject<Record<number, boolean>>;
  lastClosingQuestionScenarioRef: React.MutableRefObject<number | null>;
  lastAnsweredClosingScenarioRef: React.MutableRefObject<number | null>;
  waitingForClosingAdditionRef: React.MutableRefObject<number | null>;
  setClosingQuestionState: React.Dispatch<
    React.SetStateAction<Record<1 | 2 | 3, ClosingQuestionPhase>>
  >;
  setClosingQuestionPending: React.Dispatch<React.SetStateAction<boolean>>;
  setClosingQuestionScenario: React.Dispatch<React.SetStateAction<1 | 2 | 3 | null>>;
};

export function useAriaInterviewClosingQuestionState(): AriaInterviewClosingQuestionState {
  const [closingQuestionState, setClosingQuestionState] = useState<
    Record<1 | 2 | 3, ClosingQuestionPhase>
  >({
    1: 'needed',
    2: 'needed',
    3: 'needed',
  });
  const [closingQuestionPending, setClosingQuestionPending] = useState(false);
  const [closingQuestionScenario, setClosingQuestionScenario] = useState<1 | 2 | 3 | null>(null);
  const closingQuestionAskedRef = useRef<Record<number, boolean>>({ 1: false, 2: false, 3: false });
  const closingQuestionAnsweredRef = useRef<Record<number, boolean>>({ 1: false, 2: false, 3: false });
  const lastClosingQuestionScenarioRef = useRef<number | null>(null);
  const lastAnsweredClosingScenarioRef = useRef<number | null>(null);
  const waitingForClosingAdditionRef = useRef<number | null>(null);

  return {
    closingQuestionState,
    closingQuestionPending,
    closingQuestionScenario,
    closingQuestionAskedRef,
    closingQuestionAnsweredRef,
    lastClosingQuestionScenarioRef,
    lastAnsweredClosingScenarioRef,
    waitingForClosingAdditionRef,
    setClosingQuestionState,
    setClosingQuestionPending,
    setClosingQuestionScenario,
  };
}

export function toAriaInterviewGateClosingQuestionRefsScope(
  state: Pick<
    AriaInterviewClosingQuestionState,
    | 'closingQuestionAskedRef'
    | 'closingQuestionAnsweredRef'
    | 'lastClosingQuestionScenarioRef'
    | 'lastAnsweredClosingScenarioRef'
    | 'waitingForClosingAdditionRef'
  >,
) {
  return {
    closingQuestionAskedRef: state.closingQuestionAskedRef,
    closingQuestionAnsweredRef: state.closingQuestionAnsweredRef,
    lastClosingQuestionScenarioRef: state.lastClosingQuestionScenarioRef,
    lastAnsweredClosingScenarioRef: state.lastAnsweredClosingScenarioRef,
    waitingForClosingAdditionRef: state.waitingForClosingAdditionRef,
  };
}

export function toPerformInterviewClosingQuestionSettersScope(
  state: Pick<
    AriaInterviewClosingQuestionState,
    'setClosingQuestionState' | 'setClosingQuestionPending' | 'setClosingQuestionScenario'
  >,
) {
  return {
    setClosingQuestionState: state.setClosingQuestionState,
    setClosingQuestionPending: state.setClosingQuestionPending,
    setClosingQuestionScenario: state.setClosingQuestionScenario,
  };
}
