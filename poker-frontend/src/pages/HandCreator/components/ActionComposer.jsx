import { useEffect, useState } from 'react';

// One-tap action buttons for the next-to-act player - replaces the old
// flow of picking an action type from a <select> then typing an amount for
// every single action. Fold/Check/Call fire immediately; Bet/Raise/All-in
// resolve their exact amount from `constraint` (computeBettingState's
// preview meta for this player) so the user rarely has to type a number.
export default function ActionComposer({ playerName, constraint, pot, onQuickAction }) {
  const [betOpen, setBetOpen] = useState(false);
  const [betAmount, setBetAmount] = useState(0);

  useEffect(() => {
    setBetOpen(false);
    setBetAmount(constraint?.minRaiseAmount || 0);
  }, [playerName, constraint?.minRaiseAmount]);

  if (!playerName || !constraint) return null;

  const { isFacingBet, callAmount, minRaiseAmount, stackBefore } = constraint;
  const betLabel = isFacingBet ? 'Raise' : 'Bet';
  const canBet = stackBefore > 0;

  const quickChips = [
    { label: 'Min', value: minRaiseAmount },
    { label: '½ Pot', value: Math.max(minRaiseAmount, Math.min(Math.round(pot / 2), stackBefore)) },
    { label: 'Pot', value: Math.max(minRaiseAmount, Math.min(pot, stackBefore)) },
    { label: 'All-in', value: stackBefore },
  ];

  const fireAllIn = () => {
    const actionType = isFacingBet ? (stackBefore <= callAmount ? 'CALL' : 'RAISE') : 'BET';
    onQuickAction(actionType, stackBefore);
  };

  const confirmBet = () => {
    onQuickAction(isFacingBet ? 'RAISE' : 'BET', betAmount);
    setBetOpen(false);
  };

  return (
    <div className="ac-composer">
      <div className="ac-acting-label">{playerName} to act</div>

      <div className="ac-buttons">
        <button type="button" className="ac-btn ac-btn-fold" onClick={() => onQuickAction('FOLD', 0)}>
          Fold
        </button>
        <button
          type="button"
          className="ac-btn ac-btn-check"
          onClick={() => onQuickAction(isFacingBet ? 'CALL' : 'CHECK', isFacingBet ? callAmount : 0)}
        >
          {isFacingBet ? `Call ${callAmount}` : 'Check'}
        </button>
        <button
          type="button"
          className="ac-btn ac-btn-bet"
          onClick={() => setBetOpen((o) => !o)}
          disabled={!canBet}
        >
          {betLabel}
        </button>
        <button type="button" className="ac-btn ac-btn-allin" onClick={fireAllIn} disabled={!canBet}>
          All-in
        </button>
      </div>

      {betOpen && (
        <div className="ac-bet-panel">
          <div className="ac-chip-row">
            {quickChips.map((c) => (
              <button key={c.label} type="button" className="ac-chip" onClick={() => setBetAmount(c.value)}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="ac-amount-row">
            <input
              type="number"
              min="0"
              max={stackBefore}
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(0, Math.min(Number(e.target.value) || 0, stackBefore)))}
            />
            <button type="button" className="ac-confirm" onClick={confirmBet}>
              Confirm {betLabel} {betAmount}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
