import React from "react";
import "./CardMenu.css";

const suits = [
  { key: "s", label: "♠", color: "black" },
  { key: "h", label: "♥", color: "red" },
  { key: "d", label: "♦", color: "red" },
  { key: "c", label: "♣", color: "black" },
];

const ranks = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];

export default function CardMenu({ onSelect }) {
  return (
    <div className="card-menu">
      {suits.map(suit =>
        ranks.map( (rank, index) => {
          const value = `${rank}${suit.key}`;
          return (
            <button
              key={value}
              className={`card-tile ${suit.color}`}
              onClick={() => onSelect(value, index)}
            >
              <span className="rank">{rank}</span>
              <span className="suit">{suit.label}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
