import { Table, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { useTableSize, PositionSizeTabs, RatePct } from './positionMatrixShared';

// Postflop half of what used to be one PositionMatrixTables.jsx - see
// PreflopPositionMatrix.jsx for the other half. Kept as independent
// components (each with its own useTableSize instance) since they now live
// on different subpages (Preflop vs Flop).
export function PostflopPositionMatrix({ positional }) {
  const { sizes, activeSize, setActiveSize, bucket, positions } = useTableSize(positional);

  if (positions.length === 0) return null;

  return (
    <div className="position-matrix-tables">
      <PositionSizeTabs positional={positional} sizes={sizes} activeSize={activeSize} setActiveSize={setActiveSize} />
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

export default PostflopPositionMatrix;
