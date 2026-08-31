import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import HandTable from '../components/HandTable';
import HeroCards from '../components/HeroCards';
import ActionList from '../components/ActionList';
import { STREETS, STREET_LABELS, HOLE_CARD_COUNTS, AMOUNT_ACTIONS, BOARD_KEY_BY_STREET } from '../constants';
import './ActionStep.css';

export default function ActionStep({
  hand,
  bigBlind,
  seatPositions,
  activeStreet,
  setActiveStreet,
  actionsForStreet,
  bettingMetaById,
  addAction,
  addQuickAction,
  updateAction,
  removeAction,
  activeNextSeat,
  activeNextSeatConstraint,
  editingSeat,
  setEditingSeat,
  updatePlayerField,
  foldedSeats,
  openCardSelector,
  onCardRemove,
  onBack,
  onFinish,
}) {
  const nextToActName = hand.players.find((p) => p.seat === activeNextSeat)?.name;
  const holeCardCount = HOLE_CARD_COUNTS[hand.gameType] || 2;
  const currentPot = hand.actions.length ? hand.actions[hand.actions.length - 1].potSizeAfter : 0;

  const betsBySeat = new Map();
  const lastActionByName = new Map();
  actionsForStreet.forEach((a) => {
    lastActionByName.set(a.player, a);
    if (AMOUNT_ACTIONS.has(a.actionType)) {
      betsBySeat.set(a.player, (betsBySeat.get(a.player) || 0) + (Number(a.amount) || 0));
    }
  });

  const checkedSeats = new Set();
  hand.players.forEach((p) => {
    if (lastActionByName.get(p.name)?.actionType === 'CHECK') checkedSeats.add(p.seat);
  });

  // All-in: a player's most recent action (anywhere in the hand, not just
  // this street) committed their entire stack-before-that-action. Compares
  // against the per-action "stackBefore" meta computeBettingState already
  // tracks, not the player's original starting stack - a stack can be
  // exhausted gradually across several streets, not just in one action.
  const lastActionOverallByName = new Map();
  hand.actions.forEach((a) => lastActionOverallByName.set(a.player, a));
  const allInSeats = new Set();
  hand.players.forEach((p) => {
    if (foldedSeats.has(p.seat)) return;
    const last = lastActionOverallByName.get(p.name);
    if (!last) return;
    const meta = bettingMetaById.get(last.id);
    if (meta && meta.stackBefore > 0 && meta.stackBefore - (Number(last.amount) || 0) <= 0) {
      allInSeats.add(p.seat);
    }
  });

  const tableSeats = seatPositions.map(({ seat, position }) => {
    const player = hand.players.find((p) => p.seat === seat);
    return {
      seat,
      position,
      name: player?.name || `Seat ${seat}`,
      stack: player?.stack ?? 0,
      isDealer: player?.isDealer,
      isHero: player?.isHero,
      holeCards: player?.holeCards,
    };
  });

  const streetHasActions = (street) =>
    hand.actions.some((a) => a.street === street && a.actionType !== 'POST_SB' && a.actionType !== 'POST_BB');

  return (
    <div className="as-panel">
      <h1 className="as-title">Log the Action</h1>

      <HandTable
        seats={tableSeats}
        editableSeats
        editingSeat={editingSeat}
        onSeatClick={(seat) => setEditingSeat(seat === editingSeat ? null : seat)}
        renderSeatExtras={(s) => ({
          onNameChange: (value) => updatePlayerField(s.seat, 'name', value),
          onStackChange: (value) => updatePlayerField(s.seat, 'stack', value),
          // Hero's cards are entered via the larger HeroCards row below -
          // showing them again inline on the seat would just duplicate that
          // same pair right next to it.
          ...(s.isHero
            ? {}
            : {
                holeCardCount,
                onPickHoleCard: (i) =>
                  openCardSelector({ type: 'hole', seat: s.seat, index: i, current: s.holeCards?.[i] }),
                onRemoveHoleCard: (i) => onCardRemove({ type: 'hole', seat: s.seat, index: i }),
              }),
        })}
        foldedSeats={foldedSeats}
        nextToActSeat={activeNextSeat}
        betsBySeat={betsBySeat}
        checkedSeats={checkedSeats}
        allInSeats={allInSeats}
        board={hand.board}
        showBoard={activeStreet !== 'PREFLOP'}
        activeStreet={activeStreet}
        onPickBoardCard={(street, index) =>
          openCardSelector({ type: 'board', street, index, current: hand.board[BOARD_KEY_BY_STREET[street]][index] })
        }
        onRemoveBoardCard={(street, index) => onCardRemove({ type: 'board', street, index })}
        pot={currentPot}
        bigBlind={bigBlind}
        centerLabel={hand.stakes}
      />

      <HeroCards
        hero={hand.players.find((p) => p.isHero)}
        gameType={hand.gameType}
        openCardSelector={openCardSelector}
        onCardRemove={onCardRemove}
      />

      <Tabs
        options={STREETS.map((s) => ({
          key: s,
          label: `${STREET_LABELS[s].toUpperCase()}${streetHasActions(s) ? ' •' : ''}`,
        }))}
        active={activeStreet}
        onChange={setActiveStreet}
      />

      <ActionList
        actionsForStreet={actionsForStreet}
        bettingMetaById={bettingMetaById}
        seatPositions={seatPositions}
        players={hand.players}
        foldedSeats={foldedSeats}
        nextToActName={nextToActName}
        activeNextSeatConstraint={activeNextSeatConstraint}
        pot={currentPot}
        onQuickAction={(actionType, amount) => addQuickAction(activeStreet, actionType, amount)}
        onAddManual={() => addAction(activeStreet)}
        onChangeType={(id, value) => updateAction(id, 'actionType', value)}
        onChangeAmount={(id, value) => updateAction(id, 'amount', value)}
        onRemove={removeAction}
      />

      <div className="as-actions-row">
        <Button variant="secondary" onClick={onBack}>
          <ChevronLeft size={16} /> Back
        </Button>
        {activeStreet === 'RIVER' ? (
          <Button variant="primary" onClick={onFinish}>
            Review &amp; Create Hand <ChevronRight size={16} />
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => setActiveStreet(STREETS[STREETS.indexOf(activeStreet) + 1])}
          >
            Next street <ChevronRight size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}
