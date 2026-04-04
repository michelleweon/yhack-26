import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getBrowserStorage } from '@/shared/services/browserStorage';

export type AppFlow = 'dev' | 'real';

interface AppFlowContextValue {
  flow: AppFlow | null;
  isReady: boolean;
  selectFlow: (nextFlow: AppFlow) => void;
  clearFlow: () => void;
}

const STORAGE_KEY = 'raccoon_app_flow';

const AppFlowContext = createContext<AppFlowContextValue | null>(null);

export function AppFlowProvider({ children }: { children: ReactNode }) {
  const [flow, setFlow] = useState<AppFlow>('real');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const storage = getBrowserStorage();
    const storedFlow = storage.getItem(STORAGE_KEY);

    if (storedFlow !== 'real') {
      storage.setItem(STORAGE_KEY, 'real');
    }

    setFlow('real');
    setIsReady(true);
  }, []);

  const value = useMemo<AppFlowContextValue>(() => ({
    flow,
    isReady,
    selectFlow(nextFlow) {
      getBrowserStorage().setItem(STORAGE_KEY, nextFlow);
      setFlow(nextFlow);
    },
    clearFlow() {
      getBrowserStorage().setItem(STORAGE_KEY, 'real');
      setFlow('real');
    },
  }), [flow, isReady]);

  return <AppFlowContext.Provider value={value}>{children}</AppFlowContext.Provider>;
}

export function useAppFlow() {
  const context = useContext(AppFlowContext);

  if (!context) {
    throw new Error('useAppFlow must be used within an AppFlowProvider');
  }

  return context;
}
