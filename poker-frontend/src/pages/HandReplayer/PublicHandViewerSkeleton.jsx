import { Skeleton } from '../../components/ui/Skeleton';

// Generic (not table/seat-precise) skeleton for PublicHandViewer's loading
// state - the loaded view is a poker-table/seats graphic, a genuinely poor
// fit for a tile/row skeleton shape, so this is just enough to be visually
// consistent with the rest of the app's loading treatment for this one
// rare (share-link) path.
export function PublicHandViewerSkeleton() {
  return (
    <div className="hand-replayer public-loading">
      <Skeleton style={{ width: 280, height: 180, borderRadius: '50%' }} />
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        {[0, 1, 2].map(i => <Skeleton key={i} style={{ width: 56, height: 56, borderRadius: '50%' }} />)}
      </div>
    </div>
  );
}

export default PublicHandViewerSkeleton;
