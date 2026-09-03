import { useEffect, useState } from 'react';
import { confidenceModifier } from '../../utils/confidence';
import '../../components/PositionalStats.css'; // shared .pos-size-tabs/.pos-size-tab classes
import './MatrixTableCard.css';

// Shared between PreflopPositionMatrix and PostflopPositionMatrix (the two
// halves of what used to be one PositionMatrixTables.jsx). PositionalStats.jsx
// and StudyCharts.jsx carry their own copies of the sizes/activeSize/
// useEffect block this useTableSize() hook replaces here - left alone for
// now (out of scope for this refactor) but are natural future adopters.

const POSITION_ORDER = ['BTN', 'BTN/SB', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'];
export function sortPositions(positions) {
  return [...positions].sort((a, b) => {
    const ia = POSITION_ORDER.indexOf(a);
    const ib = POSITION_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

// Total hands across every position in a table-size bucket - see
// StudyCharts.jsx's identical helper for why this (not just the largest
// size ever seen) is what the default selection should be based on.
export function bucketHandCount(bucket) {
  return Object.values(bucket?.positions || {}).reduce((sum, p) => sum + (p.hands || 0), 0);
}

export function mostPopulousSize(positional, sizes) {
  if (sizes.length === 0) return null;
  return sizes.reduce((best, size) =>
    bucketHandCount(positional[size]) > bucketHandCount(positional[best]) ? size : best
  , sizes[0]);
}

export function RatePct({ rate }) {
  if (!rate || rate.opportunities === 0) return <span className="matrix-cell-empty">—</span>;
  const modifier = confidenceModifier(rate);
  return <span className={`matrix-cell-pct ${modifier ? `matrix-cell-pct--${modifier}` : ''}`}>{rate.pct}%</span>;
}

// `positional` is stats.positional (statsEngine.js's finalizePositional).
// Defaults to the most-played table size (not the largest ever seen), with
// a manual switcher for the rest - see mostPopulousSize above.
export function useTableSize(positional) {
  const sizes = Object.keys(positional || {}).map(Number).filter(n => !Number.isNaN(n)).sort((a, b) => b - a);
  const [activeSize, setActiveSize] = useState(null);

  useEffect(() => {
    setActiveSize(prev => (prev !== null && sizes.includes(prev) ? prev : mostPopulousSize(positional, sizes)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(sizes)]);

  const bucket = activeSize !== null ? positional[activeSize] : null;
  const positions = bucket ? sortPositions(Object.keys(bucket.positions || {})) : [];

  return { sizes, activeSize, setActiveSize, bucket, positions };
}

export function PositionSizeTabs({ positional, sizes, activeSize, setActiveSize }) {
  if (sizes.length <= 1) return null;
  return (
    <div className="pos-size-tabs">
      {sizes.map(size => (
        <button
          key={size}
          type="button"
          className={`pos-size-tab ${activeSize === size ? 'active' : ''}`}
          onClick={() => setActiveSize(size)}
        >
          {size}-handed ({bucketHandCount(positional[size])})
        </button>
      ))}
    </div>
  );
}
