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

// Custom Confirmation Modal Component
const ConfirmationModal = ({ message, onConfirm, onCancel, theme }) => (
  <div className="custom-modal-overlay">
    <div className={`custom-modal-content glass-panel ${theme}`}>
      <p>{message}</p>
      <div className="modal-actions">
        <button className="modal-btn cancel" onClick={onCancel}>Annuler</button>
        <button className="modal-btn confirm" onClick={onConfirm}>Confirmer</button>
      </div>
    </div>
  </div>
);

function App() {
  const [currentScreen, setCurrentScreen] = useState('home'); // 'home' or 'game'
  const [mode, setMode] = useState('countries'); // 'countries' or 'capitals'
  const [foundList, setFoundList] = useState([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [lang, setLang] = useState('fr'); // 'fr' or 'en'
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [popupError, setPopupError] = useState(false);
  const [popupWarning, setPopupWarning] = useState(false);
  const [popupSuccess, setPopupSuccess] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
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
    if (extInputRef.current) {
       setTimeout(() => extInputRef.current.focus(), 50);
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

  const resetGame = useCallback((newMode) => {
    setMode(newMode);
    setFoundList([]);
    setScore(0);
    setTimeLeft(15 * 60);
    setIsPlaying(false);
    setIsGameOver(false);
    setSelectedCountry(null);
    resetNavigationTrail(null);
    setMenuOpen(false);
  }, [resetNavigationTrail]);

  const startGame = useCallback((selectedMode) => {
    resetGame(selectedMode);
    setCurrentScreen('game');
  }, [resetGame]);

  const goHome = useCallback(() => {
    resetGame(mode);
    setCurrentScreen('home');
  }, [resetGame, mode]);

  useEffect(() => {
    if (isPlaying && !isGameOver && foundList.length > 0 && foundList.length >= Object.keys(countryDataMap).length) {
      setIsGameOver(true);
      setIsPlaying(false);
    }
  }, [foundList.length, isPlaying, isGameOver]);

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/cultural/ne_110m_admin_0_countries.json')
      .then(res => res.json())
      .then(data => {
        setCountriesData(data.features);
      });
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
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [isPlaying, isGameOver, timeLeft]);

  const stopGame = useCallback(() => {
    setIsGameOver(true);
    setIsPlaying(false);
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
            // Strong focus re-assertion ONLY if in keyboard mode
            if (extInputRef.current && effectiveKeyboardMode) {
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
            // Strong focus re-assertion ONLY if in keyboard mode
            if (extInputRef.current && effectiveKeyboardMode) {
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
    if (c === selectedCountry) {
      setPopupError(false);
      return;
    }

    setSelectedCountry(c);
    resetNavigationTrail(c);
    setPopupError(false);
    // Assert focus when clicking a country on the globe
    if (extInputRef.current) {
      setTimeout(() => extInputRef.current.focus(), 50);
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
    const pixelRatio = isMobile ? Math.min(devicePixelRatio, 2) : Math.min(devicePixelRatio, 1.75);
    return {
      isMobile,
      isTablet,
      pixelRatio,
      enableAutoRotate: true,
      enablePointerInteraction: false,
      maxLabels: isMobile ? 8 : (isTablet ? 15 : 30),
      showAtmosphere: false,
      useImageTextures: false,
      // Restore performant curvature resolution
      polygonCapCurvatureResolution: isMobile ? 1.5 : (isTablet ? 1.25 : 1.1)
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
        />
      ) : (
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
      )}
      
      <GlobeMap  
        mode={mode} 
        lang={lang}
        countriesData={countriesData} 
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
      />

      {(isGameOver || showInfoModal) && (
        <ResultsModal 
          foundList={foundList}
          totalCountries={totalPossible}
          countryDataMap={countryDataMap}
          onRestart={isGameOver ? goHome : () => handleCustomConfirm(
            lang === 'fr' ? "Recommencer une partie ?" : "Restart game?",
            () => { resetGame(mode); setShowInfoModal(false); }
          )}
          onClose={!isGameOver ? () => setShowInfoModal(false) : null}
          isGameOver={isGameOver}
          onStop={stopGame}
          isPlaying={isPlaying}
          mode={mode}
          theme={theme}
        />
      )}

      {confirmState && (
        <ConfirmationModal 
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
          theme={theme}
        />
      )}
    </div>
  );
}

export default App;
