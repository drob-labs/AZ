import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { de } from './de';
import { sq, type Dict } from './sq';

export type Locale = 'sq' | 'de';
const dicts: Record<Locale, Dict> = { sq, de };
const KEY = 'az.locale';

interface I18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: keyof Dict, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n>({ locale: 'sq', setLocale: () => {}, t: (k) => String(k) });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('sq');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'sq' || v === 'de') setLocaleState(v);
    });
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);

  const value = useMemo<I18n>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => {
        let s: string = dicts[locale][key];
        for (const [k, v] of Object.entries(vars ?? {})) s = s.replace(`{${k}}`, String(v));
        return s;
      },
    }),
    [locale, setLocale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
