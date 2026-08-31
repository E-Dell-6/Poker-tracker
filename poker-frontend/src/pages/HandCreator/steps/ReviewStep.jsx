import { useEffect, useState } from 'react';
import { Check, X, ChevronLeft } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import HandTable from '../components/HandTable';
import PersonPicker from '../components/PersonPicker';
import CardSlot from '../components/CardSlot';
import { HOLE_CARD_COUNTS } from '../constants';
import './ReviewStep.css';

export default function ReviewStep({
  hand,
  setHand,
  bigBlind,
  seatPositions,
  updatePlayerField,
  toggleWinner,
  hasRevealed,
  toggleRevealHand,
  openCardSelector,
  onCardRemove,
  people,
  peopleLoading,
  statusMessage,
  onCreatePerson,
  onBack,
  onSave,
  isSaving,
}) {
  const finalPotSize = hand.actions.length ? hand.actions[hand.actions.length - 1].potSizeAfter : 0;
  const holeCardCount = HOLE_CARD_COUNTS[hand.gameType] || 2;

  const [splits, setSplits] = useState({});

  // Seeds an even split of the pot across the checked winners whenever the
  // winner selection (or the pot itself) changes - editable from there.
  // This is what finally makes player.winnings non-zero on save (see
  // useHandBuilder.saveHand); previously every hand saved via this page
  // wrote winnings: 0 for every player, including the winner.
  useEffect(() => {
    if (hand.winners.length === 0) {
      setSplits({});
      return;
    }
    const share = Math.floor(finalPotSize / hand.winners.length);
    const remainder = finalPotSize - share * hand.winners.length;
    const next = {};
    hand.winners.forEach((name, i) => {
      next[name] = share + (i === 0 ? remainder : 0);
    });
    setSplits(next);
  }, [hand.winners, finalPotSize]);

  const updateSplit = (name, value) => setSplits((prev) => ({ ...prev, [name]: Math.max(0, Number(value) || 0) }));

  const updateNotes = (value) => setHand((prev) => ({ ...prev, notes: value }));
  const dateValue = hand.datePlayed ? hand.datePlayed.slice(0, 10) : '';
  const updateDate = (value) => {
    if (!value) return;
    setHand((prev) => ({ ...prev, datePlayed: new Date(value).toISOString() }));
  };

  const recapSeats = seatPositions.map(({ seat, position }) => {
    const player = hand.players.find((p) => p.seat === seat);
    const revealed = player && hasRevealed(player.name);
    return {
      seat,
      position,
      name: player?.name || `Seat ${seat}`,
      stack: player?.stack ?? 0,
      isDealer: player?.isDealer,
      isHero: player?.isHero,
      holeCards: player?.isHero ? player?.holeCards : revealed ? player?.showedHand : [],
    };
  });

  return (
    <div className="rv-panel">
      <h1 className="rv-title">Review &amp; Save</h1>

      {statusMessage && (
        <div className={`rv-status ${statusMessage.type === 'success' ? 'rv-status-success' : 'rv-status-error'}`}>
          {statusMessage.type === 'success' ? <Check size={14} /> : <X size={14} />}
          {statusMessage.text}
        </div>
      )}

      <HandTable seats={recapSeats} board={hand.board} showBoard pot={finalPotSize} bigBlind={bigBlind} centerLabel={hand.stakes} />

      <div className="rv-grid">
        <label className="rv-field">
          <span>Date played</span>
          <input type="date" value={dateValue} onChange={(e) => updateDate(e.target.value)} />
        </label>
      </div>

      <label className="rv-field rv-notes">
        <span>Notes</span>
        <textarea
          rows={3}
          value={hand.notes}
          placeholder="Anything worth remembering about this hand..."
          onChange={(e) => updateNotes(e.target.value)}
        />
      </label>

      <div className="rv-section-label">Players</div>
      <div className="rv-players">
        {hand.players.map((player) => {
          const position = seatPositions.find((s) => s.seat === player.seat)?.position;
          const linkedPerson = people.find((pn) => pn._id === player.personId);
          const revealed = hasRevealed(player.name);

          return (
            <div className="rv-player-row" key={player.seat}>
              <div className="rv-player-main">
                <span className="rv-seat-label">
                  Seat {player.seat} · {position}
                </span>

                <input
                  className="rv-name-input"
                  value={player.name}
                  onChange={(e) => updatePlayerField(player.seat, 'name', e.target.value)}
                />

                <PersonPicker
                  people={people}
                  peopleLoading={peopleLoading}
                  selectedId={player.personId}
                  defaultName={player.name}
                  onLink={(id) => updatePlayerField(player.seat, 'personId', id)}
                  onCreate={(name, file) => onCreatePerson(player.seat, name, file)}
                />

                {linkedPerson && (
                  <span className="rv-linked-badge">
                    <Check size={12} /> Linked
                  </span>
                )}
              </div>

              <div className="rv-reveal-row">
                <label className="rv-checkbox-label">
                  <input type="checkbox" checked={revealed} onChange={() => toggleRevealHand(player.seat)} />
                  Revealed hand at showdown
                </label>

                {revealed && (
                  <div className="rv-reveal-cards">
                    {Array.from({ length: holeCardCount }).map((_, i) => (
                      <CardSlot
                        key={i}
                        card={player.showedHand?.[i]}
                        onClick={() =>
                          openCardSelector({
                            type: 'showedHand',
                            seat: player.seat,
                            index: i,
                            current: player.showedHand?.[i],
                          })
                        }
                        onRemove={
                          player.showedHand?.[i]
                            ? () => onCardRemove({ type: 'showedHand', seat: player.seat, index: i })
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rv-section-label">
        Winner(s) <span className="rv-required">*</span>
      </div>
      <div className="rv-winners">
        {hand.players.map((player) => (
          <label className="rv-winner-chip" key={player.seat}>
            <input
              type="checkbox"
              checked={hand.winners.includes(player.name)}
              onChange={() => toggleWinner(player.name)}
            />
            {player.name}
          </label>
        ))}
      </div>

      {hand.winners.length === 0 ? (
        <div className="rv-warning-text">Select at least one winner (more than one for a split pot).</div>
      ) : (
        <div className="rv-splits">
          {hand.winners.map((name) => (
            <label className="rv-split-row" key={name}>
              <span>{name} wins</span>
              <input type="number" min="0" value={splits[name] ?? 0} onChange={(e) => updateSplit(name, e.target.value)} />
            </label>
          ))}
        </div>
      )}

      <div className="rv-actions-row">
        <Button variant="secondary" onClick={onBack} disabled={isSaving}>
          <ChevronLeft size={16} /> Back
        </Button>
        <Button variant="primary" onClick={() => onSave(splits)} disabled={isSaving || hand.winners.length === 0}>
          {isSaving ? 'Saving…' : 'Create Hand'}
        </Button>
      </div>
    </div>
  );
}
