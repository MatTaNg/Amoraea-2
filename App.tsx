import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from './src/features/authentication/hooks/useAuth';
import { LoginScreen } from './src/app/screens/LoginScreen';
import { RegisterScreen } from './src/app/screens/RegisterScreen';
import { OnboardingNameScreen } from './src/app/screens/onboarding/OnboardingNameScreen';
import { OnboardingAgeScreen } from './src/app/screens/onboarding/OnboardingAgeScreen';
import { OnboardingGenderScreen } from './src/app/screens/onboarding/OnboardingGenderScreen';
import { OnboardingAttractedToScreen } from './src/app/screens/onboarding/OnboardingAttractedToScreen';
import { OnboardingHeightScreen } from './src/app/screens/onboarding/OnboardingHeightScreen';
import { OnboardingOccupationScreen } from './src/app/screens/onboarding/OnboardingOccupationScreen';
import { OnboardingLocationScreen } from './src/app/screens/onboarding/OnboardingLocationScreen';
import { OnboardingPhotosScreen } from './src/app/screens/onboarding/OnboardingPhotosScreen';
import { HomeScreen } from './src/app/screens/HomeScreen';
import { TypologyDetailScreen } from './src/app/screens/TypologyDetailScreen';
import { CompatibilityScreen } from './src/app/screens/CompatibilityScreen';
import { EditProfileScreen } from './src/app/screens/EditProfileScreen';
import { ContactsScreen } from './src/app/screens/ContactsScreen';
import { HumanDesignScreen } from './src/app/screens/HumanDesignScreen';
import { AriaScreen } from './src/app/screens/AriaScreen';
import { FullAssessmentScreen } from './src/app/screens/FullAssessmentScreen';
import { AppHeader } from './src/ui/components/AppHeader';
import { ProfileRepository } from './src/data/repositories/ProfileRepository';
import { InviteCodeRepository } from './src/data/repositories/InviteCodeRepository';
import { OnboardingUseCase } from './src/domain/useCases/OnboardingUseCase';
import { AsyncStorageService } from './src/utilities/storage/AsyncStorageService';
import { supabase } from './src/data/supabase/client';
import { useQuery } from '@tanstack/react-query';

const Stack = createNativeStackNavigator();
const queryClient = new QueryClient();

const profileRepository = new ProfileRepository();
const inviteCodeRepository = new InviteCodeRepository();
const storageService = new AsyncStorageService();
const onboardingUseCase = new OnboardingUseCase(profileRepository, storageService);

const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </Stack.Navigator>
);

const OnboardingNavigator = ({ userId }: { userId: string }) => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="OnboardingName">
      {(props) => <OnboardingNameScreen {...props} userId={userId} />}
    </Stack.Screen>
    <Stack.Screen name="OnboardingAge">
      {(props) => <OnboardingAgeScreen {...props} userId={userId} />}
    </Stack.Screen>
    <Stack.Screen name="OnboardingGender">
      {(props) => <OnboardingGenderScreen {...props} userId={userId} />}
    </Stack.Screen>
    <Stack.Screen name="OnboardingAttractedTo">
      {(props) => <OnboardingAttractedToScreen {...props} userId={userId} />}
    </Stack.Screen>
    <Stack.Screen name="OnboardingHeight">
      {(props) => <OnboardingHeightScreen {...props} userId={userId} />}
    </Stack.Screen>
    <Stack.Screen name="OnboardingOccupation">
      {(props) => <OnboardingOccupationScreen {...props} userId={userId} />}
    </Stack.Screen>
    <Stack.Screen name="OnboardingLocation">
      {(props) => <OnboardingLocationScreen {...props} userId={userId} />}
    </Stack.Screen>
    <Stack.Screen name="OnboardingPhotos">
      {(props) => <OnboardingPhotosScreen {...props} userId={userId} />}
    </Stack.Screen>
  </Stack.Navigator>
);

const AppNavigator = ({ userId }: { userId: string }) => {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      let p = await profileRepository.getProfile(userId);
      if (!p) {
        const { data: { session } } = await supabase.auth.getSession();
        const metadata = session?.user?.user_metadata as { referral_code?: string } | undefined;
        await inviteCodeRepository.ensureUserWithInviteCode(userId, {
          email: session?.user?.email ?? undefined,
          referralCode: metadata?.referral_code,
        });
        p = await profileRepository.getProfile(userId);
      }
      return p ?? null;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (userId) {
      onboardingUseCase.retryFailedUpdates();
    }
  }, [userId]);

  if (isLoading || !profile) {
    return null; // Loading state
  }

  if (!profile.onboardingCompleted) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="OnboardingName">
          {(props) => <OnboardingNameScreen {...props} userId={userId} />}
        </Stack.Screen>
        <Stack.Screen name="OnboardingAge">
          {(props) => <OnboardingAgeScreen {...props} userId={userId} />}
        </Stack.Screen>
        <Stack.Screen name="OnboardingGender">
          {(props) => <OnboardingGenderScreen {...props} userId={userId} />}
        </Stack.Screen>
        <Stack.Screen name="OnboardingAttractedTo">
          {(props) => <OnboardingAttractedToScreen {...props} userId={userId} />}
        </Stack.Screen>
        <Stack.Screen name="OnboardingHeight">
          {(props) => <OnboardingHeightScreen {...props} userId={userId} />}
        </Stack.Screen>
        <Stack.Screen name="OnboardingOccupation">
          {(props) => <OnboardingOccupationScreen {...props} userId={userId} />}
        </Stack.Screen>
        <Stack.Screen name="OnboardingLocation">
          {(props) => <OnboardingLocationScreen {...props} userId={userId} />}
        </Stack.Screen>
        <Stack.Screen name="OnboardingPhotos">
          {(props) => <OnboardingPhotosScreen {...props} userId={userId} />}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        header: () => <AppHeader />,
        headerShown: true,
        title: '',
      }}
    >
      <Stack.Screen name="Home">
        {(props) => <HomeScreen {...props} userId={userId} />}
      </Stack.Screen>
      <Stack.Screen name="TypologyDetail" component={TypologyDetailScreen} />
      <Stack.Screen name="Compatibility" component={CompatibilityScreen} />
      <Stack.Screen name="FullAssessment" component={FullAssessmentScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Contacts" component={ContactsScreen} />
      <Stack.Screen name="HumanDesign" component={HumanDesignScreen} />
      <Stack.Screen name="Aria" component={AriaScreen} />
    </Stack.Navigator>
  );
};

const RootNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return null; // Or a loading screen
  }

  // Only show app/onboarding when user has a real session with email (signed in or signed up)
  const isLoggedIn = user?.email != null && user.email !== '';

  return (
    <NavigationContainer>
      {isLoggedIn ? <AppNavigator userId={user!.id} /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RootNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

