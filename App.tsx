import React, { useCallback, useEffect, useState, Suspense, lazy, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import {
  NavigationContainer,
  DarkTheme,
  getStateFromPath as getStateFromPathDefault,
  type LinkingOptions,
  type NavigationState,
} from '@react-navigation/native';
import * as ExpoLinking from 'expo-linking';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from './src/features/authentication/hooks/useAuth';
import { LoginScreen } from './src/app/screens/LoginScreen';
import { RegisterScreen } from './src/app/screens/RegisterScreen';
import { ForgotPasswordScreen } from './src/app/screens/ForgotPasswordScreen';
import { SetNewPasswordScreen } from './src/app/screens/SetNewPasswordScreen';
import { PostInterviewLaunchScreen } from '@app/screens/onboarding/PostInterviewLaunchScreen';
import { PostInterviewScreen } from '@app/screens/onboarding/PostInterviewScreen';
import { PostInterviewPassedScreen } from '@app/screens/onboarding/PostInterviewPassedScreen';
import { PostInterviewFailedScreen } from '@app/screens/onboarding/PostInterviewFailedScreen';
import { DatingProfileOnboardingNavigator } from '@app/navigation/DatingProfileOnboardingNavigator';
import { DatingProfileEditScreen } from '@app/screens/DatingProfileEditScreen';
import { PostInterviewProcessingScreen } from '@app/screens/onboarding/PostInterviewProcessingScreen';
import { PostInterviewSexualCommunicationScreen } from '@app/screens/onboarding/PostInterviewSexualCommunicationScreen';
import { POST_INTERVIEW_BG } from '@app/screens/onboarding/PostInterviewScrollLayout';
import { PsychometricAssessmentScreen } from '@app/screens/PsychometricAssessmentScreen';
import { PsychometricsCompleteScreen } from '@app/screens/PsychometricsCompleteScreen';
import { InterviewCompleteScreen } from '@features/onboarding/screens/InterviewCompleteScreen';
import { AssessmentWelcomeScreen } from '@features/onboarding/screens/AssessmentWelcomeScreen';
import {
  AUTH_EMAIL_CONFIRM_PATH,
  AUTH_PASSWORD_RESET_PATH,
  isAuthEmailConfirmPath,
  isAuthPasswordResetPath,
  isBarePasswordResetLanding,
  isEmailConfirmationCallback,
} from '@features/authentication/webAuthRecoveryRouting';
import { isAmoraeaAdminConsoleEmail } from '@/constants/adminConsole';
import {
  fetchInterviewAttemptRevealSnapshot,
  fetchUserInterviewRevealPollRow,
} from '@utilities/fetchInterviewAttemptRevealSnapshot';
import {
  resolveInterviewStackBootstrap,
  shouldFetchPostInterviewDeferralSnapshot,
} from '@features/psychometrics/resolveInterviewStackBootstrap';
import { shouldRedirectWebPathToPreferredRoute } from '@features/onboarding/interviewStackWebLinking';
import {
  isLaunchWaitlistPostInterviewModeEnabled,
} from '@features/onboarding/postInterviewLaunchMode';
import {
  resolveInitialInterviewRoute,
  type InterviewStackRoute,
} from '@features/psychometrics/resolveInitialInterviewRoute';
import { storedInterviewHasResumableScenarioProgress } from '@utilities/interviewResumeCursor';
import { loadInterviewFromStorage } from '@utilities/storage/InterviewStorage';
import { hydrateUserEnteredInterviewFlowFromStorage } from '@utilities/interviewEntryLock';
import { OnboardingHeader } from './src/ui/components/OnboardingHeader';
import { ProfileRepository } from './src/data/repositories/ProfileRepository';
import { InviteCodeRepository } from './src/data/repositories/InviteCodeRepository';
import { OnboardingUseCase } from './src/domain/useCases/OnboardingUseCase';
import { AsyncStorageService } from './src/utilities/storage/AsyncStorageService';
import { supabase } from './src/data/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MarketResearchModal } from '@features/onboarding/MarketResearchModal';
import {
  MarketResearchCompletionProvider,
  useMarketResearchCompletion,
} from '@features/referrals/MarketResearchCompletionContext';
import {
  ReferralCodeIntroShell,
  isReferralCodeIntroSuppressedRoute,
  resolveActiveNavigationRouteName,
} from '@features/referrals/ReferralCodeIntroShell';
import { ReferralCompletionCongratulationsShell } from '@features/referrals/ReferralCompletionCongratulationsShell';
import { RelationshipValidationNavigator } from '@app/navigation/RelationshipValidationNavigator';
import { fetchValidationShellRouting } from '@features/relationshipValidation/relationshipValidationRepo';
import {
  clearValidationStandardReturnRoute,
  readValidationStandardReturnRoute,
  shouldUseRelationshipValidationNavigator,
} from '@features/relationshipValidation/validationShellRouting';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import {
  initAudosFromEnv,
  syncAudosIdentifyFromSupabaseUser,
} from '@/integrations/audos';

const AriaScreenLazy = lazy(async () => {
  try {
    const mod = await import('@features/aria/screens/AriaInterviewScreen');
    return mod;
  } catch (err) {
    const e = err as Error;
    const fallbackErrorMessage = String(e?.message ?? err);
    console.error('[ARIA_LAZY_IMPORT_FAILED]', {
      name: e?.name,
      message: fallbackErrorMessage,
      stack: e?.stack,
    });
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

const AriaScreenWithSuspense = (props: React.ComponentProps<typeof AriaScreenLazy>) => (
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

const AuthNavigator = ({ initialRouteName = 'Login' }: { initialRouteName?: string }) => (
  <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    <Stack.Screen name="SetNewPassword" component={SetNewPasswordScreen} />
  </Stack.Navigator>
);

const POST_INTERVIEW_STACK_SCREEN_OPTIONS = {
  headerShown: true,
  header: () => <OnboardingHeader variant="dark" />,
  contentStyle: { flex: 1, backgroundColor: POST_INTERVIEW_BG },
} as const;

/** Logged-in experience: AI interview only, plus PostInterview for non-admin completion handoff. */
const InterviewAppNavigator = ({
  userId,
  initialRouteName,
  interviewAlreadyCompleted,
  legacyPsychometricsMode,
  needsMarketResearch,
}: {
  userId: string;
  initialRouteName: InterviewStackRoute;
  interviewAlreadyCompleted: boolean;
  legacyPsychometricsMode: boolean;
  needsMarketResearch: boolean;
}) => (
  <Stack.Navigator
    key={userId}
    initialRouteName={initialRouteName}
    screenOptions={{
      title: '',
    }}
  >
    <Stack.Screen
      name="AssessmentWelcome"
      component={AssessmentWelcomeScreen as unknown as React.ComponentType<Record<string, never>>}
      initialParams={{ userId, needsMarketResearch }}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="InterviewComplete"
      component={InterviewCompleteScreen as unknown as React.ComponentType<Record<string, never>>}
      initialParams={{ userId }}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="PsychometricAssessment"
      component={PsychometricAssessmentScreen as unknown as React.ComponentType<Record<string, never>>}
      initialParams={{
        userId,
        interviewAlreadyCompleted,
        legacyPsychometricsMode,
        needsMarketResearch,
      }}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="PsychometricsComplete"
      component={PsychometricsCompleteScreen as unknown as React.ComponentType<Record<string, never>>}
      initialParams={{ userId }}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="Amoraea"
      component={AriaScreenWithSuspense}
      initialParams={{ userId }}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="PostInterviewLaunch"
      component={PostInterviewLaunchScreen as unknown as React.ComponentType<Record<string, never>>}
      initialParams={{ userId }}
      options={POST_INTERVIEW_STACK_SCREEN_OPTIONS}
    />
    <Stack.Screen
      name="PostInterview"
      component={PostInterviewScreen as unknown as React.ComponentType<Record<string, never>>}
      initialParams={{ userId }}
      options={POST_INTERVIEW_STACK_SCREEN_OPTIONS}
    />
    <Stack.Screen
      name="PostInterviewProcessing"
      component={PostInterviewProcessingScreen as unknown as React.ComponentType<Record<string, never>>}
      initialParams={{ userId }}
      options={POST_INTERVIEW_STACK_SCREEN_OPTIONS}
    />
    <Stack.Screen
      name="PostInterviewPassed"
      component={PostInterviewPassedScreen as unknown as React.ComponentType<Record<string, never>>}
      initialParams={{ userId }}
      options={POST_INTERVIEW_STACK_SCREEN_OPTIONS}
    />
    <Stack.Screen
      name="PostInterviewFailed"
      component={PostInterviewFailedScreen as unknown as React.ComponentType<Record<string, never>>}
      initialParams={{ userId }}
      options={POST_INTERVIEW_STACK_SCREEN_OPTIONS}
    />
    <Stack.Screen
      name="PostInterviewSexualCommunication"
      component={PostInterviewSexualCommunicationScreen as unknown as React.ComponentType<Record<string, never>>}
      initialParams={{ userId }}
      options={POST_INTERVIEW_STACK_SCREEN_OPTIONS}
    />
    <Stack.Screen name="DatingProfileOnboarding" options={{ headerShown: false }}>
      {(props) => (
        <DatingProfileOnboardingNavigator
          userId={(props.route.params as { userId?: string } | undefined)?.userId ?? userId}
        />
      )}
    </Stack.Screen>
    <Stack.Screen
      name="DatingProfileEdit"
      component={DatingProfileEditScreen as unknown as React.ComponentType<Record<string, never>>}
      initialParams={{ userId }}
      options={{ headerShown: true }}
    />
  </Stack.Navigator>
);

async function fetchStandardPostInterviewDeferralSnapshot(userId: string) {
  const [snap, userRow] = await Promise.all([
    fetchInterviewAttemptRevealSnapshot(userId),
    fetchUserInterviewRevealPollRow(userId),
  ]);
  return { snap, userRow };
}


function isTerminalPostInterviewRoute(
  route: InterviewStackRoute | null | undefined,
): route is 'PostInterviewPassed' | 'PostInterviewFailed' | 'PostInterviewLaunch' {
  if (route === 'PostInterviewLaunch') return true;
  if (isLaunchWaitlistPostInterviewModeEnabled()) return false;
  return route === 'PostInterviewPassed' || route === 'PostInterviewFailed';
}

function buildInterviewStackInitialState(
  initialRouteName: InterviewStackRoute,
  userId: string,
  interviewAlreadyCompleted: boolean,
  legacyPsychometricsMode: boolean,
  needsMarketResearch: boolean,
): NavigationState {
  const params =
    initialRouteName === 'PsychometricAssessment'
      ? { userId, interviewAlreadyCompleted, legacyPsychometricsMode, needsMarketResearch }
      : initialRouteName === 'AssessmentWelcome'
        ? { userId, needsMarketResearch }
        : { userId };
  return {
    stale: false,
    type: 'stack',
    key: `interview-stack-${userId}`,
    index: 0,
    routeNames: [
      'AssessmentWelcome',
      'InterviewComplete',
      'PsychometricAssessment',
      'PsychometricsComplete',
      'Amoraea',
      'PostInterview',
      'PostInterviewLaunch',
      'PostInterviewProcessing',
      'PostInterviewPassed',
      'PostInterviewFailed',
      'PostInterviewSexualCommunication',
      'DatingProfileOnboarding',
      'DatingProfileEdit',
    ],
    routes: [{ key: `${initialRouteName}-0`, name: initialRouteName, params }],
  } as NavigationState;
}

function createInterviewStackLinking(
  preferredRoute: InterviewStackRoute | undefined,
): LinkingOptions<Record<string, unknown>> | undefined {
  if (Platform.OS !== 'web') {
    return undefined;
  }
  const prefixes = [
    ...(typeof window !== 'undefined' ? [`${window.location.protocol}//${window.location.host}`] : []),
    ExpoLinking.createURL('/'),
  ];
  return {
    prefixes,
    config: { screens: INTERVIEW_STACK_LINKING_SCREENS as Record<string, string | Record<string, unknown>> },
    getStateFromPath(path: string, options: Parameters<typeof getStateFromPathDefault>[1]) {
      const mapped = mapInterviewStackPath(path);
      if (preferredRoute && shouldRedirectWebPathToPreferredRoute(path, preferredRoute)) {
        const preferredPath = INTERVIEW_STACK_ROUTE_PATH[preferredRoute];
        return getStateFromPathDefault(preferredPath, options);
      }
      return getStateFromPathDefault(mapped, options);
    },
  };
}

type LoggedInInterviewShellReadyProps = {
  userId: string;
  needsMarketResearch: boolean;
  initialRouteName: InterviewStackRoute;
  interviewAlreadyCompleted: boolean;
  legacyPsychometricsMode: boolean;
  navInitialState: NavigationState | undefined;
  showMarketResearchOverlay: boolean;
  onMarketResearchDismissed: () => void;
};

function LoggedInInterviewShellReady({
  userId,
  needsMarketResearch,
  initialRouteName,
  interviewAlreadyCompleted,
  legacyPsychometricsMode,
  navInitialState,
  showMarketResearchOverlay,
  onMarketResearchDismissed,
}: LoggedInInterviewShellReadyProps) {
  const { notifyMarketResearchComplete, marketResearchComplete } = useMarketResearchCompletion();
  const [activeRouteName, setActiveRouteName] = useState<string | undefined>(initialRouteName);
  const [navigationState, setNavigationState] = useState<NavigationState | undefined>(navInitialState);
  const frozenNavInitialStateRef = useRef(navInitialState);
  const interviewLinking = useMemo(
    () => createInterviewStackLinking(initialRouteName),
    [initialRouteName],
  );

  useEffect(() => {
    setActiveRouteName(initialRouteName);
  }, [initialRouteName]);

  const handleNavigationStateChange = useCallback(
    (state: NavigationState | undefined) => {
      setNavigationState(state);
      setActiveRouteName(resolveActiveNavigationRouteName(state) ?? initialRouteName);
    },
    [initialRouteName],
  );

  useEffect(() => {
    if (!needsMarketResearch) {
      notifyMarketResearchComplete();
    }
  }, [needsMarketResearch, notifyMarketResearchComplete]);

  const onMarketResearchComplete = useCallback(() => {
    notifyMarketResearchComplete();
    onMarketResearchDismissed();
  }, [notifyMarketResearchComplete, onMarketResearchDismissed]);

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
    <NavigationContainer
      theme={navTheme}
      linking={interviewLinking}
      initialState={frozenNavInitialStateRef.current}
      onStateChange={handleNavigationStateChange}
    >
      <View style={ROOT_STYLE}>
        <InterviewAppNavigator
          userId={userId}
          initialRouteName={initialRouteName}
          interviewAlreadyCompleted={interviewAlreadyCompleted}
          legacyPsychometricsMode={legacyPsychometricsMode}
          needsMarketResearch={needsMarketResearch}
        />
        {showMarketResearchOverlay ? (
          <MarketResearchModal visible userId={userId} onComplete={onMarketResearchComplete} />
        ) : null}
        <ReferralCodeIntroShell
          userId={userId}
          marketResearchComplete={marketResearchComplete}
          suppressReferralIntro={isReferralCodeIntroSuppressedRoute(activeRouteName, navigationState)}
        />
        <ReferralCompletionCongratulationsShell userId={userId} />
      </View>
    </NavigationContainer>
  );
}

const LoggedInInterviewShell = ({ userId }: { userId: string }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const lockedPostInterviewRouteRef = useRef<InterviewStackRoute | null>(null);
  const interviewShellBootstrappedRef = useRef(false);
  const lastResolvedInterviewStackRef = useRef<{
    initialRouteName: InterviewStackRoute;
    interviewAlreadyCompleted: boolean;
    legacyPsychometricsMode: boolean;
    needsMarketResearch: boolean;
    navInitialState: NavigationState;
  } | null>(null);
  const [validationReturnRoute] = useState(() => readValidationStandardReturnRoute(queryClient, userId));
  const [marketResearchDismissed, setMarketResearchDismissed] = useState(false);
  const { data: userEnteredInterviewFlow = false, isLoading: interviewEntryLockLoading } = useQuery({
    queryKey: ['interviewEntryLock', userId],
    queryFn: () => hydrateUserEnteredInterviewFlowFromStorage(userId),
    enabled: !!userId,
    staleTime: Infinity,
  });

  const { data: profile, isPending: profilePending, isError } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      let p = await profileRepository.getProfile(userId);
      if (!p) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const metadata = session?.user?.user_metadata as
          | { referral_code?: string; age?: number; gender?: 'Man' | 'Woman' | 'Non-binary' }
          | undefined;
        await inviteCodeRepository.ensureUserWithInviteCode(userId, {
          email: session?.user?.email ?? undefined,
          referralCode: metadata?.referral_code,
          age: typeof metadata?.age === 'number' ? metadata.age : undefined,
          gender: metadata?.gender,
        });
        p = await profileRepository.getProfile(userId);
      }
      return p ?? null;
    },
    enabled: !!userId,
    retry: false,
  });

  const isAdminEmail = isAmoraeaAdminConsoleEmail(user?.email);

  const profileShowsStandardInterviewComplete =
    profile?.interviewCompleted === true && !isAdminEmail;

  /** Wait until `ensureUserWithInviteCode` has created the `users` row before routing (avoids missing market research on first login). */
  const profileBootstrapped = !!profile && !profilePending && !isError;

  const { data: initialRoute, isLoading: initialRouteLoading } = useQuery({
    queryKey: ['initialInterviewRoute', userId],
    queryFn: () => resolveInitialInterviewRoute(userId),
    enabled: !!userId && profileBootstrapped,
    staleTime: 0,
  });

  const needsPostInterviewDeferralSnapshot = shouldFetchPostInterviewDeferralSnapshot(
    initialRoute,
    profileShowsStandardInterviewComplete,
  );

  const { data: deferralAttempt, isLoading: deferralLoading } = useQuery({
    queryKey: ['standardPostInterviewDeferral', userId],
    queryFn: () => fetchStandardPostInterviewDeferralSnapshot(userId),
    enabled: !!userId && needsPostInterviewDeferralSnapshot,
    staleTime: 0,
  });

  const serverRoutesToAssessmentWelcome =
    initialRoute?.screen === 'AssessmentWelcome' && !profileShowsStandardInterviewComplete;

  const { data: localResumableInterviewProgress, isLoading: localResumeLoading } = useQuery({
    queryKey: ['localInterviewResume', userId],
    queryFn: async () => {
      const saved = await loadInterviewFromStorage(userId);
      if (saved == null) return false;
      return storedInterviewHasResumableScenarioProgress({
        messages: saved.messages,
        scenariosCompleted: saved.scenariosCompleted,
        scenarioScores: saved.scenarioScores,
        resumeActiveScenario: saved.resumeActiveScenario,
        currentScenario: saved.currentScenario ?? undefined,
      });
    },
    enabled: !!userId && profileBootstrapped && serverRoutesToAssessmentWelcome,
    staleTime: 0,
  });

  useEffect(() => {
    lockedPostInterviewRouteRef.current = null;
    interviewShellBootstrappedRef.current = false;
    lastResolvedInterviewStackRef.current = null;
  }, [userId]);

  useEffect(() => {
    if (validationReturnRoute) {
      clearValidationStandardReturnRoute(queryClient, userId);
    }
  }, [validationReturnRoute, queryClient, userId]);

  useEffect(() => {
    if (userId) {
      onboardingUseCase.retryFailedUpdates();
    }
  }, [userId]);

  const showMarketResearch =
    initialRoute?.needsMarketResearch === true && !marketResearchDismissed;

  const handleMarketResearchComplete = useCallback(() => {
    setMarketResearchDismissed(true);
    void queryClient.invalidateQueries({ queryKey: ['initialInterviewRoute', userId] });
  }, [queryClient, userId]);

  const bootstrapPending =
    !profileBootstrapped ||
    !profile ||
    interviewEntryLockLoading ||
    initialRouteLoading ||
    initialRoute === undefined ||
    (needsPostInterviewDeferralSnapshot && deferralLoading) ||
    (serverRoutesToAssessmentWelcome && localResumeLoading);

  const resolvedInterviewStack = useMemo(() => {
    if (!profile) {
      return null;
    }
    if (bootstrapPending && !interviewShellBootstrappedRef.current) {
      return null;
    }

    const bootstrap = resolveInterviewStackBootstrap({
      initialRoute,
      profileShowsStandardInterviewComplete,
      deferralSnapshot: deferralAttempt?.snap,
      isAdminEmail,
      lockedPostInterviewRoute: lockedPostInterviewRouteRef.current,
      validationStandardReturnRoute: validationReturnRoute,
      localResumableInterviewProgress: localResumableInterviewProgress === true,
      userId,
      userEnteredInterviewFlow: userEnteredInterviewFlow === true,
    });

    if (isTerminalPostInterviewRoute(bootstrap.initialRouteName)) {
      lockedPostInterviewRouteRef.current = bootstrap.initialRouteName;
    }

    const { initialRouteName, interviewAlreadyCompleted, legacyPsychometricsMode, needsMarketResearch } =
      bootstrap;

    const stack = {
      initialRouteName,
      interviewAlreadyCompleted,
      legacyPsychometricsMode,
      needsMarketResearch,
      navInitialState: buildInterviewStackInitialState(
        initialRouteName,
        userId,
        interviewAlreadyCompleted,
        legacyPsychometricsMode,
        needsMarketResearch,
      ),
    };
    interviewShellBootstrappedRef.current = true;
    lastResolvedInterviewStackRef.current = stack;
    return stack;
  }, [
    bootstrapPending,
    profile,
    initialRoute,
    profileShowsStandardInterviewComplete,
    needsPostInterviewDeferralSnapshot,
    deferralAttempt,
    isAdminEmail,
    userId,
    validationReturnRoute,
    initialRoute?.interviewPassedAdminOverride,
    initialRoute?.interviewPassedComputed,
    localResumableInterviewProgress,
    userEnteredInterviewFlow,
  ]);

  const stackToRender = resolvedInterviewStack ?? lastResolvedInterviewStackRef.current;

  if (!stackToRender) {
    return <LoadingScreen />;
  }

  const {
    initialRouteName,
    interviewAlreadyCompleted,
    legacyPsychometricsMode,
    needsMarketResearch,
    navInitialState,
  } = stackToRender;

  const showMarketResearchOverlay =
    showMarketResearch &&
    initialRouteName !== 'PsychometricAssessment' &&
    initialRouteName !== 'AssessmentWelcome';

  return (
    <MarketResearchCompletionProvider initialComplete={!needsMarketResearch}>
      <LoggedInInterviewShellReady
        userId={userId}
        needsMarketResearch={needsMarketResearch}
        initialRouteName={initialRouteName}
        interviewAlreadyCompleted={interviewAlreadyCompleted}
        legacyPsychometricsMode={legacyPsychometricsMode}
        navInitialState={navInitialState}
        showMarketResearchOverlay={showMarketResearchOverlay}
        onMarketResearchDismissed={handleMarketResearchComplete}
      />
    </MarketResearchCompletionProvider>
  );
};

