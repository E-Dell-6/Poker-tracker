import { useState, useEffect, useMemo } from 'react';
import './PlayerStats.css';
import { SessionSelector } from '../../components/SessionSelector';
import { calculateHeadsUpStats } from '../../utils/HeadsUpStats';

const TIME_FILTERS = [
  { label: 'Last 30 Days', value: 30 },
  { label: 'Last 60 Days', value: 60 },
  { label: 'Last 90 Days', value: 90 },
  { label: 'All Time', value: null }
];

const GAME_TYPE_FILTERS = [
  { label: 'All Games', value: 'all' },
  { label: 'Heads-Up', value: 'Heads-Up' },
  { label: 'NLH', value: 'NLH' },
  { label: 'PLO', value: 'PLO' }
];

// Only render a StatBox if there were actual opportunities for it
function StatBox({ label, value, opportunities }) {
  if (!opportunities) return null;
  return (
    <div className="stat-box">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}%</div>
      <div className="stat-sample">{opportunities} hands</div>
    </div>
  );
}

export function PlayerStats({ player, sessions }) {
  const [timeFilter, setTimeFilter] = useState(null);
  const [gameTypeFilter, setGameTypeFilter] = useState('all');
  const [disabledSessions, setDisabledSessions] = useState(new Set());
  const [showSessionPanel, setShowSessionPanel] = useState(false);

  // Reset disabled sessions when player changes
  useEffect(() => {
    setDisabledSessions(new Set());
  }, [player?._id]);

  // Sessions shown in the panel — respect time/type filters
  const panelSessions = useMemo(() => {
    if (!sessions?.length) return [];
    let filtered = [...sessions];
    if (timeFilter !== null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - timeFilter);
      filtered = filtered.filter(s => new Date(s.date) >= cutoff);
    }
    if (gameTypeFilter !== 'all') {
      filtered = filtered.filter(s => s.gameType === gameTypeFilter);
    }
    // Only show sessions where this player appears
    filtered = filtered.filter(s =>
      s.hands?.some(h => h.players?.find(p => p.name === player?.name))
    );
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [sessions, timeFilter, gameTypeFilter, player]);

  const activeSessions = useMemo(() =>
    panelSessions.filter(s => !disabledSessions.has(s._id ?? s.id)),
    [panelSessions, disabledSessions]
  );

  const stats = useMemo(() => {
    if (!player || !activeSessions.length) return null;
    if (gameTypeFilter === 'NLH') return { message: 'NLH stats coming soon...' };
    if (gameTypeFilter === 'PLO') return { message: 'PLO stats coming soon...' };

    const playerHands = [];
    activeSessions.forEach(session => {
      (session.hands ?? []).forEach(hand => {
        if (hand.players?.find(p => p.name === player.name)) {
          playerHands.push({ ...hand, gameType: session.gameType, sessionDate: session.date });
        }
      });
    });

    return calculateHeadsUpStats(playerHands, player.name);
  }, [player, activeSessions, gameTypeFilter]);

  const toggleSession = (id) => {
    setDisabledSessions(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = (enable) => {
    setDisabledSessions(prev => {
      const next = new Set(prev);
      panelSessions.forEach(s => {
        const id = s._id ?? s.id;
        enable ? next.delete(id) : next.add(id);
      });
      return next;
    });
  };

  if (!player) return null;

  const activeCount = panelSessions.filter(s => !disabledSessions.has(s._id ?? s.id)).length;

  return (
    <div className="player-stats-section">
      <div className="stats-header">
        <h2>Statistics</h2>
        <button
          className={`sessions-toggle-btn ${showSessionPanel ? 'active' : ''}`}
          onClick={() => setShowSessionPanel(v => !v)}
        >
          📋 Sessions ({activeCount}/{panelSessions.length})
        </button>
      </div>

      {showSessionPanel && (
        <SessionSelector
          sessions={panelSessions}
          disabledSessions={disabledSessions}
          onToggle={toggleSession}
          onToggleAll={toggleAll}
        />
      )}

      <div className="stats-filters">
        <div className="filter-group">
          <label>Time Period</label>
          <div className="filter-buttons">
            {TIME_FILTERS.map(f => (
              <button
                key={f.label}
                className={`filter-btn ${timeFilter === f.value ? 'active' : ''}`}
                onClick={() => setTimeFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <label>Game Type</label>
          <div className="filter-buttons">
            {GAME_TYPE_FILTERS.map(f => (
              <button
                key={f.label}
                className={`filter-btn ${gameTypeFilter === f.value ? 'active' : ''}`}
                onClick={() => setGameTypeFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!stats || stats.totalHands === 0 ? (
        <div className="stats-placeholder">No data available for the selected filters.</div>
      ) : stats.message ? (
        <div className="stats-placeholder">{stats.message}</div>
      ) : (
        <div className="stats-container">
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-label">Total Hands</div>
              <div className="stat-value">{stats.totalHands}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">VPIP</div>
              <div className="stat-value">{stats.vpip}%</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">PFR</div>
              <div className="stat-value">{stats.pfr}%</div>
            </div>
          </div>

          {stats.positions && Object.keys(stats.positions).length > 0 && (
            <>
              <h3 className="section-title">Position Stats</h3>
              {Object.entries(stats.positions).map(([position, posStats]) => {
                const r = posStats._raw;
                // Only render position block if there were hands in it
                const hasData = r && (r.opportunities1Bet > 0 || r.facedOpen > 0);
                if (!hasData) return null;
                return (
                  <div key={position} className="position-stats">
                    <h4>{position}</h4>
                    {position === 'Small Blind' ? (
                      <div className="stats-grid">
                        <StatBox label="Open %" value={posStats.openPct} opportunities={r.opportunities1Bet} />
                        <StatBox label="4-Bet %" value={posStats.fourBetPct} opportunities={r.opportunities4Bet} />
                        <StatBox label="Defend vs 3-Bet %" value={posStats.defend3BetPct} opportunities={r.opportunities4Bet} />
                        <StatBox label="6-Bet %" value={posStats.sixBetPct} opportunities={r.opportunities6Bet} />
                        <StatBox label="Defend vs 5-Bet %" value={posStats.defend5BetPct} opportunities={r.opportunities6Bet} />
                        <StatBox label="8-Bet %" value={posStats.eightBetPct} opportunities={r.opportunities8Bet} />
                        <StatBox label="Defend vs 7-Bet %" value={posStats.defend7BetPct} opportunities={r.opportunities8Bet} />
                      </div>
                    ) : (
                      <div className="stats-grid">
                        <StatBox label="3-Bet %" value={posStats.threeBetPct} opportunities={r.facedOpen} />
                        <StatBox label="Defend vs Open %" value={posStats.defend1BetPct} opportunities={r.facedOpen} />
                        <StatBox label="5-Bet %" value={posStats.fiveBetPct} opportunities={r.opportunities5Bet} />
                        <StatBox label="Defend vs 4-Bet %" value={posStats.defend4BetPct} opportunities={r.opportunities5Bet} />
                        <StatBox label="7-Bet %" value={posStats.sevenBetPct} opportunities={r.opportunities7Bet} />
                        <StatBox label="Defend vs 6-Bet %" value={posStats.defend6BetPct} opportunities={r.opportunities7Bet} />
                        <StatBox label="9-Bet %" value={posStats.nineBetPct} opportunities={r.opportunities9Bet} />
                        <StatBox label="Defend vs 8-Bet %" value={posStats.defend8BetPct} opportunities={r.opportunities9Bet} />
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}