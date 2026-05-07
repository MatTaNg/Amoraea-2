import { UserProfile } from "@/src/types";

/**
 * Check if life domains are completed
 */
export function checkLifeDomainsCompleted(profile: UserProfile | null): boolean {
  return !!(
    profile?.lifeDomains?.intimacy !== undefined &&
    profile?.lifeDomains?.finance !== undefined &&
    profile?.lifeDomains?.spirituality !== undefined &&
    profile?.lifeDomains?.family !== undefined &&
    profile?.lifeDomains?.physicalHealth !== undefined
  );
}

