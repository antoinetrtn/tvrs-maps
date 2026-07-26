import "./index.css";
import "./styles/buttons.css";
import "./styles/panelSystem.css";

import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";

// Removing strict mode to prevent react-globe.gl from creating multiple instances in dev mode
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
