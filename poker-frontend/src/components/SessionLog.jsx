import React, { useState, useEffect } from "react";
import { HandleStars } from "./HandleStars";
import { EditSessionLog } from "./EditSessionLog.jsx";
import { API_URL } from "../config";
import "./SessionLog.css";

export function SessionLog({ sessions, onSessionsChange, onHandClick }) {
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState(null);
  const [favouriteHandIds, setFavouriteHandIds] = useState(new Set());

  useEffect(() => {
    const fetchFavourites = async () => {
      try {
        const response = await fetch(`${API_URL}/api/favourites`, {
          credentials: 'include',
        });
        if (response.ok) {
          const favourites = await response.json();
          const data = Array.isArray(favourites) ? favourites : [];
          const favouriteIds = data.map(hand =>
            typeof hand === 'string' ? hand : hand._id
          );
          setFavouriteHandIds(new Set(favouriteIds));
        }
      } catch (error) {
        console.error("Failed to fetch favourites:", error);
      }
    };
    fetchFavourites();
  }, [sessions]);

  const handleFavouriteToggle = (handId, isFavourited) => {
    setFavouriteHandIds(prev => {
      const newSet = new Set(prev);
      if (isFavourited) newSet.add(handId);
      else newSet.delete(handId);
      return newSet;
    });
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const getSessionOpponents = (session) => {
    if (!session.hands || session.hands.length === 0) return [];
    const uniquePlayers = new Set();
    session.hands.forEach(hand => {
      if (hand.players) {
        hand.players.forEach(p => {
          if (!p.isHero) uniquePlayers.add(p.name);
        });
      }
    });
    return Array.from(uniquePlayers);
  };

  const handleSessionClick = (id) => {
    setSelectedSessionId((prevId) => (prevId === id ? null : id));
  };

  const handleContextMenu = (e, session) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.pageX, y: e.pageY, session });
  };

  const handleDeleteSession = async () => {
    const sessionToDelete = contextMenu?.session;
    if (!sessionToDelete) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete this session from ${new Date(sessionToDelete.date).toLocaleDateString()}?`
    );
    if (!confirmed) { setContextMenu(null); return; }
    try {
      const response = await fetch(
        `${API_URL}/api/sessions/${sessionToDelete._id}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to delete session");
      if (onSessionsChange) {
        onSessionsChange((prevSessions) =>
          prevSessions.filter((session) => session._id !== sessionToDelete._id)
        );
      }
      setContextMenu(null);
      alert("Session deleted successfully");
    } catch (err) {
      console.error("Error deleting session", err);
      alert("Failed to delete session");
    }
  };

  const openEditModal = () => {
    const targetSession = contextMenu?.session;
    if (targetSession) {
      setSessionToEdit({ ...targetSession, opponents: getSessionOpponents(targetSession) });
      setIsEditModalOpen(true);
      setContextMenu(null);
    }
  };

  const handleSaveEdit = (updatedSession) => {
    if (onSessionsChange) {
      onSessionsChange((prevSessions) => {
        const updatedList = prevSessions.map((session) =>
          session._id === updatedSession._id ? updatedSession : session
        );
        return updatedList.sort((a, b) => new Date(b.date) - new Date(a.date));
      });
    }
  };

  const handleHandClickInternal = (e, hand, session) => {
    e.stopPropagation();
    if (onHandClick) onHandClick(hand, session);
  };

  // Derive per-hand profit: use profitLoss if available, otherwise
  // check if hero is a winner and show pot size as a win, else 0 as a loss.
  const getHandProfit = (hand) => {
    const hero = hand.players?.find((p) => p.isHero);
    if (!hero) return null;
    // Use explicit profitLoss field if present
    if (typeof hero.profitLoss === 'number') return hero.profitLoss;
    // Fallback: hero in winners = won the pot (approximate)
    const heroName = hero.name;
    const won = hand.winners?.includes(heroName);
    if (won) return hand.finalPotSize ?? 0;
    return null; // don't show if we can't determine
  };

  return (
    <>
      <ul className="sessions-list">
        {sessions.map((session) => {
          const isExpanded = selectedSessionId === session._id;
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
                  <span className="session-players">{session.hands?.length || 0} hands</span>
                </div>
                <div className={`session-profit ${session.totalProfit >= 0 ? "win" : "loss"}`}>
                  {session.totalProfit >= 0 ? "+" : ""}{session.totalProfit}
                </div>
              </div>

              {isExpanded && session.hands && (
                <ul className="hands-list">
                  {session.hands.map((hand, i) => {
                    const hero = hand.players.find((p) => p.isHero);
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
                            {hero && hero.holeCards.length > 0 ? (
                              hero.holeCards.map((card, ci) => (
                                <div key={ci} className="card-wrapper">
                                  <img
                                    src={`/images/cards/${card}.png`}
                                    alt={card}
                                    className="card-img"
                                  />
                                </div>
                              ))
                            ) : (
                              <span className="no-cards">No Cards</span>
                            )}
                          </div>
                          <span className="hand-winner">Winner: {hand.winners.join(", ")}</span>
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