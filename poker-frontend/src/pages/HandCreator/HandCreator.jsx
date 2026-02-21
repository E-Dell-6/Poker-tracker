import React, { useState, useEffect } from "react";
import "./HandCreator.css";
import PlayerSeat from "./PlayerSeat";
import Settings from "./Settings";
import DraggableDealerButton from "./DealerButton";

// Controller component
function Controller({ currentIndex, totalActions, onNext, onPrev }) {
  const isLive = currentIndex === totalActions;
  
  return (
    <div className="controller">
      <button 
        onClick={onPrev}
        disabled={currentIndex === 0}
        className="controller-button"
      >
        ← Undo
      </button>
      <div className="controller-display">
        {currentIndex} / {totalActions}
        {isLive && <span style={{ color: '#4CAF50', marginLeft: '8px' }}>● LIVE</span>}
        {!isLive && <span style={{ color: '#e94560', marginLeft: '8px' }}>● REPLAY</span>}
      </div>
      <button 
        onClick={onNext}
        disabled={currentIndex >= totalActions}
        className="controller-button"
      >
        Next →
      </button>
    </div>
  );
}

// Card Menu Component
function CardMenu({ onSelect, onClose }) {
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
  const suits = ['♠', '♥', '♦', '♣'];
  const suitColors = { '♠': '#000', '♥': '#e74c3c', '♦': '#e74c3c', '♣': '#000' };
  
  return (
    <div className="card-menu-overlay" onClick={onClose}>
      <div className="card-menu-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="card-menu-title">Select Card</h3>
        <div className="card-grid">
          {ranks.map(rank => (
            suits.map(suit => (
              <div
                key={`${rank}${suit}`}
                onClick={() => onSelect(rank, suit)}
                className="card-option"
              >
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: suitColors[suit] }}>
                  {rank}
                </div>
                <div style={{ fontSize: '24px', color: suitColors[suit] }}>
                  {suit}
                </div>
              </div>
            ))
          ))}
        </div>
      </div>
    </div>
  );
}

