import React, { useState, useEffect } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { HandleStars } from "./HandleStars";
import { EditSessionLog } from "./EditSessionLog.jsx";
import { API_URL } from "../config";
import { formatAmount, formatSignedAmount } from "../utils/formatMoney";
import { handMatchesFilter, getAvailableFilters } from "../utils/handFilters";
import "./SessionLog.css";

export function SessionLog({ sessions, onSessionsChange, onHandClick }) {
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState(null);
  const [favouriteHandIds, setFavouriteHandIds] = useState(new Set());
  const [sessionFilters, setSessionFilters] = useState({});

  // Session list no longer carries `hands` (see GET /api/sessions on the
  // backend) - hand detail is fetched lazily per session, the first time
  // it's expanded or opened for editing, and cached here so toggling the
  // row open/closed again doesn't refetch.
  const [handsBySession, setHandsBySession] = useState({});
  const [loadingHandsFor, setLoadingHandsFor] = useState(() => new Set());

  const fetchHandsForSession = async (sessionId) => {
    if (handsBySession[sessionId]) return handsBySession[sessionId];
    setLoadingHandsFor(prev => new Set(prev).add(sessionId));
    try {
      const res = await fetch(`${API_URL}/api/sessions/${sessionId}/hands`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load hands");
      const data = await res.json();
      const hands = Array.isArray(data.hands) ? data.hands : [];
      setHandsBySession(prev => ({ ...prev, [sessionId]: hands }));
      return hands;
    } catch (err) {
      console.error("Failed to fetch hands for session", sessionId, err);
      return [];
    } finally {
      setLoadingHandsFor(prev => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

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

  const getSessionOpponents = (hands) => {
    if (!hands?.length) return [];
    const unique = new Set();
    hands.forEach(hand => {
      hand.players?.forEach(p => { if (!p.isHero) unique.add(p.name); });
    });
    return Array.from(unique);
  };

  const handleSessionClick = (id) => {
    setSelectedSessionId(prev => {
      const next = prev === id ? null : id;
      if (next) fetchHandsForSession(next);
      return next;
    });
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
    } catch (err) {
      alert("Failed to delete session");
    }
  };

  const openEditModal = async () => {
    const s = contextMenu?.session;
    setContextMenu(null);
    if (!s) return;
    const hands = await fetchHandsForSession(s._id);
    setSessionToEdit({ ...s, hands, opponents: getSessionOpponents(hands) });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (updated) => {
    onSessionsChange?.(prev =>
      prev.map(s => s._id === updated._id ? updated : s)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
    );
  };

  const handleHandClickInternal = (e, hand, session, hands) => {
    e.stopPropagation();
    // HandReplayer needs session.hands (for prev/next-hand navigation within
    // the replay). The list-level `session` no longer carries it, so attach
    // the hands we already fetched for this expanded row before navigating.
    onHandClick?.(hand, { ...session, hands });
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
          const hands = handsBySession[session._id] ?? [];
          const isLoadingHands = isExpanded && loadingHandsFor.has(session._id);
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
                <div className="session-left">
                  <span className="session-date">{new Date(session.date).toLocaleDateString()}</span>
                  <span className="session-game-type">{session.gameType}</span>
                  <span className="session-players">{session.totalHands ?? hands.length} hands</span>
                </div>
                <div className={`session-profit ${session.totalProfit >= 0 ? "win" : "loss"}`}>
                  {formatSignedAmount(session.totalProfit, session.currency)}
                </div>
              </div>

              {isExpanded && isLoadingHands && (
                <div className="hands-loading">Loading hands...</div>
              )}

              {isExpanded && !isLoadingHands && (
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
                          onClick={(e) => handleHandClickInternal(e, hand, session, hands)}
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
                              <strong>{formatAmount(hand.finalPotSize, session.currency)}</strong>
                            </div>
                            {handProfit !== null && (
                              <div className={`hand-profit ${handProfit >= 0 ? "win" : "loss"}`}>
                                {formatSignedAmount(handProfit, session.currency)}
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
          <div className="menu-item" onClick={openEditModal}><Pencil size={14} /> Edit Session</div>
          <div className="menu-item delete" onClick={handleDeleteSession}><Trash2 size={14} /> Delete</div>
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