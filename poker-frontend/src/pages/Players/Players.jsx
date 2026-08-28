import { Layout } from "../../components/Layout"
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import './Players.css';
import { PlayerInfo } from "./PlayerInfo";
import { API_URL } from "../../config";

export function Players() {
  const [players, setPlayers] = useState([]);
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
        const peopleRes = await fetch(`${API_URL}/api/people`, { credentials: "include" });
        const peopleData = await peopleRes.json();
        setPlayers(Array.isArray(peopleData) ? peopleData : []);
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

  return (
    <Layout>
      <div className="players-container">
        {players.length === 0 ? (
          <p className="no-info">
            No players yet. Map a player from the History page to get started.
          </p>
        ) : (
          <>
            <div className="player-list">
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
                filteredPlayers.map((player) => (
                  <div
                    className={`player-card ${currInfoPlayer?._id === player._id ? 'active' : ''}`}
                    key={player._id}
                    onClick={() => togglePlayerInfo(player)}
                  >
                    {player.image && (
                      <img
                        src={`${API_URL}${player.image}`}
                        alt={player.name}
                        className="player-avatar"
                      />
                    )}
                    <h3>{player.name}</h3>
                    <button
                      type="button"
                      className={`star-toggle-btn ${player.starred ? 'starred' : ''}`}
                      onClick={(e) => handleToggleStar(e, player)}
                      title={player.starred ? 'Unstar player' : 'Star player'}
                      aria-pressed={!!player.starred}
                    >
                      <Star size={16} fill={player.starred ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                ))
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