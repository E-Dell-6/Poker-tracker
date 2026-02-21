import React, { useState, useEffect } from "react";
import './FavouritesLog.css';

export function FavouritesLog({ hands: initialHands, onHandClick }) {
  const [hands, setHands] = useState([]);
  const [starredHands, setStarredHands] = useState({});

  // Initialize hands and starredHands when props change
  useEffect(() => {
    setHands(initialHands || []);
    const initialStars = {};
    (initialHands || []).forEach(hand => {
      initialStars[hand._id] = true; // all favourite hands start as starred
    });
    setStarredHands(initialStars);
  }, [initialHands]);

  const handleStarClick = (handId) => {
    setStarredHands(prev => {
      const newStatus = !prev[handId];

      // Delay deletion
      setTimeout(async () => {
        if (!newStatus) {
          try {
            await fetch(`http://localhost:1111/api/favourites/${handId}`, {
              method: "DELETE"
            });
            console.log(`Deleted hand ${handId} from backend`);

            // Remove the hand from local state so UI updates
            setHands(prevHands => prevHands.filter(h => h._id !== handId));
          } catch (err) {
            console.error("Failed to delete hand", err);
            // Optionally revert star
            setStarredHands(prev => ({ ...prev, [handId]: true }));
          }
        }
      }, 500);

      return { ...prev, [handId]: newStatus };
    });
  };

  if (!hands || hands.length === 0) {
    return (
      <div className="empty-state">
        <p>No favourite hands yet. Click the ⭐ button on hands to add them!</p>
      </div>
    );
  }

  return (
    <div className="favourites-container">
      <ul className="hands-list">
        {hands.map((hand, i) => {
          const hero = hand.players?.find(p => p.isHero);
          const holeCards = hero?.holeCards && Array.isArray(hero.holeCards) && hero.holeCards.length > 0
            ? hero.holeCards.filter(card => card).join(" ")
            : "No Cards";

          const isStarred = starredHands[hand._id];

          return (
            <li
              key={hand._id || i}
              className="hand-item"
              onClick={() => onHandClick && onHandClick(hand, {
                date: hand.sessionDate,
                gameType: hand.sessionGameType,
                _id: hand.sessionId
              })}
            >
              <div className="hand-info">
                <span className="hand-date">{hand.sessionDate ? new Date(hand.sessionDate).toLocaleDateString() : "N/A"}</span>
                <span className="hand-game-type">{hand.sessionGameType || "N/A"}</span>
                <span className="hand-index">#{hand.handIndex >= 0 ? hand.handIndex : i + 1}</span>
                <span className="hand-cards">{holeCards}</span>
                <span className="hand-winner">{hand.winners && hand.winners.length > 0 ? `Winner: ${hand.winners.join(", ")}` : "Winner: N/A"}</span>
              </div>

              <div className="hand-pot">
                <span className="pot-label">Pot:</span>
                {hand.finalPotSize || 0}
              </div>

              <button
                className="star-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStarClick(hand._id);
                }}
              >
                {isStarred ? '⭐' : '☆'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}