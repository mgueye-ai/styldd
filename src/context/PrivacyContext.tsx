import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = '@styld/privacy_mode';

type PrivacyContextValue = {
  privacyMode: boolean;
  isReady: boolean;
  togglePrivacyMode: () => void;
  setPrivacyMode: (value: boolean) => void;
};

const PrivacyContext = createContext<PrivacyContextValue | undefined>(undefined);

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [privacyMode, setPrivacyModeState] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value === 'true') {
          setPrivacyModeState(true);
        }
      })
      .finally(() => setIsReady(true));
  }, []);

  const setPrivacyMode = (value: boolean) => {
    setPrivacyModeState(value);
    AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  };

  const togglePrivacyMode = () => {
    setPrivacyMode(!privacyMode);
  };

  const value = useMemo(
    () => ({
      privacyMode,
      isReady,
      togglePrivacyMode,
      setPrivacyMode,
    }),
    [privacyMode, isReady],
  );

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacyMode() {
  const context = useContext(PrivacyContext);

  if (!context) {
    throw new Error('usePrivacyMode must be used within PrivacyProvider');
  }

  return context;
}
