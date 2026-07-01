
export function calculateHeadsUpStats(hands, playerName) {
  const headsUpHands = hands.filter(hand => hand.gameType === 'Heads-Up');

  if (headsUpHands.length === 0) {
    return { totalHands: 0, vpip: 0, pfr: 0, positions: {} };
  }

  let totalHands = 0;
  let vpipHands = 0;
  let pfrHands = 0;

  const positionStats = {
    'Small Blind': initializeSmallBlindStats(),
    'Big Blind': initializeBigBlindStats()
  };

  headsUpHands.forEach(hand => {
    const player = hand.players.find(p => p.name === playerName);
    if (!player || !hand.actions) return;

    totalHands++;
    const position = player.isDealer ? 'Small Blind' : 'Big Blind';
    const posStats = positionStats[position];

    const preflopActions = hand.actions.filter(a => a.street === 'PREFLOP');
    const playerPreflopActions = preflopActions.filter(a => a.player === playerName);
    
    const didVPIP = calculateVPIP(preflopActions, playerName, position);
    if (didVPIP) {
      vpipHands++;
    }

    if (playerPreflopActions.some(a => a.actionType === 'RAISE' || a.actionType === 'BET')) {
      pfrHands++;
    }

    analyzeBettingSequence(preflopActions, playerName, position, posStats);
  });

  const vpip = totalHands > 0 ? Math.round((vpipHands / totalHands) * 100) : 0;
  const pfr = totalHands > 0 ? Math.round((pfrHands / totalHands) * 100) : 0;

  const positions = {};
  Object.keys(positionStats).forEach(pos => {
    positions[pos] = calculatePositionPercentages(positionStats[pos], pos);
  });

  return { totalHands, vpip, pfr, positions };
}


function calculateVPIP(allPreflopActions, playerName, position) {
  const playerActions = allPreflopActions.filter(a => a.player === playerName);
  const realActions = allPreflopActions.filter(a => 
    a.actionType !== 'POST_SB' && a.actionType !== 'POST_BB'
  );
  
  if (position === 'Small Blind') {
   
    return playerActions.some(a => a.actionType === 'RAISE' || a.actionType === 'BET');
  } else {
    let vpipAction = false;
    
    for (let i = 0; i < realActions.length; i++) {
      const action = realActions[i];
      
      if (action.player === playerName) {
        const previousActions = realActions.slice(0, i);
        const opponentRaised = previousActions.some(a => 
          a.player !== playerName && (a.actionType === 'RAISE' || a.actionType === 'BET')
        );
        
        if (opponentRaised) {
          if (action.actionType === 'CALL' || action.actionType === 'RAISE' || action.actionType === 'BET') {
            vpipAction = true;
          }
        } else {
          if (action.actionType === 'RAISE' || action.actionType === 'BET') {
            vpipAction = true;
          }
        }
      }
    }
    
    return vpipAction;
  }
}

function initializeSmallBlindStats() {
  return {
    opportunities1Bet: 0, made1Bet: 0,
    opportunities4Bet: 0, made4Bet: 0, defended3Bet: 0,
    opportunities6Bet: 0, made6Bet: 0, defended5Bet: 0,
    opportunities8Bet: 0, made8Bet: 0, defended7Bet: 0,
  };
}

function initializeBigBlindStats() {
  return {
    facedOpen: 0, made3Bet: 0, defended1Bet: 0,
    opportunities5Bet: 0, made5Bet: 0, defended4Bet: 0,
    opportunities7Bet: 0, made7Bet: 0, defended6Bet: 0,
    opportunities9Bet: 0, made9Bet: 0, defended8Bet: 0,
  };
}


function analyzeBettingSequence(actions, playerName, position, stats) {
  const realActions = actions.filter(a => 
    a.actionType !== 'POST_SB' && a.actionType !== 'POST_BB'
  );
  
  let currentBetLevel = 0;  
  let lastAggressorBetLevel = 0; 
  
  
  let sbHadOpenOpportunity = false;

  
  for (let i = 0; i < realActions.length; i++) {
    const action = realActions[i];
    const isPlayer = action.player === playerName;
    
    if (action.actionType === 'RAISE' || action.actionType === 'BET') {
      currentBetLevel++;
      lastAggressorBetLevel = currentBetLevel;
      
      
      if (isPlayer) {
        recordPlayerAggression(position, currentBetLevel, stats);
      } else {
        recordOpportunity(position, currentBetLevel, stats);
      }
    } 
    else if (action.actionType === 'CALL' && isPlayer) {
      recordDefense(position, lastAggressorBetLevel, stats);
    }
    else if (action.actionType === 'FOLD') {
      if (isPlayer) {
      }
      break;
    }
    else if (action.actionType === 'CHECK') {
      if (isPlayer && position === 'Small Blind' && i === 0) {
        sbHadOpenOpportunity = true;
        stats.opportunities1Bet++;
      }
    }
  }
  
  if (position === 'Small Blind' && !sbHadOpenOpportunity) {
    const sbMadeFirstAction = realActions.length > 0 && realActions[0].player === playerName;
    if (sbMadeFirstAction && (realActions[0].actionType === 'RAISE' || realActions[0].actionType === 'BET')) {
    } else if (realActions.length > 0) {
      stats.opportunities1Bet++;
    }
  }
  }


