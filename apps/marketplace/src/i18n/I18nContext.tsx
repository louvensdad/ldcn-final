import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Locale } from "../types";
import ptBR from "./locales/pt-BR.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";

const DICTS: Record<Locale, Record<string, string>> = {
  "pt-BR": ptBR,
  en,
  es,
  fr,
};

export const SUPPORTED_LOCALES: { id: Locale; label: string }[] = [
  { id: "pt-BR", label: "Português (BR)" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
];

type Vars = Record<string, string | number>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Plain lookup with {{var}} interpolation. */
  t: (key: string, vars?: Vars) => string;
  /** i18next-style plural: picks `${key}_one` or `${key}_other` based on count. */
  tn: (key: string, count: number, vars?: Vars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{{${name}}}`,
  );
}

function detectInitialLocale(): Locale {
  const nav = typeof navigator !== "undefined" ? navigator.language : "pt-BR";
  const short = nav.slice(0, 2).toLowerCase();
  if (nav.toLowerCase().startsWith("pt")) return "pt-BR";
  if (short === "es") return "es";
  if (short === "fr") return "fr";
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(detectInitialLocale);

  const value = useMemo<I18nContextValue>(() => {
    const dict = DICTS[locale] ?? DICTS["pt-BR"];
    const fallback = DICTS["pt-BR"];

    const t = (key: string, vars?: Vars) => {
      const template = dict[key] ?? fallback[key] ?? key;
      return interpolate(template, vars);
    };

    const tn = (key: string, count: number, vars?: Vars) => {
      const suffix = count === 1 ? "_one" : "_other";
      return t(`${key}${suffix}`, { count, ...vars });
    };

    return { locale, setLocale, t, tn };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
