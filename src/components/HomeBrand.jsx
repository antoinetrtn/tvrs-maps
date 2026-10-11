import React from "react";

/** PROTOTYPE — compact pixel wordmark replacing the large ASCII logo. */
const HomeBrand = ({ className = "" }) => (
  <div className={`home-brand ${className}`} aria-label="Tvrs Maps">
    <span className="home-brand-mark" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
    <span className="home-brand-word" data-text="TVRS">
      TVRS
    </span>
    <span className="home-brand-sub">MAPS</span>
  </div>
);

export default HomeBrand;
