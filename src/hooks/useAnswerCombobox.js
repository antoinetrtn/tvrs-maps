/**
 * useAnswerCombobox.js — Logique de combobox pour la saisie des réponses et la recherche en mode learn.
 *
 * RÈGLES & DÉCISIONS DE CONCEPTION :
 * Dans tous les modes de jeu non-learn (countries, capitals, departments, us_states,
 * rivers_mountains) :
 * 1. Les suggestions sont TOUJOURS calculées et affichées dès 3 caractères saisis,
 *    qu'un pays soit sélectionné sur le globe ou non.
 * 2. Aucune suggestion n'est pré-surlignée par défaut (activeIndex = -1) :
 *    Entrée n'auto-valide jamais la première suggestion par accident.
 * 3. La validation d'une réponse se fait EXCLUSIVEMENT par le choix d'une suggestion :
 *    - Clic ou tap direct sur une option dans la liste.
 *    - Flèches Haut/Bas pour surligner une option, puis validation avec Entrée.
 *    Entrée sur le texte brut tapé sans suggestion surlignée ne valide JAMAIS la réponse.
 *    Dans ce cas, un rejet visuel sobre (shake) est déclenché sans vider le texte, avec l'indice
 *    "select_on_globe_hint" si aucune sélection n'est active, sinon "pick_in_list_hint".
 * 4. Lors du choix d'une suggestion (choose) :
 *    - Si aucun pays n'est sélectionné sur le globe (requireSelection = true) :
 *      rejet (shake avec l'indice "select_on_globe_hint"), réinitialisation complète du champ
 *      (texte vidé, activeIndex = -1, liste fermée, focus conservé), onEnter n'est pas appelé,
 *      et retourne false.
 *    - Si un pays est sélectionné sur le globe :
 *      onEnter(chosen.display) est appelé. Quelle que soit l'issue de la tentative,
 *      le champ est réinitialisé (commitSuccess) et retourne true.
 *
 * Mode Learn (mode === "learn") :
 * Le comportement reste inchangé : validation directe sur Entrée/Tab de la première
 * suggestion, recherche libre sans sélection obligatoire de pays.
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

  if (isOpen && activeIndex >= 0 && activeIndex < suggestions.length) {
    choose(activeIndex);
  } else {
    const hint = requireSelection ? "select_on_globe_hint" : "pick_in_list_hint";
    triggerReject(hint);
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
    if (mode === "learn") {
      return getLearnSuggestions(currentValue, countryDataMap, { lang, limit: 5 });
    }
    return getAnswerSuggestions(currentValue, index, { foundSet, limit: 5, lang });
  }, [mode, currentValue, countryDataMap, lang, index, foundSet]);

  const triggerReject = useCallback(
    (hintKey = "select_on_globe_hint") => {
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
      const defaultText =
        hintKey === "pick_in_list_hint"
          ? "Choisis un pays dans la liste"
          : "Sélectionne un pays sur le globe";
      const resolved = t ? t(hintKey) : defaultText;
      setStatusText(resolved === hintKey ? defaultText : resolved);
    },
    [isRejected, t]
  );

  const restoreFocus = useCallback(() => {
    if (inputRef?.current) {
      try {
        inputRef.current.focus({ preventScroll: true });
      } catch {
        inputRef.current.focus();
      }
    }
  }, [inputRef]);

  const commitSuccess = useCallback(() => {
    setInputValue("");
    setActiveIndex(-1);
    setIsOpen(false);
    setStatusText("");
    restoreFocus();
  }, [restoreFocus]);

  const choose = useCallback(
    (idx) => {
      const chosen = suggestions[idx];
      if (!chosen) return false;

      if (mode === "learn") {
        if (requireSelection) return false;
        const result = onEnter ? onEnter(chosen.display) : false;
        if (!result) return false;

        if (onLearnSearchChange) {
          onLearnSearchChange("");
        }
        commitSuccess();
        return true;
      }

      if (requireSelection) {
        triggerReject("select_on_globe_hint");
        setInputValue("");
        setActiveIndex(-1);
        setIsOpen(false);
        restoreFocus();
        return false;
      }

      onEnter?.(chosen.display);
      commitSuccess();
      return true;
    },
    [
      suggestions,
      mode,
      requireSelection,
      onEnter,
      onLearnSearchChange,
      commitSuccess,
      triggerReject,
      restoreFocus,
    ]
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
