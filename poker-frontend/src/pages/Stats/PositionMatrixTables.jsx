import { Table, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { confidenceModifier } from '../../utils/confidence';
import './PositionMatrixTables.css';

const POSITION_ORDER = ['BTN', 'BTN/SB', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'];
function sortPositions(positions) {
  return [...positions].sort((a, b) => {
    const ia = POSITION_ORDER.indexOf(a);
    const ib = POSITION_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
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
// attacker-vs-responder matrices.
export function PositionMatrixTables({ positional }) {
  const sizes = Object.keys(positional || {}).map(Number).filter(n => !Number.isNaN(n)).sort((a, b) => b - a);
  const largestSize = sizes[0];
  const bucket = largestSize ? positional[largestSize] : null;
  const positions = bucket ? sortPositions(Object.keys(bucket.positions || {})) : [];

  if (positions.length === 0) return null;

  return (
    <div className="position-matrix-tables">
      <div className="matrix-table-card">
        <div className="matrix-table-header">
          <h3 className="section-title">Preflop matrix by position</h3>
          <span className="matrix-table-sub">All frequencies in %{largestSize ? ` · ${largestSize}-handed` : ''}</span>
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
            <TableCell header align="right">Steal</TableCell>
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
                  <TableCell align="right"><RatePct rate={p.steal} /></TableCell>
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
          <span className="matrix-table-sub">C-bet by street, fold to c-bet, check-raise, donk/probe, AF</span>
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
