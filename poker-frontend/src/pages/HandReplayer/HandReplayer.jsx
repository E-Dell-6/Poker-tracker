import React, { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./HandReplayer.css";

import PokerTable from "./PokerTable";
import PlayerSeat from "./PlayerSeat";
import Controller from "../../components/controller"

import { getSeatStyle, reorderPlayersForDisplay } from "../../utils/getSeatStyle";

export function HandReplayer() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const hand = state?.hand;
  const session = state?.session;
  const [actionIndex, setActionIndex] = useState(0);
  let [historyCollapse, setHistoryCollapse] = useState(true);
  const toggleCollapse = () => {
    setHistoryCollapse(!historyCollapse);
  }

  useEffect(() => {
    setActionIndex(0);
  }, [hand?._id]);

  const actions = hand?.actions || [];

  const actionsWithReveals = useMemo(() => {
    const augmented = [];
    let lastStreet = "PREFLOP";

    actions.forEach((action) => {
      if (action.street && action.street !== lastStreet) {
        augmented.push({
          actionType: "reveal",
          street: action.street,
          revealStreet: action.street,
        });
        lastStreet = action.street;
      }
      augmented.push(action);
    });

    return augmented;
  }, [actions]);

  const initialIndex = useMemo(() => {
    const firstNonPostIndex = actionsWithReveals.findIndex(
      (action) => action.actionType !== "POST_SB" && action.actionType !== "POST_BB"
    );
    return firstNonPostIndex === -1 ? 0 : firstNonPostIndex;
  }, [actionsWithReveals]);

  const derivedState = useMemo(() => {
    const players = JSON.parse(JSON.stringify(hand.players));
    let currentBoard = [];
    let currentSecondBoard = [];
    let firstRunoutComplete = false;
    let showSecondBoard = false;

    let bets = {};
    let folded = {};
    let shownPlayerHand = [];
    let maxBet = 0;
    let checked = [];
    let currentStreet = "PREFLOP";
    let pot = 0;
    let currentStreetBets = 0;

    actionsWithReveals.slice(0, actionIndex).forEach((action) => {
      if (action.actionType === "reveal") {
        currentStreet = action.revealStreet;
        pot += currentStreetBets;
        currentStreetBets = 0;
        bets = {};
        checked = [];
        maxBet = 0;

        if (currentStreet === "FLOP") {
          currentBoard = [...(hand.board.flop || [])];
        } else if (currentStreet === "TURN") {
          currentBoard = [...(hand.board.turn || [])];
        } else if (currentStreet === "RIVER") {
          currentBoard = [...(hand.board.river || [])];
          firstRunoutComplete = true;
        }
        return;
      }

      if (!action.player) return;

      const amount = Number(action.amount) || 0;
      const player = players.find((p) => p.name === action.player);
      if (!player) return;

      const previousBet = bets[action.player] || 0;

      if (action.actionType === "POST_SB" || action.actionType === "POST_BB") {
        bets[action.player] = amount;
        maxBet = Math.max(maxBet, amount);
        player.stack -= amount;
        currentStreetBets += amount;
        return;
      }

      if (action.actionType === "BET" || action.actionType === "RAISE") {
        const additionalAmount = amount - previousBet;
        bets[action.player] = amount;
        maxBet = amount;
        player.stack -= additionalAmount;
        currentStreetBets += additionalAmount;
        const checkedIndex = checked.indexOf(action.player);
        if (checkedIndex > -1) checked.splice(checkedIndex, 1);
        return;
      }

      if (action.actionType === "CHECK") {
        checked.push(action.player);
        return;
      }

      if (action.actionType === "CALL") {
        const additionalAmount = amount - previousBet;
        bets[action.player] = amount;
        maxBet = Math.max(maxBet, amount);
        player.stack -= additionalAmount;
        currentStreetBets += additionalAmount;
        const checkedIndex = checked.indexOf(action.player);
        if (checkedIndex > -1) checked.splice(checkedIndex, 1);
        return;
      }

      if (action.actionType === "FOLD") {
        folded[action.player] = true;
        return;
      }

      if (action.actionType === "SHOW_HAND") {
        shownPlayerHand.push(action.player);
        bets = {};
        return;
      }
    });

    if (actionIndex >= actionsWithReveals.length && hand.board) {
      if (hand.board.river && hand.board.river.length > 0) {
        currentBoard = [...hand.board.river];
        firstRunoutComplete = true;
      } else if (hand.board.turn && hand.board.turn.length > 0) {
        currentBoard = [...hand.board.turn];
      } else if (hand.board.flop && hand.board.flop.length > 0) {
        currentBoard = [...hand.board.flop];
      }
    }

    if (currentBoard.length === 5) firstRunoutComplete = true;

    if (firstRunoutComplete && hand.isRunTwice && hand.secondBoard) {
      showSecondBoard = true;
      const secondFlop = hand.secondBoard.flop || [];
      const secondTurn = hand.secondBoard.turn || [];
      const secondRiver = hand.secondBoard.river || [];

      if (secondRiver.length > 0) {
        currentSecondBoard = [...secondRiver];
      } else if (secondTurn.length > 0) {
        currentSecondBoard = [...secondTurn];
      } else if (secondFlop.length > 0) {
        currentSecondBoard = [...secondFlop];
      }
    }

    return {
      players,
      currentBoard,
      currentBetAmount: bets,
      maxBet,
      folded,
      shownPlayerHand,
      pot: pot + currentStreetBets,
      checked,
      showSecondBoard,
      currentSecondBoard,
    };
  }, [actionIndex, actionsWithReveals, hand]);

  const allBlinds = actionsWithReveals
    .filter((action) => action.actionType === "POST_SB" || action.actionType === "POST_BB")
    .map((action) => action.amount);
  const bigBlind = Math.max(...allBlinds, 0);

  const displayedPlayers = reorderPlayersForDisplay(derivedState.players);

  // Build seat nodes to pass into PokerTable so they render
  // inside the table ellipse — ensuring % positions are relative
  // to the table itself, not the outer padded container.
  const seatNodes = displayedPlayers.map((player, index) => (
    <PlayerSeat
      key={player.name}
      player={player}
      style={getSeatStyle(index, displayedPlayers.length)}
      betAmount={derivedState.currentBetAmount[player.name] || 0}
      isFolded={derivedState.folded[player.name] === true}
      winners={actionIndex === actionsWithReveals.length ? hand?.winners : null}
      isChecked={derivedState.checked.includes(player.name) === true}
      shownPlayerHand={
        derivedState.shownPlayerHand.includes(player.name)
          ? player.showedHand
          : null
      }
    />
  ));

  return (
    <div className="hand-replayer">
      <div className="controller-wrapper">
        <Controller
          onNext={() => setActionIndex(Math.min(actionIndex + 1, actionsWithReveals.length))}
          onPrev={() => setActionIndex(Math.max(actionIndex - 1, initialIndex))}
          actionIndex={actionIndex}
          totalActions={actionsWithReveals.length}
          initialIndex={initialIndex}
        />
      </div>

      <button className="history-button" onClick={toggleCollapse}>Menu</button>

      <div className={!historyCollapse ? "history" : "nothing"}>
        {session && session.hands ? (
          <ul className="hands-list">
            {session.hands.map((h, i) => {
              const hero = h.players.find((p) => p.isHero);
              const isActive = h._id === hand?._id;
              return (
                <li
                  key={i}
                  className={`hand-item ${isActive ? "active-hand" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/hand-replay', { state: { hand: h, session: session } });
                  }}
                >
                  <div className="hand-item-left">
                    <span className="hand-round-number">#{h.handIndex || i + 1}</span>
                    <div className="menu-hole-cards">
                      {hero && hero.holeCards?.length > 0 ? (
                        hero.holeCards.map((card, ci) => (
                          <div key={ci} className="menu-card-wrapper">
                            <img
                              src={`/images/cards/${card}.png`}
                              alt={card}
                              className="menu-card-img"
                            />
                          </div>
                        ))
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>—</span>
                      )}
                    </div>
                  </div>

                  <div className="hand-item-right">
                    <div className="hand-item-winner">
                      <span className="winner-label">Winner</span>
                      <span className="winner-name">{h.winners?.join(", ") || "—"}</span>
                    </div>
                    <div className="hand-item-pot">
                      <span className="pot-label">Pot</span>
                      <span className="pot-value">{h.finalPotSize}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p style={{ color: 'var(--muted)', padding: '20px', fontSize: 13 }}>No session data available</p>
        )}
      </div>

      {/* table-container: just centers the table, no seat overlay needed here */}
      <div className="table-container">
        <PokerTable
          board={derivedState.currentBoard}
          pot={derivedState.pot}
          bigBlind={bigBlind}
          winners={actionIndex === actionsWithReveals.length ? hand?.winners : null}
          secondBoard={derivedState.showSecondBoard ? derivedState.currentSecondBoard : null}
          seats={seatNodes}
        />
      </div>
    </div>
  );
}