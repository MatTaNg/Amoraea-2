import { useState } from "react";

export interface LifeDomainsState {
  lifeDomainValues: {
    intimacy: number;
    finance: number;
    spirituality: number;
    family: number;
    physicalHealth: number;
  };
  savingLifeDomains: boolean;
}

const DEFAULT_VALUES = {
  intimacy: 0,
  finance: 0,
  spirituality: 0,
  family: 0,
  physicalHealth: 0,
};

export const useLifeDomainsState = () => {
  const [lifeDomainValues, setLifeDomainValues] = useState<{
    intimacy: number;
    finance: number;
    spirituality: number;
    family: number;
    physicalHealth: number;
  }>(DEFAULT_VALUES);
  const [savingLifeDomains, setSavingLifeDomains] = useState(false);

  const state: LifeDomainsState = {
    lifeDomainValues,
    savingLifeDomains,
  };

  return {
    state,
    setters: {
      setLifeDomainValues,
      setSavingLifeDomains,
    },
  };
};

