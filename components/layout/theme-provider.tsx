"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type ThemeValue = { theme: "light" | "dark"; toggleTheme: () => void; ready: boolean };
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const stored = localStorage.getItem("econmind-theme");
      // New visitors begin with the editorial light surface; a deliberate saved
      // preference is always respected.
      setTheme(stored === "dark" || stored === "light" ? stored : "light");
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("econmind-theme", theme);
  }, [ready, theme]);

  const value = useMemo(() => ({ theme, ready, toggleTheme: () => setTheme((current) => current === "light" ? "dark" : "light") }), [ready, theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeProvider missing");
  return value;
}