const LoadingScreen = () => (
  <View style={[ROOT_STYLE, { justifyContent: 'center', alignItems: 'center' }]}>
    <ActivityIndicator size="large" color="#7A9ABE" />
    <Text style={{ marginTop: 16, color: '#7A9ABE', fontSize: 14 }}>Loading...</Text>
  </View>
);

/**
 * Logged-in stack: `Amoraea` uses path `interview` so the browser URL stays `/interview` (not rewritten to `/`).
 * `/` still opens the same screen by parsing as `interview`.
 */
function mapInterviewStackPath(path: string): string {
  const qIndex = path.indexOf('?');
  const pathnameRaw = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const search = qIndex >= 0 ? path.slice(qIndex) : '';
  const pathname = pathnameRaw.replace(/\/+$/, '') || '/';
  if (
    pathname === '/' ||
    pathname === '' ||
    pathname === '/interview' ||
    pathname === 'interview'
  ) {
    return `interview${search}`;
  }
  return path;
}

/** Auth stack: Login lives at ``; map `/interview` → `/` so both URLs show the login screen. */
function normalizeAuthWebPath(path: string): string {
  const [pathPart, query] = path.split('?');
  const trimmed = pathPart.replace(/\/+$/, '') || '/';
  const isInterviewAlias =
    trimmed === '/interview' || trimmed === 'interview' || pathPart === 'interview';
  if (!isInterviewAlias) {
    return path;
  }
  return query != null && query !== '' ? `/?${query}` : '/';
}

