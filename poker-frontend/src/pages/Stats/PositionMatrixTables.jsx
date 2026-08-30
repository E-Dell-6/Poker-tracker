import { useEffect, useState } from 'react';
import { Table, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { confidenceModifier } from '../../utils/confidence';
import '../../components/PositionalStats.css'; // shared .pos-size-tabs/.pos-size-tab classes (see StudyCharts.jsx's own cross-import for the same precedent)
import './PositionMatrixTables.css';

const POSITION_ORDER = ['BTN', 'BTN/SB', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'];
function sortPositions(positions) {
  return [...positions].sort((a, b) => {
    const ia = POSITION_ORDER.indexOf(a);
    const ib = POSITION_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

// Total hands across every position in a table-size bucket - see
// StudyCharts.jsx's identical helper for why this (not just the largest
// size ever seen) is what the default selection should be based on.
function bucketHandCount(bucket) {
  return Object.values(bucket?.positions || {}).reduce((sum, p) => sum + (p.hands || 0), 0);
}

function mostPopulousSize(positional, sizes) {
  if (sizes.length === 0) return null;
  return sizes.reduce((best, size) =>
    bucketHandCount(positional[size]) > bucketHandCount(positional[best]) ? size : best
  , sizes[0]);
}

function RatePct({ rate }) {
  if (!rate || rate.opportunities === 0) return <span className="matrix-cell-empty">—</span>;
  const modifier = confidenceModifier(rate);
  return <span className={`matrix-cell-pct ${modifier ? `matrix-cell-pct--${modifier}` : ''}`}>{rate.pct}%</span>;
}

// `positional` is stats.positional (statsEngine.js's finalizePositional) -
// same data source as PositionalStats.jsx and StudyCharts.jsx, just
// re-presented as the flat "one row per position" tables the Study mockup
// shows, instead of PositionalStats.jsx's richer (and kept, not replaced)
// attacker-vs-responder matrices. Table-size selection mirrors
// StudyCharts.jsx: defaults to the most-played size (not the largest ever
// seen), with a manual switcher for the rest.
export function PositionMatrixTables({ positional }) {
  const sizes = Object.keys(positional || {}).map(Number).filter(n => !Number.isNaN(n)).sort((a, b) => b - a);
  const [activeSize, setActiveSize] = useState(null);

  useEffect(() => {
    setActiveSize(prev => (prev !== null && sizes.includes(prev) ? prev : mostPopulousSize(positional, sizes)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(sizes)]);

  const bucket = activeSize !== null ? positional[activeSize] : null;
  const positions = bucket ? sortPositions(Object.keys(bucket.positions || {})) : [];

  if (positions.length === 0) return null;

  return (
    <div className="position-matrix-tables">
      {sizes.length > 1 && (
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
      )}
      <div className="matrix-table-card">
        <div className="matrix-table-header">
          <h3 className="section-title">Preflop matrix by position</h3>
          <span className="matrix-table-sub">All frequencies in %{activeSize != null ? ` · ${activeSize}-handed` : ''}</span>
        </div>
        <Table>
          <TableHead>
            <TableCell header>Pos</TableCell>
            <TableCell header align="right">Hands</TableCell>
            <TableCell header align="right">VPIP</TableCell>
            <TableCell header align="right">PFR</TableCell>
            <TableCell header align="right">RFI</TableCell>
            <TableCell header align="right">3-Bet</TableCell>
            <TableCell header align="right">Fold v3B</TableCell>
            <TableCell header align="right">4-Bet</TableCell>
            <TableCell header align="right">Fold v4B</TableCell>
            <TableCell header align="right">Steal</TableCell>
            <TableCell header align="right">Fold v Steal</TableCell>
            <TableCell header align="right">Limp</TableCell>
            <TableCell header align="right">Cold Call</TableCell>
            <TableCell header align="right">WTSD</TableCell>
            <TableCell header align="right">W$SD</TableCell>
            <TableCell header align="right">BB/100</TableCell>
          </TableHead>
          <TableBody>
            {positions.map(pos => {
              const p = bucket.positions[pos];
              return (
                <TableRow key={pos}>
                  <TableCell><strong>{pos}</strong></TableCell>
                  <TableCell align="right"><span className="ui-table-value-mono">{p.hands ?? '—'}</span></TableCell>
                  <TableCell align="right"><RatePct rate={p.vpip} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.pfr} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.open} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.threeBet} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.foldTo3Bet} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.fourBet} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.foldTo4Bet} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.steal} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.foldToSteal} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.limp} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.coldCall} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.wtsd} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.wsd} /></TableCell>
                  <TableCell align="right">
                    <span className={`ui-table-value-mono ${p.bb100 == null ? '' : p.bb100 >= 0 ? 'ui-table-value-pos' : 'ui-table-value-neg'}`}>
                      {p.bb100 ?? '—'}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="matrix-table-card">
        <div className="matrix-table-header">
          <h3 className="section-title">Postflop matrix by position</h3>
          <span className="matrix-table-sub">C-bet by street, fold to c-bet, check-raise, donk/probe, WWSF, AF</span>
        </div>
        <Table>
          <TableHead>
            <TableCell header>Pos</TableCell>
            <TableCell header align="right">C-Bet Flop</TableCell>
            <TableCell header align="right">Fold to CB</TableCell>
            <TableCell header align="right">C-Bet Turn</TableCell>
            <TableCell header align="right">C-Bet River</TableCell>
            <TableCell header align="right">Check-Raise</TableCell>
            <TableCell header align="right">Donk</TableCell>
            <TableCell header align="right">Probe</TableCell>
            <TableCell header align="right">WWSF</TableCell>
            <TableCell header align="right">AF</TableCell>
          </TableHead>
          <TableBody>
            {positions.map(pos => {
              const p = bucket.positions[pos];
              return (
                <TableRow key={pos}>
                  <TableCell><strong>{pos}</strong></TableCell>
                  <TableCell align="right"><RatePct rate={p.cbFlop} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.foldToCbFlop} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.cbTurn} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.cbRiver} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.checkRaise} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.donk} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.probe} /></TableCell>
                  <TableCell align="right"><RatePct rate={p.wwsf} /></TableCell>
                  <TableCell align="right"><span className="ui-table-value-mono">{p.aggFactor ?? '—'}</span></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default PositionMatrixTables;
