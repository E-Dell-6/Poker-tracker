import { Skeleton } from '../../components/ui/Skeleton';

// Shaped like the loaded Study page in Stats.jsx - 6 blocks in
// .study-tiles-grid, 2 chart-card blocks (.study-charts-grid), a table
// block.
export function StudyPageSkeleton() {
  return (
    <div className="stats-container">
      <div className="study-tiles-grid">
        {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} style={{ height: 84 }} />)}
      </div>
      <div className="study-charts-grid">
        <Skeleton style={{ height: 260 }} />
        <Skeleton style={{ height: 260 }} />
      </div>
      <Skeleton style={{ height: 320 }} />
    </div>
  );
}

export default StudyPageSkeleton;
