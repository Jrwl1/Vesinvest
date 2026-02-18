import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { TabId } from '../components/Layout';

// Legacy tab IDs kept for backward compatibility (revenue tab removed; drivers on Budget)
export type LegacyTabId = 'assets' | 'sites' | 'plan' | 'import' | 'revenue';
export type AnyTabId = TabId | LegacyTabId;

interface NavigationState {
  tab: TabId;
  assetId: string | null; // Legacy: kept for backward compat with AssetDetailPage
}

interface NavigationContextType {
  state: NavigationState;
  navigateToTab: (tab: AnyTabId) => void;
  // Legacy methods — kept so old pages compile but not actively used
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
    tab: 'budget',
    assetId: null,
  });

  const navigateToTab = useCallback((tab: AnyTabId) => {
    // Map legacy tab IDs to new ones (revenue tab removed; edit drivers on Budget page)
    const mapped: TabId = (tab === 'assets' || tab === 'sites' || tab === 'plan' || tab === 'import' || tab === 'revenue')
      ? 'budget'
      : tab;
    setState({ tab: mapped, assetId: null });
  }, []);

  // Legacy: kept for backward compat
  const navigateToAsset = useCallback((assetId: string) => {
    setState({ tab: 'budget', assetId });
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
