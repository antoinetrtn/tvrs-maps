import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Globe, MapPin, Info, Square, X, ChevronLeft, ChevronRight, Mic, MicOff, Home, Play } from 'lucide-react';
import Logo from './Logo';
import './GameHUD.css';
import { THEME, CONTINENT_COLORS } from './designSystem';

// Check for Speech Recognition API support
const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

const GameHUD = ({
  mode, onGoHome, lang, score, totalPossible, timeLeft,
  onInput, onEnter, isPlaying, isGameOver, onStop, onInfo,
  isFocusedCountry, onClearFocus, onNavigateFocus, inputError, inputSuccess, inputWarning, extInputRef,
  foundList, countryDataMap, theme, viewport, isKeyboardMode, selectedCountry
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  
  // Use a ref to store the latest onEnter callback so the Speech API never uses a stale closure
  const onEnterRef = useRef(onEnter);
  useEffect(() => {
    onEnterRef.current = onEnter;
  }, [onEnter]);

  const normalizeString = (str) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-'']/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const startListening = useCallback(() => {
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let transcript = '';
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      
      const text = transcript.trim();
      if (text) {
        // Display the preview instantly in the input field
        setInputValue(text);
        if (isFinal) {
          // Use the REF to ensure we are validating against the currently selected country
          if (onEnterRef.current && onEnterRef.current(text)) {
            setInputValue('');
          }
        }
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => {
      if (recognitionRef.current === recognition && !isGameOver) {
        try { recognition.start(); } catch(e) {}
      }
    };
    
    recognitionRef.current = recognition;
    recognition.start();
  }, [lang, isGameOver]);

  const toggleMic = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsListening(false);
    } else {
      startListening();
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    
    // Stricter trigger: at least 4 chars and must represent a significant part of the word
    if (val.length >= 4) {
      const normalizedInput = normalizeString(val);
      const newSuggestions = [];
      const keysToCheck = mode === 'learn' 
        ? Object.keys(countryDataMap || {}) 
        : Object.keys(countryDataMap || {}).filter(k => !foundList.includes(k));
      
      for (const adminKey of keysToCheck) {
        const mapped = countryDataMap[adminKey];
        if (!mapped) continue;
        let nameToMatch = lang === 'fr' ? (mapped.name_fr || mapped.name_en || adminKey) : (mapped.name_en || adminKey);
        let capitalToMatch = lang === 'fr' && mapped.capital_fr ? mapped.capital_fr : (mapped.capital || null);
        
        // In learn mode, match both name and capital
        if (mode === 'learn') {
          const matchName = normalizeString(nameToMatch).includes(normalizedInput);
          const matchCap = capitalToMatch && normalizeString(capitalToMatch).includes(normalizedInput);
          
          // Suggestions should help with long/complex names
          if (matchName || matchCap) {
            const target = matchName ? nameToMatch : capitalToMatch;
            // Only suggest if input is long enough or target is complex (has spaces/hyphens)
            if (val.length >= 5 || target.includes(' ') || target.includes('-')) {
              newSuggestions.push({ 
                key: adminKey, 
                display: target, 
                subtext: matchName ? (mapped.capital_fr || mapped.capital) : (mapped.name_fr || mapped.name_en || adminKey) 
              });
            }
          }
        } else {
          let targetMatch = mode === 'countries' ? nameToMatch : capitalToMatch;
          if (targetMatch && normalizeString(targetMatch).includes(normalizedInput)) {
            // Very strict in game mode: only suggest if we have a lot of letters or it's a compound name
            const isCompound = targetMatch.includes(' ') || targetMatch.includes('-');
            const isSignificantMatch = val.length / targetMatch.length >= 0.7;

            if (isSignificantMatch || (isCompound && val.length >= 5)) {
              newSuggestions.push({ 
                key: adminKey, 
                display: targetMatch, 
                subtext: mode === 'capitals' ? (mapped.name_fr || mapped.name_en || adminKey) : (mapped?.capital_fr || mapped?.capital) 
              });
            }
          }
        }
      }
      setSuggestions(newSuggestions.slice(0, 5));
    } else setSuggestions([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab' && suggestions.length > 0) { 
      e.preventDefault(); 
      submitSuggestion(suggestions[0].display); 
    }
    else if (e.key === 'Enter' && onEnter) {
      e.preventDefault();
      if (onEnter(inputValue)) { 
        setInputValue(''); 
        setSuggestions([]);
      }
    }
  };

  const submitSuggestion = (match) => {
    if (onEnter && onEnter(match)) { 
      setInputValue(''); 
      setSuggestions([]);
      if (extInputRef.current) extInputRef.current.focus();
    }
  };

  const CONTINENT_ORDER = ["Europe", "Americas", "Asia", "Africa", "Oceania", "Antarctic"];
  const REGION_COLORS = useMemo(() => CONTINENT_COLORS[theme] || CONTINENT_COLORS.dark, [theme]);
  const UI_COLORS = useMemo(() => THEME[theme] || THEME.dark, [theme]);

  const regionStats = useMemo(() => {
    if (!countryDataMap) return {};
    const stats = {};
    CONTINENT_ORDER.forEach(r => stats[r] = { total: 0, found: 0 });
    Object.keys(countryDataMap).forEach(k => {
      const reg = countryDataMap[k]?.region;
      if (reg && stats[reg]) stats[reg].total++;
    });
    if (foundList) foundList.forEach(k => {
      const reg = countryDataMap[k]?.region;
      if (reg && stats[reg]) stats[reg].found++;
    });
    return stats;
  }, [foundList, countryDataMap]);

  const progressPercent = totalPossible ? Math.min((score / totalPossible) * 100, 100) : 0;

  // Determine which continent to highlight
  const activeContinent = useMemo(() => {
    if (!selectedCountry || !countryDataMap) return null;
    return countryDataMap[selectedCountry]?.region;
  }, [selectedCountry, countryDataMap]);

  return (
    <>
      <div
        className={`top-hud-bar ${isKeyboardMode ? 'keyboard-mode' : ''} ${mode === 'learn' ? 'learn-mode' : ''}`}
        style={window.innerWidth < 1024 ? {
          top: (viewport?.top || 0) + (isKeyboardMode ? 10 : 24)
        } : {}}
      >
          <div className="hud-top-left">
            <button className="hud-btn-circular glass-panel mobile-only" onClick={onGoHome} title={lang === 'fr' ? 'Accueil' : 'Home'}>
              <Home size={18} />
            </button>
            <div 
              className="desktop-only hud-logo-clickable" 
              onClick={onGoHome}
              title={lang === 'fr' ? 'Retour à l\'accueil' : 'Return home'}
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            >
              <Logo size="small" variant="hud" />
            </div>
          </div>

          {mode !== 'learn' && (
            <>
              <div className="hud-top-center">
            <div className="central-island-panel glass-panel" onClick={onInfo}>
               <div className="island-timer">{formatTime(timeLeft)}</div>
               <div className="island-divider" />
               <div className="island-progress-wrap">
                  <div className="progress-linear-container">
                     <div className="progress-linear-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
               </div>
               <div className="island-divider" />
               <div className="island-score">
                  <span className="score-current">{score}</span>
                  <span className="score-total">/{totalPossible}</span>
               </div>
            </div>
          </div>

          <div className="hud-top-right">
            {isPlaying && !isGameOver ? (
              <button 
                className="hud-btn-circular glass-panel" 
                style={{ color: 'var(--error)' }} 
                onClick={onStop} 
                title={lang === 'fr' ? 'Arrêter' : 'Stop'}
              >
                <Square size={18} fill="currentColor" />
              </button>
            ) : (
              <button 
                className="hud-btn-circular glass-panel" 
                style={{ color: 'var(--success)' }} 
                onClick={() => onNavigateFocus('next')} 
                title={lang === 'fr' ? 'Jouer' : 'Play'}
              >
                <Play size={18} fill="currentColor" />
              </button>
            )}
          </div>

          {/* Mobile Only Gauges (Now separate row in grid) */}
          <div className="hud-top-gauges mobile-only animation-fade-in">
            {CONTINENT_ORDER.map(reg => {
              const isActive = activeContinent === reg;
              const isFaded = activeContinent && activeContinent !== reg;
              return (
                <div key={reg} className={`gauge-item ${isActive ? 'highlight' : ''} ${isFaded ? 'faded' : ''}`} title={reg}>
                  <div className="circular-gauge" style={{ "--pct": `${(regionStats[reg]?.found / regionStats[reg]?.total) * 100}%`, "--color": REGION_COLORS[reg] }}>
                    <span className="gauge-val">{reg === 'Americas' ? 'AM' : (reg === 'Antarctic' ? 'AN' : reg.substring(0, 2).toUpperCase())}</span>
                  </div>
                </div>
              );
              })}
              </div>
              </>
              )}
              </div>
      {/* Desktop Only Gauges in Bottom Right */}
      {mode !== 'learn' && (
        <div className={`hud-bottom-right desktop-only ${isKeyboardMode ? 'keyboard-mode' : ''}`}>
          <div className="island-sub-gauges animation-fade-in">
            {CONTINENT_ORDER.map(reg => {
              const isActive = activeContinent === reg;
              const isFaded = activeContinent && activeContinent !== reg;
              
              return (
                <div 
                  key={reg} 
                  className={`gauge-item ${isActive ? 'highlight' : ''} ${isFaded ? 'faded' : ''}`} 
                  title={reg}
                >
                  <div className="circular-gauge" style={{ "--pct": `${(regionStats[reg]?.found / regionStats[reg]?.total) * 100}%`, "--color": REGION_COLORS[reg] }}>
                    <span className="gauge-val">{reg === 'Americas' ? 'AM' : (reg === 'Antarctic' ? 'AN' : reg.substring(0, 2).toUpperCase())}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="hud-btn-circular glass-panel" onClick={onInfo} title={lang === 'fr' ? 'Informations' : 'Information'}>
            <Info size={18} />
          </button>
        </div>
      )}

      {/* Focus Badge: Always visible if focused, even with keyboard */}
      {isFocusedCountry && (
        <div className="top-hud-container" style={{ top: (viewport?.top || 0) + 24, left: viewport?.left || 0 }}>
          <div className="top-hud-stack" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
            <div className="focus-info-card animation-fade-in">
              {isKeyboardMode && mode !== 'learn' && (
                <div className="focus-mini-pill">
                  <span className="focus-mini-val">{score}</span><span className="focus-mini-sub">/{totalPossible}</span>
                </div>
              )}
              <div className="focus-label">
                <MapPin size={14} className="focus-icon" />
                <span className="focus-label-text">
                  {mode === 'learn' 
                    ? (lang === 'fr' 
                        ? (countryDataMap[selectedCountry]?.name_fr || selectedCountry) 
                        : (countryDataMap[selectedCountry]?.name_en || selectedCountry))
                    : (mode === 'countries' 
                        ? (lang === 'fr' ? 'Devinez ce pays' : 'Guess this country') 
                        : (lang === 'fr' ? 'Trouvez la capitale' : 'Find the capital'))
                  }
                </span>
                <button className="focus-close-btn" onClick={onClearFocus}>
                  <X size={14} />
                </button>
              </div>
              {isKeyboardMode && mode !== 'learn' && (
                <div className="focus-mini-pill">
                  <span className="focus-mini-val">{formatTime(timeLeft)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        <div 
          className="bottom-hud-container"
          style={window.innerWidth < 1024 ? {
            position: 'absolute',
            bottom: 'auto',
            top: (viewport.top + viewport.height) - 24,
            transform: `translate(-50%, -100%)`,
            left: viewport.left + (viewport.width / 2)
          } : {}}
        >
          {suggestions.length > 0 && (
            <div className="suggestions-list animation-fade-in">
              {suggestions.map((s, idx) => (
                <button 
                  key={idx} 
                  className="suggestion-item" 
                  onPointerDown={(e) => {
                    e.preventDefault(); // STOPS BLUR
                    submitSuggestion(s.display);
                  }}
                  type="button"
                >
                  <span className="sug-text">{s.display}</span>
                  {s.subtext && <small className="sug-sub">({s.subtext})</small>}
                </button>
              ))}
            </div>
          )}

          <div className="bottom-hud-islands">
            {isFocusedCountry && mode !== 'learn' && (
              <>
                <button className="hud-btn-circular glass-panel" onClick={() => onNavigateFocus('prev')}>
                  <ChevronLeft size={18} />
                </button>
                <button className="hud-btn-circular glass-panel" onClick={() => onNavigateFocus('next')}>
                  <ChevronRight size={18} />
                </button>
              </>
            )}

            <div 
              className={`input-island glass-panel ${inputError ? 'error' : ''} ${inputWarning ? 'warning' : ''} ${inputSuccess ? 'success' : ''} ${activeContinent ? 'has-continent' : ''}`}
              style={{ "--continent-color": activeContinent ? REGION_COLORS[activeContinent] : 'transparent' }}
            >
              <input
                ref={extInputRef}
                type="text"
                name="quiz-response"
                id="quiz-response-field"
                inputMode="text"
                enterKeyHint="done"
                placeholder={isListening ? '...' : (mode === 'learn' ? (lang === 'fr' ? 'Rechercher un pays ou une capitale...' : 'Search for a country or capital...') : (isFocusedCountry ? (mode === 'countries' ? (lang === 'fr' ? 'Devinez ce pays' : 'Guess this country') : (lang === 'fr' ? 'Trouvez la capitale' : 'Find the capital')) : (lang === 'fr' ? 'Saisir un pays...' : 'Enter a country...')))}
                className="input-field"
                value={inputValue}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                readOnly={isListening}
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck="false"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                aria-label={lang === 'fr' ? 'Réponse du quiz' : 'Quiz answer'}
              />
            </div>

            {SpeechRecognition && mode !== 'learn' && (
              <button className={`hud-btn-circular glass-panel mic-btn ${isListening ? 'active' : ''}`} onClick={toggleMic}>
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
          </div>
        </div>
    </>
  );
};

export default React.memo(GameHUD);
