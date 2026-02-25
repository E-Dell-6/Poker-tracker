import React, { useState, useEffect } from "react";
import { HandleStars } from "./HandleStars";
import { EditSessionLog } from "./EditSessionLog.jsx";
import { API_URL } from "../config";
import "./SessionLog.css";

// ── Filter definitions ───────────────────────────────────
const HAND_FILTERS = [
  { key: "flop",  label: "Saw Flop" },
  { key: "allin", label: "All-In"   },
  { key: "3bet",  label: "3-Bet"    },
  { key: "4bet",  label: "4-Bet"    },
  { key: "5bet",  label: "5-Bet"    },
  { key: "6bet",  label: "6-Bet"    },
];

function sawFlop(hand) {
  // board.flop is an array of card strings
  return hand.board?.flop?.length > 0;
}

function hadAllIn(hand) {
  // A player is all-in when they raise/call/bet and their remaining stack is 0
  // We detect this by checking if any player's winnings indicate they put in their whole stack,
  // or if a RAISE/CALL/BET action amount equals the player's starting stack
  if (hand.hasAllIn || hand.allIn) return true;

  // Check if any player put in exactly their full stack (winnings covers full stack or stack = 0 after action)
  const players = hand.players ?? [];
  for (const p of players) {
    // If a player won more than their stack, they were all-in
    if (p.winnings > 0 && p.winnings > p.stack) return true;
  }

  // Check actions: if a RAISE or CALL amount equals a player's stack, it's all-in
  const actions = hand.actions ?? [];
  for (const a of actions) {
    if (a.actionType === "RAISE" || a.actionType === "CALL" || a.actionType === "BET") {
      const player = players.find(p => p.name === a.player);
      if (player && a.amount >= player.stack) return true;
    }
  }

  return false;
}

function countPreflopRaises(hand) {
  // actionType is uppercase: 'RAISE'. Street is uppercase: 'PREFLOP'
  // First action (open raise) counts as raise 1 (the open).
  // 3-bet = 2 raises preflop, 4-bet = 3, etc.
  return (hand.actions ?? []).filter(
    a => a.street === "PREFLOP" && a.actionType === "RAISE"
  ).length;
}

function handMatchesFilter(hand, filter) {
  switch (filter) {
    case "flop":  return sawFlop(hand);
    case "allin": return hadAllIn(hand);
    case "3bet":  return countPreflopRaises(hand) >= 2;
    case "4bet":  return countPreflopRaises(hand) >= 3;
    case "5bet":  return countPreflopRaises(hand) >= 4;
    case "6bet":  return countPreflopRaises(hand) >= 5;
    default:      return true;
  }
}

function getAvailableFilters(hands) {
  return HAND_FILTERS.filter(f => hands.some(h => handMatchesFilter(h, f.key)));
}

