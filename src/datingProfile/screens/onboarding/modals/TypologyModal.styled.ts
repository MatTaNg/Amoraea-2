import { StyleSheet } from "react-native";
import { theme } from "@/shared/theme/theme";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    padding: 24,
  },
  description: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 18,
    lineHeight: 20,
  },
  optionalNote: {
    fontSize: 13,
    color: theme.colors.text2,
    marginBottom: 18,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 8,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginBottom: 6,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    marginBottom: 12,
    overflow: "hidden",
  },
  picker: {
    color: theme.colors.text,
    height: 50,
    backgroundColor: theme.colors.surface,
  },
  buttonContainer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: { flex: 1 },
  nextButton: { flex: 1 },
});
