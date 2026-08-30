import { Table, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Skeleton } from '../../components/ui/Skeleton';

// Shaped like the real table in Players.jsx - a real header row, then
// skeleton rows (avatar circle + name bar, a tag pill, a few stat bars, a
// star circle).
export function PlayersTableSkeleton() {
  return (
    <Table>
      <TableHead>
        <TableCell header>Player</TableCell>
        <TableCell header>Tags</TableCell>
        <TableCell header align="right">Hands</TableCell>
        <TableCell header align="right">VPIP</TableCell>
        <TableCell header align="right">PFR</TableCell>
        <TableCell header align="right">3-Bet</TableCell>
        <TableCell header align="right">Won From</TableCell>
        <TableCell header align="right"></TableCell>
      </TableHead>
      <TableBody>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <TableRow key={i}>
            <TableCell>
              <div className="player-row-name">
                <Skeleton style={{ width: 28, height: 28, borderRadius: '50%' }} />
                <Skeleton style={{ width: 100, height: 14 }} />
              </div>
            </TableCell>
            <TableCell><Skeleton style={{ width: 50, height: 18, borderRadius: 999 }} /></TableCell>
            <TableCell align="right"><Skeleton style={{ width: 30, height: 14, marginLeft: 'auto' }} /></TableCell>
            <TableCell align="right"><Skeleton style={{ width: 30, height: 14, marginLeft: 'auto' }} /></TableCell>
            <TableCell align="right"><Skeleton style={{ width: 30, height: 14, marginLeft: 'auto' }} /></TableCell>
            <TableCell align="right"><Skeleton style={{ width: 30, height: 14, marginLeft: 'auto' }} /></TableCell>
            <TableCell align="right"><Skeleton style={{ width: 50, height: 14, marginLeft: 'auto' }} /></TableCell>
            <TableCell align="right"><Skeleton style={{ width: 20, height: 20, borderRadius: '50%', marginLeft: 'auto' }} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default PlayersTableSkeleton;
