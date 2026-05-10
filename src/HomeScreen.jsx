import React from 'react';
import { Globe2, MapPin, GraduationCap, Sun, Moon } from 'lucide-react';
import Logo from './Logo';
import './HomeScreen.css';

const HomeScreen = ({ onStartGame, theme, setTheme, lang, setLang }) => {
  return (
    <div className={`home-screen-overlay ${theme}`}>
      <div className="home-content animation-fade-in">
        <Logo size="large" className="home-logo" />
        
        <div className="home-buttons">
          <button className="home-btn mode-countries" onClick={() => onStartGame('countries')}>
            <Globe2 size={24} />
            <div className="btn-text">
              <span className="btn-title">{lang === 'fr' ? 'Pays' : 'Countries'}</span>
              <span className="btn-desc">{lang === 'fr' ? 'Devinez tous les pays du monde' : 'Guess all countries in the world'}</span>
            </div>
          </button>

          <button className="home-btn mode-capitals" onClick={() => onStartGame('capitals')}>
            <MapPin size={24} />
            <div className="btn-text">
              <span className="btn-title">{lang === 'fr' ? 'Capitales' : 'Capitals'}</span>
              <span className="btn-desc">{lang === 'fr' ? 'Trouvez la capitale de chaque pays' : 'Find the capital of every country'}</span>
            </div>
          </button>

          <button className="home-btn mode-learn disabled" disabled title={lang === 'fr' ? 'Bientôt disponible' : 'Coming soon'}>
            <GraduationCap size={24} />
            <div className="btn-text">
              <span className="btn-title">Learn</span>
              <span className="btn-desc">{lang === 'fr' ? 'Mode apprentissage (À venir)' : 'Learning mode (Coming soon)'}</span>
            </div>
          </button>
        </div>
      </div>

      <div className="home-bottom-right">
        <div className="lang-toggle-wrap glass-panel">
          <button 
            className={`lang-btn ${lang === 'fr' ? 'active' : ''}`} 
            onClick={() => setLang('fr')}
          >
            FR
          </button>
          <div className="lang-divider" />
          <button 
            className={`lang-btn ${lang === 'en' ? 'active' : ''}`} 
            onClick={() => setLang('en')}
          >
            EN
          </button>
        </div>
        <button className="theme-toggle-btn glass-panel" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </div>
  );
};

export default React.memo(HomeScreen);