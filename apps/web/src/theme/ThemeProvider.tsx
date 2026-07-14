import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export const themes = ['training-base', 'forest-camp', 'snow-field'] as const;
export type ThemeCode = (typeof themes)[number];
const themeKey = 'tankquest.theme';

interface ThemeValue {
  theme: ThemeCode;
  setTheme: (theme: ThemeCode) => void;
}

const ThemeContext = createContext<ThemeValue>({
  theme: 'training-base' as ThemeCode,
  setTheme: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeCode>(() => readTheme());
  useEffect(() => {
    localStorage.setItem(themeKey, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

function readTheme(): ThemeCode {
  const stored = localStorage.getItem(themeKey);
  return themes.find((theme) => theme === stored) ?? 'training-base';
}
