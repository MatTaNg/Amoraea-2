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

const AriaScreenLazy = lazy(async () => {
  try {
    const mod = await import('./src/app/screens/AriaScreen');
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
      body: JSON.stringify({
        sessionId: 'e70f17',
        location: 'App.tsx:AriaScreenLazy',
        message: 'AriaScreen dynamic import resolved',
        data: { hasDefault: !!mod?.default },
        timestamp: Date.now(),
        hypothesisId: 'H2',
        runId: 'pre-fix',
      }),
    }).catch(() => {});
    // #endregion
    return mod;
  } catch (err) {
    const e = err as Error;
    const fallbackErrorMessage = String(e?.message ?? err);
    console.error('[ARIA_LAZY_IMPORT_FAILED]', {
      name: e?.name,
      message: fallbackErrorMessage,
      stack: e?.stack,
    });
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
      body: JSON.stringify({
        sessionId: 'e70f17',
        location: 'App.tsx:AriaScreenLazy:catch',
        message: 'AriaScreen dynamic import FAILED',
        data: {
          name: e?.name,
          msg: fallbackErrorMessage,
          stack: (e?.stack ?? '').slice(0, 4000),
        },
        timestamp: Date.now(),
        hypothesisId: 'H1',
        runId: 'pre-fix',
      }),
    }).catch(() => {});
    // #endregion
    return {
      default: function AriaUnavailable() {
        return (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#05060D', padding: 24 }}>
            <Text style={{ color: '#E8F0F8', fontSize: 16, textAlign: 'center' }}>
              Speech recognition is not available in this build. Use a development or production build (not Expo Go) for the full interview.
            </Text>
            <Text style={{ color: '#95A8BD', fontSize: 12, textAlign: 'center', marginTop: 10 }}>
              Debug: {fallbackErrorMessage}
            </Text>
          </View>
        );
      },
    };
  }
});

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
const InterviewAppNavigator = ({
  userId,
  initialRouteName,
}: {
  userId: string;
  initialRouteName: 'Aria' | 'PostInterview';
}) => (
  <Stack.Navigator
    initialRouteName={initialRouteName}
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
        header: () => <OnboardingHeader variant="dark" />,
      }}
    />
  </Stack.Navigator>
);

const AppNavigator = ({ userId }: { userId: string }) => {
  const { user } = useAuth();
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

  const isAdminEmail = (user?.email ?? '').toLowerCase() === 'admin@amoraea.com';
  /** Match `scoreInterview` handoff: standard applicants only; alpha/admin stay on Aria (thank-you / analysis). */
  const initialRouteName: 'Aria' | 'PostInterview' =
    profile.interviewCompleted && !profile.isAlphaTester && !isAdminEmail ? 'PostInterview' : 'Aria';

  return <InterviewAppNavigator userId={userId} initialRouteName={initialRouteName} />;
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
