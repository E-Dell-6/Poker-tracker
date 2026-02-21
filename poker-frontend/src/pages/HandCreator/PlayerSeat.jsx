import React, { useState, useEffect } from 'react';
import { ActionMenu } from './ActionMenu';
import { PlayerBlinds } from './PlayerBlinds';
import './PlayerSeat.css';

export default function PlayerSeat({ 
  player, 
  handId, 
  style, 
  playerIndex,
  totalPlayers,
  isActive,
  isDealer,
  dealerIndex,
  onActionComplete,
  currentStreet,
  currentBet
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(player.name);
  const [holeCards, setHoleCards] = useState([]);
  const [isCardMenuOpen, setIsCardMenuOpen] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);
  
  // Initialize hole cards for hero
  useEffect(() => {
    if (player.isHero) {
      setHoleCards(new Array(2).fill(null));
    }
  }, [player.isHero]);

  // Initialize hole cards for hero
  useEffect(() => {
    if (player.isHero) {
      setHoleCards(new Array(2).fill(null));
    }
  }, [player.isHero]);
  
  const updateHoleCards = async (card, index) => {
    try {
      setHoleCards(prev => {
        const next = [...prev];
        next[index] = card;
        return next;
      });

      const response = await fetch(
        `http://localhost:1111/api/favourites/${handId}/holeCards`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ card, index }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update data");
      }
    } catch (error) {
      console.error("Error updating hole card:", error);
    }
  };

  const handleHoleCardClick = (index, e) => {
    e.stopPropagation();
    setSelectedCardIndex(index);
    setIsCardMenuOpen(true);
  };

  const handleNameClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleNameSubmit = async () => {
    if (tempName.trim() && tempName !== player.name) {
      try {
        const payload = { 
          oldName: player.name, 
          newName: tempName,
          playerSeatNumber: player.seat 
        };
        
        console.log('Updating name with payload:', payload);
        console.log('HandId:', handId);
        console.log('URL:', `http://localhost:1111/api/favourites/${handId}/name`);
        
        const response = await fetch(`http://localhost:1111/api/favourites/${handId}/name`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload)
        });
        
        const responseText = await response.text();
        console.log('Raw response:', responseText);
        
        if (!response.ok) {
          let result;
          try {
            result = JSON.parse(responseText);
          } catch {
            result = { error: responseText };
          }
          throw new Error(result.details || result.error || "Name update failed");
        }
        
        const result = JSON.parse(responseText);
        console.log("Name updated successfully:", result);
        
        setIsEditing(false);
      } catch (error) {
        console.error("Error updating name:", error);
        setTempName(player.name);
        setIsEditing(false);
      }
    } else {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setTempName(player.name);
      setIsEditing(false);
    }
  };

  return (
    <div 
      className={`player-seat ${isActive ? 'active-turn' : ''} ${player.folded ? 'folded' : ''}`}
      style={style}
      data-player-index={playerIndex}
    >
      <PlayerBlinds 
        dealerIndex={dealerIndex}
        playerIndex={playerIndex}
        totalPlayers={totalPlayers}
        playerBet={player.currentBet}
      />
      
      <div className="player-info">
        {isEditing ? (
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleKeyDown}
            autoFocus
            className="name-input"
          />
        ) : (
          <div 
            className="player-name" 
            onClick={handleNameClick}
            title="Click to edit name"
          >
            {player.name}
          </div>
        )}
        <div className="player-stack">Stack: ${player.stack}</div>
        {player.currentBet > 0 && (
          <div className="player-bet">Bet: ${player.currentBet}</div>
        )}
        
        {/* Hero Cards */}
        {player.isHero && (
          <div className="hero-cards">
            {holeCards.map((card, index) => (
              <img
                key={index}
                src={
                  card
                    ? `/images/cards/${card}.png`
                    : "/images/cardbacks/fire_cardback.png"
                }
                alt={card ?? "Hidden card"}
                className="card-image"
                onClick={(e) => handleHoleCardClick(index, e)}
                style={{
                  width: '45px',
                  height: '63px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: index === 0 ? '4px' : '0'
                }}
              />
            ))}
          </div>
        )}
      </div>
      
      {isActive && !player.folded && (
        <ActionMenu 
          player={player}
          playerIndex={playerIndex}
          totalPlayers={totalPlayers}
          handId={handId}
          currentStreet={currentStreet}
          currentBet={currentBet}
          onClose={() => {}}
          onActionComplete={onActionComplete}
        />
      )}
      
      {/* Card Menu for selecting hero cards */}
      {isCardMenuOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000
          }}
          onClick={() => setIsCardMenuOpen(false)}
        >
          <div 
            style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              padding: '30px',
              borderRadius: '16px',
              border: '3px solid #0f3460',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: '#e94560', textAlign: 'center', marginBottom: '20px' }}>Select Card</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: '8px' }}>
              {['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'].map(rank => (
                ['♠', '♥', '♦', '♣'].map(suit => {
                  const suitColor = suit === '♥' || suit === '♦' ? '#e74c3c' : '#000';
                  return (
                    <div
                      key={`${rank}${suit}`}
                      onClick={() => {
                        updateHoleCards(`${rank}${suit}`, selectedCardIndex);
                        setIsCardMenuOpen(false);
                        setSelectedCardIndex(null);
                      }}
                      style={{
                        width: '50px',
                        height: '70px',
                        background: '#fff',
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        border: '2px solid #ddd',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: suitColor }}>
                        {rank}
                      </div>
                      <div style={{ fontSize: '24px', color: suitColor }}>
                        {suit}
                      </div>
                    </div>
                  );
                })
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}