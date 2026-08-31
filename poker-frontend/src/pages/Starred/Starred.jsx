import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Star, Upload } from "lucide-react";
import { Layout } from "../../components/Layout";
import { SessionLog } from "../../components/SessionLog";
import { FavouritesLog } from "../../components/FavouritesLog";
import { Tag } from "../../components/ui/Tag";
import { Tabs } from "../../components/ui/Tabs";
import { getFavourites } from "../../api/favourites";
import { getSessions, updateSession } from "../../api/sessions";
import { getPeoplePage, updatePerson } from "../../api/people";
import { API_URL } from "../../config";
import "./Starred.css";

// One page, unpaginated - starred sets are expected to stay small (a
// handful of hands/sessions/players someone deliberately flagged), so a
// single generous limit keeps this page simple rather than juggling three
// independent paginators.
const FETCH_LIMIT = 200;

// Pages whose own header carries the "Import hands" CTA - mirrored here so
// arriving on /starred from one of them keeps the button available instead
// of it just disappearing. The actual upload UI lives on History, so the
// button navigates there rather than duplicating the upload flow.
const IMPORT_CTA_PATHS = ["/", "/dashboard", "/history"];

export function Starred() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("hands");

  const fromPath = location.state?.from?.split("?")[0];
  const showImportCta = fromPath ? IMPORT_CTA_PATHS.includes(fromPath) : false;

  const [hands, setHands] = useState([]);
  const [handsLoading, setHandsLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(true);

  const fetchHands = useCallback(() => {
    return getFavourites()
      .then(setHands)
      .catch((err) => console.error("Failed to load starred hands:", err))
      .finally(() => setHandsLoading(false));
  }, []);

  const fetchSessions = useCallback(() => {
    return getSessions({ page: 1, limit: FETCH_LIMIT, starred: true })
      .then((data) => setSessions(Array.isArray(data.sessions) ? data.sessions : []))
      .catch((err) => console.error("Failed to load starred sessions:", err))
      .finally(() => setSessionsLoading(false));
  }, []);

  const fetchPlayers = useCallback(() => {
    return getPeoplePage({ page: 1, limit: FETCH_LIMIT, starred: true })
      .then((data) => setPlayers(Array.isArray(data.players) ? data.players : []))
      .catch((err) => console.error("Failed to load starred players:", err))
      .finally(() => setPlayersLoading(false));
  }, []);

  useEffect(() => { fetchHands(); }, [fetchHands]);
  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

  const handleToggleSessionStar = async (session) => {
    try {
      await updateSession(session._id, { starred: !session.starred });
      // Refetch rather than patch in place - unstarring has to drop the
      // session from this already-starred-only list.
      await fetchSessions();
    } catch (err) {
      console.error("Error toggling session star:", err);
    }
  };

  const handleTogglePlayerStar = async (player) => {
    try {
      await updatePerson(player._id, { starred: !player.starred });
      await fetchPlayers();
    } catch (err) {
      console.error("Error toggling player star:", err);
    }
  };

  const goToHand = (hand, session) => navigate("/hand-replay", { state: { hand, session } });

  const tabOptions = [
    { key: "hands", label: `Hands${handsLoading ? "" : ` (${hands.length})`}` },
    { key: "sessions", label: `Sessions${sessionsLoading ? "" : ` (${sessions.length})`}` },
    { key: "players", label: `Players${playersLoading ? "" : ` (${players.length})`}` },
  ];

  return (
    <Layout
      title="Starred"
      subtitle="Hands, sessions, and players you've starred"
      ctaLabel={showImportCta ? "Import hands" : undefined}
      ctaIcon={showImportCta ? Upload : undefined}
      onCta={showImportCta ? () => navigate("/history") : undefined}
    >
      <div className="starred-page">
        <Tabs options={tabOptions} active={activeTab} onChange={setActiveTab} />

        {activeTab === "hands" && (
          handsLoading ? (
            <div className="starred-section-placeholder">Loading…</div>
          ) : (
            <FavouritesLog hands={hands} onHandClick={goToHand} />
          )
        )}

        {activeTab === "sessions" && (
          sessionsLoading ? (
            <div className="starred-section-placeholder">Loading…</div>
          ) : sessions.length === 0 ? (
            <div className="starred-section-placeholder">No starred sessions yet.</div>
          ) : (
            <SessionLog
              sessions={sessions}
              onSessionsChange={() => fetchSessions()}
              onHandClick={goToHand}
              onToggleStar={handleToggleSessionStar}
            />
          )
        )}

        {activeTab === "players" && (
          playersLoading ? (
            <div className="starred-section-placeholder">Loading…</div>
          ) : players.length === 0 ? (
            <div className="starred-section-placeholder">
              No starred players yet. Click the <Star size={13} style={{ verticalAlign: "-2px" }} fill="currentColor" /> button on a player to add them.
            </div>
          ) : (
            <ul className="starred-players-grid">
              {players.map((player) => (
                <li
                  key={player._id}
                  className="starred-player-card"
                  onClick={() => navigate(`/players/${player._id}`)}
                >
                  <div className="starred-player-info">
                    {player.image ? (
                      <img src={`${API_URL}${player.image}`} alt={player.name} className="starred-player-avatar" />
                    ) : (
                      <span className="starred-player-avatar starred-player-avatar--placeholder">
                        {player.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="starred-player-name">{player.name}</span>
                  </div>
                  {player.tags?.length > 0 && (
                    <div className="starred-player-tags">
                      {player.tags.map((t, i) => <Tag key={i} label={t.label} color={t.color} />)}
                    </div>
                  )}
                  <button
                    type="button"
                    className="starred-player-star-btn"
                    onClick={(e) => { e.stopPropagation(); handleTogglePlayerStar(player); }}
                    title="Unstar player"
                    aria-pressed="true"
                  >
                    <Star size={16} fill="currentColor" />
                  </button>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </Layout>
  );
}

export default Starred;
