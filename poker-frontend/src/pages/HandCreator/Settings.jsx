import React from 'react';
import './Settings.css';

export default function Settings({ onClose, dealerIndex, setDealerIndex, totalPlayers }) {
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Game Settings</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <label className="settings-label">Select Dealer Position</label>
            <div className="dealer-grid">
              {Array.from({ length: totalPlayers }).map((_, idx) => (
                <div
                  key={idx}
                  className={`dealer-option ${idx === dealerIndex ? 'active' : ''}`}
                  onClick={() => setDealerIndex(idx)}
                >
                  Seat {idx + 1}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}