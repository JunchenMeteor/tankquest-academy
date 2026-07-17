import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export const themes = ['training-base', 'forest-camp', 'snow-field'] as const;
export type ThemeCode = (typeof themes)[number];
export type ThemePreference = 'mission' | ThemeCode;
const themeKey = 'tankquest.theme-preference-v2';

interface ThemeValue {
  theme: ThemePreference;
  activeTheme: ThemeCode;
  setTheme: (theme: ThemePreference) => void;
  setMissionTheme: (theme: ThemeCode) => void;
}

const ThemeContext = createContext<ThemeValue>({
  theme: 'mission',
  activeTheme: 'training-base',
  setTheme: () => undefined,
  setMissionTheme: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemePreference>(() => readTheme());
  const [missionTheme, setMissionTheme] = useState<ThemeCode>('training-base');
  const activeTheme = theme === 'mission' ? missionTheme : theme;

  useEffect(() => {
    localStorage.setItem(themeKey, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme;
  }, [activeTheme]);

  const value = useMemo(
    () => ({ theme, activeTheme, setTheme, setMissionTheme }),
    [activeTheme, theme]
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

function readTheme(): ThemePreference {
  const stored = localStorage.getItem(themeKey);
  if (stored === 'mission') return stored;
  return themes.find((theme) => theme === stored) ?? 'mission';
}
