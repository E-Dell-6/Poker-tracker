// Shared angle logic: where a seat sits around the table for a given index.
// This is the same placement math used for the player boxes themselves —
// the dealer button reuses it so it lines up with whichever seat is the dealer.
function getSeatAngle(index, totalPlayers) {
    if (index === totalPlayers - 1) {
      return 90;
    }

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
    return startAngle + (index * angleStep);
}

export function getSeatStyle (index, totalPlayers){
    const xRadius = 50;
    const yRadius = 36;

    const angle = getSeatAngle(index, totalPlayers);
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

// Places a dealer-button chip along the exact same seat angle, but pulled
// in toward the center of the table so it sits "in front of" that player
// rather than on top of their name/stack box.
export function getDealerButtonStyle(index, totalPlayers) {
    const xRadius = 33;
    const yRadius = 22;

    const angle = getSeatAngle(index, totalPlayers);
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