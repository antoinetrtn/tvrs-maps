import "./index.css";
import "./styles/buttons.css";
import "./styles/panelSystem.css";
import "./styles/glitchMoments.css";
import "./styles/motion.css";

import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";

const root = ReactDOM.createRoot(document.getElementById("root"));

// Dev-only component gallery: `import.meta.env.DEV` is false in production builds,
// so Vite drops this branch and the gallery chunk entirely.
if (import.meta.env.DEV && window.location.hash.startsWith("#/dev/components")) {
  import("./dev/DevGallery.jsx")
    .then(({ default: DevGallery }) => root.render(<DevGallery />))
    .catch((err) => console.error(err));
} else {
  // Removing strict mode to prevent react-globe.gl from creating multiple instances in dev mode
  root.render(<App />);
}
