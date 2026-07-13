export type InterviewConfirmDialogOptions = {
  title: string;
  message: string;
  confirmText: string;
};

export type ShowInterviewConfirmDialog = (
  options: InterviewConfirmDialogOptions,
  onConfirm: () => void,
) => void;

export function runConfirmInterviewRetake(deps: {
  showConfirmDialog: ShowInterviewConfirmDialog;
  performRetake: () => void | Promise<void>;
}): void {
  deps.showConfirmDialog(
    {
      title: 'Start retest?',
      message:
        'Are you sure you want to retest? You will not be able to return to this results screen after starting a new retest.',
      confirmText: 'Retest',
    },
    () => void deps.performRetake(),
  );
}

export function runConfirmAdminInterviewReset(deps: {
  showConfirmDialog: ShowInterviewConfirmDialog;
  performAdminInterviewReset: () => void | Promise<void>;
}): void {
  deps.showConfirmDialog(
    {
      title: 'Reset interview?',
      message:
        'Reset the entire interview from the beginning? Local progress and transcript will be cleared (admin only; does not change your account retake counters).',
      confirmText: 'Reset',
    },
    () => void deps.performAdminInterviewReset(),
  );
}

export function runConfirmInterviewSignOut(deps: {
  showConfirmDialog: ShowInterviewConfirmDialog;
  signOut: () => void | Promise<void>;
}): void {
  deps.showConfirmDialog(
    {
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      confirmText: 'Log out',
    },
    () => void deps.signOut(),
  );
}

export function runOpenAdminPanelFromRouteParam(deps: {
  openAdminPanelParam: boolean | undefined;
  isAdminAccount: boolean;
  setShowAdminPanel: React.Dispatch<React.SetStateAction<boolean>>;
  navigation: {
    setParams?: (params: { openAdminPanel?: undefined }) => void;
  };
}): void {
  if (!deps.openAdminPanelParam || !deps.isAdminAccount) return;
  deps.setShowAdminPanel(true);
  if (typeof deps.navigation.setParams === 'function') {
    deps.navigation.setParams({ openAdminPanel: undefined });
  }
}
