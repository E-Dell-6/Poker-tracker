import { Star } from 'lucide-react';
import CardSlot from './CardSlot';
import './SeatCard.css';

// The creator's editable seat. Deliberately a separate component from
// HandReplayer's read-only PlayerSeat.jsx (different file, different class
// prefix below) even though it borrows that page's visual treatment - the
// two are never mounted together, but neither is this app's CSS scoped, so
// keeping the class names distinct avoids a silent collision if that ever
// changes.
export default function SeatCard({
  style,
  position,
  name,
  stack,
  isDealer,
  isHero,
  isFolded,
  isNextToAct,
  isEditing,
  onToggleEdit,
  editable = false,
  betAmount = 0,
  isChecked = false,
  isAllIn = false,
  onNameChange,
  onStackChange,
  onSetDealer,
  onSetHero,
  holeCardCount,
  holeCards,
  onPickHoleCard,
  onRemoveHoleCard,
}) {
  const hasPopoverFields = Boolean(onNameChange || onStackChange || onSetDealer || onSetHero);

  return (
    <div
      className={`sc-seat ${isHero ? 'sc-hero' : ''} ${isFolded ? 'sc-folded' : ''} ${isNextToAct ? 'sc-next' : ''}`}
      style={style}
      onClick={editable ? onToggleEdit : undefined}
      role={editable ? 'button' : undefined}
      tabIndex={editable ? 0 : undefined}
    >
      {isNextToAct && <div className="sc-next-chip">Acts next</div>}
      {betAmount > 0 && <div className="sc-bet-chip">{betAmount}</div>}
      {betAmount === 0 && isChecked && <div className="sc-check-chip">Check</div>}
      {isAllIn && <div className="sc-allin-chip">All-in</div>}

      <div className="sc-pos">{position}</div>
      <div className="sc-name">{name}</div>
      {isHero && (
        <div className="sc-hero-badge">
          <Star size={11} fill="currentColor" /> Hero
        </div>
      )}
      <div className="sc-stack">{stack}</div>

      {holeCardCount > 0 && (
        <div className="sc-holecards" onClick={(e) => e.stopPropagation()}>
          {Array.from({ length: holeCardCount }).map((_, i) => (
            <CardSlot
              key={i}
              size="sm"
              card={holeCards?.[i]}
              onClick={onPickHoleCard ? () => onPickHoleCard(i) : undefined}
              onRemove={holeCards?.[i] && onRemoveHoleCard ? () => onRemoveHoleCard(i) : undefined}
            />
          ))}
        </div>
      )}

      {isEditing && hasPopoverFields && (
        <div className="sc-popover" onClick={(e) => e.stopPropagation()}>
          {onNameChange && (
            <label>
              Name
              <input value={name} onChange={(e) => onNameChange(e.target.value)} />
            </label>
          )}
          {onStackChange && (
            <label>
              Stack
              <input
                type="number"
                min="0"
                value={stack}
                onChange={(e) => onStackChange(Number(e.target.value))}
              />
            </label>
          )}
          {(onSetDealer || onSetHero) && (
            <div className="sc-popover-actions">
              {onSetDealer && (
                <button type="button" onClick={onSetDealer} disabled={isDealer}>
                  {isDealer ? 'Dealer ✓' : 'Set as Dealer'}
                </button>
              )}
              {onSetHero && (
                <button type="button" onClick={onSetHero} disabled={isHero}>
                  {isHero ? 'Hero ✓' : 'Set as Hero'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
