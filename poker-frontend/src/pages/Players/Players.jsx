import { Layout } from "../../components/Layout"
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import './Players.css';
import { PlayerInfo } from "./PlayerInfo";
import { Table, TableHead, TableBody, TableRow, TableCell } from "../../components/ui/Table";
import { Tag } from "../../components/ui/Tag";
import { formatSignedMajorUnits } from "../../utils/formatMoney";
import { API_URL } from "../../config";

export function Players() {
  const [players, setPlayers] = useState([]);
  const [statsByPersonId, setStatsByPersonId] = useState({});
  const [currInfoPlayer, setCurrInfoPlayer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  const filteredPlayers = players
    .filter((player) => !showStarredOnly || player.starred)
    .filter((player) =>
      player.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Person list (name/image/tags/starred) and per-opponent aggregate
        // stats (vpip/pfr/threeBet/totalProfitLoss) live in two different
        // collections - see peopleRoute.js's GET / and statsController.js's
        // listPlayerStats - fetched in parallel and merged by personId
        // rather than N+1 fetching stats per row.
        const [peopleRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/api/people`, { credentials: "include" }),
          fetch(`${API_URL}/api/stats/players`, { credentials: "include" }),
        ]);
        const peopleData = await peopleRes.json();
        const statsData = statsRes.ok ? await statsRes.json() : [];
        setPlayers(Array.isArray(peopleData) ? peopleData : []);
        const byId = {};
        (Array.isArray(statsData) ? statsData : []).forEach(s => { byId[String(s.personId)] = s; });
        setStatsByPersonId(byId);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  function togglePlayerInfo(player) {
    if (currInfoPlayer?._id === player._id) {
      setCurrInfoPlayer(null);
    } else {
      setCurrInfoPlayer(player);
    }
  }

  const handlePlayerUpdate = (updatedPlayer) => {
    setPlayers(prev => prev.map(p => p._id === updatedPlayer._id ? updatedPlayer : p));
    setCurrInfoPlayer(updatedPlayer);
  };

  const handleToggleStar = async (e, player) => {
    e.stopPropagation();
    const nextStarred = !player.starred;
    try {
      const res = await fetch(`${API_URL}/api/people/${player._id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: nextStarred }),
      });
      if (!res.ok) throw new Error('Failed to update star');
      const updatedPlayer = await res.json();
      setPlayers(prev => prev.map(p => p._id === updatedPlayer._id ? updatedPlayer : p));
      if (currInfoPlayer?._id === updatedPlayer._id) setCurrInfoPlayer(updatedPlayer);
    } catch (error) {
      console.error('Error toggling star:', error);
    }
  };

  const subtitle = players.length > 0
    ? `${players.length} tracked opponent${players.length === 1 ? '' : 's'}`
    : undefined;

  return (
    <Layout title="Players" subtitle={subtitle}>
      <div className="players-container">
        {players.length === 0 ? (
          <p className="no-info">
            No players yet. Map a player from the History page to get started.
          </p>
        ) : (
          <>
            <div className="player-list-panel">
              <div className="player-list-controls">
                <input
                  type="text"
                  className="player-search"
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                  type="button"
                  className={`star-filter-btn ${showStarredOnly ? 'active' : ''}`}
                  onClick={() => setShowStarredOnly((prev) => !prev)}
                  title={showStarredOnly ? 'Show all players' : 'Show starred players'}
                  aria-pressed={showStarredOnly}
                >
                  <Star size={16} fill={showStarredOnly ? 'currentColor' : 'none'} />
                </button>
              </div>

              {filteredPlayers.length === 0 ? (
                <p className="no-info no-info--inline">
                  {showStarredOnly
                    ? "You haven't starred any players yet."
                    : `No players match "${searchQuery}".`}
                </p>
              ) : (
                <Table>
                  <TableHead>
                    <TableCell header>Player</TableCell>
                    <TableCell header>Tags</TableCell>
                    <TableCell header align="right">Hands</TableCell>
                    <TableCell header align="right">VPIP</TableCell>
                    <TableCell header align="right">PFR</TableCell>
                    <TableCell header align="right">3-Bet</TableCell>
                    <TableCell header align="right">Won From</TableCell>
                    <TableCell header align="right"></TableCell>
                  </TableHead>
                  <TableBody>
                    {filteredPlayers.map((player) => {
                      const stat = statsByPersonId[String(player._id)];
                      const isActive = currInfoPlayer?._id === player._id;
                      return (
                        <TableRow
                          key={player._id}
                          className={isActive ? 'ui-table-row--active' : ''}
                          onClick={() => togglePlayerInfo(player)}
                        >
                          <TableCell>
                            <div className="player-row-name">
                              {player.image ? (
                                <img src={`${API_URL}${player.image}`} alt={player.name} className="player-avatar player-avatar--sm" />
                              ) : (
                                <span className="player-avatar-placeholder">{player.name.charAt(0).toUpperCase()}</span>
                              )}
                              <span>{player.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="player-row-tags">
                              {player.tags?.length > 0
                                ? player.tags.map((t, i) => <Tag key={i} label={t.label} color={t.color} />)
                                : <span className="ui-table-value-muted">—</span>}
                            </div>
                          </TableCell>
                          <TableCell align="right"><span className="ui-table-value-mono">{stat?.totalHands ?? '—'}</span></TableCell>
                          <TableCell align="right"><span className="ui-table-value-mono">{stat?.vpip?.opportunities ? `${stat.vpip.pct}%` : '—'}</span></TableCell>
                          <TableCell align="right"><span className="ui-table-value-mono">{stat?.pfr?.opportunities ? `${stat.pfr.pct}%` : '—'}</span></TableCell>
                          <TableCell align="right"><span className="ui-table-value-mono">{stat?.threeBet?.opportunities ? `${stat.threeBet.pct}%` : '—'}</span></TableCell>
                          <TableCell align="right">
                            {stat?.handsWithProfitData
                              ? (
                                <span className={`ui-table-value-mono ${stat.totalProfitLoss >= 0 ? 'ui-table-value-pos' : 'ui-table-value-neg'}`}>
                                  {stat.currency ? formatSignedMajorUnits(stat.totalProfitLoss, stat.currency) : `${stat.totalProfitLoss >= 0 ? '+' : ''}${stat.totalProfitLoss}`}
                                </span>
                              )
                              : <span className="ui-table-value-muted">—</span>}
                          </TableCell>
                          <TableCell align="right">
                            <button
                              type="button"
                              className={`star-toggle-btn ${player.starred ? 'starred' : ''}`}
                              onClick={(e) => handleToggleStar(e, player)}
                              title={player.starred ? 'Unstar player' : 'Star player'}
                              aria-pressed={!!player.starred}
                            >
                              <Star size={16} fill={player.starred ? 'currentColor' : 'none'} />
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
            {currInfoPlayer && (
              <div className="player-info-container">
                <PlayerInfo
                  player={currInfoPlayer}
                  onPlayerUpdate={handlePlayerUpdate}
                />
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

export default Players;
