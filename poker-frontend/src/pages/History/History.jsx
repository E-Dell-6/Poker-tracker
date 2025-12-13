import React, { useState, useMemo } from 'react';
import { Layout } from '../../components/Layout';
import './History.css'; 

const allSessions = [
  { id: 1, date: '2025-12-08', gameType: 'NLH', profit: 450, },
  { id: 2, date: '2025-12-05', gameType: 'PLO', profit: -120, },
  { id: 3, date: '2025-12-04', gameType: 'Heads-Up', profit: 210,},
  { id: 4, date: '2025-11-28', gameType: 'NLH', profit: -85,},
  { id: 5, date: '2025-11-25', gameType: 'PLO', profit: 600, },
];

const gameFilters = ['All', 'NLH', 'PLO', 'Heads-Up'];

export function History() {
  const [selectedGame, setSelectedGame] = useState('All');

  // Filter
  const filteredSessions = useMemo(() => {
    if (selectedGame === 'All') {
      return allSessions;
    }
    return allSessions.filter(session => session.gameType === selectedGame);
  }, [selectedGame]);

  // Function to handle clicking a session to view details
  const handleSessionClick = (sessionId) => {
    console.log(`Navigating to session details for ID: ${sessionId}`);
    // In a real app, you would use React Router's navigate function here
  };

  return (
    <Layout>
      <div className="history-container">
        <h1>Hand History Review</h1>

        {/* --- Game Type Filter --- */}
        <div className="game-filter">
          <h3>Filter by Game Type:</h3>
          <div className="filter-buttons">
            {gameFilters.map(game => (
              <button
                key={game}
                className={selectedGame === game ? 'active' : ''}
                onClick={() => setSelectedGame(game)}
              >
                {game}
              </button>
            ))}
          </div>
        </div>
        
        <hr />

        {/* --- Sessions List View --- */}
        <div className="sessions-list-container">
          <h2>Sessions ({filteredSessions.length})</h2>
          {filteredSessions.length > 0 ? (
            <ul className="sessions-list">
              {filteredSessions.map(session => (
                <li 
                  key={session.id} 
                  className="session-item"
                  onClick={() => handleSessionClick(session.id)}
                >
                  <div className="session-info">
                    <span className="session-date">Date: **{session.date}**</span>
                    <span className="session-game-type">Game: **{session.gameType}**</span>
                  </div>
                  <div className={`session-profit ${session.profit >= 0 ? 'win' : 'loss'}`}>
                    **{session.profit >= 0 ? '+' : ''}${session.profit}**
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>No sessions found for the selected game type.</p>
          )}
        </div>
      </div>
    </Layout>
  );
}