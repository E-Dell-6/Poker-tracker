import { Trash2 } from 'lucide-react';
import { SELECTABLE_ACTION_TYPES, ACTION_LABELS, AMOUNT_ACTIONS } from '../constants';

// One already-logged action: editable/removable fallback for fixing up
// whatever the quick-action buttons produced (or for manual entry when
// nothing about the quick flow fits, e.g. an odd MUCK).
export default function ActionRow({ action, position, isFolded, warning, hint, onChangeType, onChangeAmount, onRemove }) {
  const typeOptions = SELECTABLE_ACTION_TYPES.includes(action.actionType)
    ? SELECTABLE_ACTION_TYPES
    : [action.actionType, ...SELECTABLE_ACTION_TYPES];

  return (
    <div className="ar-wrapper">
      <div className="ar-row">
        <div className="ar-player">
          {position} · {action.player}
          {isFolded ? ' (folded)' : ''}
        </div>

        <select value={action.actionType} onChange={(e) => onChangeType(e.target.value)}>
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {ACTION_LABELS[type]}
            </option>
          ))}
        </select>

        {AMOUNT_ACTIONS.has(action.actionType) ? (
          <input
            type="number"
            min="0"
            value={action.amount}
            onChange={(e) => onChangeAmount(Number(e.target.value))}
          />
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
