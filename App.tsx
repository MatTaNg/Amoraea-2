import React, { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from './src/features/authentication/hooks/useAuth';
import { LoginScreen } from './src/app/screens/LoginScreen';
import { RegisterScreen } from './src/app/screens/RegisterScreen';
import { Stage1BasicInfoScreen } from './src/app/screens/onboarding/Stage1BasicInfoScreen';
import { InterviewFramingScreen } from './src/app/screens/onboarding/InterviewFramingScreen';
import { PostInterviewScreen } from './src/app/screens/onboarding/PostInterviewScreen';
import { UnderReviewScreen } from './src/app/screens/onboarding/UnderReviewScreen';
import { Gate2ReentryScreen } from './src/app/screens/onboarding/Gate2ReentryScreen';
import { Stage3PsychometricsScreen } from './src/app/screens/onboarding/Stage3PsychometricsScreen';
import { Stage4CompatibilityScreen } from './src/app/screens/onboarding/Stage4CompatibilityScreen';
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
import { OnboardingHeader } from './src/ui/components/OnboardingHeader';
import { ProfileRepository } from './src/data/repositories/ProfileRepository';
import { InviteCodeRepository } from './src/data/repositories/InviteCodeRepository';
import { OnboardingUseCase } from './src/domain/useCases/OnboardingUseCase';
import { AsyncStorageService } from './src/utilities/storage/AsyncStorageService';
import { supabase } from './src/data/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

const ROOT_STYLE = {
  flex: 1,
  height: '100%' as const,
  overflow: 'hidden' as const,
  backgroundColor: '#05060D',
};

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

/** Gate-based onboarding: Interview first → (when approved) Basic Info → Psychometrics → Compatibility → Complete.
 *  Skip basic info modals for now — go straight to AI interview; basic info screens remain available for later use. */
function getOnboardingInitialRoute(profile: { onboardingStage?: string; applicationStatus?: string; gate1Score?: unknown }): string {
  const stage = profile.onboardingStage ?? 'interview';
  // Only show Stage1BasicInfo after interview is passed; otherwise go straight to AI interview
  if (stage === 'basic_info') {
    if (profile.gate1Score && profile.applicationStatus === 'approved') return 'Stage1BasicInfo';
    return 'OnboardingInterview';
  }
  if (stage === 'interview') {
    if (profile.applicationStatus === 'approved') return 'Stage1BasicInfo';
    if (profile.gate1Score) return 'PostInterview';
    return 'OnboardingInterview';
  }
  if (stage === 'psychometrics') {
    if (profile.applicationStatus === 'approved') return 'Gate2Reentry';
    if (profile.applicationStatus === 'under_review') return 'UnderReview';
    return 'PostInterview';
  }
  if (stage === 'compatibility') return 'Stage4Compatibility';
  if (stage === 'complete') return 'Stage1BasicInfo'; // should not be used; main app shown
  return 'OnboardingInterview';
}

const GatesOnboardingNavigator = ({ userId }: { userId: string }) => {
  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => profileRepository.getProfile(userId),
    enabled: !!userId,
  });
  const initialRoute = useMemo(() => getOnboardingInitialRoute(profile ?? {}), [profile]);
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: true,
        header: () => <OnboardingHeader />,
        title: '',
      }}
    >
      <Stack.Screen name="Stage1BasicInfo" component={Stage1BasicInfoScreen} initialParams={{ userId }} />
      <Stack.Screen name="InterviewFraming" component={InterviewFramingScreen} initialParams={{ userId }} />
      <Stack.Screen
        name="OnboardingInterview"
        component={AriaScreen}
        initialParams={{ userId }}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="PostInterview" component={PostInterviewScreen} initialParams={{ userId }} />
      <Stack.Screen name="UnderReview" component={UnderReviewScreen} initialParams={{ userId }} />
      <Stack.Screen name="Gate2Reentry" component={Gate2ReentryScreen} initialParams={{ userId }} />
      <Stack.Screen name="Stage3Psychometrics" component={Stage3PsychometricsScreen} initialParams={{ userId }} />
      <Stack.Screen name="Stage4Compatibility" component={Stage4CompatibilityScreen} initialParams={{ userId }} />
    </Stack.Navigator>
  );
};

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

  const stage = profile.onboardingStage ?? 'interview';
  const showMainApp = stage === 'complete' || profile.profileVisible === true;

  if (!showMainApp) {
    return <GatesOnboardingNavigator userId={userId} />;
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
      <Stack.Screen
        name="Aria"
        component={AriaScreen}
        initialParams={{ userId }}
        options={{ headerShown: false }}
      />
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

/** On web (iOS Safari PWA), unlock audio on first user gesture so Aira TTS is not blocked. */
function useWebAudioUnlock() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const unlockAudio = () => {
      const AudioContext = (window as unknown as { AudioContext?: typeof globalThis.AudioContext; webkitAudioContext?: typeof globalThis.AudioContext }).AudioContext
        || (window as unknown as { webkitAudioContext?: typeof globalThis.AudioContext }).webkitAudioContext;
      if (AudioContext) {
        const ctx = new (AudioContext as new () => AudioContext)();
        ctx.resume().then(() => {});
      }
      const silentAudio = new window.Audio();
      silentAudio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAEAAQARAAAAIgAAABIAAgAQABAAAAA=';
      silentAudio.play().catch(() => {});
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('touchend', unlockAudio);
      document.removeEventListener('click', unlockAudio);
    };
    document.addEventListener('touchstart', unlockAudio, { once: true });
    document.addEventListener('touchend', unlockAudio, { once: true });
    document.addEventListener('click', unlockAudio, { once: true });
    return () => {
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('touchend', unlockAudio);
      document.removeEventListener('click', unlockAudio);
    };
  }, []);
}

export default function App() {
  useWebAudioUnlock();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.innerHTML = `
      html, body, #root {
        overflow: hidden !important;
        height: 100% !important;
        width: 100% !important;
        position: fixed !important;
        background-color: #05060D !important;
      }
      ::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
      }
      * {
        -ms-overflow-style: none !important;
        scrollbar-width: none !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <View style={ROOT_STYLE}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <RootNavigator />
        </SafeAreaProvider>
      </QueryClientProvider>
    </View>
  );
}

