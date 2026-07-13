import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

/** Route params accepted by the interview screen across main and validation stacks. */
export type AriaInterviewScreenParams = {
  userId?: string;
  fromValidationTrack?: boolean;
  openAdminPanel?: boolean;
  onComplete?: (results: unknown) => void;
};

export type AriaInterviewScreenRouteName = 'Amoraea' | 'OnboardingInterview' | 'ValidationAmoraea';

export type AriaInterviewScreenParamList = {
  Amoraea: AriaInterviewScreenParams;
  OnboardingInterview: AriaInterviewScreenParams;
  ValidationAmoraea: AriaInterviewScreenParams & { fromValidationTrack?: true };
};

export type AriaInterviewScreenNavigationProp = NativeStackNavigationProp<
  AriaInterviewScreenParamList,
  AriaInterviewScreenRouteName
>;

export type AriaInterviewScreenRouteProp = RouteProp<
  AriaInterviewScreenParamList,
  AriaInterviewScreenRouteName
>;

/** Navigation may be wrapped (e.g. validation stack); route params stay canonical. */
export type AriaInterviewScreenProps = {
  navigation: AriaInterviewScreenNavigationProp | Record<string, unknown>;
  route: AriaInterviewScreenRouteProp | { name?: string; params?: AriaInterviewScreenParams };
};

export type AriaInterviewScreenSetupInput = {
  navigation: AriaInterviewScreenProps['navigation'];
  route: {
    name?: string;
    params?: AriaInterviewScreenParams;
  };
};
