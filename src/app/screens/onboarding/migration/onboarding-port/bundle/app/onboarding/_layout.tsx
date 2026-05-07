import React from "react";
import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen
        name="modals"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="break"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="assessments"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="profile-builder"
        options={{ title: "Profile Builder" }}
      />
      <Stack.Screen
        name="additional-info"
        options={{ title: "Additional Information" }}
      />
    </Stack>
  );
}
