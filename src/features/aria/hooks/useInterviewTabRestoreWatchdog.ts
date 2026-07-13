import { useEffect } from 'react';
import { Platform } from 'react-native';

import { runTabRestoreWatchdogTick } from '@features/aria/runTabRestoreWatchdogTick';
import type { TabRestoreWatchdogDeps } from '@features/aria/tabRestoreWatchdogTypes';

const TAB_RESTORE_WATCHDOG_INTERVAL_MS = 500;

export function useInterviewTabRestoreWatchdog(
  depsRef: React.MutableRefObject<TabRestoreWatchdogDeps>,
): void {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = setInterval(() => {
      runTabRestoreWatchdogTick(depsRef.current);
    }, TAB_RESTORE_WATCHDOG_INTERVAL_MS);
    return () => clearInterval(id);
  }, [depsRef]);
}
