import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { Layout } from "../../components/Layout";
import { Table, TableHead, TableBody, TableRow, TableCell } from "../../components/ui/Table";
import { Tag } from "../../components/ui/Tag";
import { Pagination } from "../../components/ui/Pagination";
import { formatAmount } from "../../utils/formatMoney";
import { parseHandQuery } from "../../utils/handQuery";
import { searchHands } from "../../api/handSearch";
import { getPeoplePage } from "../../api/people";
import { API_URL } from "../../config";
import "./SearchResults.css";

const PLAYER_PAGE_SIZE = 50;
const HAND_RESULTS_LIMIT = 200;

export function SearchResults() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const [inputValue, setInputValue] = useState(q);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [handResults, setHandResults] = useState(null);
  const [playerResults, setPlayerResults] = useState(null);
  const [playerTotal, setPlayerTotal] = useState(0);

  const parsed = q ? parseHandQuery(q) : null;

  // Keep the on-page box in sync when `q` changes from outside this page
  // (header search, browser back/forward) - page reset for those cases
  // happens for free since a fresh mount already starts at page 1; the
  // in-page resubmit path (handleSubmit below) resets it explicitly,
  // batched with the URL update itself.
  useEffect(() => {
    setInputValue(q);
  }, [q]);

  useEffect(() => {
    if (!parsed) {
      setHandResults(null);
      setPlayerResults(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        if (parsed.type === "playerName") {
          const data = await getPeoplePage({ page, limit: PLAYER_PAGE_SIZE, search: parsed.query });
          if (cancelled) return;
          setPlayerResults(Array.isArray(data.players) ? data.players : []);
          setPlayerTotal(data.total ?? 0);
          setHandResults(null);
        } else {
          const hands = await searchHands({
            handClass: parsed.type === "handClass" ? parsed.token : undefined,
            holeCards: parsed.type === "literalCards" ? parsed.cards.join(",") : undefined,
            limit: HAND_RESULTS_LIMIT,
          });
          if (cancelled) return;
          setHandResults(hands);
          setPlayerResults(null);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
        setHandResults([]);
        setPlayerResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    setPage(1);
    setSearchParams(trimmed ? { q: trimmed } : {});
  };

  const goToHand = (r) => {
    navigate("/hand-replay", {
      state: {
        hand: r.hand,
        session: {
          _id: r.sessionId,
          date: r.sessionDate,
          gameType: r.sessionGameType,
          currency: r.sessionCurrency,
          hands: [r.hand],
        },
      },
    });
  };

  const totalPages = Math.ceil(playerTotal / PLAYER_PAGE_SIZE);

  return (
    <Layout title="Search" subtitle={q ? `Results for "${q}"` : undefined}>
      <div className="search-results-container">
        <form className="search-results-searchbar" onSubmit={handleSubmit}>
          <Search size={16} className="search-results-searchbar-icon" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search hands, players..."
            autoFocus
          />
        </form>

        {!q ? (
          <p className="no-info">Type a player name, or a hand like AA, ATo, A9s, or 7h8h.</p>
        ) : loading ? (
          <p className="no-info">Searching...</p>
        ) : error ? (
          <p className="no-info">{error}</p>
        ) : handResults !== null ? (
          <>
            <div className="search-results-header">
              {handResults.length} hand{handResults.length === 1 ? "" : "s"} found
            </div>
            {handResults.length === 0 ? (
              <p className="no-info">No hands match "{q}".</p>
            ) : (
              <ul className="search-results-hand-list">
                {handResults.map((r) => {
                  const hero = r.hand.players?.find((p) => p.isHero);
                  return (
                    <li
                      key={r.hand._id}
                      className="search-results-hand-item"
                      onClick={() => goToHand(r)}
                    >
                      <span className="result-date">
                        {new Date(r.sessionDate).toLocaleDateString()}
                      </span>
                      <div className="result-cards">
                        {hero?.holeCards?.length > 0 ? (
                          hero.holeCards.map((c, i) => (
                            <img
                              key={i}
                              src={`/images/cards/${c}.png`}
                              alt={c}
                              className="result-card-img"
                            />
                          ))
                        ) : (
                          <span className="no-cards">No Cards</span>
                        )}
                      </div>
                      <span className="result-game">{r.sessionGameType}</span>
                      <span className="result-pot">
                        {formatAmount(r.hand.finalPotSize, r.sessionCurrency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : playerResults !== null ? (
          <>
            <div className="search-results-header">
              {playerTotal} player{playerTotal === 1 ? "" : "s"} found
            </div>
            {playerResults.length === 0 ? (
              <p className="no-info">No players match "{q}".</p>
            ) : (
              <>
                <Table>
                  <TableHead>
                    <TableCell header>Player</TableCell>
                    <TableCell header>Tags</TableCell>
                  </TableHead>
                  <TableBody>
                    {playerResults.map((player) => (
                      <TableRow key={player._id} onClick={() => navigate(`/players/${player._id}`)}>
                        <TableCell>
                          <div className="player-row-name">
                            {player.image ? (
                              <img
                                src={`${API_URL}${player.image}`}
                                alt={player.name}
                                className="player-avatar player-avatar--sm"
                              />
                            ) : (
                              <span className="player-avatar-placeholder">
                                {player.name.charAt(0).toUpperCase()}
                              </span>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </>
            )}
          </>
        ) : null}
      </div>
    </Layout>
  );
}

export default SearchResults;