function recordPlayerAggression(position, betLevel, stats) {
  if (position === 'Small Blind') {
  
    switch(betLevel) {
      case 1:
        stats.made1Bet++;
        stats.opportunities1Bet++; 
        break;
      case 3:
        stats.made4Bet++;
        break;
      case 5:
        stats.made6Bet++;
        break;
      case 7:
        stats.made8Bet++;
        break;
    }
  } else {
    switch(betLevel) {
      case 2:
        stats.made3Bet++;
        break;
      case 4:
        stats.made5Bet++;
        break;
      case 6:
        stats.made7Bet++;
        break;
      case 8:
        stats.made9Bet++;
        break;
    }
  }
}

function recordOpportunity(position, betLevel, stats) {
  if (position === 'Small Blind') {
    switch(betLevel) {
      case 2:
        stats.opportunities4Bet++;
        break;
      case 4:
        stats.opportunities6Bet++;
        break;
      case 6:
        stats.opportunities8Bet++;
        break;
    }
  } else {
    switch(betLevel) {
      case 1:
        stats.facedOpen++;
        break;
      case 3:
        stats.opportunities5Bet++;
        break;
      case 5:
        stats.opportunities7Bet++;
        break;
      case 7:
        stats.opportunities9Bet++;
        break;
    }
  }
}


function recordDefense(position, betLevel, stats) {
  if (position === 'Small Blind') {
    switch(betLevel) {
      case 2:
        stats.defended3Bet++;
        break;
      case 4:
        stats.defended5Bet++;
        break;
      case 6:
        stats.defended7Bet++;
        break;
    }
  } else {
    switch(betLevel) {
      case 1:
        stats.defended1Bet++;
        break;
      case 3:
        stats.defended4Bet++;
        break;
      case 5:
        stats.defended6Bet++;
        break;
      case 7:
        stats.defended8Bet++;
        break;
    }
  }
}

function calculatePositionPercentages(stats, position) {
  const calc = (num, denom) => denom === 0 ? 0 : Math.round((num / denom) * 100);
  
  if (position === 'Small Blind') {
    return {
      openPct: calc(stats.made1Bet, stats.opportunities1Bet),
      fourBetPct: calc(stats.made4Bet, stats.opportunities4Bet),
      sixBetPct: calc(stats.made6Bet, stats.opportunities6Bet),
      eightBetPct: calc(stats.made8Bet, stats.opportunities8Bet),
      defend3BetPct: calc(stats.defended3Bet, stats.opportunities4Bet),
      defend5BetPct: calc(stats.defended5Bet, stats.opportunities6Bet),
      defend7BetPct: calc(stats.defended7Bet, stats.opportunities8Bet),
      _raw: {
        opportunities1Bet: stats.opportunities1Bet,
        made1Bet: stats.made1Bet,
        opportunities4Bet: stats.opportunities4Bet,
        made4Bet: stats.made4Bet,
        defended3Bet: stats.defended3Bet,
        opportunities6Bet: stats.opportunities6Bet,
        made6Bet: stats.made6Bet,
        defended5Bet: stats.defended5Bet,
        opportunities8Bet: stats.opportunities8Bet,
        made8Bet: stats.made8Bet,
        defended7Bet: stats.defended7Bet,
      }
    };
  } else {
    return {
      threeBetPct: calc(stats.made3Bet, stats.facedOpen),
      fiveBetPct: calc(stats.made5Bet, stats.opportunities5Bet),
      sevenBetPct: calc(stats.made7Bet, stats.opportunities7Bet),
      nineBetPct: calc(stats.made9Bet, stats.opportunities9Bet),
      defend1BetPct: calc(stats.defended1Bet, stats.facedOpen),
      defend4BetPct: calc(stats.defended4Bet, stats.opportunities5Bet),
      defend6BetPct: calc(stats.defended6Bet, stats.opportunities7Bet),
      defend8BetPct: calc(stats.defended8Bet, stats.opportunities9Bet),
      _raw: {
        facedOpen: stats.facedOpen,
        made3Bet: stats.made3Bet,
        defended1Bet: stats.defended1Bet,
        opportunities5Bet: stats.opportunities5Bet,
        made5Bet: stats.made5Bet,
        defended4Bet: stats.defended4Bet,
        opportunities7Bet: stats.opportunities7Bet,
        made7Bet: stats.made7Bet,
        defended6Bet: stats.defended6Bet,
        opportunities9Bet: stats.opportunities9Bet,
        made9Bet: stats.made9Bet,
        defended8Bet: stats.defended8Bet,
      }
    };
  }
}
