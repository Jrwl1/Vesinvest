import React,{ createContext,useCallback,useContext,useEffect,useState } from 'react';
import { getDemoStatus,type DemoStatusResult } from '../api';

export type DemoEntryState =
  | 'loading'
  | 'available'
  | 'unavailable'
  | 'unreachable';

type DemoStatusState =
  | { status: 'loading' }
  | {
      status: 'ready';
      enabled: boolean;
      appMode: 'production' | 'trial' | 'internal_demo';
      authBypassEnabled: boolean;
      demoLoginEnabled: boolean;
      orgId: string | null;
    }
  | { status: 'unreachable' };

const DemoStatusContext = createContext<DemoStatusState | null>(null);

export function resolveDemoEntryState(status: DemoStatusState): DemoEntryState {
  if (status.status === 'loading') return 'loading';
  if (status.status === 'unreachable') return 'unreachable';
  return status.appMode === 'internal_demo' && status.demoLoginEnabled
    ? 'available'
    : 'unavailable';
}

export function DemoStatusProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoStatusState>({ status: 'loading' });

  const fetchStatus = useCallback(async () => {
    const result: DemoStatusResult = await getDemoStatus();
    if ('unreachable' in result) {
      setState({ status: 'unreachable' });
      return;
    }
    const enabled = result.enabled;
    setState({
      status: 'ready',
      enabled,
      appMode: result.appMode,
      authBypassEnabled: result.authBypassEnabled,
      demoLoginEnabled: result.demoLoginEnabled,
      orgId: enabled ? result.orgId ?? null : null,
    });
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return (
    <DemoStatusContext.Provider value={state}>
      {children}
    </DemoStatusContext.Provider>
  );
}

export function useDemoStatus(): DemoStatusState {
  const ctx = useContext(DemoStatusContext);
  if (ctx === null) {
    return { status: 'loading' };
  }
  return ctx;
}

/** True only when backend said demo is enabled. Do not use for button visibility when status is loading or unreachable. */
export function useDemoEnabled(): boolean {
  const s = useDemoStatus();
  return s.status === 'ready' && s.enabled;
}

/** True when we could not reach /demo/status. Show banner, do not silently hide demo button. */
export function useDemoUnreachable(): boolean {
  const s = useDemoStatus();
  return s.status === 'unreachable';
}

export function useDemoEntryState(): DemoEntryState {
  const status = useDemoStatus();
  return resolveDemoEntryState(status);
}
