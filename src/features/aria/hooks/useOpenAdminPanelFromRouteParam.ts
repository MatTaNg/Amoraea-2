import { useEffect } from 'react';

import { runOpenAdminPanelFromRouteParam } from '@features/aria/interviewConfirmDialogActions';
import type { OpenAdminPanelFromRouteDeps } from '@features/aria/openAdminPanelFromRouteTypes';

export function useOpenAdminPanelFromRouteParam(
  depsRef: React.MutableRefObject<OpenAdminPanelFromRouteDeps>,
  trigger: { openAdminPanelParam: boolean | undefined; isAdminAccount: boolean },
): void {
  useEffect(() => {
    runOpenAdminPanelFromRouteParam({
      ...depsRef.current,
      openAdminPanelParam: trigger.openAdminPanelParam,
      isAdminAccount: trigger.isAdminAccount,
    });
  }, [depsRef, trigger.openAdminPanelParam, trigger.isAdminAccount]);
}