const INTERVIEW_STACK_ROUTE_PATH: Record<InterviewStackRoute, string> = {
  AssessmentWelcome: 'welcome',
  InterviewComplete: 'interview-complete',
  PsychometricAssessment: 'psychometrics',
  PsychometricsComplete: 'psychometrics-complete',
  Amoraea: 'interview',
  PostInterview: 'post-interview',
  PostInterviewLaunch: 'launch',
  PostInterviewProcessing: 'post-interview-processing',
  PostInterviewPassed: 'passed',
  PostInterviewFailed: 'failed',
  PostInterviewSexualCommunication: 'post-interview-sexual-communication',
};

const INTERVIEW_STACK_LINKING_SCREENS = {
  AssessmentWelcome: 'welcome',
  InterviewComplete: 'interview-complete',
  PsychometricAssessment: {
    path: 'psychometrics',
    parse: {
      openAdminPanel: (value: string | undefined) =>
        value === '1' || value === 'true' || value === 'yes',
    },
  },
  PsychometricsComplete: 'psychometrics-complete',
  Amoraea: {
    path: 'interview',
    parse: {
      openAdminPanel: (value: string | undefined) =>
        value === '1' || value === 'true' || value === 'yes',
    },
  },
  PostInterview: 'post-interview',
  PostInterviewLaunch: 'launch',
  PostInterviewProcessing: 'post-interview-processing',
  PostInterviewPassed: 'passed',
  PostInterviewFailed: 'failed',
  PostInterviewSexualCommunication: 'post-interview-sexual-communication',
} as const;

