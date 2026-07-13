import { useAriaInterviewScreenElement } from '@features/aria/hooks/useAriaInterviewScreenSetup';
import type { AriaInterviewScreenProps } from '@features/aria/ariaInterviewScreenTypes';

export type {
  AriaInterviewScreenNavigationProp,
  AriaInterviewScreenParamList,
  AriaInterviewScreenParams,
  AriaInterviewScreenProps,
  AriaInterviewScreenRouteName,
  AriaInterviewScreenRouteProp,
} from '@features/aria/ariaInterviewScreenTypes';

export function AriaInterviewScreen(props: AriaInterviewScreenProps) {  return useAriaInterviewScreenElement(props);
}

export default AriaInterviewScreen;
