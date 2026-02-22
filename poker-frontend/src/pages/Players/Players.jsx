import { Layout } from "../../components/Layout"
import { useEffect, useState } from "react";
import './Players.css';
import { PlayerInfo } from "./PlayerInfo";

export function Players() {
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currInfoPlayer, setCurrInfoPlayer] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [peopleRes, sessionsRes] = await Promise.all([
          fetch("http://localhost:1111/api/people", { credentials: "include" }),
          fetch("http://localhost:1111/api/sessions", { credentials: "include" }),
        ]);

        const peopleData = await peopleRes.json();
        const sessionsData = await sessionsRes.json();

        setPlayers(Array.isArray(peopleData) ? peopleData : []);
        setSessions(Array.isArray(sessionsData) ? sessionsData : []);
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
              {players.map((player) => (
                <div
                  className={`player-card ${currInfoPlayer?._id === player._id ? 'active' : ''}`}
                  key={player._id}
                  onClick={() => togglePlayerInfo(player)}
                >
                  {player.image && (
                    <img
                      src={`http://localhost:1111${player.image}`}
                      alt={player.name}
                      className="player-avatar"
                    />
                  )}
                  <h3>{player.name}</h3>
                </div>
              ))}
            </div>
            {currInfoPlayer && (
              <div className="player-info-container">
                <PlayerInfo
                  player={currInfoPlayer}
                  sessions={sessions}
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