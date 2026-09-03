import { Table, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { useTableSize, PositionSizeTabs, RatePct } from './positionMatrixShared';

// Preflop half of what used to be one PositionMatrixTables.jsx - see
// PostflopPositionMatrix.jsx for the other half. Kept as independent
// components (each with its own useTableSize instance) since they now live
// on different subpages (Preflop vs Flop).
export function PreflopPositionMatrix({ positional }) {
  const { sizes, activeSize, setActiveSize, bucket, positions } = useTableSize(positional);

  if (positions.length === 0) return null;

  return (
    <div className="position-matrix-tables">
      <PositionSizeTabs positional={positional} sizes={sizes} activeSize={activeSize} setActiveSize={setActiveSize} />
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
    </div>
  );
}

export default PreflopPositionMatrix;
