import { StyleSheet } from "react-native";
import { theme } from "@/shared/theme/theme";
import { ONBOARDING_MODAL_MAX_WIDTH } from "./onboardingModalLayout";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    width: "100%",
    maxWidth: ONBOARDING_MODAL_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
    paddingBottom: 40,
  },
  lead: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  question: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 12,
    marginBottom: 14,
    lineHeight: 24,
  },
  dealbreakerQuestion: {
    fontSize: 17,
    fontWeight: "500",
    color: theme.colors.text,
    marginTop: 12,
    marginBottom: 14,
    lineHeight: 24,
  },
  dealbreakerEmphasis: {
    fontWeight: "700",
    color: theme.colors.text,
  },
  secondaryBlock: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: "rgba(82,142,220,0.18)",
    paddingTop: 24,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(82,142,220,0.25)",
    backgroundColor: "rgba(255,255,255,0.045)",
    marginBottom: 4,
  },
  rowValue: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 22,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(82,142,220,0.25)",
    backgroundColor: "rgba(255,255,255,0.045)",
    maxWidth: "100%",
  },
  chipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: "rgba(91,168,232,0.2)",
  },
  chipText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  chipTextSelected: {
    color: theme.colors.primary,
    fontWeight: "600",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(82,142,220,0.18)",
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    maxWidth: ONBOARDING_MODAL_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backBtn: { flex: 1 },
  nextBtn: { flex: 1 },
  optionRow: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  optionText: {
    fontSize: 16,
    color: theme.colors.text,
    lineHeight: 22,
  },
});
