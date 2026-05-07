import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { DatingProfileStackParamList } from "@app/navigation/DatingProfileOnboardingNavigator";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/shared/hooks/AuthProvider";
import { useProfile } from "@/shared/hooks/useProfile";
import { Button } from "@/shared/ui/Button";
import { markOnboardingCompleteForAssessments } from "@/data/services/assessmentService";
import { theme } from "@/shared/theme/theme";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: theme.colors.background,
  },
  iconContainer: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 32,
  },
  iconText: {
    fontSize: 64,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 24,
  },
  body: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
    marginBottom: 16,
  },
  meta: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  buttonBlock: {
    marginTop: 32,
  },
  breakRecommendation: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontStyle: "italic",
    marginBottom: 24,
  },
});

export function BreakScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DatingProfileStackParamList>>();
  const { user } = useAuth();
  const { profile, loading } = useProfile();

  useEffect(() => {
    if (loading) return;
    if (profile?.assessmentsCompleted) {
      navigation.replace("DatingProfileBuilder");
      return;
    }
    if (profile?.assessmentsStarted || profile?.currentAssessment) {
      const current = profile?.currentAssessment;
      if (current === "CONFLICT-30") {
        navigation.replace("DatingConflictStyle", {});
        return;
      }
      if (typeof current === "string" && current.length > 0) {
        navigation.replace("DatingInstrument", { instrument: current });
        return;
      }
      navigation.replace("DatingAssessmentIntro");
    }
  }, [
    loading,
    profile?.assessmentsCompleted,
    profile?.assessmentsStarted,
    profile?.currentAssessment,
    navigation,
  ]);

  useEffect(() => {
    if (!user?.id) return;
    if (profile?.assessmentsStarted || profile?.assessmentsCompleted || profile?.currentAssessment) return;
    markOnboardingCompleteForAssessments(user.id).catch(console.error);
  }, [user?.id, profile?.assessmentsStarted, profile?.assessmentsCompleted, profile?.currentAssessment]);

  if (loading || profile?.assessmentsStarted || profile?.assessmentsCompleted || profile?.currentAssessment) {
    return null;
  }

  const handleContinue = () => {
    navigation.replace("DatingAssessmentIntro");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.iconContainer}>
        <Text style={styles.iconText}>☕</Text>
      </View>
      <Text style={styles.title}>Your profile is complete.</Text>
      <Text style={styles.subtitle}>What's next takes focus.</Text>
      <Text style={styles.body}>
        The final step is a series of 3 short psychological assessments.
        Together they help us understand how you
        connect, communicate, and show up in relationships.
      </Text>
      <Text style={styles.body}>
        These are validated research
        instruments used in relationship psychology. Your results are private
        and used only to improve your matches.
      </Text>
      <Text style={styles.breakRecommendation}>
        We recommend taking a short break before starting, you can return
        anytime if you need to pause.
      </Text>

      <View style={styles.buttonBlock}>
        <Button
          title="Continue →"
          onPress={handleContinue}
          variant="solid"
        />
      </View>
    </SafeAreaView>
  );
}
