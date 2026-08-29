import './StatTile.css';

// KPI card: label, big value (monospace, tabular), optional delta/sub-label
// and icon. Used on Dashboard (4 tiles) and Study (6 tiles) - no existing
// component does this today, this one's genuinely new.
export function StatTile({ label, value, delta, deltaPositive, icon: Icon, valueClassName = '' }) {
  return (
    <div className="ui-stat-tile">
      <div className="ui-stat-tile-header">
        <span className="ui-stat-tile-label">{label}</span>
        {Icon && <Icon size={15} className="ui-stat-tile-icon" />}
      </div>
      <div className={`ui-stat-tile-value ${valueClassName}`}>{value}</div>
      {delta != null && (
        <div className={`ui-stat-tile-delta ${deltaPositive === false ? 'neg' : deltaPositive === true ? 'pos' : ''}`}>
          {delta}
        </div>
      )}
    </div>
  );
}

export default StatTile;
