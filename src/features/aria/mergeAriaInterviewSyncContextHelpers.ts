import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

import { mergeAriaInterviewSyncCtx } from '@features/aria/syncAriaInterviewDepsTypes';



export function mergeAriaInterviewCoreGateServicesBaseSyncCtx(

  coreGateCtx: AriaInterviewDepsSyncContext,

  servicesBaseCtx: AriaInterviewDepsSyncContext,

): AriaInterviewDepsSyncContext {

  return mergeAriaInterviewSyncCtx(coreGateCtx, servicesBaseCtx);

}



export function mergeAriaInterviewServicesFullSyncCtx(

  servicesBaseCtx: AriaInterviewDepsSyncContext,

  servicesExtendedCtx: AriaInterviewDepsSyncContext,

): AriaInterviewDepsSyncContext {

  return mergeAriaInterviewSyncCtx(servicesBaseCtx, servicesExtendedCtx);

}



export function mergeAriaInterviewCoreGateServicesFullSyncCtx(

  coreGateCtx: AriaInterviewDepsSyncContext,

  servicesBaseCtx: AriaInterviewDepsSyncContext,

  servicesExtendedCtx: AriaInterviewDepsSyncContext,

): AriaInterviewDepsSyncContext {

  return mergeAriaInterviewSyncCtx(

    mergeAriaInterviewSyncCtx(coreGateCtx, servicesBaseCtx),

    servicesExtendedCtx,

  );

}



export function mergeAriaInterviewCoreWithLocalSyncCtx(

  coreCtx: AriaInterviewDepsSyncContext,

  localCtx: AriaInterviewDepsSyncContext,

): AriaInterviewDepsSyncContext {

  return mergeAriaInterviewSyncCtx(coreCtx, localCtx);

}



export function mergeAriaInterviewServicesBaseWithLocalSyncCtx(

  servicesBaseCtx: AriaInterviewDepsSyncContext,

  localCtx: AriaInterviewDepsSyncContext,

): AriaInterviewDepsSyncContext {

  return mergeAriaInterviewSyncCtx(servicesBaseCtx, localCtx);

}



export function mergeAriaInterviewCoreGateServicesBaseWithLocalSyncCtx(

  baseCtx: AriaInterviewDepsSyncContext,

  localCtx: AriaInterviewDepsSyncContext,

): AriaInterviewDepsSyncContext {

  return mergeAriaInterviewSyncCtx(baseCtx, localCtx);

}



export function mergeAriaInterviewCoreGateServicesFullWithLocalSyncCtx(

  fullCtx: AriaInterviewDepsSyncContext,

  localCtx: AriaInterviewDepsSyncContext,

): AriaInterviewDepsSyncContext {

  return mergeAriaInterviewSyncCtx(fullCtx, localCtx);

}


