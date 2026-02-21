import React, { useState, useRef, useEffect } from 'react';
import './DealerButton.css';

export default function DraggableDealerButton({ players, onDealerChange }) {
  const [position, setPosition] = useState({ x: 400, y: 300 });
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const buttonRef = useRef(null);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    const rect = buttonRef.current.getBoundingClientRect();
    setOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - offset.x,
        y: e.clientY - offset.y
      });
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      findClosestPlayer();
    }
  };

  const findClosestPlayer = () => {
    const buttonCenter = {
      x: position.x + 20, // 20 is half the button width
      y: position.y + 20
    };

    let closestIndex = 0;
    let minDistance = Infinity;

    players.forEach((player, index) => {
      const playerElement = document.querySelector(`[data-player-index="${index}"]`);
      if (playerElement) {
        const rect = playerElement.getBoundingClientRect();
        const playerCenter = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };

        const distance = Math.sqrt(
          Math.pow(buttonCenter.x - playerCenter.x, 2) +
          Math.pow(buttonCenter.y - playerCenter.y, 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      }
    });

    onDealerChange(closestIndex);
    
    // Snap to the closest player - position towards table center
    const closestElement = document.querySelector(`[data-player-index="${closestIndex}"]`);
    if (closestElement) {
      const rect = closestElement.getBoundingClientRect();
      const tableCenter = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      };
      
      // Calculate direction from player to table center
      const dx = tableCenter.x - (rect.left + rect.width / 2);
      const dy = tableCenter.y - (rect.top + rect.height / 2);
      
      // Normalize and move 175px towards center
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      const offsetDistance = 175; // Distance from player towards table center
      
      setPosition({
        x: rect.left + rect.width / 2 + (dx / magnitude) * offsetDistance - 20,
        y: rect.top + rect.height / 2 + (dy / magnitude) * offsetDistance - 20
      });
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position, offset]);

  return (
    <div
      ref={buttonRef}
      className={`draggable-dealer-button ${isDragging ? 'dragging' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
      onMouseDown={handleMouseDown}
    >
      D
    </div>
  );
}