import React from 'react';
import { Globe2, MapPin, GraduationCap } from 'lucide-react';
import './HomeScreen.css';

const HomeScreen = ({ onStartGame, theme }) => {
  return (
    <div className={`home-screen-overlay ${theme}`}>
      <div className="home-content animation-fade-in">
        <h1 className="home-title">
          <span className="title-tvrs">TVRS</span>
          <span className="title-maps">Maps</span>
        </h1>
        <p className="home-subtitle">L'expérience géographique interactive</p>

        <div className="home-buttons">
          <button className="home-btn mode-countries" onClick={() => onStartGame('countries')}>
            <Globe2 size={24} />
            <div className="btn-text">
              <span className="btn-title">Pays</span>
              <span className="btn-desc">Devinez tous les pays du monde</span>
            </div>
          </button>

          <button className="home-btn mode-capitals" onClick={() => onStartGame('capitals')}>
            <MapPin size={24} />
            <div className="btn-text">
              <span className="btn-title">Capitales</span>
              <span className="btn-desc">Trouvez la capitale de chaque pays</span>
            </div>
          </button>

          <button className="home-btn mode-learn disabled" disabled title="Bientôt disponible">
            <GraduationCap size={24} />
            <div className="btn-text">
              <span className="btn-title">Learn</span>
              <span className="btn-desc">Mode apprentissage (À venir)</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(HomeScreen);