import React, { useEffect, useState } from "react";

const TimelineItem = ({ event, color, text, time }) => (
  <li className={event.kind === "lock" ? "is-lock" : undefined}>
    <span
      className="conquest-feed-swatch"
      style={color ? { "--actor-color": color } : undefined}
      aria-hidden="true"
    />
    <span className="conquest-feed-text">{text}</span>
    <time className="conquest-timeline-time" dateTime={event.created_at}>
      {time}
    </time>
  </li>
);

/**
 * Per-country history (captures, steals, reinforcements, lock) read from the server on
 * demand, shown in the answer slot. Lazy chunk: wording, colours and the close button
 * come from the HUD so this file pulls nothing else into the bundle.
 */
const ConquestCountryTimeline = ({ t, lang, title, countryId, load, describe, colorOf, close }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.resolve(load(countryId))
      .then((res) => alive && setData(res || { events: [] }))
      .catch(() => alive && setData({ events: [] }));
    return () => {
      alive = false;
    };
  }, [countryId, load]);

  const time = (iso) =>
    new Date(iso).toLocaleTimeString(lang, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  return (
    <section className="conquest-steal conquest-timeline" aria-label={t.timelineTitle}>
      <div className="conquest-steal-header">
        <span className="conquest-label">
          {t.timelineTitle} · {title}
          {data?.locked ? ` · ${t.timelineLocked}` : ""}
        </span>
        {close}
      </div>
      {data && (
        <ol className="conquest-timeline-list">
          {data.events.map((event) => (
            <TimelineItem
              key={event.id}
              event={event}
              color={colorOf(event.actor_id)}
              text={describe(event)}
              time={time(event.created_at)}
            />
          ))}
        </ol>
      )}
    </section>
  );
};

export default ConquestCountryTimeline;
