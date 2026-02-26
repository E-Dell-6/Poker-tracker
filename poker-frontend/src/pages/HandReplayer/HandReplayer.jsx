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
      // If street changes, insert a reveal action first
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

    // DISPLAY STATE ONLY
    let bets = {}; // playerName -> bet amount shown
    let folded = {};
    let shownPlayerHand = [];
    let maxBet = 0;
    let checked = [];
    let currentStreet = "PREFLOP";
    let pot = 0; // Track total pot
    let currentStreetBets = 0; // Track bets on current street



    actionsWithReveals.slice(0, actionIndex).forEach((action, idx) => {
      // --- STREET CHANGE ---
      if (action.street && action.street !== currentStreet) {
        currentStreet = action.street;

        // reset
        pot += currentStreetBets;
        currentStreetBets = 0;

        bets = {};
        checked = [];
        maxBet = 0;

        if (currentStreet === "FLOP") {
          currentBoard = [...hand.board.flop]; // Show flop
        }
        if (currentStreet === "TURN") {
          currentBoard = [...hand.board.turn]; // Show flop + turn
        }
        if (currentStreet === "RIVER") {
          currentBoard = [...hand.board.river]; // Show flop + turn + river
          firstRunoutComplete = true;
        }
      }

      if (!action.player) return;

      if (!action.player) return;

      const amount = Number(action.amount) || 0;

      // Find the player and track their previous bet this street
      const player = players.find((p) => p.name === action.player);
      if (!player) return;

      const previousBet = bets[action.player] || 0;

      // --- BLINDS / POSTS ---
      if (action.actionType === "POST_SB" || action.actionType === "POST_BB") {
        bets[action.player] = amount;
        maxBet = Math.max(maxBet, amount);
        player.stack -= amount;
        currentStreetBets += amount;
        return;
      }

      // --- BET / RAISE (ABSOLUTE AMOUNT) ---
      if (action.actionType === "BET" || action.actionType === "RAISE") {
        const additionalAmount = amount - previousBet;
        bets[action.player] = amount;
        maxBet = amount;
        player.stack -= additionalAmount;
        currentStreetBets += additionalAmount;

        const checkedIndex = checked.indexOf(action.player);
        if (checkedIndex > -1) {
          checked.splice(checkedIndex, 1);
        }
        return;
      }
      if (action.actionType === "CHECK") {
        checked.push(action.player);
      }
      // --- CALL (ABSOLUTE AMOUNT) ---
      if (action.actionType === "CALL") {
        const additionalAmount = amount - previousBet;
        bets[action.player] = amount;
        maxBet = Math.max(maxBet, amount);
        player.stack -= additionalAmount;
        currentStreetBets += additionalAmount;
        const checkedIndex = checked.indexOf(action.player);
        if (checkedIndex > -1) {
          checked.splice(checkedIndex, 1);
        }
        return;
      }
      //FOLD
      if (action.actionType === "FOLD") {
        folded[action.player] = true;
        return;
      }

      //SHOW
      if (action.actionType === "SHOW_HAND") {
        shownPlayerHand.push(action.player);
        bets = {};
      }
    });

    // MOVED OUTSIDE THE LOOP - Check after all actions are processed

    // Fallback: If we've processed all actions and board isn't showing, just show it
    if (actionIndex >= actionsWithReveals.length - 1 && hand.board) {
      if (hand.board.river && hand.board.river.length > 0) {
        currentBoard = [...hand.board.river];
        firstRunoutComplete = true;
      } else if (hand.board.turn && hand.board.turn.length > 0) {
        currentBoard = [...hand.board.turn];
      } else if (hand.board.flop && hand.board.flop.length > 0) {
        currentBoard = [...hand.board.flop];
      }
    }

    // Alternative check: if the main board is complete (5 cards), first runout is done
    if (currentBoard.length === 5) {
      firstRunoutComplete = true;
    }



    if (firstRunoutComplete && hand.isRunTwice && hand.secondBoard) {
      showSecondBoard = true;

      // Build the full second board by combining flop, turn, and river
      const secondFlop = hand.secondBoard.flop || [];
      const secondTurn = hand.secondBoard.turn || [];
      const secondRiver = hand.secondBoard.river || [];


      // Combine all cards based on what's available
      if (secondRiver.length > 0) {
        currentSecondBoard = [...secondRiver]; // River includes flop + turn already
      } else if (secondTurn.length > 0) {
        currentSecondBoard = [...secondTurn]; // Turn includes flop already
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
  const winnerAnimations = [];

  if (actionIndex === actionsWithReveals.length && hand?.winners) {
    hand.winners.forEach((winnerName) => {
      // Find the index of the winner in the DISPLAYED list to match the visual seat
      const winnerIndex = displayedPlayers.findIndex(
        (p) => p.name === winnerName
      );

      if (winnerIndex !== -1) {
        // reuse the logic that positions the seat
        const style = getSeatStyle(winnerIndex, displayedPlayers.length);
        winnerAnimations.push({
          name: winnerName,
          targetStyle: style,
        });
      }
    });
  }

  return (
    <div className="hand-replayer">
      <div className="controller">
        <div className="controller">
          <Controller
            onNext={() => setActionIndex(actionIndex + 1)}
            onPrev={() => setActionIndex(actionIndex - 1)}
            actionIndex={actionIndex}
            totalActions={actionsWithReveals.length}
            initialIndex={initialIndex}
          />
        </div>
      </div>
      <button className="history-button" onClick={toggleCollapse}>Menu</button>
      <div className={!historyCollapse ? "history" : "nothing"}>
        
  {session && session.hands ? (
    <ul className="hands-list">
      {session.hands.map((hand, i) => {
        const hero = hand.players.find((p) => p.isHero);
        return (
          <li 
            key={i} 
            className="hand-item"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/hand-replay', { state: { hand: hand, session: session }});
            }}
          >
            <div className="session-info">
              <span className="session-date">
                #{hand.handIndex || i + 1}
              </span>
              <span className="session-game-type">
                {hero
                  ? `${hero.holeCards.join(" ")}`
                  : "No Cards"}
              </span>
              <span className="session-players">
                Winner: {hand.winners.join(", ")}
              </span>
            </div>

            <div
              className={`session-profit ${
                hand.finalPotSize > 0 ? "win" : ""
              }`}
            >
              <span className="pot-label">Pot:</span>
              {hand.finalPotSize}
            </div>
          </li>
        );
      })}
    </ul>
  ) : (
    <p style={{ color: 'white', padding: '20px' }}>No session data available</p>
  )}
</div>
  
      <div className="table-container">
        <PokerTable
          board={derivedState.currentBoard}
          pot={derivedState.pot}
          bigBlind={bigBlind}
          winners={
            actionIndex === actionsWithReveals.length ? hand?.winners : null
          }
          secondBoard={
            derivedState.showSecondBoard
              ? derivedState.currentSecondBoard
              : null
          }
        />
        <div className="table-seats">
          {reorderPlayersForDisplay(derivedState.players).map(
            (player, index) => (
              <PlayerSeat
                key={player.name}
                player={player}
                style={getSeatStyle(index, derivedState.players.length)}
                betAmount={derivedState.currentBetAmount[player.name] || 0}
                isFolded={derivedState.folded[player.name] === true}
                winners={
                  actionIndex === actionsWithReveals.length
                    ? hand?.winners
                    : null
                }
                isChecked={derivedState.checked.includes(player.name) === true}
                shownPlayerHand={
                  derivedState.shownPlayerHand.includes(player.name)
                    ? player.showedHand
                    : null
                }
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}