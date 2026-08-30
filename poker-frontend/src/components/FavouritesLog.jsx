import React, { useState, useEffect } from "react";
import { Star } from "lucide-react";
import './FavouritesLog.css';
import { API_URL } from "../config";
import { Tag } from "./ui/Tag";

// ── Filter definitions ───────────────────────────────────
// Mirrors SessionLog.jsx's HAND_FILTERS exactly (same keys/labels/logic)
// so "3-Bet" etc. mean the same thing in both views. Duplicated here
// rather than shared, since these two components live in different files
// with no existing shared-utils module.
const HAND_FILTERS = [
  { key: "flop",  label: "Saw Flop" },
  { key: "allin", label: "All-In"   },
  { key: "3bet",  label: "3-Bet"    },
  { key: "4bet",  label: "4-Bet"    },
  { key: "5bet",  label: "5-Bet"    },
  { key: "6bet",  label: "6-Bet"    },
];

function sawFlop(hand) {
  return hand.board?.flop?.length > 0;
}

function hadAllIn(hand) {
  if (hand.hasAllIn || hand.allIn) return true;

  const players = hand.players ?? [];
  for (const p of players) {
    if (p.winnings > 0 && p.winnings > p.stack) return true;
  }

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

// Same fallback chain as SessionLog.jsx's getHandProfit: prefer an
// explicit profitLoss if one's ever added to the schema, otherwise treat
// "hero is a listed winner" as "won the full pot".
function getHandProfit(hand) {
  const hero = hand.players?.find(p => p.isHero);
  if (!hero) return null;
  if (typeof hero.profitLoss === "number") return hero.profitLoss;
  const won = hand.winners?.includes(hero.name);
  if (won) return hand.finalPotSize ?? 0;
  return null;
}

export function FavouritesLog({ hands: initialHands, onHandClick }) {
  const [hands, setHands] = useState([]);
  const [starredHands, setStarredHands] = useState({});
  const [activeFilter, setActiveFilter] = useState(null);

  useEffect(() => {
    setHands(initialHands || []);
    const initialStars = {};
    (initialHands || []).forEach(hand => {
      initialStars[hand._id] = true;
    });
    setStarredHands(initialStars);
  }, [initialHands]);

  // Note: unlike SessionLog (where a hand lives inside a Session and the
  // star can go either way), everything rendered here is *already* a
  // favourite — so clicking the star is always "remove from favourites",
  // never "add". That's a DELETE against the Favourite subdocument, not
  // the add/remove toggle SessionLog's HandleStars performs.
  const handleStarClick = (handId) => {
    setStarredHands(prev => {
      const newStatus = !prev[handId];

      setTimeout(async () => {
        if (!newStatus) {
          try {
            await fetch(`${API_URL}/api/favourites/${handId}`, {
              method: "DELETE",
              credentials: "include",
            });
            setHands(prevHands => prevHands.filter(h => h._id !== handId));
          } catch (err) {
            console.error("Failed to delete hand", err);
            setStarredHands(prev => ({ ...prev, [handId]: true }));
          }
        }
      }, 500);

      return { ...prev, [handId]: newStatus };
    });
  };

  const setFilter = (filterKey) => {
    setActiveFilter(prev => (prev === filterKey ? null : filterKey));
  };

  const availableFilters = getAvailableFilters(hands);
  const visibleHands = activeFilter
    ? hands.filter(h => handMatchesFilter(h, activeFilter))
    : hands;

  if (!hands || hands.length === 0) {
    return (
      <div className="favourites-container">
        <div className="empty-state">
          <p>No favourite hands yet. Click the <Star size={14} style={{ verticalAlign: '-2px' }} fill="currentColor" /> button on hands to add them!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="favourites-container">
      {availableFilters.length > 0 && (
        <div className="hand-filter-bar">
          {availableFilters.map(f => (
            <button
              key={f.key}
              className={`hand-filter-btn ${activeFilter === f.key ? "active" : ""}`}
              onClick={() => setFilter(f.key)}
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
          const isStarred = starredHands[hand._id];
          const handProfit = getHandProfit(hand);

          return (
            <li
              key={hand._id || i}
              className="hand-item"
              onClick={() => onHandClick && onHandClick(hand, {
                // Favourite subdocuments denormalize these three fields
                // onto the hand itself (see handRoute.js) rather than
                // linking to a live Session document — this is a
                // reconstructed stand-in "session" for onHandClick's
                // sake, not a real one. It'll be blank for hands that
                // were created directly into Favourites (e.g. via
                // HandCreator) rather than favourited from a session.
                date: hand.sessionDate,
                gameType: hand.sessionGameType,
                _id: hand.sessionId,
              })}
            >
              <div className="hand-info">
                <span className="hand-index">#{hand.handIndex >= 0 ? hand.handIndex : i + 1}</span>

                {hand.sessionDate && (
                  <span className="hand-date">{new Date(hand.sessionDate).toLocaleDateString()}</span>
                )}
                {hand.sessionGameType && (
                  <Tag variant="neutral" label={hand.sessionGameType} />
                )}

                <div className="hand-cards">
                  {hero?.holeCards?.filter(Boolean).length > 0 ? (
                    hero.holeCards.filter(Boolean).map((card, ci) => (
                      <div key={ci} className="card-wrapper">
                        <img src={`/images/cards/${card}.png`} alt={card} className="card-img" />
                      </div>
                    ))
                  ) : (
                    <span className="no-cards">No Cards</span>
                  )}
                </div>

                <span className="hand-winner">
                  {hand.winners?.length > 0 ? `Winner: ${hand.winners.join(", ")}` : "Winner: N/A"}
                </span>
              </div>

              <div className="hand-right">
                <div className="hand-pot">
                  <span className="pot-label">Pot:</span>
                  <strong>{hand.finalPotSize ?? 0}</strong>
                </div>
                {handProfit !== null && (
                  <div className={`hand-profit ${handProfit >= 0 ? "win" : "loss"}`}>
                    {handProfit >= 0 ? "+" : ""}{handProfit}
                  </div>
                )}
              </div>

              <button
                className="star-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStarClick(hand._id);
                }}
                aria-label={isStarred ? "Remove from favourites" : "Add to favourites"}
              >
                <Star size={16} fill={isStarred ? "currentColor" : "none"} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}