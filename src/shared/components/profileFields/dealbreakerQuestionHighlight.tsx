import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { DEALBREAKER_QUESTION_HIGHLIGHT_PHRASE } from '@/shared/constants/dealbreakerQuestionCopy';

export function renderDealbreakerQuestionHighlight(
  text: string,
  emphasisStyle: StyleProp<TextStyle>,
): React.ReactNode {
  const phrase = DEALBREAKER_QUESTION_HIGHLIGHT_PHRASE;
  const index = text.toLowerCase().indexOf(phrase);
  if (index < 0) return text;

  return (
    <>
      {text.slice(0, index)}
      <Text style={emphasisStyle}>{text.slice(index, index + phrase.length)}</Text>
      {text.slice(index + phrase.length)}
    </>
  );
}
