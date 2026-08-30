import { Skeleton } from '../../components/ui/Skeleton';

// Shaped like SessionLog's session-card rows - a date bar, a tag-pill, a
// hands-count bar, a profit bar, and a star-circle per row. Reuses
// SessionLog.css's own .session-card/.session-header classes (already
// loaded on the History page) so it lines up with the real rows.
export function SessionListSkeleton() {
  return (
    <ul className="sessions-list">
      {[0, 1, 2, 3, 4].map(i => (
        <li key={i} className="session-card session-card--skeleton">
          <div className="session-header">
            <div className="session-left">
              <Skeleton style={{ width: 70, height: 16 }} />
              <Skeleton style={{ width: 44, height: 18, borderRadius: 999 }} />
              <Skeleton style={{ width: 56, height: 14 }} />
            </div>
            <div className="session-right">
              <Skeleton style={{ width: 60, height: 18 }} />
              <Skeleton style={{ width: 24, height: 24, borderRadius: '50%' }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default SessionListSkeleton;
