import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { messages, type Locale } from './messages.js';

const localeKey = 'tankquest.locale';
type Params = Record<string, number | string>;

export function translate(locale: Locale, key: string, params: Params = {}) {
  const template = messages[locale][key] ?? messages.en[key] ?? key;
  return Object.entries(params).reduce(
    (value, [name, replacement]) =>
      value.replaceAll(`{{${name}}}`, String(replacement)),
    template
  );
}

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Params) => string;
}

const I18nContext = createContext<I18nValue>({
  locale: 'en' as Locale,
  setLocale: () => undefined,
  t: (key: string, params?: Params) => translate('en', key, params),
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => readLocale());
  useEffect(() => {
    localStorage.setItem(localeKey, locale);
    document.documentElement.lang = locale;
  }, [locale]);
  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: string, params?: Params) => translate(locale, key, params),
    }),
    [locale]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

function readLocale(): Locale {
  return localStorage.getItem(localeKey) === 'zh-CN' ? 'zh-CN' : 'en';
}
