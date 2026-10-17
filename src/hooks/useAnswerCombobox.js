/**
 * useAnswerCombobox.js — Combobox logic for game answers and learn searches.
 *
 * DESIGN DECISION & JUSTIFICATION:
 * AUCUNE suggestion n'est pré-surlignée par défaut (activeIndex = -1), même
 * lorsqu'un joueur tape exactement le nom complet d'une entité ou un préfixe
 * valide.
 * Si une suggestion était pré-sélectionnée par défaut, taper une chaîne comme
 * "ma" puis appuyer sur Entrée validerait Madagascar (ou toute autre suggestion
 * en tête de liste) par pur hasard, sans décision délibérée du joueur.
 * Dans tous les modes de jeu (countries, capitals, departments, us_states,
 * rivers_mountains), une réponse n'est transmise à `onEnter` que si le joueur
 * l'a EXPLICITEMENT choisie :
 *   1. par clic / tap direct sur l'option,
 *   2. ou par navigation au clavier (Flèche Bas / Flèche Haut) puis Entrée.
 * Appuyer sur Entrée sans suggestion activement surlignée déclenche un rejet
 * visuel sobre (shake en steps() sans perte de vie) et (ré)ouvre la liste.
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
  reset,
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
      reset();
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
  reset,
}) {
  if (import.meta.env.DEV && (currentValue === "WIN100" || currentValue === "LOSE100")) {
    e.preventDefault();
    if (onEnter && onEnter(currentValue)) {
      reset();
    }
    return;
  }

  if (!currentValue || !currentValue.trim()) {
    return;
  }

  e.preventDefault();

  if (isOpen && activeIndex >= 0 && activeIndex < suggestions.length) {
    choose(activeIndex);
  } else {
    triggerReject();
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
}) {
  const generatedId = useId();
  const listId = `answer-suggestions-${generatedId.replace(/:/g, "")}`;

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
    if (mode === "learn") {
      return getLearnSuggestions(currentValue, countryDataMap, { lang, limit: 5 });
    }
    return getAnswerSuggestions(currentValue, index, { foundSet, limit: 5, lang });
  }, [mode, currentValue, countryDataMap, lang, index, foundSet]);

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
    setStatusText(t ? t("answer_pick_hint") : "Choisis dans la liste");
  }, [isRejected, t]);

  const choose = useCallback(
    (idx) => {
      const chosen = suggestions[idx];
      if (!chosen) return false;

      const result = onEnter ? onEnter(chosen.display) : false;
      if (!result) return false;

      if (mode === "learn" && onLearnSearchChange) {
        onLearnSearchChange("");
      }
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
      return true;
    },
    [suggestions, onEnter, mode, onLearnSearchChange, inputRef]
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
      const reset = () => {
        setInputValue("");
        setIsOpen(false);
      };

      if (mode === "learn") {
        handleLearnKeyDown({
          e,
          suggestions,
          choose,
          onEnter,
          currentValue,
          onLearnSearchChange,
          reset,
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
          reset,
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
      isOpen,
      activeIndex,
      triggerReject,
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
