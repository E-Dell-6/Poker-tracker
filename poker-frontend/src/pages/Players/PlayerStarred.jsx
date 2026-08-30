import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import './PlayerStarred.css';
import { getPersonStarredItems } from '../../api/people';
import { formatAmount, formatSignedAmount } from '../../utils/formatMoney';

// Favourited hands saved before sessionCurrency was tracked won't have it;
// fall back to a plain number rather than calling formatAmount with an
// undefined currency.
function safeFormatAmount(amount, currency) {
  if (currency) return formatAmount(amount, currency);
  return typeof amount === 'number' ? amount.toLocaleString() : '—';
}

export function PlayerStarred({ player }) {
  const [starredHands, setStarredHands] = useState([]);
  const [starredSessions, setStarredSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!player?._id) return;
    let cancelled = false;

    const fetchStarred = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getPersonStarredItems(player._id);
        if (cancelled) return;
        setStarredHands(Array.isArray(data.starredHands) ? data.starredHands : []);
        setStarredSessions(Array.isArray(data.starredSessions) ? data.starredSessions : []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStarred();
    return () => { cancelled = true; };
  }, [player?._id]);

  if (!player) return null;

  const hasNothing = starredHands.length === 0 && starredSessions.length === 0;

  return (
    <div className="player-starred-section">
      <h2>
        <Star size={18} fill="currentColor" /> Starred
      </h2>

      {loading ? (
        <div className="starred-placeholder">Loading starred items…</div>
      ) : error ? (
        <div className="starred-placeholder">{error}</div>
      ) : hasNothing ? (
        <div className="starred-placeholder">
          No starred hands or sessions with this player yet.
        </div>
      ) : (
        <>
          {starredSessions.length > 0 && (
            <div className="starred-group">
              <h3 className="starred-group-title">Sessions</h3>
              <ul className="starred-list">
                {starredSessions.map((session) => (
                  <li key={session._id} className="starred-session-card">
                    <div className="starred-session-left">
                      <span className="starred-session-date">
                        {new Date(session.date).toLocaleDateString()}
                      </span>
                      <span className="starred-session-game-type">{session.gameType}</span>
                    </div>
                    <div
                      className={`starred-session-profit ${session.totalProfit >= 0 ? 'win' : 'loss'}`}
                    >
                      {formatSignedAmount(session.totalProfit, session.currency)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {starredHands.length > 0 && (
            <div className="starred-group">
              <h3 className="starred-group-title">Hands</h3>
              <ul className="starred-list">
                {starredHands.map((hand, i) => (
                  <li key={hand._id ?? i} className="starred-hand-card">
                    <div className="starred-hand-left">
                      <span className="starred-hand-index">#{hand.handIndex ?? i + 1}</span>
                      <span className="starred-hand-date">
                        {hand.sessionDate ? new Date(hand.sessionDate).toLocaleDateString() : ''}
                      </span>
                      <span className="starred-hand-game-type">{hand.sessionGameType}</span>
                    </div>
                    <div className="starred-hand-right">
                      <span className="starred-hand-pot">
                        {safeFormatAmount(hand.finalPotSize, hand.sessionCurrency)}
                      </span>
                      {hand.winners?.length > 0 && (
                        <span className="starred-hand-winner">
                          Winner: {hand.winners.join(', ')}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}