import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import HandTable from '../components/HandTable';
import { POSITIONS_BY_COUNT } from '../constants';
import './TableSetupStep.css';

// Table renders immediately with live defaults instead of appearing after a
// wall of form fields. Dealer/hero assignment and starting stacks move into
// click-on-seat popovers (via HandTable/SeatCard) instead of disconnected
// <select>s and a separate stack-input grid.
export default function TableSetupStep({
  smallBlind,
  bigBlind,
  ante,
  numPlayers,
  dealerSeat,
  heroSeat,
  stacksBySeat,
  seatPositions,
  updateTableField,
  updateSeatStack,
  editingSeat,
  setEditingSeat,
  onNext,
  onExit,
}) {
  const draftSeats = seatPositions.map(({ seat, position }) => ({
    seat,
    position,
    name: `Seat ${seat}`,
    stack:
      stacksBySeat[seat] !== undefined && stacksBySeat[seat] !== ''
        ? Number(stacksBySeat[seat])
        : bigBlind * 100,
    isDealer: seat === dealerSeat,
    isHero: seat === heroSeat,
    holeCards: [],
  }));

  return (
    <div className="ts-panel">
      <h1 className="ts-title">Set Up the Table</h1>
      <p className="ts-subtitle">Click a seat to set the dealer, hero, and starting stack.</p>

      <div className="ts-quickfields">
        <label className="ts-field">
          <span>Small Blind</span>
          <input
            type="number"
            min="0"
            value={smallBlind}
            onChange={(e) => updateTableField('smallBlind', Number(e.target.value))}
          />
        </label>
        <label className="ts-field">
          <span>Big Blind</span>
          <input
            type="number"
            min="0"
            value={bigBlind}
            onChange={(e) => updateTableField('bigBlind', Number(e.target.value))}
          />
        </label>
        <label className="ts-field">
          <span>Ante</span>
          <input
            type="number"
            min="0"
            value={ante}
            onChange={(e) => updateTableField('ante', Number(e.target.value))}
          />
        </label>
        <label className="ts-field">
          <span>Players</span>
          <select value={numPlayers} onChange={(e) => updateTableField('numPlayers', Number(e.target.value))}>
            {Object.keys(POSITIONS_BY_COUNT).map((n) => (
              <option key={n} value={n}>
                {n}-handed
              </option>
            ))}
          </select>
        </label>
      </div>

      <HandTable
        seats={draftSeats}
        editableSeats
        editingSeat={editingSeat}
        onSeatClick={(seat) => setEditingSeat(seat === editingSeat ? null : seat)}
        renderSeatExtras={(s) => ({
          onStackChange: (value) => updateSeatStack(s.seat, value),
          onSetDealer: () => {
            updateTableField('dealerSeat', s.seat);
            setEditingSeat(null);
          },
          onSetHero: () => {
            updateTableField('heroSeat', s.seat);
            setEditingSeat(null);
          },
        })}
        centerLabel={`${smallBlind} / ${bigBlind}`}
      />

      <div className="ts-footer-note">
        {smallBlind}/{bigBlind}
        {ante > 0 ? ` (${ante} ante)` : ''} · {numPlayers}-handed · Dealer seat {dealerSeat} · Hero seat {heroSeat}
      </div>

      <div className="ts-actions-row">
        <Button variant="secondary" onClick={onExit}>
          <ChevronLeft size={16} /> Back
        </Button>
        <Button variant="primary" onClick={onNext}>
          Next <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