export function SessionLog({ sessions, onSessionsChange, onHandClick }) {
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState(null);
  const [favouriteHandIds, setFavouriteHandIds] = useState(new Set());
  const [sessionFilters, setSessionFilters] = useState({});

  useEffect(() => {
    const fetchFavourites = async () => {
      try {
        const response = await fetch(`${API_URL}/api/favourites`, { credentials: "include" });
        if (response.ok) {
          const favourites = await response.json();
          const data = Array.isArray(favourites) ? favourites : [];
          const ids = data.map(h => typeof h === "string" ? h : h._id);
          setFavouriteHandIds(new Set(ids));
        }
      } catch (err) {
        console.error("Failed to fetch favourites:", err);
      }
    };
    fetchFavourites();
  }, [sessions]);

  const handleFavouriteToggle = (handId, isFavourited) => {
    setFavouriteHandIds(prev => {
      const next = new Set(prev);
      if (isFavourited) next.add(handId);
      else next.delete(handId);
      return next;
    });
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const getSessionOpponents = (session) => {
    if (!session.hands?.length) return [];
    const unique = new Set();
    session.hands.forEach(hand => {
      hand.players?.forEach(p => { if (!p.isHero) unique.add(p.name); });
    });
    return Array.from(unique);
  };

  const handleSessionClick = (id) => {
    setSelectedSessionId(prev => prev === id ? null : id);
  };

  const handleContextMenu = (e, session) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.pageX, y: e.pageY, session });
  };

  const handleDeleteSession = async () => {
    const s = contextMenu?.session;
    if (!s) return;
    if (!window.confirm(`Delete session from ${new Date(s.date).toLocaleDateString()}?`)) {
      setContextMenu(null); return;
    }
    try {
      const res = await fetch(`${API_URL}/api/sessions/${s._id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete session");
      onSessionsChange?.(prev => prev.filter(x => x._id !== s._id));
      setContextMenu(null);
      alert("Session deleted successfully");
    } catch (err) {
      alert("Failed to delete session");
    }
  };

  const openEditModal = () => {
    const s = contextMenu?.session;
    if (s) {
      setSessionToEdit({ ...s, opponents: getSessionOpponents(s) });
      setIsEditModalOpen(true);
      setContextMenu(null);
    }
  };

  const handleSaveEdit = (updated) => {
    onSessionsChange?.(prev =>
      prev.map(s => s._id === updated._id ? updated : s)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
    );
  };

  const handleHandClickInternal = (e, hand, session) => {
    e.stopPropagation();
    onHandClick?.(hand, session);
  };

  const getHandProfit = (hand) => {
    const hero = hand.players?.find(p => p.isHero);
    if (!hero) return null;
    if (typeof hero.profitLoss === "number") return hero.profitLoss;
    const won = hand.winners?.includes(hero.name);
    if (won) return hand.finalPotSize ?? 0;
    return null;
  };

  const setFilterForSession = (sessionId, filterKey) => {
    setSessionFilters(prev => ({
      ...prev,
      [sessionId]: prev[sessionId] === filterKey ? null : filterKey,
    }));
  };

  return (
    <>
      <ul className="sessions-list">
        {sessions.map((session) => {
          const isExpanded = selectedSessionId === session._id;
          const activeFilter = sessionFilters[session._id] ?? null;
          const hands = session.hands ?? [];
          const availableFilters = isExpanded ? getAvailableFilters(hands) : [];
          const visibleHands = activeFilter
            ? hands.filter(h => handMatchesFilter(h, activeFilter))
            : hands;

          return (
            <li
              key={session._id}
              className="session-card"
              onClick={() => handleSessionClick(session._id)}
              onContextMenu={(e) => handleContextMenu(e, session)}
            >
              <div className="session-header">
                <div className="session-info">
                  <span className="session-date">{new Date(session.date).toLocaleDateString()}</span>
                  <span className="session-game-type">{session.gameType}</span>
                  <span className="session-players">{hands.length} hands</span>
                </div>
                <div className={`session-profit ${session.totalProfit >= 0 ? "win" : "loss"}`}>
                  {session.totalProfit >= 0 ? "+" : ""}{session.totalProfit}
                </div>
              </div>

              {isExpanded && (
                <>
                  {availableFilters.length > 0 && (
                    <div
                      className="hand-filter-bar"
                      onClick={e => e.stopPropagation()}
                    >
                      {availableFilters.map(f => (
                        <button
                          key={f.key}
                          className={`hand-filter-btn ${activeFilter === f.key ? "active" : ""}`}
                          onClick={() => setFilterForSession(session._id, f.key)}
                        >
                          {f.label}
                          <span className="hand-filter-count">
                            {hands.filter(h => handMatchesFilter(h, f.key)).length}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <ul className="hands-list">
                    {visibleHands.length === 0 && (
                      <li className="hands-empty-filter">No hands match this filter.</li>
                    )}
                    {visibleHands.map((hand, i) => {
                      const hero = hand.players?.find(p => p.isHero);
                      const isStarred = favouriteHandIds.has(hand._id);
                      const handProfit = getHandProfit(hand);
                      return (
                        <li
                          key={i}
                          className="hand-item"
                          onClick={(e) => handleHandClickInternal(e, hand, session)}
                        >
                          <div className="hand-info">
                            <span className="hand-index">#{hand.handIndex || i + 1}</span>
                            <div className="hand-cards">
                              {hero && hero.holeCards?.length > 0 ? (
                                hero.holeCards.map((card, ci) => (
                                  <div key={ci} className="card-wrapper">
                                    <img src={`/images/cards/${card}.png`} alt={card} className="card-img" />
                                  </div>
                                ))
                              ) : (
                                <span className="no-cards">No Cards</span>
                              )}
                            </div>
                            <span className="hand-winner">Winner: {hand.winners?.join(", ")}</span>
                          </div>
                          <div className="hand-right">
                            <div className="hand-pot">
                              <span className="pot-label">Pot:</span>
                              <strong>{hand.finalPotSize}</strong>
                            </div>
                            {handProfit !== null && (
                              <div className={`hand-profit ${handProfit >= 0 ? "win" : "loss"}`}>
                                {handProfit >= 0 ? "+" : ""}{handProfit}
                              </div>
                            )}
                          </div>
                          <HandleStars
                            hand={hand}
                            isStarred={isStarred}
                            onToggle={handleFavouriteToggle}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <div className="menu-item" onClick={openEditModal}>✏️ Edit Session</div>
          <div className="menu-item delete" onClick={handleDeleteSession}>🗑️ Delete</div>
        </div>
      )}

      <EditSessionLog
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        sessionData={sessionToEdit}
        onSave={handleSaveEdit}
      />
    </>
  );
}