import { X } from 'lucide-react';
import './CardSlot.css';

// Renders a single card as real card art (matches HandReplayer's
// /images/cards/{code}.png treatment) instead of the old glyph rendering.
// `onClick` undefined makes the slot a static (non-interactive) display,
// used for the read-only Review-step recap table.
export default function CardSlot({ card, onClick, onRemove, size = 'md' }) {
  const interactive = Boolean(onClick);

  if (!card) {
    return (
      <button
        type="button"
        className={`cds-slot cds-empty cds-${size}`}
        onClick={onClick}
        disabled={!interactive}
        aria-label="Add card"
      >
        <span className="cds-plus">+</span>
      </button>
    );
  }

  return (
    <div
      className={`cds-slot cds-filled cds-${size}`}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <img src={`/images/cards/${card}.png`} alt={card} className="cds-img" />
      {onRemove && (
        <button
          type="button"
          className="cds-remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove card"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}
