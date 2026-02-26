import { Layout } from '../../components/Layout';
import { useState, useEffect, useMemo, useRef } from 'react';
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

// ── Hand filtering per stat type ─────────────────────────
// Uses the actual schema: actionType (RAISE/CALL/BET/FOLD/CHECK), street (PREFLOP/FLOP/TURN/RIVER)

function getPreflopRaiseCount(hand) {
    return (hand.actions ?? []).filter(
        a => a.street === 'PREFLOP' && a.actionType === 'RAISE'
    ).length;
}

function heroAction(hand, street, types) {
    return (hand.actions ?? []).some(
        a => a.player === HERO_SENTINEL && a.street === street && types.includes(a.actionType)
    );
}

function heroFaced(hand, street, raiseNum) {
    // Hero faced an nth raise on street = opponent raised raiseNum times before hero acted
    const pfActions = (hand.actions ?? []).filter(a => a.street === street);
    let raisesSeen = 0;
    for (const a of pfActions) {
        if (a.actionType === 'RAISE') raisesSeen++;
        if (a.player === HERO_SENTINEL && raisesSeen >= raiseNum) return true;
    }
    return false;
}

function getHandsForStat(statKey, heroHands) {
    // heroHands are already normalized with HERO_SENTINEL
    switch (statKey) {
        case 'vpip':
            return heroHands.filter(h =>
                heroAction(h, 'PREFLOP', ['CALL', 'RAISE', 'BET'])
            );
        case 'pfr':
            return heroHands.filter(h =>
                heroAction(h, 'PREFLOP', ['RAISE'])
            );
        case 'totalHands':
            return heroHands;

        // SB open
        case 'open':
            return heroHands.filter(h => getPreflopRaiseCount(h) === 0 &&
                heroAction(h, 'PREFLOP', ['RAISE', 'BET'])
            );

        // BB 3-bet (faced open, hero raises)
        case '3bet':
            return heroHands.filter(h => getPreflopRaiseCount(h) >= 1 &&
                heroAction(h, 'PREFLOP', ['RAISE']) &&
                heroFaced(h, 'PREFLOP', 1)
            );

        // SB 4-bet (faced 3-bet, hero raises again)
        case '4bet':
            return heroHands.filter(h => getPreflopRaiseCount(h) >= 2 &&
                heroAction(h, 'PREFLOP', ['RAISE']) &&
                heroFaced(h, 'PREFLOP', 2)
            );

        // BB 5-bet
        case '5bet':
            return heroHands.filter(h => getPreflopRaiseCount(h) >= 3 &&
                heroAction(h, 'PREFLOP', ['RAISE']) &&
                heroFaced(h, 'PREFLOP', 3)
            );

        // SB 6-bet
        case '6bet':
            return heroHands.filter(h => getPreflopRaiseCount(h) >= 4 &&
                heroAction(h, 'PREFLOP', ['RAISE']) &&
                heroFaced(h, 'PREFLOP', 4)
            );

        case '7bet':
            return heroHands.filter(h => getPreflopRaiseCount(h) >= 5 &&
                heroAction(h, 'PREFLOP', ['RAISE']) &&
                heroFaced(h, 'PREFLOP', 5)
            );

        case '8bet':
            return heroHands.filter(h => getPreflopRaiseCount(h) >= 6 &&
                heroAction(h, 'PREFLOP', ['RAISE']) &&
                heroFaced(h, 'PREFLOP', 6)
            );

        case '9bet':
            return heroHands.filter(h => getPreflopRaiseCount(h) >= 7 &&
                heroAction(h, 'PREFLOP', ['RAISE']) &&
                heroFaced(h, 'PREFLOP', 7)
            );

        // Defends = called/raised facing a raise
        case 'defend1bet':
            return heroHands.filter(h =>
                heroFaced(h, 'PREFLOP', 1) &&
                heroAction(h, 'PREFLOP', ['CALL', 'RAISE'])
            );
        case 'defend3bet':
            return heroHands.filter(h =>
                heroFaced(h, 'PREFLOP', 2) &&
                heroAction(h, 'PREFLOP', ['CALL', 'RAISE'])
            );
        case 'defend4bet':
            return heroHands.filter(h =>
                heroFaced(h, 'PREFLOP', 3) &&
                heroAction(h, 'PREFLOP', ['CALL', 'RAISE'])
            );
        case 'defend5bet':
            return heroHands.filter(h =>
                heroFaced(h, 'PREFLOP', 4) &&
                heroAction(h, 'PREFLOP', ['CALL', 'RAISE'])
            );
        case 'defend6bet':
            return heroHands.filter(h =>
                heroFaced(h, 'PREFLOP', 5) &&
                heroAction(h, 'PREFLOP', ['CALL', 'RAISE'])
            );
        case 'defend7bet':
            return heroHands.filter(h =>
                heroFaced(h, 'PREFLOP', 6) &&
                heroAction(h, 'PREFLOP', ['CALL', 'RAISE'])
            );
        case 'defend8bet':
            return heroHands.filter(h =>
                heroFaced(h, 'PREFLOP', 7) &&
                heroAction(h, 'PREFLOP', ['CALL', 'RAISE'])
            );

        default:
            return [];
    }
}

