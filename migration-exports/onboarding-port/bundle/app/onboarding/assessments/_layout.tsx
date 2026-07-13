import React from "react";
import { Stack } from "expo-router";

export default function AssessmentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen name="intro" options={{ title: "Assessments", headerShown: false }} />
      <Stack.Screen name="instrument" options={{ headerShown: false }} />
      <Stack.Screen name="conflict-style" options={{ headerShown: false }} />
      <Stack.Screen name="conflict-results" options={{ headerShown: false }} />
      <Stack.Screen name="insight" options={{ headerShown: false }} />
    </Stack>
  );
}
