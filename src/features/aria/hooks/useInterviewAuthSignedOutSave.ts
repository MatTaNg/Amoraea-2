import { useEffect } from 'react';

import {
  installInterviewAuthSignedOutSaveListener,
  type InterviewAuthSignedOutSaveDeps,
} from '@features/aria/buildInterviewProgressSnapshotFromRefs';

export function useInterviewAuthSignedOutSave(
  depsRef: React.MutableRefObject<InterviewAuthSignedOutSaveDeps>,
): void {
  useEffect(() => {
    return installInterviewAuthSignedOutSaveListener(depsRef);
  }, [depsRef]);
}
