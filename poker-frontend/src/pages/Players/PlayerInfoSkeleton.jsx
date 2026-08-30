import { Skeleton } from '../../components/ui/Skeleton';

// Shaped like PlayerInfo.jsx - reuses its own .player-info container
// (centered flex column, same padding/background) so the skeleton sits
// exactly where the real content will: a large avatar circle, a name bar,
// a row of tag-pill placeholders, a notes-card block, a stats block.
export function PlayerInfoSkeleton() {
  return (
    <div className="player-info">
      <Skeleton style={{ width: 130, height: 130, borderRadius: '50%', marginBottom: 20 }} />
      <Skeleton style={{ width: 200, height: 32, marginBottom: 20 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        <Skeleton style={{ width: 60, height: 26, borderRadius: 999 }} />
        <Skeleton style={{ width: 60, height: 26, borderRadius: 999 }} />
      </div>
      <Skeleton style={{ width: '100%', height: 100, marginBottom: 28 }} />
      <Skeleton style={{ width: '100%', height: 160 }} />
    </div>
  );
}

export default PlayerInfoSkeleton;
