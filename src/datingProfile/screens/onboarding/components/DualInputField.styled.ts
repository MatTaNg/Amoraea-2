import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  dualInputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
  },
  unitPicker: {
    width: 100,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
});

