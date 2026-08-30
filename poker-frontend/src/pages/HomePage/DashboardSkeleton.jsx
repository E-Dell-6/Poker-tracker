import { Skeleton } from '../../components/ui/Skeleton';

// Shaped like the real dashboard content in HomePage.jsx (4 tiles, 2
// main-grid cards, a header + 5 rows for recent sessions) - rendered both
// before we know whether the user's logged in and while the post-login
// data fetch is still in flight, so this covers both loading gaps with
// one shape.
export function DashboardSkeleton() {
  return (
    <>
      <div className="hp-tiles-grid">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} style={{ height: 88 }} />)}
      </div>
      <div className="hp-main-grid">
        <Skeleton style={{ height: 320 }} />
        <Skeleton style={{ height: 320 }} />
      </div>
      <section className="hp-section hp-section-dark">
        <Skeleton style={{ height: 32, width: 180, marginBottom: 16 }} />
        <Skeleton style={{ height: 44, marginBottom: 8 }} />
        {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} style={{ height: 52, marginBottom: 8 }} />)}
      </section>
    </>
  );
}

export default DashboardSkeleton;
