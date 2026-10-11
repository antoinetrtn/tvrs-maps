import { useCallback, useState } from "react";

const STORAGE_KEY = "tvrs-conquest-rules-seen";

const isRulesSeen = () => {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return true;
    }
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
};

export const markRulesSeen = () => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
  } catch {}
};

export function useConquestRulesAutoOpen() {
  const [open, setOpenState] = useState(() => !isRulesSeen());

  const setOpen = useCallback((next) => {
    setOpenState((prev) => {
      const val = typeof next === "function" ? next(prev) : next;
      if (!val) {
        markRulesSeen();
      }
      return Boolean(val);
    });
  }, []);

  return [open, setOpen];
}
