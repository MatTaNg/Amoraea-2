import { Platform } from 'react-native';

import type { HeadphoneProbeResult } from '@features/aria/utils/audioRouteHeadphones';
import { mapHeadphoneProbeToSessionInputRoute, shouldWarnHighThermal } from '@utilities/sessionLogging/interviewDeviceEnvironment';
import {
  collectDeviceContext,
  collectInterviewDeviceEnvironment,
} from '@utilities/sessionLogging/interviewDeviceEnvironment';
import { captureWebSessionLogDeviceContext } from '@utilities/sessionLogging/webSessionLogDeviceContext';
import { refreshWebAudioRoutesForSession } from '@utilities/sessionLogging/webMediaDeviceAudioRoute';
import {
  countSubstantiveInterviewAttemptsForUser,
  fetchLatestNonPhantomInProgressAttemptId,
} from '@features/interview/interviewAttemptLifecycle';
import {
  getSessionLogRuntime,
  markInterviewSessionClockStart,
  resetSessionLogRuntime,
  setSessionLogPlatform,
  writeAudioSessionLog,
  writeSessionLog,
} from '@utilities/sessionLogging';
import type { StartInterviewDeps } from '@features/aria/sessionLifecycleTypes';

export async function runInterviewSessionStartLogging(
  deps: StartInterviewDeps,
  routeProbe: HeadphoneProbeResult,
): Promise<void> {
  const {
    userId,
    profile,
    interviewSessionAttemptIdRef,
    interviewSessionIdRef,
    setSessionLogPlatform,
    setAudioSessionDeviceSnapshot,
    setLastInterviewDeviceEnvironment,
    setSessionAudioRoutes,
    setSessionAudioHealthNotice,
  } = deps;
  if (!userId) return;

  let createdAttemptId: string | null = interviewSessionAttemptIdRef.current;
  try {
    const device = await collectDeviceContext();
    setSessionLogPlatform(device.platform);
    setAudioSessionDeviceSnapshot({
      device_model: device.device_model,
      os_version: device.os_version,
      app_version: device.app_version,
    });
    const env = await collectInterviewDeviceEnvironment(routeProbe);
    setLastInterviewDeviceEnvironment(env);
    if (Platform.OS === 'web') {
      captureWebSessionLogDeviceContext({
        device_model: device.device_model,
        os_version: device.os_version,
        app_version: device.app_version,
        available_memory_mb: env.available_memory_mb,
      });
      await refreshWebAudioRoutesForSession({ probeMicrophone: false });
    } else {
      setSessionAudioRoutes(mapHeadphoneProbeToSessionInputRoute(routeProbe), 'unknown');
    }
    const substantiveCount = await countSubstantiveInterviewAttemptsForUser(userId);
    const attemptNumber = substantiveCount + 1;
    if (!createdAttemptId) {
      createdAttemptId = await fetchLatestNonPhantomInProgressAttemptId(userId);
      if (createdAttemptId) {
        interviewSessionAttemptIdRef.current = createdAttemptId;
      }
    }
    resetSessionLogRuntime({
      sessionCorrelationId: interviewSessionIdRef.current,
      attemptId: createdAttemptId,
      sessionLogsRequireAttemptId: createdAttemptId != null,
    });
    markInterviewSessionClockStart();
    const rLog = getSessionLogRuntime();
    setSessionLogPlatform(device.platform);
    writeAudioSessionLog({
      userId,
      attemptId: rLog.attemptId,
      eventType: 'device_environment_at_session_start',
      eventData: {
        ...env,
      },
      platform: device.platform,
    });
    const healthBits: string[] = [];
    if (shouldWarnHighThermal(env)) {
      writeAudioSessionLog({
        userId,
        attemptId: rLog.attemptId,
        eventType: 'high_thermal_warning',
        eventData: { thermal_state: env.thermal_state },
        platform: device.platform,
      });
      healthBits.push(
        'Your device may be running warm, which can affect audio quality. You may want to close other apps before starting.',
      );
    }
    if (env.other_app_using_microphone) {
      healthBits.push(
        'Another app appears to be using your microphone. Please close it before starting for the best experience.',
      );
    }
    if (healthBits.length > 0) {
      setSessionAudioHealthNotice(healthBits.join('\n\n'));
    }
    const baseData = {
      ...device,
      is_alpha_tester: !!profile?.isAlphaTester,
      referral_code_used: profile?.inviteCode ?? null,
      attempt_number: attemptNumber,
      session_correlation_id: interviewSessionIdRef.current,
    };
    writeSessionLog({
      userId,
      attemptId: rLog.attemptId,
      eventType: 'session_start',
      eventData: baseData,
      platform: device.platform,
    });
    writeSessionLog({
      userId,
      attemptId: rLog.attemptId,
      eventType: 'build_version',
      eventData: { build_version: device.build_version },
      platform: device.platform,
    });
    writeSessionLog({
      userId,
      attemptId: rLog.attemptId,
      eventType: 'audio_route_probe',
      eventData: {
        kind: routeProbe.kind,
        fingerprint: routeProbe.fingerprint,
        input_type: routeProbe.input?.type ?? null,
        input_name: routeProbe.input?.name?.slice?.(0, 120) ?? null,
      },
      platform: device.platform,
    });
  } catch (e) {
    if (__DEV__) console.warn('[session_logs] session_start logging failed', e);
    if (!interviewSessionAttemptIdRef.current) {
      resetSessionLogRuntime({
        sessionCorrelationId: interviewSessionIdRef.current,
        attemptId: null,
        sessionLogsRequireAttemptId: false,
      });
    }
  }
}
