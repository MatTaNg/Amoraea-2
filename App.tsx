import React, { useEffect, Suspense, lazy } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from './src/features/authentication/hooks/useAuth';
import { LoginScreen } from './src/app/screens/LoginScreen';
import { RegisterScreen } from './src/app/screens/RegisterScreen';
import { PostInterviewScreen } from '@app/screens/onboarding/PostInterviewScreen';
import { OnboardingHeader } from './src/ui/components/OnboardingHeader';
import { ProfileRepository } from './src/data/repositories/ProfileRepository';
import { InviteCodeRepository } from './src/data/repositories/InviteCodeRepository';
import { OnboardingUseCase } from './src/domain/useCases/OnboardingUseCase';
import { AsyncStorageService } from './src/utilities/storage/AsyncStorageService';
import { supabase } from './src/data/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';

const AriaScreenLazy = lazy(() =>
  import('./src/app/screens/AriaScreen').catch(() => ({
    default: function AriaUnavailable() {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#05060D', padding: 24 }}>
          <Text style={{ color: '#E8F0F8', fontSize: 16, textAlign: 'center' }}>
            Speech recognition is not available in this build. Use a development or production build (not Expo Go) for the full interview.
          </Text>
        </View>
      );
    },
  }))
);

const AriaScreenWithSuspense = (props: { navigation: unknown; route: unknown }) => (
  <Suspense fallback={<LoadingScreen />}>
    <AriaScreenLazy {...props} />
  </Suspense>
);

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

/** Logged-in experience: AI interview only, plus PostInterview for non-admin completion handoff. */
const InterviewAppNavigator = ({ userId }: { userId: string }) => (
  <Stack.Navigator
    initialRouteName="Aria"
    screenOptions={{
      title: '',
    }}
  >
    <Stack.Screen
      name="Aria"
      component={AriaScreenWithSuspense}
      initialParams={{ userId }}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="PostInterview"
      component={PostInterviewScreen}
      initialParams={{ userId }}
      options={{
        headerShown: true,
        header: () => <OnboardingHeader />,
      }}
    />
  </Stack.Navigator>
);

const AppNavigator = ({ userId }: { userId: string }) => {
  const { data: profile, isPending } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      let p = await profileRepository.getProfile(userId);
      if (!p) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
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

  if (isPending || !profile) {
    return <LoadingScreen />;
  }

  return <InterviewAppNavigator userId={userId} />;
};

const LoadingScreen = () => (
  <View style={[ROOT_STYLE, { justifyContent: 'center', alignItems: 'center' }]}>
    <ActivityIndicator size="large" color="#7A9ABE" />
    <Text style={{ marginTop: 16, color: '#7A9ABE', fontSize: 14 }}>Loading…</Text>
  </View>
);

const RootNavigator = () => {
  const { user, loading } = useAuth();

  const isLoggedIn = user?.email != null && user.email !== '';

  useEffect(() => {
    if (isLoggedIn && user?.id) {
      import('@data/supabase/client').then(async ({ supabase }) => {
        try {
          await supabase.from('debug_logs').delete().eq('user_id', user.id);
        } catch {
          /* best-effort */
        }
      });
      import('@utilities/remoteLog').then(({ remoteLog }) => {
        remoteLog('[INIT] App logged in', { userId: user.id, email: user.email ?? null });
      });
    }
  }, [isLoggedIn, user?.id, user?.email]);

  if (loading) {
    return <LoadingScreen />;
  }

  const navTheme = {
    ...DarkTheme,
    colors: {
      primary: '#5BA8E8',
      background: '#05060D',
      card: '#05060D',
      text: '#E8F0F8',
      border: 'rgba(82,142,220,0.2)',
      notification: '#5BA8E8',
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      {isLoggedIn ? <AppNavigator userId={user!.id} /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

function useWebAudioUnlock() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const unlockAudio = () => {
      const AudioContext =
        (window as unknown as { AudioContext?: typeof globalThis.AudioContext; webkitAudioContext?: typeof globalThis.AudioContext })
          .AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof globalThis.AudioContext }).webkitAudioContext;
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
