import { getSeatStyle, getDealerButtonStyle, reorderPlayersForDisplay } from '../../../utils/getSeatStyle';
import SeatCard from './SeatCard';
import BoardCards from './BoardCards';
import { STREET_INDEX } from '../constants';
import './HandTable.css';

// Shared oval-table visual for all three steps. Seat *placement* (x/y angle)
// reuses HandReplayer's getSeatStyle/getDealerButtonStyle/reorderPlayersForDisplay
// unmodified, so hand-creation gets the same hero-at-bottom elliptical layout
// as replay - but seat *position labels* (BTN/SB/BB/...) are dealer-relative
// and come from the caller (useHandBuilder's assignSeats), since getSeatStyle
// has no equivalent for that.
export default function HandTable({
  seats, // [{seat, position, name, stack, isDealer, isHero, holeCards}]
  editingSeat,
  onSeatClick,
  editableSeats = false,
  renderSeatExtras,
  foldedSeats,
  nextToActSeat,
  betsBySeat,
  checkedSeats,
  allInSeats,
  board,
  showBoard = false,
  activeStreet,
  onPickBoardCard,
  onRemoveBoardCard,
  pot = 0,
  bigBlind = 0,
  centerLabel,
}) {
  const displaySeats = reorderPlayersForDisplay(seats);
  const total = displaySeats.length;
  const dealerIndex = displaySeats.findIndex((s) => s.isDealer);

  let potImage = 'small-stack';
  if (pot >= bigBlind * 12) potImage = 'medium-stack';
  if (pot >= bigBlind * 50) potImage = 'large-stack';

  const hasBoardRow = showBoard && (STREET_INDEX[activeStreet] ?? STREET_INDEX.RIVER) >= STREET_INDEX.FLOP;

  return (
    <div className="ht-wrap">
      <div className="ht-table">
        <div className="ht-seats">
          {displaySeats.map((s, i) => {
            const extras = renderSeatExtras ? renderSeatExtras(s) : {};
            return (
              <SeatCard
                key={s.seat}
                style={getSeatStyle(i, total)}
                position={s.position}
                name={s.name}
                stack={s.stack}
                isDealer={s.isDealer}
                isHero={s.isHero}
                isFolded={foldedSeats?.has(s.seat)}
                isNextToAct={nextToActSeat === s.seat}
                isEditing={editingSeat === s.seat}
                onToggleEdit={() => onSeatClick && onSeatClick(s.seat)}
                editable={editableSeats}
                betAmount={betsBySeat?.get(s.name) || 0}
                isChecked={checkedSeats?.has(s.seat)}
                isAllIn={allInSeats?.has(s.seat)}
                holeCards={s.holeCards}
                {...extras}
              />
            );
          })}

          {dealerIndex !== -1 && (
            <div className="ht-dealer-chip" style={getDealerButtonStyle(dealerIndex, total)}>
              D
            </div>
          )}
        </div>

        <div className={`ht-pot ${hasBoardRow ? 'ht-pot-above' : 'ht-pot-center'}`}>
          {pot > 0 ? (
            <>
              <img src={`/images/chips/${potImage}.png`} alt="" className="ht-pot-img" />
              <span className="ht-pot-text">Pot: {pot}</span>
            </>
          ) : (
            centerLabel && <span className="ht-pot-text ht-pot-text-label">{centerLabel}</span>
          )}
        </div>

        {hasBoardRow && (
          <div className="ht-board">
            <BoardCards board={board} activeStreet={activeStreet} onPick={onPickBoardCard} onRemove={onRemoveBoardCard} />
          </div>
        )}
      </div>
    </div>
  );
}
