import React from 'react';
import { X } from 'lucide-react';
import './CardSelector.css';

// Ranks/suits match the string format stored on the Hand model
// (board.flop/turn/river and players[].holeCards): a 2-char code like
// "Ah", "Td", "9c" — rank first, suit second.
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

const SUITS = [
  { code: 's', label: '♠', color: 'black' },
  { code: 'h', label: '♥', color: 'red' },
  { code: 'd', label: '♦', color: 'red' },
  { code: 'c', label: '♣', color: 'black' },
];

export default function CardSelector({ title, usedCards, selectedCards, onSelect, onClose }) {
  const used = usedCards || new Set();
  const selected = new Set(selectedCards || []);

  return (
    <div className="cs-backdrop" onClick={onClose}>
      <div className="cs-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cs-header">
          <span className="cs-title">{title || 'Select a card'}</span>
          <button type="button" className="cs-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="cs-grid">
          {SUITS.map((suit) => (
            <div className="cs-suit-row" key={suit.code}>
              {RANKS.map((rank) => {
                const card = `${rank}${suit.code}`;
                const disabled = used.has(card);
                const isSelected = selected.has(card);
                return (
                  <button
                    type="button"
                    key={card}
                    className={`cs-card cs-card-${suit.color} ${
                      disabled ? 'cs-card-disabled' : ''
                    } ${isSelected ? 'cs-card-selected' : ''}`}
                    disabled={disabled}
                    onClick={() => onSelect(card)}
                  >
                    <span className="cs-rank">{rank}</span>
                    <span className="cs-suit">{suit.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}