import { Skeleton } from '../../components/ui/Skeleton';

// Shaped like .session-item rows in Clock.jsx (a date/duration column + a
// row of detail bars), shown while the session history is still loading
// instead of silently showing nothing until it either pops in or turns
// out empty.
export function SessionHistorySkeleton() {
  return (
    <div className="history-section">
      <h2 className="history-title">Session History</h2>
      <div className="session-list">
        {[0, 1, 2].map(i => (
          <div key={i} className="session-item session-item--skeleton">
            <div className="session-time">
              <Skeleton style={{ width: 90, height: 16, marginBottom: 8 }} />
              <Skeleton style={{ width: 130, height: 14 }} />
            </div>
            <div className="session-details">
              <Skeleton style={{ width: 70, height: 34 }} />
              <Skeleton style={{ width: 70, height: 34 }} />
              <Skeleton style={{ width: 70, height: 34 }} />
              <Skeleton style={{ width: 70, height: 34 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SessionHistorySkeleton;