const AUTH_STACK_LINKING_SCREENS = {
  Login: '',
  Register: 'register',
  ForgotPassword: 'forgot-password',
  /** Email confirmation callbacks (`getAuthEmailRedirectTo`). */
  EmailConfirm: 'auth/confirm',
  /** SetNewPassword is not URL-linked — only shown via `forcePasswordResetUi` + initialRouteName. */
} as const;

const RootNavigator = () => {
  const { user, loading, passwordRecoveryPending } = useAuth();

  const isLoggedIn = user?.email != null && user.email !== '';
  const onEmailConfirmCallback =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    isEmailConfirmationCallback();
  const forcePasswordResetUi = passwordRecoveryPending && !onEmailConfirmCallback;

  useEffect(() => {
    initAudosFromEnv();
  }, []);

  useEffect(() => {
    if (!loading) {
      syncAudosIdentifyFromSupabaseUser(user);
    }
  }, [loading, user]);

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

  const authLinking: LinkingOptions<Record<string, unknown>> | undefined = useMemo(() => {
    const prefixes = [
      ...(Platform.OS === 'web' && typeof window !== 'undefined'
        ? [`${window.location.protocol}//${window.location.host}`]
        : []),
      'amoraea://',
      ExpoLinking.createURL('/'),
    ];
    if (Platform.OS !== 'web') {
      // Auth callbacks are consumed in useAuth (verifyOtp / recovery). Keep prefixes so
      // cold-start deep links are recognized; avoid stacking SetNewPassword via path config.
      return {
        prefixes,
        config: { screens: { Login: '' } },
      };
    }
    return {
      prefixes,
      config: { screens: AUTH_STACK_LINKING_SCREENS as Record<string, string | Record<string, unknown>> },
      getStateFromPath(path: string, options: Parameters<typeof getStateFromPathDefault>[1]) {
        const normalized = normalizeAuthWebPath(path);
        if (
          typeof window !== 'undefined' &&
          isBarePasswordResetLanding(
            window.location.pathname,
            window.location.search,
            window.location.hash,
          )
        ) {
          window.history.replaceState(null, '', '/');
          return getStateFromPathDefault('/', options);
        }
        const confirmCallback =
          typeof window !== 'undefined' &&
          (isEmailConfirmationCallback() ||
            isAuthEmailConfirmPath(normalized) ||
            normalized.startsWith(AUTH_EMAIL_CONFIRM_PATH));
        if (confirmCallback) {
          return getStateFromPathDefault('/', options);
        }
        if (isAuthPasswordResetPath(normalized)) {
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', '/');
          }
          return getStateFromPathDefault('/', options);
        }
        return getStateFromPathDefault(normalized, options);
      },
    };
  }, [passwordRecoveryPending]);

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

  if (!isLoggedIn || forcePasswordResetUi) {
    return (
      <NavigationContainer
        key={forcePasswordResetUi ? 'auth-reset' : 'auth-login'}
        theme={navTheme}
        linking={forcePasswordResetUi ? undefined : authLinking}
      >
        <AuthNavigator
          initialRouteName={forcePasswordResetUi ? 'SetNewPassword' : 'Login'}
        />
      </NavigationContainer>
    );
  }

  return <LoggedInRootShell userId={user!.id} userEmail={user!.email ?? null} navTheme={navTheme} />;
};

