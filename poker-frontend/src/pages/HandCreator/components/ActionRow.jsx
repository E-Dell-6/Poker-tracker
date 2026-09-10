import { Trash2 } from 'lucide-react';
import { ACTION_LABELS, AMOUNT_ACTIONS } from '../constants';

// One already-logged action, read-only. Actions are entered through the
// ActionComposer's one-tap buttons, which is the only place betting
// constraints (call amount, min raise, stack cap) are enforced - so the log
// deliberately offers no way to retype a type or amount past those rules.
// Fixing a mistake means deleting the action and re-entering it.
export default function ActionRow({ action, position, isFolded, warning, hint, onRemove }) {
  return (
    <div className="ar-wrapper">
      <div className="ar-row">
        <div className="ar-player">
          {position} · {action.player}
          {isFolded ? ' (folded)' : ''}
        </div>

        <div className="ar-type">{ACTION_LABELS[action.actionType] || action.actionType}</div>

        {AMOUNT_ACTIONS.has(action.actionType) ? (
          <div className="ar-amount">{action.amount}</div>
        ) : (
          <div className="ar-dash">—</div>
        )}

        <button type="button" className="ar-delete" onClick={onRemove} aria-label="Delete action">
          <Trash2 size={14} />
        </button>
      </div>

      {(warning || hint) && <div className={`ar-hint ${warning ? 'ar-hint-warning' : ''}`}>{warning || hint}</div>}
    </div>
  );
}
