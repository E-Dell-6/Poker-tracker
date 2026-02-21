export function getSeatStyle (index, totalPlayers){
    const xRadius = 50; // Maximum spread
    const yRadius = 45; // Maximum spread

    let angle;
    
    // Last player (hero) is always at the bottom (90°)
    if (index === totalPlayers - 1) {
      angle = 90;
    } else {
      // Distribute other players around almost the entire table
      const numOtherPlayers = totalPlayers - 1;
      
      // Use almost the full circle, leaving space only for hero at bottom
      let arcSize;
      if (numOtherPlayers === 1) {
        arcSize = 180; // Single opponent goes directly opposite
      } else if (numOtherPlayers === 2) {
        arcSize = 200; 
      } else if (numOtherPlayers === 3) {
        arcSize = 240; 
      } else if (numOtherPlayers === 4) {
        arcSize = 260;
      } else if (numOtherPlayers === 5) {
        arcSize = 280;
      } else {
        arcSize = 300; // For 7+ players, use 300° (leaves only 60° for hero)
      }
      
      // Center the arc at the top (270° = top center)
      const startAngle = 270 - (arcSize / 2);
      const angleStep = arcSize / (numOtherPlayers - 1 || 1);
      angle = startAngle + (index * angleStep);
    }

    const radian = (angle * Math.PI) / 180;
    const left = 50 + (xRadius * Math.cos(radian));
    const top = 50 + (yRadius * Math.sin(radian));
    
    return {
      position: 'absolute',
      left: `${left}%`,
      top: `${top}%`,
      transform: 'translate(-50%, -50%)',
    };
}

export function reorderPlayersForDisplay(players) {
  // Find hero index
  const heroIndex = players.findIndex(p => p.isHero);
  
  // If no hero found, return players as-is
  if (heroIndex === -1) return players;
  
  // Rotate array so hero comes last (bottom position)
  return [
    ...players.slice(heroIndex + 1),  // Players after hero
    ...players.slice(0, heroIndex + 1) // Players before hero + hero
  ];
}