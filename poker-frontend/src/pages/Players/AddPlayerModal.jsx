import { CreatePersonForm } from '../HandCreator/components/PersonPicker';
import './AddPlayerModal.css';

// Thin modal shell around PersonPicker's own CreatePersonForm (name + image
// upload) - reused as-is rather than a third copy of the same form
// (EditSessionLog.jsx's per-opponent picker is the second).
export function AddPlayerModal({ onClose, onCreate }) {
  return (
    <div className="apm-overlay" onClick={onClose}>
      <div className="apm-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="apm-heading">Add Player</h3>
        <CreatePersonForm onCancel={onClose} onCreate={onCreate} showStarToggle />
      </div>
    </div>
  );
}

export default AddPlayerModal;