export function HandCreator() {
  const [players, setPlayers] = useState([
    { name: "Player 1", stack: 100, seat: 0, currentBet: 0, folded: false, isHero: false },
    { name: "Player 2", stack: 100, seat: 1, currentBet: 0, folded: false, isHero: false },
    { name: "Player 3", stack: 100, seat: 2, currentBet: 0, folded: false, isHero: false },
    { name: "Player 4", stack: 100, seat: 3, currentBet: 0, folded: false, isHero: false },
    { name: "Player 5", stack: 100, seat: 4, currentBet: 0, folded: false, isHero: false },
    { name: "Player 6", stack: 100, seat: 5, currentBet: 0, folded: false, isHero: false },
    { name: "Player 7", stack: 100, seat: 6, currentBet: 0, folded: false, isHero: false },
    { name: "Player 8", stack: 100, seat: 7, currentBet: 0, folded: false, isHero: false },
    { name: "Hero", stack: 100, seat: 8, currentBet: 0, folded: false, isHero: true }
  ]);
  
  const [dealerIndex, setDealerIndex] = useState(null);
  const [actionHistory, setActionHistory] = useState([]);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [currentStreet, setCurrentStreet] = useState('PRE-FLOP');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [communityCards, setCommunityCards] = useState([]);
  const [isCardMenuOpen, setIsCardMenuOpen] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);
  const [handId, setHandId] = useState(null);
  const [blindsPosted, setBlindsPosted] = useState(false);
  
  const suitColors = { '♠': '#000', '♥': '#e74c3c', '♦': '#e74c3c', '♣': '#000' };
  
  // Create hand on mount
  useEffect(() => {
    const createHand = async () => {
      try {
        // Generate a unique ID for the hand
        const handId = `hand_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const emptyHand = {
          _id: handId,
          players: players.map((player, index) => ({
            name: player.name,
            seat: index,
            stack: player.stack || 100,
            isHero: player.isHero,
            holeCards: []
          })),
          actions: [],
          communityCards: [],
          pot: 0,
          currentStreet: 'PRE-FLOP',
          dealerSeat: null
        };
        
        console.log("Creating hand with data:", emptyHand);
        
        const response = await fetch(`http://localhost:1111/api/favourites/${handId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emptyHand),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.details || "Creation failed");
        }

        const result = await response.json();
        setHandId(handId);
        console.log("Hand created with ID:", handId);
        
        return result;
      } catch (error) {
        console.error("Error creating hand:", error);
      }
    };
    createHand(); 
  }, []);
  
  // Set dealer via API
  const handleDealerChange = async (index) => {
    setDealerIndex(index);
    console.log("Dealer is now at index:", index);
    
    if (!handId) return;
    
    try {
      const dealerSeat = players[index].seat;
      
      const response = await fetch(`http://localhost:1111/api/favourites/${handId}/blinds`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dealerSeat })
      });
      
      if (!response.ok) {
        throw new Error("Failed to update dealer");
      }
      
      const result = await response.json();
      console.log("Dealer updated:", result);
      
      // Post blinds automatically
      const sbIndex = (index + 1) % players.length;
      const bbIndex = (index + 2) % players.length;
      
      // Create blind actions
      const sbAction = {
        playerIndex: sbIndex,
        type: 'bet',
        amount: 0.5,
        timestamp: Date.now()
      };
      
      const bbAction = {
        playerIndex: bbIndex,
        type: 'bet',
        amount: 1,
        timestamp: Date.now() + 1
      };
      
      // Post small blind
      await fetch(`http://localhost:1111/api/favourites/${handId}/action`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actionType: 'bet',
          street: 'PRE-FLOP',
          amount: 0.5,
          playerSeatNumber: players[sbIndex].seat
        })
      });
      
      // Post big blind
      await fetch(`http://localhost:1111/api/favourites/${handId}/action`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actionType: 'bet',
          street: 'PRE-FLOP',
          amount: 1,
          playerSeatNumber: players[bbIndex].seat
        })
      });
      
      // Update local state
      setActionHistory([sbAction, bbAction]);
      setCurrentActionIndex(2);
      setBlindsPosted(true);
      
    } catch (err) {
      console.error("Error updating dealer:", err);
    }
  };
  
  // Calculate action order starting from UTG (left of BB)
  const getActionOrder = () => {
    const order = [];
    const totalPlayers = players.length;
    
    for (let i = 0; i < totalPlayers; i++) {
      const seatIndex = (dealerIndex + 3 + i) % totalPlayers;
      order.push(seatIndex);
    }
    
    return order;
  };
  
  // Get seat position styles
  const getSeatStyle = (idx, total) => {
    if (idx === total - 1) {
      return { bottom: '5%', left: '50%', transform: 'translateX(-50%)' };
    }
    
    const numOtherPlayers = total - 1;
    let arcSize = 300;
    if (numOtherPlayers === 1) arcSize = 180;
    else if (numOtherPlayers === 2) arcSize = 200;
    else if (numOtherPlayers === 3) arcSize = 240;
    else if (numOtherPlayers === 4) arcSize = 260;
    else if (numOtherPlayers === 5) arcSize = 280;
    
    const startAngle = 270 - (arcSize / 2);
    const angleStep = arcSize / (numOtherPlayers - 1 || 1);
    const angle = startAngle + (idx * angleStep);
    const angleRad = (angle * Math.PI) / 180;
    
    const radiusX = 42;
    const radiusY = 35;
    const x = 50 + radiusX * Math.cos(angleRad);
    const y = 50 + radiusY * Math.sin(angleRad);
    
    return {
      position: 'absolute',
      left: `${x}%`,
      top: `${y}%`,
      transform: 'translate(-50%, -50%)'
    };
  };
  
  // Get current game state by replaying actions
  const getCurrentState = () => {
    let currentPlayers = players.map(p => ({ ...p, currentBet: 0, folded: false }));
    let currentBet = 0;
    let street = 'PRE-FLOP';
    
    for (let i = 0; i < currentActionIndex; i++) {
      const action = actionHistory[i];
      
      if (action.type === 'street-change') {
        street = action.street;
        currentPlayers = currentPlayers.map(p => ({ ...p, currentBet: 0 }));
        currentBet = 0;
      } else {
        const playerIndex = action.playerIndex;
        
        if (action.type === 'fold') {
          currentPlayers[playerIndex].folded = true;
        } else if (action.type === 'check') {
          // No change
        } else if (action.type === 'call') {
          const amountToAdd = currentBet - currentPlayers[playerIndex].currentBet;
          currentPlayers[playerIndex].currentBet = currentBet;
          currentPlayers[playerIndex].stack -= amountToAdd;
        } else if (action.type === 'raise' || action.type === 'bet' || action.type === 'all-in') {
          const amountToAdd = action.amount - currentPlayers[playerIndex].currentBet;
          currentPlayers[playerIndex].currentBet = action.amount;
          currentPlayers[playerIndex].stack -= amountToAdd;
          currentBet = action.amount;
        }
      }
    }
    
    return { currentPlayers, currentBet, street };
  };
  
  const { currentPlayers, currentBet, street } = getCurrentState();
  const actionOrder = getActionOrder();
  
  // Always calculate who should act next at the current point in history
  const getNextPlayerIndex = () => {
    // Don't allow action until dealer is set
    if (dealerIndex === null) return null;
    
    const activePlayers = currentPlayers.filter(p => !p.folded);
    if (activePlayers.length <= 1) return null;
    
    // Get all actions on current street (only up to currentActionIndex)
    let actionsOnStreet = [];
    let nonBlindActions = []; // Track non-blind actions separately
    for (let i = actionHistory.length - 1; i >= 0; i--) {
      if (i >= currentActionIndex) continue; // Don't count actions beyond current point
      if (actionHistory[i].type === 'street-change') break;
      actionsOnStreet.unshift(actionHistory[i]);
      
      // Blinds are the first 2 actions (SB and BB)
      if (i >= 2) {
        nonBlindActions.push(actionHistory[i]);
      }
    }
    
    // Find the last player who acted (excluding blinds)
    let lastPlayerToAct = null;
    if (nonBlindActions.length > 0) {
      lastPlayerToAct = nonBlindActions[nonBlindActions.length - 1].playerIndex;
    }
    
    // Find the position in action order to start checking from
    let startCheckIndex = 0;
    if (lastPlayerToAct !== null) {
      const lastPlayerPosition = actionOrder.indexOf(lastPlayerToAct);
      if (lastPlayerPosition !== -1) {
        startCheckIndex = (lastPlayerPosition + 1) % actionOrder.length;
      }
    }
    // If no non-blind actions yet, start from beginning (UTG)
    
    // Check all players starting from the position after the last actor
    // We need to check everyone to see if they need to act again after a raise
    for (let i = 0; i < actionOrder.length; i++) {
      const checkIndex = (startCheckIndex + i) % actionOrder.length;
      const seatIndex = actionOrder[checkIndex];
      const player = currentPlayers[seatIndex];
      
      if (!player.folded) {
        // Player needs to act if their current bet is less than the highest bet
        if (player.currentBet < currentBet) {
          return seatIndex;
        }
      }
    }
    
    return null;
  };
  
  // Show action menu only when we're at the end of history (LIVE mode)
  const currentPlayerIndex = currentActionIndex === actionHistory.length ? getNextPlayerIndex() : null;
  
  // Check if action is complete at current point in history
  const isActionComplete = currentPlayerIndex === null && currentPlayers.filter(p => !p.folded).length > 1;
  
  // Get next street
  const getNextStreet = () => {
    const streets = ['PRE-FLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];
    const currentIndex = streets.indexOf(street);
    return currentIndex < streets.length - 1 ? streets[currentIndex + 1] : null;
  };
  
  // Get number of cards for current street
  const getRequiredCards = (streetName) => {
    switch(streetName) {
      case 'FLOP': return 3;
      case 'TURN': return 4;
      case 'RIVER': return 5;
      default: return 0;
    }
  };
  
  const requiredCards = getRequiredCards(street);
  
  const handleActionComplete = (playerSeat, actionType, amount) => {
    const action = {
      playerIndex: playerSeat,
      type: actionType,
      amount: amount,
      timestamp: Date.now()
    };
    
    // If we're not at the end of history, truncate everything after current position
    const newHistory = actionHistory.slice(0, currentActionIndex);
    setActionHistory([...newHistory, action]);
    setCurrentActionIndex(currentActionIndex + 1);
  };
  
  const handleStreetChange = async (newStreet) => {
    const action = {
      type: 'street-change',
      street: newStreet,
      timestamp: Date.now()
    };
    
    // If we're not at the end of history, truncate everything after current position
    const newHistory = actionHistory.slice(0, currentActionIndex);
    setActionHistory([...newHistory, action]);
    setCurrentActionIndex(currentActionIndex + 1);
    
    if (!handId) return;
    
    try {
      await fetch(`http://localhost:1111/api/favourites/${handId}/street`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ street: newStreet })
      });
    } catch (error) {
      console.error("Error updating street:", error);
    }
  };
  
  const handleCardSelect = async (rank, suit) => {
    const newCards = [...communityCards];
    newCards[selectedCardIndex] = { rank, suit };
    setCommunityCards(newCards);
    setIsCardMenuOpen(false);
    setSelectedCardIndex(null);
    
    if (!handId) return;
    
    try {
      const card = `${rank}${suit}`;
      await fetch(`http://localhost:1111/api/favourites/${handId}/communityCards`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ card, index: selectedCardIndex })
      });
    } catch (error) {
      console.error("Error updating community card:", error);
    }
  };
  
  const handleNext = () => {
    if (currentActionIndex < actionHistory.length) {
      setCurrentActionIndex(currentActionIndex + 1);
    }
  };
  
  const handlePrev = () => {
    if (currentActionIndex > 0) {
      // Remove the last action from history completely
      const newHistory = actionHistory.slice(0, currentActionIndex - 1);
      setActionHistory(newHistory);
      setCurrentActionIndex(newHistory.length);
    }
  };
  
  return (
    <div className="hand-creator-container">
      <Controller
        currentIndex={currentActionIndex}
        totalActions={actionHistory.length}
        onNext={handleNext}
        onPrev={handlePrev}
      />
      
      <button 
        className="settings-button" 
        onClick={() => setIsSettingsOpen(true)}
      >
        ⚙️ Settings
      </button>
      
      <div className="street-indicator">
        Current Street: <strong>{street}</strong>
        <div className="current-bet">
          Current Bet: ${currentBet}
        </div>
      </div>
      
      {isSettingsOpen && (
        <Settings 
          onClose={() => setIsSettingsOpen(false)}
          dealerIndex={dealerIndex}
          setDealerIndex={handleDealerChange}
          totalPlayers={players.length}
        />
      )}
      
      {isCardMenuOpen && (
        <CardMenu 
          onSelect={handleCardSelect}
          onClose={() => setIsCardMenuOpen(false)}
        />
      )}
      
      <DraggableDealerButton 
        players={currentPlayers}
        onDealerChange={handleDealerChange}
      />
      
      <div className="pokertable">
        <div className="table-center-logo" />
        <div className="table-rail-highlight" />
        
        {/* Community Cards */}
        {requiredCards > 0 && (
          <div className="community-cards">
            {Array.from({ length: requiredCards }).map((_, index) => (
              <div
                key={index}
                onClick={() => {
                  setSelectedCardIndex(index);
                  setIsCardMenuOpen(true);
                }}
                className="community-card"
              >
                {communityCards[index] ? (
                  <>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: suitColors[communityCards[index].suit] }}>
                      {communityCards[index].rank}
                    </div>
                    <div style={{ fontSize: '32px', color: suitColors[communityCards[index].suit] }}>
                      {communityCards[index].suit}
                    </div>
                  </>
                ) : (
                  <div className="card-placeholder">?</div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Next Street Button */}
        {isActionComplete && getNextStreet() && (
          <button
            onClick={() => handleStreetChange(getNextStreet())}
            className="next-street-button"
          >
            Go to {getNextStreet()}
          </button>
        )}
        
        <div className="table-seats">
          {currentPlayers.map((player, index) => (
            <PlayerSeat
              key={player.seat}
              player={player}
              handId={handId}
              style={getSeatStyle(index, players.length)}
              playerIndex={index}
              totalPlayers={players.length}
              isActive={index === currentPlayerIndex}
              isDealer={index === dealerIndex}
              dealerIndex={dealerIndex}
              onActionComplete={handleActionComplete}
              currentStreet={street}
              currentBet={currentBet}
            />
          ))}
        </div>
      </div>
    </div>
  );
}