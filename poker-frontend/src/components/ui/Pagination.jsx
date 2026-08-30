import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import './Pagination.css';

// Shared prev/next pager for any server-paginated list (History's sessions,
// Players' roster - see their fetch effects for the page/limit query params
// this drives). `totalPages` may be 0 (no results) - both buttons just stay
// disabled in that case, no special-casing needed by callers.
export function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="ui-pagination">
      <Button
        variant="secondary"
        icon={ChevronLeft}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Prev
      </Button>
      <span className="ui-pagination-label">Page {page} of {totalPages}</span>
      <Button
        variant="secondary"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next <ChevronRight size={14} />
      </Button>
    </div>
  );
}

export default Pagination;
