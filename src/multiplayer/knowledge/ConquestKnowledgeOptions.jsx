import "./ConquestKnowledgeOptions.css";

import React from "react";

import OptionGroup from "../../components/ui/OptionGroup.jsx";
import PixelIcon from "./PixelIcon.jsx";

/**
 * Knowledge ladder step (levels 3 to 5): same pick-one answer mode as the flag step,
 * 4 named pixel visuals. The value sent back is the option label (checked server-side).
 */
const ConquestKnowledgeOptions = ({ options = [], icons = [], value, onChange, label }) => (
  <OptionGroup
    className="conquest-knowledge-options"
    options={options.map((option, index) => ({
      value: option,
      label: option,
      icon: <PixelIcon iconId={icons[index]} />,
    }))}
    value={value}
    onChange={onChange}
    label={label}
  />
);

export default ConquestKnowledgeOptions;