const loggedInNavTheme = {
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

const LoggedInRootShell = ({
  userId,
  userEmail,
  navTheme = loggedInNavTheme,
}: {
  userId: string;
  userEmail: string | null;
  navTheme?: typeof loggedInNavTheme;
}) => {
  const { user } = useAuth();
  const [userBootstrapped, setUserBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const metadata = user?.user_metadata as
        | { referral_code?: string; age?: number; gender?: 'Man' | 'Woman' | 'Non-binary' }
        | undefined;
      await inviteCodeRepository.ensureUserWithInviteCode(userId, {
        email: userEmail ?? undefined,
        referralCode: metadata?.referral_code,
        age: typeof metadata?.age === 'number' ? metadata.age : undefined,
        gender: metadata?.gender,
      });
      if (!cancelled) setUserBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, userEmail, user?.user_metadata]);

  const { data: validationShellRouting, isPending: validationShellRoutingPending } = useQuery({
    queryKey: ['validationShellRouting', userId],
    queryFn: () => fetchValidationShellRouting(userId),
    enabled: userBootstrapped,
    staleTime: 0,
  });

  if (!userBootstrapped || validationShellRoutingPending) {
    return <LoadingScreen />;
  }

  if (shouldUseRelationshipValidationNavigator(validationShellRouting)) {
    return (
      <NavigationContainer theme={navTheme}>
        <RelationshipValidationNavigator userId={userId} />
      </NavigationContainer>
    );
  }

  return <LoggedInInterviewShell userId={userId} />;
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
