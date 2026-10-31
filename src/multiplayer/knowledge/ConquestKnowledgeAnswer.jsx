import "./ConquestKnowledgeAnswer.css";

import { ChevronDown, ChevronUp } from "pixelarticons/react";
import React from "react";

import IconButton from "../../components/ui/IconButton.jsx";
import OptionGroup from "../../components/ui/OptionGroup.jsx";
import Slider from "../../components/ui/Slider.jsx";
import PixelIcon from "./PixelIcon.jsx";

const parseOrder = (value, fallback) => {
  try {
    const list = JSON.parse(value);
    return Array.isArray(list) ? list : fallback;
  } catch {
    return fallback;
  }
};

/** Pick one answer among 4 named pixel visuals (same mode as the flag step). */
const ChoiceAnswer = ({ challenge, value, onChange, label }) => (
  <OptionGroup
    className="conquest-knowledge-options"
    options={(challenge.options || []).map((option, index) => ({
      value: option,
      label: option,
      icon: <PixelIcon iconId={challenge.icons?.[index]} />,
    }))}
    value={value}
    onChange={onChange}
    label={label}
  />
);

/** Numeric answer on the kit slider (value ± tolerance checked server-side). */
const NumberAnswer = ({ challenge, value, onChange, label }) => {
  const unit = challenge.unit ? ` ${challenge.unit}` : "";
  return (
    <Slider
      className="conquest-knowledge-slider"
      min={Number(challenge.min)}
      max={Number(challenge.max)}
      step={Number(challenge.step) || 1}
      value={Number(value)}
      onChange={(next) => onChange(String(next))}
      label={label}
      formatValue={(v) => `${v}${unit}`}
    />
  );
};

/** Put the items back in order with up / down buttons; the value is the JSON list. */
const OrderAnswer = ({ challenge, value, onChange, t }) => {
  const options = challenge.options || [];
  const order = parseOrder(value, options);
  const iconOf = (item) => challenge.icons?.[options.indexOf(item)];
  const move = (index, dir) => {
    const next = [...order];
    [next[index], next[index + dir]] = [next[index + dir], next[index]];
    onChange(JSON.stringify(next));
  };
  return (
    <ol className="conquest-knowledge-order">
      {order.map((item, index) => (
        <li key={item} className="conquest-knowledge-order-row">
          <PixelIcon iconId={iconOf(item)} />
          <span className="conquest-knowledge-order-label">{item}</span>
          <IconButton
            variant="outline"
            size="sm"
            label={`${t.orderUp} : ${item}`}
            disabled={index === 0}
            onClick={() => move(index, -1)}
          >
            <ChevronUp width={16} height={16} />
          </IconButton>
          <IconButton
            variant="outline"
            size="sm"
            label={`${t.orderDown} : ${item}`}
            disabled={index === order.length - 1}
            onClick={() => move(index, 1)}
          >
            <ChevronDown width={16} height={16} />
          </IconButton>
        </li>
      ))}
    </ol>
  );
};

const ANSWERS = { choice: ChoiceAnswer, number: NumberAnswer, order: OrderAnswer };

/**
 * Knowledge ladder step answer (choice grid, slider or ordering). Text answers reuse the
 * capital TextField in ConquestStealPanel. Loaded on demand (pixel icons + slider).
 */
const ConquestKnowledgeAnswer = (props) => {
  const Answer = ANSWERS[props.challenge.answer_type] || ChoiceAnswer;
  return <Answer {...props} />;
};

export default ConquestKnowledgeAnswer;
