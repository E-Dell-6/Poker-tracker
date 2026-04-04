import "./PokerTable.css";

export default function PokerTable({ board, secondBoard, pot, bigBlind, winners, seats }) {
  const isWinner = (winners === null);
  const doesPotExist = (pot > 0);
  
  // Process first board
  let allCards = [];
  if (Array.isArray(board)) {
    allCards = board;
  } else if (board) {
    const flop = board.flop || [];
    const turn = board.turn || [];
    const river = board.river || [];
    allCards = [...flop, ...turn, ...river];
  }

  // Process second board (run it twice)
  let secondAllCards = [];
  if (secondBoard && Array.isArray(secondBoard)) {
    secondAllCards = secondBoard;
  } else if (secondBoard) {
    const flop = secondBoard.flop || [];
    const turn = secondBoard.turn || [];
    const river = secondBoard.river || [];
    secondAllCards = [...flop, ...turn, ...river];
  }

  let potImage = "small-stack";
  if (pot >= bigBlind * 12) potImage = "medium-stack";
  if (pot >= bigBlind * 50) potImage = "large-stack";

  const hasBoard = allCards.length > 0;
  const hasSecondBoard = secondAllCards.length > 0;

  return (
    <div className="pokertable">

      {/* ── Seats layer ── */}
      {seats && (
        <div className="table-seats">
          {seats}
        </div>
      )}

      {/* ── Pot: own anchor, always above center, never overlaps board ── */}
      <div className={`pot ${hasBoard || winners !== undefined ? "pot--above-board" : "pot--preflop"}`}>
        {potImage && isWinner && doesPotExist && (
          <img
            src={`/images/chips/${potImage}.png`}
            alt={potImage}
            className={`pot-image ${potImage}`}
          />
        )}
        <span className="pot-text">Pot: {pot || 0}</span>
      </div>

      {/* ── Board: own anchor, centered ── */}
      {hasBoard && (
        <div className="boards-center">
          <div
            className="full-board"
            style={{
              transform: hasSecondBoard
                ? "translate(-50%, calc(-100% - 10px))"
                : "translate(-50%, -50%)"
            }}
          >
            {hasSecondBoard && <div className="board-label">Run 1</div>}
            {allCards.map((card, i) => (
              <img
                key={i}
                src={`/images/cards/${card}.png`}
                alt={card}
                className="board-card"
              />
            ))}
          </div>

          {hasSecondBoard && (
            <div
              className="full-board"
              style={{ transform: "translate(-50%, 10px)" }}
            >
              <div className="board-label">Run 2</div>
              {secondAllCards.map((card, i) => (
                <img
                  key={i}
                  src={`/images/cards/${card}.png`}
                  alt={card}
                  className="board-card"
                />
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}