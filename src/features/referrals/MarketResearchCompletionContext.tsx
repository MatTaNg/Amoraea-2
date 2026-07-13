import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type MarketResearchCompletionContextValue = {
  marketResearchComplete: boolean;
  notifyMarketResearchComplete: () => void;
};

const MarketResearchCompletionContext = createContext<MarketResearchCompletionContextValue>({
  marketResearchComplete: false,
  notifyMarketResearchComplete: () => {},
});

export function MarketResearchCompletionProvider({
  initialComplete,
  children,
}: {
  initialComplete: boolean;
  children: React.ReactNode;
}) {
  const [marketResearchComplete, setMarketResearchComplete] = useState(initialComplete);

  const notifyMarketResearchComplete = useCallback(() => {
    setMarketResearchComplete(true);
  }, []);

  const value = useMemo(
    () => ({ marketResearchComplete, notifyMarketResearchComplete }),
    [marketResearchComplete, notifyMarketResearchComplete],
  );

  return (
    <MarketResearchCompletionContext.Provider value={value}>
      {children}
    </MarketResearchCompletionContext.Provider>
  );
}

export function useMarketResearchCompletion(): MarketResearchCompletionContextValue {
  return useContext(MarketResearchCompletionContext);
}
