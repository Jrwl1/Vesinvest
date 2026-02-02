import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { TabId } from '../components/Layout';

interface NavigationState {
  tab: TabId;
  assetId: string | null;
}

interface NavigationContextType {
  state: NavigationState;
  navigateToTab: (tab: TabId) => void;
  navigateToAsset: (assetId: string) => void;
  navigateBack: () => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export function useNavigation(): NavigationContextType {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}

interface NavigationProviderProps {
  children: ReactNode;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ children }) => {
  const [state, setState] = useState<NavigationState>({
    tab: 'assets',
    assetId: null,
  });

  const navigateToTab = useCallback((tab: TabId) => {
    setState({ tab, assetId: null });
  }, []);

  const navigateToAsset = useCallback((assetId: string) => {
    setState({ tab: 'assets', assetId });
  }, []);

  const navigateBack = useCallback(() => {
    setState((prev) => ({ ...prev, assetId: null }));
  }, []);

  return (
    <NavigationContext.Provider
      value={{ state, navigateToTab, navigateToAsset, navigateBack }}
    >
      {children}
    </NavigationContext.Provider>
  );
};
