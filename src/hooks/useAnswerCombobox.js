/**
 * useAnswerCombobox.js — Combobox logic for game answers and learn searches.
 *
 * DESIGN DECISION & JUSTIFICATION:
 * Dans tous les modes de jeu (countries, capitals, departments, us_states,
 * rivers_mountains), la sélection sur le globe fait foi (selectedCountry).
 * La liste de suggestions n'est qu'une aide d'orthographe.
 * AUCUNE suggestion n'est pré-surlignée par défaut (activeIndex = -1) :
 * Entrée n'auto-valide jamais suggestions[0] par accident (par ex. taper "ma"
 * ne doit pas valider "Madagascar" au hasard).
 * Lorsqu'un pays est sélectionné sur le globe :
 *   1. Entrée sans suggestion surlignée valide directement le texte tapé (onEnter(currentValue)).
 *   2. Entrée avec suggestion surlignée (ArrowDown / ArrowUp) valide l'option choisie.
 *   3. Le clic / tap direct sur une option valide la suggestion.
 * Lorsqu'aucun pays n'est sélectionné (requireSelection = true) :
 *   - suggestions = [] (liste masquée sans cible).
 *   - Entrée avec texte non vide déclenche un rejet visuel sobre (shake en steps(),
 *     champ non vidé, aria-live "Sélectionne un pays sur le globe").
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  buildSuggestionIndex,
  getAnswerSuggestions,
  getLearnSuggestions,
} from "../utils/answerSuggestions";

function handleLearnKeyDown({
  e,
  suggestions,
  choose,
  onEnter,
  currentValue,
  onLearnSearchChange,
  commitSuccess,
}) {
  if ((e.key === "Tab" || e.key === "Enter") && suggestions.length > 0) {
    e.preventDefault();
    choose(0);
    return;
  }
  if (e.key === "Enter" && onEnter) {
    e.preventDefault();
    if (onEnter(currentValue)) {
      if (onLearnSearchChange) onLearnSearchChange("");
      commitSuccess();
    }
  }
}

function handleEnterKey({
  e,
  currentValue,
  isOpen,
  activeIndex,
  suggestions,
  choose,
  triggerReject,
  onEnter,
  commitSuccess,
  requireSelection,
}) {
  if (import.meta.env.DEV && (currentValue === "WIN100" || currentValue === "LOSE100")) {
    e.preventDefault();
    if (onEnter?.(currentValue)) {
      commitSuccess();
    }
    return;
  }

  if (!currentValue?.trim()) {
    return;
  }

  e.preventDefault();

  if (requireSelection) {
    triggerReject();
    return;
  }

  if (isOpen && activeIndex >= 0 && activeIndex < suggestions.length) {
    choose(activeIndex);
  } else {
    const result = onEnter ? onEnter(currentValue) : false;
    if (result) {
      commitSuccess();
    }
  }
}

export default function useAnswerCombobox({
  mode,
  lang,
  countryDataMap,
  foundList,
  onEnter,
  inputRef,
  learnSearchQuery,
  onLearnSearchChange,
  t,
  requireSelection = false,
}) {
  const generatedId = useId();
  const listId = `answer-suggestions-${generatedId.replaceAll(":", "")}`;

  const [inputValue, setInputValue] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(true);
  const [isRejected, setIsRejected] = useState(false);
  const [statusText, setStatusText] = useState("");

  const shakeTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) {
        clearTimeout(shakeTimeoutRef.current);
      }
    };
  }, []);

  const index = useMemo(() => {
    if (mode === "learn") return null;
    return buildSuggestionIndex(countryDataMap, { lang, mode });
  }, [countryDataMap, lang, mode]);

  const foundSet = useMemo(() => new Set(foundList || []), [foundList]);

  const currentValue =
    mode === "learn" && learnSearchQuery !== undefined ? learnSearchQuery : inputValue;

  const suggestions = useMemo(() => {
    if (requireSelection) {
      return [];
    }
    if (mode === "learn") {
      return getLearnSuggestions(currentValue, countryDataMap, { lang, limit: 5 });
    }
    return getAnswerSuggestions(currentValue, index, { foundSet, limit: 5, lang });
  }, [requireSelection, mode, currentValue, countryDataMap, lang, index, foundSet]);

  const triggerReject = useCallback(() => {
    if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);

    if (!isRejected) {
      setIsRejected(true);
    } else {
      setIsRejected(false);
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => setIsRejected(true));
      } else {
        setTimeout(() => setIsRejected(true), 0);
      }
    }

    shakeTimeoutRef.current = setTimeout(() => {
      setIsRejected(false);
    }, 280);

    setIsOpen(true);
    setStatusText(t ? t("select_on_globe_hint") : "Sélectionne un pays sur le globe");
  }, [isRejected, t]);

  const commitSuccess = useCallback(() => {
    setInputValue("");
    setActiveIndex(-1);
    setIsOpen(false);
    setStatusText("");

    if (inputRef?.current) {
      try {
        inputRef.current.focus({ preventScroll: true });
      } catch {
        inputRef.current.focus();
      }
    }
  }, [inputRef]);

  const choose = useCallback(
    (idx) => {
      if (requireSelection) return false;
      const chosen = suggestions[idx];
      if (!chosen) return false;

      const result = onEnter ? onEnter(chosen.display) : false;
      if (!result) return false;

      if (mode === "learn" && onLearnSearchChange) {
        onLearnSearchChange("");
      }
      commitSuccess();
      return true;
    },
    [requireSelection, suggestions, onEnter, mode, onLearnSearchChange, commitSuccess]
  );

  const handleChange = useCallback(
    (e) => {
      const val = e.target.value;
      setInputValue(val);
      if (mode === "learn" && onLearnSearchChange) {
        onLearnSearchChange(val);
      }
      setActiveIndex(-1);
      setIsOpen(true);
      setIsRejected(false);
      setStatusText("");
    },
    [mode, onLearnSearchChange]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (mode === "learn") {
        handleLearnKeyDown({
          e,
          suggestions,
          choose,
          onEnter,
          currentValue,
          onLearnSearchChange,
          commitSuccess,
        });
        return;
      }

      if (e.key === "Tab") return;

      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        setStatusText("");
        return;
      }

      if (e.key === "ArrowDown" && suggestions.length > 0) {
        e.preventDefault();
        setIsOpen(true);
        setStatusText("");
        setActiveIndex((prev) => (prev === -1 ? 0 : (prev + 1) % suggestions.length));
        return;
      }

      if (e.key === "ArrowUp" && suggestions.length > 0) {
        e.preventDefault();
        setIsOpen(true);
        setStatusText("");
        setActiveIndex((prev) =>
          prev === -1
            ? suggestions.length - 1
            : (prev - 1 + suggestions.length) % suggestions.length
        );
        return;
      }

      if (e.key === "Enter") {
        handleEnterKey({
          e,
          currentValue,
          isOpen,
          activeIndex,
          suggestions,
          choose,
          triggerReject,
          onEnter,
          commitSuccess,
          requireSelection,
        });
      }
    },
    [
      mode,
      suggestions,
      choose,
      onEnter,
      currentValue,
      onLearnSearchChange,
      commitSuccess,
      isOpen,
      activeIndex,
      triggerReject,
      requireSelection,
    ]
  );

  const activeOptionId =
    isOpen && activeIndex >= 0 && suggestions[activeIndex]
      ? `${listId}-opt-${activeIndex}`
      : undefined;

  const inputProps = {
    value: currentValue,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    role: "combobox",
    "aria-expanded": Boolean(isOpen && suggestions.length > 0),
    "aria-controls": listId,
    "aria-autocomplete": "list",
    "aria-activedescendant": activeOptionId,
    "aria-haspopup": "listbox",
  };

  const listProps = {
    id: listId,
    role: "listbox",
    "aria-label": t ? t("quiz_answer") : "Réponse du quiz",
  };

  return {
    inputProps,
    listProps,
    suggestions,
    activeIndex,
    isRejected,
    choose,
    statusText,
  };
}
