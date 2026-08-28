import React, { useEffect } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

const STREETS = [
  { key: "PREFLOP", label: "Preflop" },
  { key: "FLOP", label: "Flop" },
  { key: "TURN", label: "Turn" },
  { key: "RIVER", label: "River" },
];

function getCurrentStreetIndex(actionIndex, streetStartIndex) {
  let current = 0;
  STREETS.forEach((s, i) => {
    const start = streetStartIndex[s.key];
    if (start != null && actionIndex >= start) current = i;
  });
  return current;
}

export default function Controller({
  actionIndex,
  totalActions,
  initialIndex,
  streetStartIndex = {},
  onNext,
  onPrev,
  onSeek,
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "ArrowRight") {
        if (actionIndex < totalActions) onNext();
      } else if (event.key === "ArrowLeft") {
        if (actionIndex > initialIndex) onPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actionIndex, totalActions, initialIndex, onNext, onPrev]);

  const currentStreetIdx = getCurrentStreetIndex(actionIndex, streetStartIndex);
  const isComplete = totalActions > 0 && actionIndex >= totalActions;

  return (
    <div className="controls">
      <button className="controls-nav-btn" onClick={onPrev} disabled={actionIndex === initialIndex}>
        <ChevronLeft size={16} /> Prev
      </button>

      <div className="street-track">
        {STREETS.map((s, i) => {
          const start = streetStartIndex[s.key];
          const available = start != null;
          const state = !available
            ? "unavailable"
            : isComplete || i < currentStreetIdx
            ? "complete"
            : i === currentStreetIdx
            ? "active"
            : "upcoming";

          return (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <div className={`street-connector ${i <= currentStreetIdx || isComplete ? "filled" : ""}`} />
              )}
              <button
                type="button"
                className={`street-step street-step--${state}`}
                disabled={!available}
                onClick={() => available && onSeek(start)}
                title={available ? s.label : `No ${s.label.toLowerCase()} this hand`}
              >
                <span className="street-step-dot">
                  {state === "complete" ? <Check size={11} /> : null}
                </span>
                <span className="street-step-label">{s.label}</span>
              </button>
            </React.Fragment>
          );
        })}
        {isComplete && <span className="street-track-done">Showdown</span>}
      </div>

      <button className="controls-nav-btn" onClick={onNext} disabled={actionIndex === totalActions}>
        Next <ChevronRight size={16} />
      </button>
    </div>
  );
}
