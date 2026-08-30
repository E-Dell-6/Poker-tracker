import { Skeleton } from '../../components/ui/Skeleton';

// Shaped like the loaded Profile page in Profile.jsx - a hero row (avatar
// circle + name bar + PnL block), the stat-tile grid, and a chart card.
export function ProfileSkeleton() {
  return (
    <div className="profile-page">
      <div className="profile-hero">
        <Skeleton style={{ width: 76, height: 76, borderRadius: '50%' }} />
        <div className="profile-hero-info">
          <Skeleton style={{ width: 160, height: 28, marginBottom: 10 }} />
          <Skeleton style={{ width: 200, height: 18 }} />
        </div>
        <Skeleton style={{ width: 110, height: 46 }} />
      </div>
      <div className="profile-stats-grid">
        {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} style={{ height: 70 }} />)}
      </div>
      <Skeleton style={{ height: 280 }} />
    </div>
  );
}

export default ProfileSkeleton;
