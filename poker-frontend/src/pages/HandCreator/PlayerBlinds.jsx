import React from 'react';
import './PlayerBlinds.css';

export function PlayerBlinds({ dealerIndex, playerIndex, totalPlayers, playerBet }) {
  if (dealerIndex === null) return null;
  
  const sbIndex = (dealerIndex + 1) % totalPlayers;
  const bbIndex = (dealerIndex + 2) % totalPlayers;
  
  const isSmallBlind = playerIndex === sbIndex;
  const isBigBlind = playerIndex === bbIndex;
  
  if (!isSmallBlind && !isBigBlind) return null;
  
  return (
    <div className={`blind ${isSmallBlind ? 'small-blind' : 'big-blind'}`}>
      {isSmallBlind ? `SB ($${playerBet || 0.5})` : `BB ($${playerBet || 1})`}
    </div>
  );
}