// ── StatBox ───────────────────────────────────────────────
function StatBox({ label, value, opportunities, statKey, onSelect, isActive }) {
    if (!opportunities) return null;
    return (
        <div
            className={`stat-box ${isActive ? 'stat-box--active' : ''}`}
            onClick={() => onSelect?.(statKey, label)}
            title="Click to see hands"
        >
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}%</div>
            <div className="stat-sample">{opportunities} hands</div>
        </div>
    );
}

// ── Hand Drawer ───────────────────────────────────────────
function HandDrawer({ label, hands, onClose, drawerRef }) {
    if (!hands) return null;
    return (
        <div className="hand-drawer" ref={drawerRef}>
            <div className="hand-drawer-header">
                <div className="hand-drawer-title">
                    <span className="hand-drawer-label">{label}</span>
                    <span className="hand-drawer-count">{hands.length} hands</span>
                </div>
                <button className="hand-drawer-close" onClick={onClose}>✕</button>
            </div>
            <div className="hand-drawer-list">
                {hands.length === 0 && (
                    <div className="hand-drawer-empty">No matching hands found.</div>
                )}
                {hands.map((hand, i) => {
                    const hero = hand.players?.find(p => p.isHero || p.name === HERO_SENTINEL);
                    const profit = typeof hero?.profitLoss === 'number'
                        ? hero.profitLoss
                        : (hand.winners?.includes(hero?.name) ? hand.finalPotSize : null);
                    const date = hand.sessionDate
                        ? new Date(hand.sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : '';

                    return (
                        <div key={hand._id ?? i} className="hand-drawer-item">
                            <span className="hdi-index">#{hand.handIndex ?? i + 1}</span>

                            <div className="hdi-cards">
                                {hero?.holeCards?.length > 0
                                    ? hero.holeCards.map((card, ci) => (
                                        <div key={ci} className="hdi-card-wrap">
                                            <img src={`/images/cards/${card}.png`} alt={card} className="hdi-card-img" />
                                        </div>
                                    ))
                                    : <span className="hdi-no-cards">—</span>
                                }
                            </div>

                            <span className="hdi-winner">
                                {hand.winners?.join(', ') || '—'}
                            </span>

                            <span className="hdi-pot">Pot: {hand.finalPotSize ?? '—'}</span>

                            {profit !== null && (
                                <span className={`hdi-profit ${profit >= 0 ? 'win' : 'loss'}`}>
                                    {profit >= 0 ? '+' : ''}{profit}
                                </span>
                            )}

                            {date && <span className="hdi-date">{date}</span>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────
export function Study() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [disabledSessions, setDisabledSessions] = useState(new Set());
    const [timeFilter, setTimeFilter] = useState(null);
    const [gameTypeFilter, setGameTypeFilter] = useState('all');
    const [showSessionPanel, setShowSessionPanel] = useState(false);
    const [selectedStat, setSelectedStat] = useState(null); // { key, label, hands[] }
    const drawerRef = useRef(null);

    useEffect(() => { fetchSessions(); }, []);

    const fetchSessions = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${API_URL}/api/sessions`, { credentials: 'include' });
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

    const activeSessions = useMemo(() => {
        return panelSessions.filter(s => !disabledSessions.has(s._id ?? s.id));
    }, [panelSessions, disabledSessions]);

    // Build normalized heroHands for both stats and drawer filtering
    const heroHands = useMemo(() => {
        const hands = [];
        activeSessions.forEach(session => {
            (session.hands ?? []).forEach(hand => {
                const heroPlayer = hand.players?.find(p => p.isHero);
                if (heroPlayer) {
                    const normalized = {
                        ...hand,
                        _heroName: heroPlayer.name,
                        gameType: session.gameType,
                        sessionDate: session.date,
                        players: hand.players.map(p =>
                            p.isHero ? { ...p, name: HERO_SENTINEL } : p
                        ),
                        actions: (hand.actions ?? []).map(a =>
                            a.player === heroPlayer.name ? { ...a, player: HERO_SENTINEL } : a
                        ),
                    };
                    hands.push(normalized);
                }
            });
        });
        return hands;
    }, [activeSessions]);

    const heroStats = useMemo(() => {
        if (gameTypeFilter === 'NLH') return { message: 'NLH stats coming soon...' };
        if (gameTypeFilter === 'PLO') return { message: 'PLO stats coming soon...' };
        if (heroHands.length === 0) return null;
        return calculateHeadsUpStats(heroHands, HERO_SENTINEL);
    }, [heroHands, gameTypeFilter]);

    const handleStatClick = (statKey, label) => {
        if (selectedStat?.key === statKey) {
            setSelectedStat(null);
            return;
        }
        const hands = getHandsForStat(statKey, heroHands);
        setSelectedStat({ key: statKey, label, hands });
        // Scroll drawer into view after render
        setTimeout(() => {
            drawerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
    };

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

    // Helper to build StatBox props including statKey and handler
    const mkStat = (label, value, opportunities, statKey) => ({
        label, value, opportunities, statKey,
        onSelect: handleStatClick,
        isActive: selectedStat?.key === statKey,
    });

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
                            <div className="stat-box" onClick={() => handleStatClick('totalHands', 'All Hands')}>
                                <div className="stat-label">Total Hands</div>
                                <div className="stat-value">{heroStats.totalHands}</div>
                            </div>
                            <div className={`stat-box ${selectedStat?.key === 'vpip' ? 'stat-box--active' : ''}`}
                                onClick={() => handleStatClick('vpip', 'VPIP Hands')}>
                                <div className="stat-label">VPIP</div>
                                <div className="stat-value">{heroStats.vpip}%</div>
                            </div>
                            <div className={`stat-box ${selectedStat?.key === 'pfr' ? 'stat-box--active' : ''}`}
                                onClick={() => handleStatClick('pfr', 'PFR Hands')}>
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
                                                    <StatBox {...mkStat('Open %', posStats.openPct, r.opportunities1Bet, 'open')} />
                                                    <StatBox {...mkStat('4-Bet %', posStats.fourBetPct, r.opportunities4Bet, '4bet')} />
                                                    <StatBox {...mkStat('Defend vs 3-Bet %', posStats.defend3BetPct, r.opportunities4Bet, 'defend3bet')} />
                                                    <StatBox {...mkStat('6-Bet %', posStats.sixBetPct, r.opportunities6Bet, '6bet')} />
                                                    <StatBox {...mkStat('Defend vs 5-Bet %', posStats.defend5BetPct, r.opportunities6Bet, 'defend5bet')} />
                                                    <StatBox {...mkStat('8-Bet %', posStats.eightBetPct, r.opportunities8Bet, '8bet')} />
                                                    <StatBox {...mkStat('Defend vs 7-Bet %', posStats.defend7BetPct, r.opportunities8Bet, 'defend7bet')} />
                                                </div>
                                            ) : (
                                                <div className="stats-grid">
                                                    <StatBox {...mkStat('3-Bet %', posStats.threeBetPct, r.facedOpen, '3bet')} />
                                                    <StatBox {...mkStat('Defend vs Open %', posStats.defend1BetPct, r.facedOpen, 'defend1bet')} />
                                                    <StatBox {...mkStat('5-Bet %', posStats.fiveBetPct, r.opportunities5Bet, '5bet')} />
                                                    <StatBox {...mkStat('Defend vs 4-Bet %', posStats.defend4BetPct, r.opportunities5Bet, 'defend4bet')} />
                                                    <StatBox {...mkStat('7-Bet %', posStats.sevenBetPct, r.opportunities7Bet, '7bet')} />
                                                    <StatBox {...mkStat('Defend vs 6-Bet %', posStats.defend6BetPct, r.opportunities7Bet, 'defend6bet')} />
                                                    <StatBox {...mkStat('9-Bet %', posStats.nineBetPct, r.opportunities9Bet, '9bet')} />
                                                    <StatBox {...mkStat('Defend vs 8-Bet %', posStats.defend8BetPct, r.opportunities9Bet, 'defend8bet')} />
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

                        {/* Hand Drawer */}
                        {selectedStat && (
                            <HandDrawer
                                label={selectedStat.label}
                                hands={selectedStat.hands}
                                onClose={() => setSelectedStat(null)}
                                drawerRef={drawerRef}
                            />
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
}

export default Study;