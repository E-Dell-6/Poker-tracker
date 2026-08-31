import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './ImportLogCta.css';

// Centered "+ Import log" call-to-action shown in place of an empty
// list/table when the visitor isn't signed in - History and Players both
// use this exact same treatment. Importing hands requires an account, so
// it routes to /login rather than straight to an upload flow that would
// just fail.
export function ImportLogCta() {
  const navigate = useNavigate();
  return (
    <div className="import-log-cta">
      <button type="button" className="import-log-cta-btn" onClick={() => navigate('/login')}>
        <Plus size={18} /> Import log
      </button>
    </div>
  );
}

export default ImportLogCta;
