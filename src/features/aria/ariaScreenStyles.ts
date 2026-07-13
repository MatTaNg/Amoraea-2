import { StyleSheet } from 'react-native';

import { ariaActiveInterviewStyles } from './styles/ariaActiveInterviewStyles';
import { ariaAdminInterviewStyles } from './styles/ariaAdminInterviewStyles';
import { ariaFeedbackModalStyles } from './styles/ariaFeedbackModalStyles';
import { ariaIntroLegacyStyles } from './styles/ariaIntroLegacyStyles';
import { ariaPreInterviewStyles } from './styles/ariaPreInterviewStyles';
import { ariaResultsFullScreenStyles } from './styles/ariaResultsFullScreenStyles';
import { ariaScoringResultsPanelStyles } from './styles/ariaScoringResultsPanelStyles';
import { ariaScreenShellStyles } from './styles/ariaScreenShellStyles';

export const ariaScreenStyles = StyleSheet.create({
  ...ariaScreenShellStyles,
  ...ariaPreInterviewStyles,
  ...ariaIntroLegacyStyles,
  ...ariaScoringResultsPanelStyles,
  ...ariaFeedbackModalStyles,
  ...ariaResultsFullScreenStyles,
  ...ariaActiveInterviewStyles,
  ...ariaAdminInterviewStyles,
});
