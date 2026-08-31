import CardSlot from './CardSlot';
import { STREET_INDEX, BOARD_SLOT_COUNTS } from '../constants';
import './BoardCards.css';

// Progressive reveal: only shows the flop/turn/river groups that are "live"
// for the given street, same as the original monolith's board row. `onPick`
// undefined renders a static (non-interactive) board, used by ReviewStep's
// read-only recap.
export default function BoardCards({ board, activeStreet = 'RIVER', onPick, onRemove }) {
  const activeIndex = STREET_INDEX[activeStreet] ?? STREET_INDEX.RIVER;

  const groups = [
    { street: 'FLOP', key: 'flop', count: BOARD_SLOT_COUNTS.FLOP },
    { street: 'TURN', key: 'turn', count: BOARD_SLOT_COUNTS.TURN },
    { street: 'RIVER', key: 'river', count: BOARD_SLOT_COUNTS.RIVER },
  ].filter((g) => activeIndex >= STREET_INDEX[g.street]);

  if (groups.length === 0) return null;

  return (
    <div className="bc-row">
      {groups.map((g) => (
        <div className="bc-group" key={g.key}>
          {Array.from({ length: g.count }).map((_, i) => (
            <CardSlot
              key={i}
              card={board[g.key][i]}
              onClick={onPick ? () => onPick(g.street, i) : undefined}
              onRemove={onRemove && board[g.key][i] ? () => onRemove(g.street, i) : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
