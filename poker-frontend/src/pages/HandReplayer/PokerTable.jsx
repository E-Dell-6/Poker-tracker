import "./PokerTable.css";

export default function PokerTable({ board, secondBoard, pot, bigBlind, winners }) {
  const isWinner = (winners === null);
  const doesPotExist = (pot > 0);
  console.log(board);
  
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
  if (pot >= bigBlind * 12) {
    potImage = "medium-stack";
  }
  if (pot >= bigBlind * 50) {
    potImage = "large-stack";
  }

  return (
    <div className="pokertable">

      <div className="full-board" style={{ bottom: secondAllCards.length > 0 ? '350px' : '300px' }}>
        {secondAllCards.length > 0 && <div className="board-label">Run 1</div>}
        {allCards.map((card, i) => (
          <img
            key={i}
            src={`/images/cards/${card}.png`}
            alt={card}
            className="board-card"
          />
        ))}
      </div>

      {secondAllCards.length > 0 && (
        <div className="full-board" style={{ bottom: '240px' }}>
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
      
      <div className="pot">
        {potImage && isWinner && doesPotExist && (
          <img
            src={`/images/chips/${potImage}.png`}
            alt={potImage}
            className={`pot-image ${potImage}`}
          />
        )}
        <span className="pot-text">Pot: {pot || 0}</span>
      </div>
    </div>
  );
}