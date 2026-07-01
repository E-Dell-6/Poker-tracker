export function getSeatStyle (index, totalPlayers){
    const xRadius = 50; 
    const yRadius = 36; 

    let angle;
    
    if (index === totalPlayers - 1) {
      angle = 90;
    } else {

      const numOtherPlayers = totalPlayers - 1;
      
      let arcSize;
      if (numOtherPlayers === 1) {
        arcSize = 180; 
      } else if (numOtherPlayers === 2) {
        arcSize = 200; 
      } else if (numOtherPlayers === 3) {
        arcSize = 240; 
      } else if (numOtherPlayers === 4) {
        arcSize = 260;
      } else if (numOtherPlayers === 5) {
        arcSize = 280;
      } else {
        arcSize = 300; 
      }
      
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
  const heroIndex = players.findIndex(p => p.isHero);
  
  if (heroIndex === -1) return players;
  
  return [
    ...players.slice(heroIndex + 1),  
    ...players.slice(0, heroIndex + 1) 
  ];
}