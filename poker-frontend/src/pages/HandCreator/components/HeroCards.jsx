import CardSlot from './CardSlot';
import { HOLE_CARD_COUNTS } from '../constants';
import './HeroCards.css';

// Large, always-visible picker for the hero's own hand - kept distinct from
// the small inline hole-card slots each SeatCard already shows, since the
// hero's cards are the ones the user will set/check most often and deserve
// a bigger touch target.
export default function HeroCards({ hero, gameType, openCardSelector, onCardRemove }) {
  if (!hero) return null;

  const count = HOLE_CARD_COUNTS[gameType] || 2;

  return (
    <div className="hro-wrap">
      <div className="hro-label">Hero's Hand — {hero.name}</div>
      <div className="hro-row">
        {Array.from({ length: count }).map((_, i) => (
          <CardSlot
            key={i}
            size="lg"
            card={hero.holeCards?.[i]}
            onClick={() =>
              openCardSelector({ type: 'hole', seat: hero.seat, index: i, current: hero.holeCards?.[i] })
            }
            onRemove={
              hero.holeCards?.[i]
                ? () => onCardRemove({ type: 'hole', seat: hero.seat, index: i })
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
