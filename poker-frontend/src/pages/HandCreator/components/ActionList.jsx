import ActionComposer from './ActionComposer';
import ActionRow from './ActionRow';
import { bettingHintText, bettingWarning } from '../hooks/useHandBuilder';
import './ActionList.css';

export default function ActionList({
  actionsForStreet,
  bettingMetaById,
  seatPositions,
  players,
  foldedSeats,
  nextToActName,
  activeNextSeatConstraint,
  pot,
  onQuickAction,
  onRemove,
}) {
  const positionFor = (seat) => seatPositions.find((s) => s.seat === seat)?.position || '';

  return (
    <div className="al-wrap">
      {nextToActName ? (
        <ActionComposer
          playerName={nextToActName}
          constraint={activeNextSeatConstraint}
          pot={pot}
          onQuickAction={onQuickAction}
        />
      ) : (
        <div className="al-done">All players have acted on this street.</div>
      )}

      {actionsForStreet.length > 0 && (
        <div className="al-list">
          {actionsForStreet.map((action) => {
            const constraint = bettingMetaById.get(action.id);
            const warning = constraint ? bettingWarning(action, constraint) : null;
            const hint = constraint ? bettingHintText(action, constraint) : null;
            const seat = players.find((p) => p.name === action.player)?.seat;

            return (
              <ActionRow
                key={action.id}
                action={action}
                position={positionFor(seat)}
                isFolded={foldedSeats.has(seat)}
                warning={warning}
                hint={hint}
                onRemove={() => onRemove(action.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
