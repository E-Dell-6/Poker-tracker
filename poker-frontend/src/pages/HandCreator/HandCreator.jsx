import CardSelector from '../../components/CardSelector';
import { useHandBuilder } from './hooks/useHandBuilder';
import TableSetupStep from './steps/TableSetupStep';
import ActionStep from './steps/ActionStep';
import ReviewStep from './steps/ReviewStep';
import { STREET_LABELS } from './constants';
import './HandCreator.css';

export default function HandCreator({ onSubmit }) {
  const hb = useHandBuilder({ onSubmit });

  const cardSelectorTitle = hb.cardSelector
    ? hb.cardSelector.type === 'board'
      ? `Select ${STREET_LABELS[hb.cardSelector.street]} card`
      : hb.cardSelector.type === 'showedHand'
        ? 'Select revealed card'
        : 'Select hole card'
    : '';

  return (
    <div className="hc-page">
      {hb.step === 1 && (
        <TableSetupStep
          smallBlind={hb.smallBlind}
          bigBlind={hb.bigBlind}
          ante={hb.ante}
          numPlayers={hb.numPlayers}
          dealerSeat={hb.dealerSeat}
          heroSeat={hb.heroSeat}
          stacksBySeat={hb.stacksBySeat}
          seatPositions={hb.seatPositions}
          updateTableField={hb.updateTableField}
          updateSeatStack={hb.updateSeatStack}
          editingSeat={hb.editingSeat}
          setEditingSeat={hb.setEditingSeat}
          onNext={hb.proceedToActions}
          onExit={() => hb.navigate(-1)}
        />
      )}

      {hb.step === 2 && (
        <ActionStep
          hand={hb.hand}
          bigBlind={hb.bigBlind}
          seatPositions={hb.seatPositions}
          activeStreet={hb.activeStreet}
          setActiveStreet={hb.setActiveStreet}
          actionsForStreet={hb.actionsForStreet}
          bettingMetaById={hb.bettingMetaById}
          addAction={hb.addAction}
          addQuickAction={hb.addQuickAction}
          updateAction={hb.updateAction}
          removeAction={hb.removeAction}
          activeNextSeat={hb.activeNextSeat}
          activeNextSeatConstraint={hb.activeNextSeatConstraint}
          editingSeat={hb.editingSeat}
          setEditingSeat={hb.setEditingSeat}
          updatePlayerField={hb.updatePlayerField}
          foldedSeats={hb.foldedSeats}
          openCardSelector={hb.openCardSelector}
          onCardRemove={hb.handleCardRemove}
          onBack={() => hb.setStep(1)}
          onFinish={hb.goToReview}
        />
      )}

      {hb.step === 3 && (
        <ReviewStep
          hand={hb.hand}
          setHand={hb.setHand}
          bigBlind={hb.bigBlind}
          seatPositions={hb.seatPositions}
          updatePlayerField={hb.updatePlayerField}
          toggleWinner={hb.toggleWinner}
          hasRevealed={hb.hasRevealed}
          toggleRevealHand={hb.toggleRevealHand}
          openCardSelector={hb.openCardSelector}
          onCardRemove={hb.handleCardRemove}
          people={hb.people}
          peopleLoading={hb.peopleLoading}
          statusMessage={hb.statusMessage}
          onCreatePerson={hb.createAndLinkPerson}
          onBack={() => hb.setStep(2)}
          onSave={hb.saveHand}
          isSaving={hb.isSavingHand}
        />
      )}

      {hb.cardSelector && (
        <CardSelector
          title={cardSelectorTitle}
          usedCards={hb.usedCardsForSelector}
          onSelect={hb.handleCardSelect}
          onClose={hb.closeCardSelector}
        />
      )}
    </div>
  );
}
