import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { styles } from '../LifeDomainQuestionsModal.styled';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
};

export function LifeDomainQuestionSuggestionBlock({ value, onChangeText }: Props) {
  return (
    <View style={styles.questionSuggestionBlock}>
      <Text style={styles.questionText}>Do you have a question suggestion?</Text>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChangeText}
        placeholder="Suggest a question we could ask here (optional)"
        placeholderTextColor="rgba(123,154,190,0.65)"
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}
