import React, { useEffect } from "react";
import "./Controller.css";

export default function Controller({ 
  actionIndex, 
  totalActions, 
  initialIndex,
  onNext, 
  onPrev 
}) {

  const progress = totalActions > 0 
    ? ((actionIndex - initialIndex) / (totalActions - initialIndex)) * 100 
    : 0;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "ArrowRight") {
        if (actionIndex < totalActions) {
          onNext();
        }
      } else if (event.key === "ArrowLeft") {
        if (actionIndex > initialIndex) {
          onPrev();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionIndex, totalActions, initialIndex, onNext, onPrev]);

  return (
    <div className="controls">
      <button onClick={onPrev} disabled={actionIndex === initialIndex}>
        Prev
      </button>
      <div className="progress-container">
        <div className="progress-bar" style={{ width: `${progress}%` }}></div>
        <span className="progress-text">
          {actionIndex} / {totalActions}
        </span>
      </div>
      <button onClick={onNext} disabled={actionIndex === totalActions}>
        Next
      </button>
    </div>
  );
}