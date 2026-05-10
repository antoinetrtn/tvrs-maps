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
            <Globe2 size={20} />
            <span className="btn-title">{lang === 'fr' ? 'Pays' : 'Countries'}</span>
          </button>

          <button className="home-btn mode-capitals" onClick={() => onStartGame('capitals')}>
            <MapPin size={20} />
            <span className="btn-title">{lang === 'fr' ? 'Capitales' : 'Capitals'}</span>
          </button>

          <button className="home-btn mode-learn" onClick={() => onStartGame('learn')}>
            <GraduationCap size={20} />
            <span className="btn-title">{lang === 'fr' ? 'Apprendre' : 'Learn'}</span>
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
