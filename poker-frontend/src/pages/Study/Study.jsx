import { Layout } from '../../components/Layout';
import { useState, useEffect, useMemo } from 'react';
import { calculateHeadsUpStats } from '../../utils/HeadsUpStats';
import { SessionSelector } from '../../components/SessionSelector';
import { API_URL } from '../../config';
import './Study.css';

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

const HERO_SENTINEL = '__hero__';

function calculateHeadsUpStatsForHero(heroHands) {
    if (heroHands.length === 0) return null;

    const normalizedHands = heroHands.map(hand => ({
        ...hand,
        players: hand.players.map(p =>
            p.isHero ? { ...p, name: HERO_SENTINEL } : p
        ),
        actions: (hand.actions ?? []).map(a =>
            a.player === hand._heroName ? { ...a, player: HERO_SENTINEL } : a
        )
    }));

    return calculateHeadsUpStats(normalizedHands, HERO_SENTINEL);
}

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

export function Study() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [disabledSessions, setDisabledSessions] = useState(new Set());
    const [timeFilter, setTimeFilter] = useState(null);
    const [gameTypeFilter, setGameTypeFilter] = useState('all');
    const [showSessionPanel, setShowSessionPanel] = useState(false);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${API_URL}/api/sessions`, {
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to fetch sessions');
            const data = await res.json();
            setSessions(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
            setSessions([]);
        } finally {
            setLoading(false);
        }
    };

    // Sessions shown in the panel — respect time/type filters but not manual deselection
    const panelSessions = useMemo(() => {
        let filtered = [...sessions];
        if (timeFilter !== null) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - timeFilter);
            filtered = filtered.filter(s => new Date(s.date) >= cutoff);
        }
        if (gameTypeFilter !== 'all') {
            filtered = filtered.filter(s => s.gameType === gameTypeFilter);
        }
        return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [sessions, timeFilter, gameTypeFilter]);

    // Sessions that actually feed into the stats
    const activeSessions = useMemo(() => {
        return panelSessions.filter(s => !disabledSessions.has(s._id ?? s.id));
    }, [panelSessions, disabledSessions]);

    const heroStats = useMemo(() => {
        if (gameTypeFilter === 'NLH') return { message: 'NLH stats coming soon...' };
        if (gameTypeFilter === 'PLO') return { message: 'PLO stats coming soon...' };

        const heroHands = [];
        activeSessions.forEach(session => {
            (session.hands ?? []).forEach(hand => {
                const heroPlayer = hand.players?.find(p => p.isHero);
                if (heroPlayer) {
                    heroHands.push({
                        ...hand,
                        _heroName: heroPlayer.name,
                        gameType: session.gameType,
                        sessionDate: session.date
                    });
                }
            });
        });

        return calculateHeadsUpStatsForHero(heroHands);
    }, [activeSessions, gameTypeFilter]);

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

    if (loading) {
        return (
            <Layout>
                <div className="study-page">
                    <div className="study-status-container">
                        <div className="study-spinner"></div>
                        <p>Loading your stats...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    if (error) {
        return (
            <Layout>
                <div className="study-page">
                    <div className="study-status-container">
                        <h2>Error Loading Stats</h2>
                        <p>{error}</p>
                        <button className="refresh-btn" onClick={fetchSessions}>Retry</button>
                    </div>
                </div>
            </Layout>
        );
    }

    const activeCount = panelSessions.filter(s => !disabledSessions.has(s._id ?? s.id)).length;

    return (
        <Layout>
            <div className="study-page">
                <div className="study-header">
                    <div className="study-title-row">
                        <h1>My Statistics</h1>
                        <button
                            className={`sessions-toggle-btn ${showSessionPanel ? 'active' : ''}`}
                            onClick={() => setShowSessionPanel(v => !v)}
                        >
                            📋 Sessions ({activeCount}/{panelSessions.length})
                        </button>
                    </div>
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

                {!heroStats || heroStats.totalHands === 0 ? (
                    <div className="study-status-container">
                        <h2>No Data Available</h2>
                        <p>No hands found for the selected filters.</p>
                    </div>
                ) : heroStats.message ? (
                    <div className="stats-placeholder">{heroStats.message}</div>
                ) : (
                    <div className="stats-container">
                        <div className="stats-grid">
                            <div className="stat-box">
                                <div className="stat-label">Total Hands</div>
                                <div className="stat-value">{heroStats.totalHands}</div>
                            </div>
                            <div className="stat-box">
                                <div className="stat-label">VPIP</div>
                                <div className="stat-value">{heroStats.vpip}%</div>
                            </div>
                            <div className="stat-box">
                                <div className="stat-label">PFR</div>
                                <div className="stat-value">{heroStats.pfr}%</div>
                            </div>
                        </div>

                        {heroStats.positions && Object.keys(heroStats.positions).length > 0 && (
                            <>
                                <h3 className="section-title">Position Stats</h3>
                                {Object.entries(heroStats.positions).map(([position, posStats]) => {
                                    const r = posStats._raw;
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

                        <div className="refresh-row">
                            <button className="refresh-btn" onClick={fetchSessions}>↺ Refresh Stats</button>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}

export default Study;