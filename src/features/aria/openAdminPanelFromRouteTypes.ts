import type { Dispatch, SetStateAction } from 'react';

export type OpenAdminPanelFromRouteDeps = {
  setShowAdminPanel: Dispatch<SetStateAction<boolean>>;
  navigation: {
    setParams?: (params: { openAdminPanel?: undefined }) => void;
  };
};
