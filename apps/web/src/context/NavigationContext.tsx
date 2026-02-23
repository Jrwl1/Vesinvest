import React, { ReactNode, createContext, useCallback, useContext, useState } from 'react';
import type { TabId } from '../components/Layout';

interface NavigationState {
  tab: TabId;
}

interface NavigationContextType {
  state: NavigationState;
  navigateToTab: (tab: TabId) => void;
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
    tab: 'dashboard',
  });

  const navigateToTab = useCallback((tab: TabId) => {
    setState({ tab });
  }, []);

  return (
    <NavigationContext.Provider value={{ state, navigateToTab }}>
      {children}
    </NavigationContext.Provider>
  );
};
