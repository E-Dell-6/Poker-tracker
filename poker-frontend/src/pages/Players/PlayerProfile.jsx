import { Layout } from '../../components/Layout';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PlayerInfo } from './PlayerInfo';
import { API_URL } from '../../config';
import './Players.css'; // shared .no-info empty-state style
import './PlayerProfile.css';

// Routed profile page for a single player (`/players/:personId`) - a real
// navigation with a back button, replacing the old in-place toggle panel
// Players.jsx used to render. No dedicated single-player GET endpoint
// exists (peopleRoute.js only has list GET /), so this fetches the same
// list Players.jsx does and finds the match client-side - identical data,
// no new endpoint needed at this app's scale.
export function PlayerProfile() {
  const { personId } = useParams();
  const navigate = useNavigate();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/people`, { credentials: 'include' });
        const people = await res.json();
        if (!cancelled) setPlayer((Array.isArray(people) ? people : []).find(p => p._id === personId) || null);
      } catch (error) {
        console.error('Error fetching player:', error);
        if (!cancelled) setPlayer(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [personId]);

  return (
    <Layout title="Players" subtitle={player?.name}>
      <div className="player-profile-page">
        <button type="button" className="player-profile-back-btn" onClick={() => navigate('/players')}>
          <ArrowLeft size={16} /> Back to Players
        </button>

        {loading ? (
          <p className="no-info">Loading player…</p>
        ) : !player ? (
          <p className="no-info">Player not found.</p>
        ) : (
          <PlayerInfo player={player} onPlayerUpdate={setPlayer} />
        )}
      </div>
    </Layout>
  );
}

export default PlayerProfile;
