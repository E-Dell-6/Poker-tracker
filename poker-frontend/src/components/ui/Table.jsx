import './Table.css';

// Composable table shell, extracted from the header/row/cell markup pattern
// already repeated (with slightly different class names) across
// SessionLog.jsx/History.jsx/Players.jsx. Each page still controls its own
// columns/cell content - this just gives them one consistent look instead
// of three near-identical bespoke ones.
export function Table({ children, className = '' }) {
  return (
    <div className="ui-table-wrap">
      <table className={`ui-table ${className}`}>{children}</table>
    </div>
  );
}

export function TableHead({ children }) {
  return (
    <thead>
      <tr>{children}</tr>
    </thead>
  );
}

export function TableBody({ children }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({ children, onClick, className = '' }) {
  return (
    <tr className={`${onClick ? 'ui-table-row--clickable' : ''} ${className}`} onClick={onClick}>
      {children}
    </tr>
  );
}

export function TableCell({ children, header = false, align, className = '' }) {
  const Cell = header ? 'th' : 'td';
  return <Cell className={`ui-table-cell ${align ? `align-${align}` : ''} ${className}`}>{children}</Cell>;
}

export default Table;
