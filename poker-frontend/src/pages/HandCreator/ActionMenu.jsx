import { useState, useEffect } from "react";
import "./ActionMenu.css";

export function ActionMenu({ 
  player, 
  playerIndex, 
  totalPlayers = 9, 
  handId, 
  currentStreet, 
  currentBet,
  onClose, 
  onActionComplete
}) {
  const [raiseAmount, setRaiseAmount] = useState(currentBet * 2);
  
  const playerStack = player.stack;
  const amountToCall = currentBet - (player.currentBet || 0);
  const minRaise = currentBet * 2 || 2;
  
  const canCheck = currentBet === 0 || player.currentBet === currentBet;
  const canCall = currentBet > 0 && amountToCall < playerStack;
  const canRaise = playerStack > currentBet;
  
  useEffect(() => {
    setRaiseAmount(Math.min(minRaise, playerStack));
  }, [minRaise, playerStack]);
  
  // Calculate menu position based on seat location
  const getMenuPosition = (index, total) => {
    if (index === total - 1) return 'above';
    
    const numOtherPlayers = total - 1;
    let arcSize = 300;
    if (numOtherPlayers === 1) arcSize = 180;
    else if (numOtherPlayers === 2) arcSize = 200;
    else if (numOtherPlayers === 3) arcSize = 240;
    else if (numOtherPlayers === 4) arcSize = 260;
    else if (numOtherPlayers === 5) arcSize = 280;
    
    const startAngle = 270 - (arcSize / 2);
    const angleStep = arcSize / (numOtherPlayers - 1 || 1);
    const angle = startAngle + (index * angleStep);
    
    if (angle >= 45 && angle <= 135) return 'above';
    else if (angle > 135 && angle <= 225) return 'right';
    else if (angle > 225 && angle < 315) return 'below';
    else return 'left';
  };
  
  const position = getMenuPosition(playerIndex, totalPlayers);
  
  const createAction = async (actionType, amount = 0) => {
    try {
      const payload = { 
        actionType, 
        street: currentStreet, 
        amount, 
        playerSeatNumber: player.seat 
      };
      
      console.log('Sending action:', payload);
      console.log('To URL:', `http://localhost:1111/api/favourites/${handId}/action`);
      
      const response = await fetch(
        `http://localhost:1111/api/favourites/${handId}/action`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload)
        }
      );
      
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: responseText };
        }
        console.error("Server error:", errorData);
        throw new Error(`Failed to update data: ${JSON.stringify(errorData)}`);
      }
      
      const data = JSON.parse(responseText);
      console.log("Action created successfully:", data);
    } catch(error) {
      console.error("error sending data:", error);
    }
  };
  
  const handleRaise = () => {
    if (raiseAmount < minRaise && raiseAmount !== playerStack) {
      alert(`Minimum raise is ${minRaise}`);
      return;
    }
    
    const isAllIn = raiseAmount === playerStack;
    const actionType = isAllIn ? 'all-in' : (currentBet === 0 ? 'bet' : 'raise');
    
    createAction(actionType, raiseAmount);
    
    if (onActionComplete) {
      onActionComplete(player.seat, actionType, raiseAmount);
    }
    onClose();
  };
  
  const handleFold = () => {
    createAction('fold', 0);
    if (onActionComplete) onActionComplete(player.seat, 'fold', 0);
    onClose();
  };
  
  const handleCheck = () => {
    createAction('check', 0);
    if (onActionComplete) onActionComplete(player.seat, 'check', 0);
    onClose();
  };
  
  const handleCall = () => {
    const isAllIn = amountToCall >= playerStack;
    const actualCallAmount = Math.min(amountToCall, playerStack);
    const actionType = isAllIn ? 'all-in' : 'call';
    
    createAction(actionType, currentBet);
    
    if (onActionComplete) onActionComplete(player.seat, actionType, currentBet);
    onClose();
  };
  
  return (
    <div className={`action-menu ${position}`}>
      <div className="action-menu-header">
        {player.name} - Stack: ${playerStack}
      </div>
      <div className="action-menu-content">
        <div className="betting-info">
          {currentBet > 0 && <div>Current bet: ${currentBet}</div>}
          {canCall && <div>To call: ${amountToCall}</div>}
          {canRaise && <div>Min raise: ${minRaise}</div>}
        </div>
        
        {canRaise && (
          <div className="raise-section">
            <div className="slider-value">
              {raiseAmount === playerStack ? `ALL-IN ($${raiseAmount})` : `$${raiseAmount}`}
            </div>
            <input
              type="range"
              min={minRaise}
              max={playerStack}
              step="1"
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
              className="slider"
            />
            <input
              type="number"
              min={minRaise}
              max={playerStack}
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
              className="number-input"
            />
            <button 
              className="action-button" 
              onClick={handleRaise}
              style={{ 
                background: raiseAmount === playerStack ? '#f44' : '#4CAF50' 
              }}
            >
              {raiseAmount === playerStack ? 'All-In' : (currentBet === 0 ? 'Bet' : 'Raise')}
            </button>
          </div>
        )}
        
        {canCheck && (
          <button className="action-button" onClick={handleCheck}>
            Check
          </button>
        )}
        
        {canCall && (
          <button 
            className="action-button" 
            onClick={handleCall}
            style={{ background: '#2196F3' }}
          >
            Call ${amountToCall}
          </button>
        )}
        
        <button 
          className="action-button" 
          onClick={handleFold}
          style={{ background: '#f44' }}
        >
          Fold
        </button>
      </div>
    </div>
  );
}