import React, { useState, useEffect } from "react";
import { API_URL } from "../config";
import { HAND_FILTERS } from "../utils/handFilters";
import { formatAmount } from "../utils/formatMoney";
import "./HandSearchMenu.css";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS = [
  { key: "s", symbol: "♠" },
  { key: "h", symbol: "♥" },
  { key: "d", symbol: "♦" },
  { key: "c", symbol: "♣" },
];

const GAME_TYPES = ["All", "NLH", "PLO", "Heads-Up"];
const POSITIONS = ["BTN", "SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN/SB"];

// PLO deals 4 hole cards instead of NLH's 2. Rather than branching the
// card picker's logic by game type, we just let the user pick up to 4
// cards the hero must hold - the backend checks holeCards is a superset
// of the selection, which is naturally correct for both: an NLH hand's
// 2-card holeCards array simply can't satisfy a selection of 3+ cards,
// no special-casing required.
const MAX_SELECTABLE_CARDS = 4;

export function HandSearchMenu({ onHandClick }) {
  const [isOpen, setIsOpen] = useState(false);
  const [gameType, setGameType] = useState("All");
  const [result, setResult] = useState("all");
  const [filterKey, setFilterKey] = useState("");
  const [position, setPosition] = useState("");
  const [selectedCards, setSelectedCards] = useState([]);
  const [results, setResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const toggleCard = (card) => {
    setSelectedCards((prev) => {
      if (prev.includes(card)) return prev.filter((c) => c !== card);
      if (prev.length >= MAX_SELECTABLE_CARDS) return prev;
      return [...prev, card];
    });
  };

  const runSearch = async () => {
    setIsSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (gameType !== "All") params.set("gameType", gameType);
      if (result !== "all") params.set("result", result);
      if (filterKey) params.set("filter", filterKey);
      if (position) params.set("position", position);
      if (selectedCards.length > 0) params.set("holeCards", selectedCards.join(","));

      const res = await fetch(`${API_URL}/api/hands/search?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(Array.isArray(data.hands) ? data.hands : []);
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setGameType("All");
    setResult("all");
    setFilterKey("");
    setPosition("");
    setSelectedCards([]);
    setResults(null);
    setError(null);
  };

  return (
    <div className="hand-search-menu">
      <button
        type="button"
        className="hand-search-toggle"
        onClick={() => setIsOpen(true)}
      >
        🔍 Search Hands
      </button>

      {isOpen && (
        <div className="hand-search-overlay" onClick={() => setIsOpen(false)}>
          <div className="hand-search-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hand-search-modal-header">
              <h3>Search Hands</h3>
              <button
                type="button"
                className="hand-search-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="hand-search-row">
              <label>Game</label>
              <div className="hand-search-pillgroup">
                {GAME_TYPES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={gameType === g ? "active" : ""}
                    onClick={() => setGameType(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="hand-search-row">
              <label>Result</label>
              <div className="hand-search-pillgroup">
                {[
                  { key: "all", label: "All" },
                  { key: "won", label: "Won" },
                  { key: "lost", label: "Lost" },
                ].map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    className={result === r.key ? "active" : ""}
                    onClick={() => setResult(r.key)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="hand-search-row">
              <label>Action</label>
              <div className="hand-search-pillgroup">
                <button
                  type="button"
                  className={filterKey === "" ? "active" : ""}
                  onClick={() => setFilterKey("")}
                >
                  Any
                </button>
                {HAND_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={filterKey === f.key ? "active" : ""}
                    onClick={() => setFilterKey(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="hand-search-row">
              <label>Position</label>
              <div className="hand-search-pillgroup">
                <button
                  type="button"
                  className={position === "" ? "active" : ""}
                  onClick={() => setPosition("")}
                >
                  Any
                </button>
                {POSITIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={position === p ? "active" : ""}
                    onClick={() => setPosition(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="hand-search-row">
              <label>
                Hole Cards
                {selectedCards.length > 0 && ` (${selectedCards.length}/${MAX_SELECTABLE_CARDS})`}
              </label>
              <div className="card-grid">
                {RANKS.map((rank) => (
                  <div key={rank} className="card-grid-row">
                    {SUITS.map((suit) => {
                      const card = `${rank}${suit.key}`;
                      const isRed = suit.key === "h" || suit.key === "d";
                      const isSelected = selectedCards.includes(card);
                      return (
                        <button
                          key={card}
                          type="button"
                          className={`card-cell ${isRed ? "red" : "black"} ${isSelected ? "selected" : ""}`}
                          onClick={() => toggleCard(card)}
                        >
                          {rank}{suit.symbol}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="hand-search-actions">
              <button type="button" className="hand-search-clear" onClick={clearSearch}>
                Clear
              </button>
              <button
                type="button"
                className="hand-search-run"
                onClick={runSearch}
                disabled={isSearching}
              >
                {isSearching ? "Searching..." : "Search"}
              </button>
            </div>

            {error && <div className="hand-search-error">{error}</div>}

            {results !== null && (
              <div className="hand-search-results">
                <div className="hand-search-results-header">
                  {results.length} hand{results.length === 1 ? "" : "s"} found
                </div>
                {results.length === 0 ? (
                  <div className="hand-search-empty">No hands match these filters.</div>
                ) : (
                  <ul className="hand-search-results-list">
                    {results.map((r) => {
                      const hero = r.hand.players?.find((p) => p.isHero);
                      return (
                        <li
                          key={r.hand._id}
                          className="hand-search-result-item"
                          onClick={() => {
                            setIsOpen(false);
                            onHandClick?.(r.hand, {
                              _id: r.sessionId,
                              date: r.sessionDate,
                              gameType: r.sessionGameType,
                              currency: r.sessionCurrency,
                              hands: [r.hand],
                            });
                          }}
                        >
                          <span className="result-date">
                            {new Date(r.sessionDate).toLocaleDateString()}
                          </span>
                          <div className="result-cards">
                            {hero?.holeCards?.length > 0 ? (
                              hero.holeCards.map((c, i) => (
                                <img
                                  key={i}
                                  src={`/images/cards/${c}.png`}
                                  alt={c}
                                  className="result-card-img"
                                />
                              ))
                            ) : (
                              <span className="no-cards">No Cards</span>
                            )}
                          </div>
                          <span className="result-game">{r.sessionGameType}</span>
                          <span className="result-pot">
                            {formatAmount(r.hand.finalPotSize, r.sessionCurrency)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}