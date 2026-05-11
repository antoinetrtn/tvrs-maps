import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import GlobeMap from './GlobeMap.jsx';
import GameHUD from './GameHUD.jsx';
import HomeScreen from './HomeScreen.jsx';
import './App.css';
import { normalizeString as rawNormalize, countryDataMap } from './gameData';

// Enhanced normalizer: strip accents, hyphens, extra spaces, lowercase
const normalizeString = (str) => {
  return rawNormalize(str).replace(/[-'']/g, ' ').replace(/\s+/g, ' ').trim();
};
import ResultsModal from './ResultsModal.jsx';
import EndScreen from './EndScreen.jsx';

// Custom Confirmation Modal Component
const ConfirmationModal = ({ message, onConfirm, onCancel, theme, lang }) => (
  <div className="custom-modal-overlay">
    <div className={`custom-modal-content glass-panel ${theme}`}>
      <p>{message}</p>
      <div className="modal-actions">
        <button className="modal-btn cancel" onClick={onCancel}>
          {lang === 'fr' ? "Annuler" : "Cancel"}
        </button>
        <button className="modal-btn confirm" onClick={onConfirm}>
          {lang === 'fr' ? "Confirmer" : "Confirm"}
        </button>
      </div>
    </div>
  </div>
);

function App() {
  const [currentScreen, setCurrentScreen] = useState('home'); // 'home' or 'game'
  const [mode, setMode] = useState('countries'); // 'countries' or 'capitals'
  const [foundList, setFoundList] = useState([]);
  const [score, setScore] = useState(0);
  const [gameDuration, setGameDuration] = useState(15 * 60);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [lang, setLang] = useState('fr'); // 'fr' or 'en'
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [showResultsTable, setShowResultsTable] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [popupError, setPopupError] = useState(false);
  const [popupWarning, setPopupWarning] = useState(false);
  const [popupSuccess, setPopupSuccess] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [globeLightingEnabled, setGlobeLightingEnabled] = useState(true);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  }); // System default theme
  
  // New States for Advanced UX
  const [menuOpen, setMenuOpen] = useState(false);
  const [hudSide, setHudSide] = useState('right'); // 'left' or 'right'
  const [confirmState, setConfirmState] = useState(null); // { message, onConfirm }

  const extInputRef = useRef(null);
  const initialHeight = useRef(window.innerHeight);
  const viewportFrameRef = useRef(null);
  const navigationTrailRef = useRef([]);
  const navigationTrailIndexRef = useRef(-1);

  // --- MOBILE KEYBOARD / VIEWPORT LOGIC ---
  const getViewport = useCallback(() => {
    const vv = window.visualViewport;
    return {
      width: vv ? vv.width : window.innerWidth,
      height: vv ? vv.height : window.innerHeight,
      top: vv ? vv.offsetTop : 0,
      left: vv ? vv.offsetLeft : 0
    };
  }, []);

  const [viewport, setViewport] = useState(getViewport);

  useEffect(() => {
    const handleResize = () => {
      if (viewportFrameRef.current) cancelAnimationFrame(viewportFrameRef.current);
      viewportFrameRef.current = requestAnimationFrame(() => {
        const nextViewport = getViewport();
        setViewport(prev => {
          const changed =
            Math.abs(prev.width - nextViewport.width) > 1 ||
            Math.abs(prev.height - nextViewport.height) > 1 ||
            Math.abs(prev.top - nextViewport.top) > 1 ||
            Math.abs(prev.left - nextViewport.left) > 1;
          return changed ? nextViewport : prev;
        });
      });
    };
    window.addEventListener('resize', handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    }
    return () => {
      if (viewportFrameRef.current) cancelAnimationFrame(viewportFrameRef.current);
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
    };
  }, [getViewport]);

  // Build a sorted list of all unfound country keys for prev/next navigation
  const allCountryKeys = useMemo(() => Object.keys(countryDataMap), []);
  const totalPossible = allCountryKeys.length;

  const getClosestUnfound = useCallback((fromAdmin, currentFound) => {
     let minList = [];
     const c1 = countryDataMap[fromAdmin];
     if (!c1 || c1.lat === undefined) return null;

     Object.keys(countryDataMap).forEach(key => {
        if (!currentFound.includes(key) && countryDataMap[key].lat !== undefined) {
           let dLng = Math.abs(c1.lng - countryDataMap[key].lng);
           if (dLng > 180) dLng = 360 - dLng;
           const dist = Math.hypot(c1.lat - countryDataMap[key].lat, dLng);
           minList.push({ key, dist });
        }
     });

     minList.sort((a,b) => a.dist - b.dist);
     return minList.length > 0 ? minList[0].key : null;
  }, []);

  const resetNavigationTrail = useCallback((country) => {
    navigationTrailRef.current = country ? [country] : [];
    navigationTrailIndexRef.current = country ? 0 : -1;
  }, []);

  // Navigate to next/previous unfound country in focus mode
  const navigateFocus = useCallback((direction) => {
    const unfoundKeys = allCountryKeys.filter(k => !foundList.includes(k) && countryDataMap[k]?.lat !== undefined);
    if (unfoundKeys.length === 0) return;

    if (!isPlaying && mode !== 'learn') setIsPlaying(true);

    let nextCountry;
    if (!selectedCountry) {
      nextCountry = direction === 'prev' ? unfoundKeys[unfoundKeys.length - 1] : unfoundKeys[0];
      resetNavigationTrail(nextCountry);
    } else {
      let trail = navigationTrailRef.current;
      let trailIndex = navigationTrailIndexRef.current;

      if (trail[trailIndex] !== selectedCountry) {
        trail = [selectedCountry];
        trailIndex = 0;
        navigationTrailRef.current = trail;
        navigationTrailIndexRef.current = trailIndex;
      }

      if (direction === 'prev' && trailIndex > 0) {
        nextCountry = trail[trailIndex - 1];
        navigationTrailIndexRef.current = trailIndex - 1;
      } else if (direction === 'next' && trailIndex < trail.length - 1) {
        nextCountry = trail[trailIndex + 1];
        navigationTrailIndexRef.current = trailIndex + 1;
      } else {
        const excludedForNavigation = Array.from(new Set([
          ...foundList,
          ...trail,
          selectedCountry
        ]));
        nextCountry = getClosestUnfound(selectedCountry, excludedForNavigation);

        if (nextCountry) {
          if (direction === 'prev') {
            navigationTrailRef.current = [nextCountry, ...trail];
            navigationTrailIndexRef.current = 0;
          } else {
            navigationTrailRef.current = [...trail.slice(0, trailIndex + 1), nextCountry];
            navigationTrailIndexRef.current = trailIndex + 1;
          }
        }
      }
    }

    if (!nextCountry) return;
    
    setSelectedCountry(nextCountry);
    setPopupError(false);
    setPopupWarning(false);
    
    // Maintain focus for a seamless experience. If already focused, don't re-assert.
    if (extInputRef.current && document.activeElement !== extInputRef.current) {
       setTimeout(() => {
         if (extInputRef.current) extInputRef.current.focus();
       }, 50);
    }
  }, [selectedCountry, foundList, allCountryKeys, isPlaying, getClosestUnfound, resetNavigationTrail]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedCountry) {
        if (e.key === 'ArrowRight') navigateFocus('next');
        if (e.key === 'ArrowLeft') navigateFocus('prev');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCountry, navigateFocus]);
  
  // Game countries loaded from GeoJSON
  const [countriesData, setCountriesData] = useState([]);
  const [highResCountriesByAdmin, setHighResCountriesByAdmin] = useState(() => new Map());

  const keyboardModeCandidate = window.innerWidth < 1024 && (
    viewport.height < initialHeight.current * 0.85 ||
    viewport.top > 20
  );
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);
  const effectiveKeyboardMode = keyboardModeCandidate || isKeyboardMode;

  useEffect(() => {
    if (window.innerWidth >= 1024) {
      setIsKeyboardMode(false);
      return undefined;
    }

    if (keyboardModeCandidate) {
      setIsKeyboardMode(true);
      return undefined;
    }

    const closeTimer = setTimeout(() => setIsKeyboardMode(false), 180);
    return () => clearTimeout(closeTimer);
  }, [keyboardModeCandidate]);

  const preserveInputFocus = useCallback(() => {
    const input = extInputRef.current;
    if (!input) return;
    if (document.activeElement !== input) {
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
    }
  }, []);

  const resetGame = useCallback((newMode) => {
    setMode(newMode);
    setFoundList([]);
    setScore(0);
    setTimeLeft(gameDuration);
    setIsPlaying(false);
    setIsGameOver(false);
    setShowEndScreen(false);
    setShowResultsTable(false);
    setSelectedCountry(null);
    resetNavigationTrail(null);
    setMenuOpen(false);
  }, [resetNavigationTrail, gameDuration]);

  const startGame = useCallback((selectedMode) => {
    resetGame(selectedMode);
    setCurrentScreen('game');
  }, [resetGame]);

  const goHome = useCallback(() => {
    resetGame(mode);
    setCurrentScreen('home');
  }, [resetGame, mode]);

  useEffect(() => {
    if (currentScreen === 'home') {
      setTimeLeft(gameDuration);
    }
  }, [gameDuration, currentScreen]);

  useEffect(() => {
    if (isPlaying && !isGameOver && foundList.length > 0 && foundList.length >= Object.keys(countryDataMap).length) {
      setIsGameOver(true);
      setIsPlaying(false);
      setShowEndScreen(true);
    }
  }, [foundList.length, isPlaying, isGameOver]);

  useEffect(() => {
    Promise.all([
      fetch('/data/countries-50m-low.json').then(res => res.json()),
      fetch('/data/countries-50m.json').then(res => {
        if (!res.ok) throw new Error(`Unable to load 50m countries`);
        return res.json();
      }).catch(() => null)
    ])
    .then(([data110m, data50m]) => {
      if (data110m && data110m.features) {
        setCountriesData(data110m.features);
      }
      if (data50m && data50m.features) {
        const map = new Map(data50m.features.map(f => [
          f.properties?.ADMIN || f.properties?.name || f.properties?.NAME,
          f
        ]));
        setHighResCountriesByAdmin(map);
      }
    })
    .catch(err => console.error("Failed to load map data", err));
  }, []);

  useEffect(() => {
    let timer = null;
    if (isPlaying && !isGameOver && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft <= 0 && isPlaying && !isGameOver) {
      setIsGameOver(true);
      setIsPlaying(false);
      setShowEndScreen(true);
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [isPlaying, isGameOver, timeLeft]);

  const stopGame = useCallback(() => {
    setIsGameOver(true);
    setIsPlaying(false);
    setShowEndScreen(true);
  }, []);

  const handleInput = useCallback((inputVal) => {
    if (inputVal === "WIN100") {
      setFoundList(Object.keys(countryDataMap));
      setScore(Object.keys(countryDataMap).length);
      return true;
    }
    if (inputVal === "LOSE100") {
      setIsGameOver(true);
      return true;
    }

    if (!isPlaying && mode !== 'learn') setIsPlaying(true);
    if (selectedCountry) return false;

    const normalizedInput = normalizeString(inputVal);
    if (!normalizedInput) return false;
    let matchFound = null;

    for (let adminKey of Object.keys(countryDataMap)) {
      const mapped = countryDataMap[adminKey];
      let matchName = null;
      let matchCapital = null;

      if (mapped) {
        matchName = lang === 'fr' ? normalizeString(mapped.name_fr || mapped.name_en || adminKey) : normalizeString(mapped.name_en || adminKey);
        matchCapital = lang === 'fr' && mapped.capital_fr ? normalizeString(mapped.capital_fr) : (mapped.capital ? normalizeString(mapped.capital) : null);
      } else {
        matchName = normalizeString(adminKey);
      }

      if (mode === 'countries') {
        if (matchName === normalizedInput) {
          matchFound = adminKey;
          break;
        }
      } else if (mode === 'capitals' && matchCapital) {
        if (matchCapital === normalizedInput) {
          matchFound = adminKey;
          break;
        }
      }
    }

    if (matchFound) {
      if (foundList.includes(matchFound)) {
        return "ALREADY_FOUND";
      }
      const newFound = [...foundList, matchFound];
      setFoundList(newFound);
      setScore(prev => prev + 1);

      setSelectedCountry(matchFound);
      setPopupSuccess(true);
      setTimeout(() => {
        setPopupSuccess(false);
        setSelectedCountry(prev => {
          if (prev === matchFound) {
            const nextCountry = getClosestUnfound(matchFound, newFound);
            navigationTrailRef.current = nextCountry ? [matchFound, nextCountry] : [matchFound];
            navigationTrailIndexRef.current = nextCountry ? 1 : 0;
            // Strong focus re-assertion ONLY if in keyboard mode and focus was actually lost
            if (extInputRef.current && effectiveKeyboardMode && document.activeElement !== extInputRef.current) {
              extInputRef.current.focus();
            }
            return nextCountry || null;
          }
          return prev;
        });
      }, 600);

      return "SUCCESS";
    }
    return "ERROR";
  }, [foundList, isPlaying, lang, mode, selectedCountry, getClosestUnfound, effectiveKeyboardMode]);

  const specificCountryGuess = useCallback((inputVal) => {
    if (!selectedCountry) return false;
    const mapped = countryDataMap[selectedCountry];
    if (!mapped) return false;

    if (!isPlaying && mode !== 'learn') setIsPlaying(true);

    const normalizedInput = normalizeString(inputVal);
    let matchName = lang === 'fr' ? normalizeString(mapped.name_fr) : normalizeString(mapped.name_en);
    let matchCapital = lang === 'fr' && mapped.capital_fr ? normalizeString(mapped.capital_fr) : (mapped.capital ? normalizeString(mapped.capital) : null);

    let isSuccess = false;
    if (mode === 'countries' && matchName === normalizedInput) {
      isSuccess = true;
    } else if (mode === 'capitals' && matchCapital === normalizedInput) {
      isSuccess = true;
    }

    if (isSuccess) {
      if (foundList.includes(selectedCountry)) {
        setPopupWarning(true);
        setTimeout(() => setPopupWarning(false), 500);
        return "ALREADY_FOUND";
      }

      const newFound = [...foundList, selectedCountry];
      setFoundList(newFound);
      setScore(score + 1);
      setPopupError(false);
      setPopupWarning(false);
      setPopupSuccess(true);

      const guessedCountry = selectedCountry;

      setTimeout(() => {
        setPopupSuccess(false);
        setSelectedCountry(prev => {
          if (prev === guessedCountry) {
            const nextCountry = getClosestUnfound(guessedCountry, newFound);
            navigationTrailRef.current = nextCountry ? [guessedCountry, nextCountry] : [guessedCountry];
            navigationTrailIndexRef.current = nextCountry ? 1 : 0;
            // Strong focus re-assertion ONLY if in keyboard mode and focus was actually lost
            if (extInputRef.current && effectiveKeyboardMode && document.activeElement !== extInputRef.current) {
              extInputRef.current.focus();
            }
            return nextCountry || null;
          }
          return prev;
        });
      }, 400);

      return "SUCCESS";
    } else {
      setPopupError(true);
      setTimeout(() => setPopupError(false), 500);
      return "ERROR";
    }
  }, [foundList, isPlaying, lang, mode, score, selectedCountry, getClosestUnfound, effectiveKeyboardMode]);

  const handleCountrySelect = useCallback((c) => {
    if (c === selectedCountry && c !== null) {
      setPopupError(false);
      return;
    }

    setSelectedCountry(c);
    resetNavigationTrail(c);
    setPopupError(false);
    // Assert focus when clicking a country on the globe.
    // If we're already focused (e.g. via preventDefault on pointerdown), skip the redundant call.
    if (c && extInputRef.current && document.activeElement !== extInputRef.current) {
      setTimeout(() => {
        if (extInputRef.current) extInputRef.current.focus();
      }, 80); // Slightly longer delay for stability on globe clicks
    }
  }, [selectedCountry, resetNavigationTrail]);

  const handleSearch = useCallback((inputVal) => {
    const normalizedInput = normalizeString(inputVal);
    if (!normalizedInput) return false;

    for (let adminKey of Object.keys(countryDataMap)) {
      const mapped = countryDataMap[adminKey];
      if (!mapped) continue;
      
      const matchName = lang === 'fr' ? normalizeString(mapped.name_fr || mapped.name_en || adminKey) : normalizeString(mapped.name_en || adminKey);
      const matchCapital = lang === 'fr' && mapped.capital_fr ? normalizeString(mapped.capital_fr) : (mapped.capital ? normalizeString(mapped.capital) : null);

      if (matchName === normalizedInput || matchCapital === normalizedInput) {
        handleCountrySelect(adminKey);
        return true;
      }
    }
    return false;
  }, [lang, handleCountrySelect]);

  const shouldAutoRotate = currentScreen === 'home';

  const handleCustomConfirm = (msg, action) => {
    setConfirmState({ message: msg, onConfirm: () => { action(); setConfirmState(null); } });
  };

  const perfProfile = useMemo(() => {
    const isMobile = viewport.width < 768;
    const isTablet = viewport.width >= 768 && viewport.width < 1024;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const pixelRatio = isMobile ? Math.min(devicePixelRatio, 1.35) : Math.min(devicePixelRatio, 1.75);
    return {
      isMobile,
      isTablet,
      pixelRatio,
      enableAutoRotate: true,
      enablePointerInteraction: true,
      maxLabels: isMobile ? 5 : (isTablet ? 12 : 30),
      showAtmosphere: false,
      useImageTextures: false,
      cullOffscreenCountries: isMobile || isTablet,
      // Robust curvature resolution for quality and stability
      polygonCapCurvatureResolution: isMobile ? 4 : (isTablet ? 3 : 1.5)
    };
  }, [viewport.width]);

  return (
    <div className={`app-container ${theme}`} data-theme={theme}>
      {currentScreen === 'home' ? (
        <HomeScreen 
          onStartGame={startGame} 
          theme={theme} 
          setTheme={setTheme} 
          lang={lang} 
          setLang={setLang}
          gameDuration={gameDuration}
          setGameDuration={setGameDuration}
          globeLightingEnabled={globeLightingEnabled}
          setGlobeLightingEnabled={setGlobeLightingEnabled}
        />
      ) : (
        !showEndScreen && (
          <GameHUD 
            mode={mode} 
            onGoHome={goHome}
            lang={lang}
            score={score} 
            totalPossible={totalPossible}
            timeLeft={timeLeft}
            onInput={() => {}} 
            onEnter={(val) => {
              if (mode === 'learn') {
                 const res = handleSearch(val);
                 if (!res) {
                    setPopupError(true);
                    setTimeout(() => setPopupError(false), 500);
                 }
                 return res;
              }

              let res;
              if (selectedCountry) {
                 res = specificCountryGuess(val);
              } else {
                 res = handleInput(val);
                 if (res === "ALREADY_FOUND") {
                    setPopupWarning(true);
                    setTimeout(() => setPopupWarning(false), 500);
                 } else if (res === "ERROR") {
                    setPopupError(true);
                    setTimeout(() => setPopupError(false), 500);
                 }
              }
              // Return true to clear the input field in GameHUD for any terminal result
              return res === "SUCCESS" || res === true || res === "ERROR" || res === "ALREADY_FOUND";
            }}
            isPlaying={isPlaying}
            isGameOver={isGameOver}
            onStop={() => handleCustomConfirm(
              lang === 'fr' ? "Arrêter la partie en cours ?" : "Stop the current game?",
              stopGame
            )}
            onInfo={() => setShowInfoModal(true)}
            isFocusedCountry={!!selectedCountry}
            onClearFocus={() => {
              setSelectedCountry(null);
              resetNavigationTrail(null);
            }}
            onNavigateFocus={navigateFocus}
            inputError={popupError}
            inputWarning={popupWarning}
            inputSuccess={popupSuccess}
            extInputRef={extInputRef}
            foundList={foundList}
            countryDataMap={countryDataMap}
            theme={theme}
            viewport={viewport}
            isKeyboardMode={effectiveKeyboardMode}
            selectedCountry={selectedCountry}
          />
        )
      )}
      
      <GlobeMap  
        mode={mode} 
        lang={lang}
        countriesData={countriesData} 
        highResCountriesByAdmin={highResCountriesByAdmin}
        foundList={foundList} 
        selectedCountry={selectedCountry}
        shouldAutoRotate={shouldAutoRotate && perfProfile.enableAutoRotate}
        onCountrySelect={handleCountrySelect}
        theme={theme}
        viewport={viewport}
        isError={popupError}
        hasActiveFeedback={popupError || popupSuccess}
        perfProfile={perfProfile}
        isHomeScreen={currentScreen === 'home'}
        isKeyboardMode={effectiveKeyboardMode}
        isEndScreen={showEndScreen}
        isPerfectScore={foundList.length === totalPossible}
        onPreserveInputFocus={preserveInputFocus}
        globeLightingEnabled={globeLightingEnabled}
      />

      {showEndScreen && (
        <EndScreen 
          foundList={foundList}
          totalCountries={totalPossible}
          countryDataMap={countryDataMap}
          onRestart={goHome}
          onViewTable={() => {
            setShowEndScreen(false);
            setShowResultsTable(true);
          }}
          theme={theme}
          lang={lang}
        />
      )}

      {(showResultsTable || showInfoModal) && (
        <ResultsModal 
          foundList={foundList}
          totalCountries={totalPossible}
          countryDataMap={countryDataMap}
          onRestart={isGameOver ? goHome : () => handleCustomConfirm(
            lang === 'fr' ? "Recommencer une partie ?" : "Restart game?",
            () => { resetGame(mode); setShowInfoModal(false); }
          )}
          onClose={() => {
            setShowResultsTable(false);
            setShowInfoModal(false);
            if (isGameOver) setShowEndScreen(true);
          }}
          isGameOver={isGameOver}
          onStop={stopGame}
          isPlaying={isPlaying}
          mode={mode}
          theme={theme}
          lang={lang}
        />
      )}

      {confirmState && (
        <ConfirmationModal
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
          theme={theme}
          lang={lang}
        />
      )}    </div>
  );
}

export default App;
