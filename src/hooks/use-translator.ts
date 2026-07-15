import { useState, useCallback, useRef } from "react";

type Lang = "en" | "es";

type TranslateState = {
  translation: string;
  loading: boolean;
  error: string | null;
};

/**
 * Real working translator using Google's free translate endpoint.
 * No API key required. Translates between English and Spanish.
 */
export function useTranslator() {
  const [states, setStates] = useState<Record<Lang, TranslateState>>({
    en: { translation: "", loading: false, error: null },
    es: { translation: "", loading: false, error: null },
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  const translate = useCallback(async (text: string, from: Lang, to: Lang) => {
    if (!text.trim()) {
      setStates((prev) => ({
        ...prev,
        [to]: { translation: "", loading: false, error: null },
      }));
      return;
    }

    setStates((prev) => ({
      ...prev,
      [to]: { ...prev[to], loading: true, error: null },
    }));

    const myReqId = ++reqIdRef.current;

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      // Google returns nested arrays: [[["translated","original",...], ...], ...]
      const translated = Array.isArray(data?.[0])
        ? data[0].map((seg: unknown[]) => seg[0]).join("")
        : "";

      if (myReqId !== reqIdRef.current) return; // stale request

      setStates((prev) => ({
        ...prev,
        [to]: { translation: translated, loading: false, error: null },
      }));
    } catch (err) {
      if (myReqId !== reqIdRef.current) return;
      const msg = err instanceof Error ? err.message : "Translation failed";
      setStates((prev) => ({
        ...prev,
        [to]: { translation: "", loading: false, error: msg },
      }));
    }
  }, []);

  /** Debounced translate — cancels pending requests while typing */
  const translateDebounced = useCallback(
    (text: string, from: Lang, to: Lang, delay = 500) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => translate(text, from, to), delay);
    },
    [translate]
  );

  return { states, translate, translateDebounced };
}
