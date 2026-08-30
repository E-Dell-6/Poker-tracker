import { Layout } from "../../components/Layout"
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star } from "lucide-react";
import './Players.css';
import { Table, TableHead, TableBody, TableRow, TableCell } from "../../components/ui/Table";
import { Tag } from "../../components/ui/Tag";
import { Pagination } from "../../components/ui/Pagination";
import { PlayersTableSkeleton } from "./PlayersTableSkeleton";
import { formatSignedMajorUnits } from "../../utils/formatMoney";
import { getPlayersStats } from "../../api/stats";
import { getPeoplePage, updatePerson } from "../../api/people";
import { API_URL } from "../../config";

const PAGE_SIZE = 50;

export function Players() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statsByPersonId, setStatsByPersonId] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  const hasActiveFilter = Boolean(debouncedSearch) || showStarredOnly;

  // Search/starred-only filtering is pushed server-side alongside the
  // pagination itself (see peopleRoute.js's GET /) - otherwise a search
  // would only ever match whichever page happened to already be loaded.
  const fetchPlayers = () => {
    return getPeoplePage({ page, limit: PAGE_SIZE, search: debouncedSearch, starred: showStarredOnly })
      .then(data => {
        setPlayers(Array.isArray(data.players) ? data.players : []);
        setTotal(data.total ?? 0);
      })
      .catch(error => console.error('Error fetching players:', error))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, showStarredOnly]);

  // Debounce the search box so typing doesn't refetch per keystroke -
  // setPage(1) lands in the same batched update as the debounced value
  // itself, so the fetch effect above only fires once with the final
  // (search, page) pair instead of once with a stale page and once correct.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Per-opponent aggregate stats (vpip/pfr/threeBet/totalProfitLoss) live in
  // a separate collection - see statsController.js's listPlayerStats -
  // fetched once, in full, and joined to whichever page of players is
  // currently shown by personId. Left unpaginated: it's a lean,
  // no-embedded-hands collection, cheap to fetch regardless of roster size,
  // and pagination here would just mean keeping two paginated fetches in
  // sync for no real benefit.
  useEffect(() => {
    getPlayersStats()
      .then(statsData => {
        const byId = {};
        statsData.forEach(s => { byId[String(s.personId)] = s; });
        setStatsByPersonId(byId);
      })
      .catch(error => console.error('Error fetching player stats:', error));
  }, []);

  const handleToggleStarredOnly = () => { setPage(1); setShowStarredOnly(prev => !prev); };

  const handleToggleStar = async (e, player) => {
    e.stopPropagation();
    const nextStarred = !player.starred;
    try {
      await updatePerson(player._id, { starred: nextStarred });
      // Refetch rather than patch the local array in place - if
      // "starred only" is active, un-starring a player has to drop them
      // from the current page (and the total count), which a simple
      // in-place update can't do correctly across pages.
      await fetchPlayers();
    } catch (error) {
      console.error('Error toggling star:', error);
    }
  };

  const subtitle = total > 0
    ? `${total} tracked opponent${total === 1 ? '' : 's'}`
    : undefined;

  return (
    <Layout title="Players" subtitle={subtitle}>
      <div className="players-container">
        {loading ? (
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
                onClick={handleToggleStarredOnly}
                title={showStarredOnly ? 'Show all players' : 'Show starred players'}
                aria-pressed={showStarredOnly}
              >
                <Star size={16} fill={showStarredOnly ? 'currentColor' : 'none'} />
              </button>
            </div>
            <PlayersTableSkeleton />
          </div>
        ) : total === 0 && !hasActiveFilter ? (
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
                  onClick={handleToggleStarredOnly}
                  title={showStarredOnly ? 'Show all players' : 'Show starred players'}
                  aria-pressed={showStarredOnly}
                >
                  <Star size={16} fill={showStarredOnly ? 'currentColor' : 'none'} />
                </button>
              </div>

              {players.length === 0 ? (
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
                    {players.map((player) => {
                      const stat = statsByPersonId[String(player._id)];
                      return (
                        <TableRow
                          key={player._id}
                          onClick={() => navigate(`/players/${player._id}`)}
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
              <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

export default Players;
