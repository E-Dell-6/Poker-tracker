// headsUpStats.js - Utility for calculating Heads-Up poker statistics

/**
 * Calculate comprehensive statistics for a player in Heads-Up games
 * In heads-up:
 * - Small Blind makes ODD bets: Open (1-bet), 3-bet, 5-bet, 7-bet
 * - Big Blind makes EVEN bets: 2-bet, 4-bet, 6-bet, 8-bet
 * 
 * FIXED VERSION - Addresses all tracking and counting issues
 */
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
    
    // VPIP Calculation (FIXED)
    const didVPIP = calculateVPIP(preflopActions, playerName, position);
    if (didVPIP) {
      vpipHands++;
    }

    // PFR Calculation
    if (playerPreflopActions.some(a => a.actionType === 'RAISE' || a.actionType === 'BET')) {
      pfrHands++;
    }

    // Analyze betting sequence
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

/**
 * Fixed VPIP calculation
 */
function calculateVPIP(allPreflopActions, playerName, position) {
  const playerActions = allPreflopActions.filter(a => a.player === playerName);
  const realActions = allPreflopActions.filter(a => 
    a.actionType !== 'POST_SB' && a.actionType !== 'POST_BB'
  );
  
  if (position === 'Small Blind') {
    // SB VPIP: Only counts if they RAISE (not limp/complete)
    // Limping (calling BB) is not considered voluntary in heads-up
    return playerActions.some(a => a.actionType === 'RAISE' || a.actionType === 'BET');
  } else {
    // BB VPIP: Check what happened BEFORE their action
    let vpipAction = false;
    
    for (let i = 0; i < realActions.length; i++) {
      const action = realActions[i];
      
      if (action.player === playerName) {
        // Look at what happened before this action
        const previousActions = realActions.slice(0, i);
        const opponentRaised = previousActions.some(a => 
          a.player !== playerName && (a.actionType === 'RAISE' || a.actionType === 'BET')
        );
        
        if (opponentRaised) {
          // BB faced a raise - calling or raising counts as VPIP
          if (action.actionType === 'CALL' || action.actionType === 'RAISE' || action.actionType === 'BET') {
            vpipAction = true;
          }
        } else {
          // SB just limped/checked - only BB raising counts as VPIP
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

/**
 * COMPLETELY REWRITTEN betting sequence analyzer
 * Fixes all timing and counting issues
 */
function analyzeBettingSequence(actions, playerName, position, stats) {
  const realActions = actions.filter(a => 
    a.actionType !== 'POST_SB' && a.actionType !== 'POST_BB'
  );
  
  let currentBetLevel = 0;  // Tracks what bet level we're currently at
  let lastAggressorBetLevel = 0; // Tracks the last bet/raise that was made
  
  // Track if SB had opportunity to open
  let sbHadOpenOpportunity = false;
  
  console.log(`\n=== NEW HAND (${position}) ===`);
  console.log(`Actions: ${realActions.map(a => `${a.player}:${a.actionType}`).join(' → ')}`);
  
  for (let i = 0; i < realActions.length; i++) {
    const action = realActions[i];
    const isPlayer = action.player === playerName;
    
    if (action.actionType === 'RAISE' || action.actionType === 'BET') {
      currentBetLevel++;
      lastAggressorBetLevel = currentBetLevel;
      
      console.log(`Bet #${currentBetLevel} by ${action.player} (isPlayer: ${isPlayer}, position: ${position})`);
      
      if (isPlayer) {
        // Player made this bet/raise
        recordPlayerAggression(position, currentBetLevel, stats);
      } else {
        // Opponent made this bet/raise - creates opportunity for player
        recordOpportunity(position, currentBetLevel, stats);
      }
    } 
    else if (action.actionType === 'CALL' && isPlayer) {
      // Player called - this is a defense against the last bet level
      console.log(`${playerName} calls bet #${lastAggressorBetLevel}`);
      recordDefense(position, lastAggressorBetLevel, stats);
    }
    else if (action.actionType === 'FOLD') {
      if (isPlayer) {
        console.log(`${playerName} folded to bet #${lastAggressorBetLevel}`);
      }
      // Fold ends the action, but we've already counted the opportunity
      break;
    }
    else if (action.actionType === 'CHECK') {
      if (isPlayer && position === 'Small Blind' && i === 0) {
        // SB checked (limped) - they had opportunity to open but didn't
        sbHadOpenOpportunity = true;
        stats.opportunities1Bet++;
        console.log('SB limped (checked) - had open opportunity but declined');
      }
    }
  }
  
  // If SB never had their open opportunity counted yet, count it now
  if (position === 'Small Blind' && !sbHadOpenOpportunity) {
    // Check if SB took any action at all (if they opened, it's already counted)
    const sbMadeFirstAction = realActions.length > 0 && realActions[0].player === playerName;
    if (sbMadeFirstAction && (realActions[0].actionType === 'RAISE' || realActions[0].actionType === 'BET')) {
      // SB opened - opportunity already counted in recordPlayerAggression
    } else if (realActions.length > 0) {
      // SB did something else first (shouldn't happen in heads-up, but count opportunity)
      stats.opportunities1Bet++;
    }
  }
  
  console.log('=== END HAND ===\n');
}

/**
 * Record when player makes a bet/raise
 */
function recordPlayerAggression(position, betLevel, stats) {
  if (position === 'Small Blind') {
    // SB makes odd bets: 1-bet (open), 3-bet, 5-bet, 7-bet
    // But in standard notation: open, 4-bet, 6-bet, 8-bet
    switch(betLevel) {
      case 1:
        stats.made1Bet++;
        stats.opportunities1Bet++; // Counted when they actually open
        console.log('  → SB opened (made 1-bet)');
        break;
      case 3:
        stats.made4Bet++;
        console.log('  → SB made 4-bet');
        break;
      case 5:
        stats.made6Bet++;
        console.log('  → SB made 6-bet');
        break;
      case 7:
        stats.made8Bet++;
        console.log('  → SB made 8-bet');
        break;
    }
  } else {
    // BB makes even bets: 2-bet (3-bet), 4-bet (5-bet), 6-bet (7-bet), 8-bet (9-bet)
    switch(betLevel) {
      case 2:
        stats.made3Bet++;
        console.log('  → BB made 3-bet');
        break;
      case 4:
        stats.made5Bet++;
        console.log('  → BB made 5-bet');
        break;
      case 6:
        stats.made7Bet++;
        console.log('  → BB made 7-bet');
        break;
      case 8:
        stats.made9Bet++;
        console.log('  → BB made 9-bet');
        break;
    }
  }
}

/**
 * Record when player faces a bet (opportunity to raise or call)
 */
function recordOpportunity(position, betLevel, stats) {
  if (position === 'Small Blind') {
    // SB facing even bets from BB: 2-bet (3-bet), 4-bet (5-bet), 6-bet (7-bet)
    switch(betLevel) {
      case 2:
        stats.opportunities4Bet++;
        console.log('  → SB faces 3-bet (opportunity to 4-bet or defend)');
        break;
      case 4:
        stats.opportunities6Bet++;
        console.log('  → SB faces 5-bet (opportunity to 6-bet or defend)');
        break;
      case 6:
        stats.opportunities8Bet++;
        console.log('  → SB faces 7-bet (opportunity to 8-bet or defend)');
        break;
    }
  } else {
    // BB facing odd bets from SB: 1-bet (open), 3-bet (4-bet), 5-bet (6-bet), 7-bet (8-bet)
    switch(betLevel) {
      case 1:
        stats.facedOpen++;
        console.log('  → BB faces open (opportunity to 3-bet or defend)');
        break;
      case 3:
        stats.opportunities5Bet++;
        console.log('  → BB faces 4-bet (opportunity to 5-bet or defend)');
        break;
      case 5:
        stats.opportunities7Bet++;
        console.log('  → BB faces 6-bet (opportunity to 7-bet or defend)');
        break;
      case 7:
        stats.opportunities9Bet++;
        console.log('  → BB faces 8-bet (opportunity to 9-bet or defend)');
        break;
    }
  }
}

/**
 * Record when player defends (calls) against a bet
 */
function recordDefense(position, betLevel, stats) {
  if (position === 'Small Blind') {
    // SB defending against BB's bets: 3-bet, 5-bet, 7-bet
    switch(betLevel) {
      case 2:
        stats.defended3Bet++;
        console.log('  → SB defended vs 3-bet');
        break;
      case 4:
        stats.defended5Bet++;
        console.log('  → SB defended vs 5-bet');
        break;
      case 6:
        stats.defended7Bet++;
        console.log('  → SB defended vs 7-bet');
        break;
    }
  } else {
    // BB defending against SB's bets: open, 4-bet, 6-bet, 8-bet
    switch(betLevel) {
      case 1:
        stats.defended1Bet++;
        console.log('  → BB defended vs open');
        break;
      case 3:
        stats.defended4Bet++;
        console.log('  → BB defended vs 4-bet');
        break;
      case 5:
        stats.defended6Bet++;
        console.log('  → BB defended vs 6-bet');
        break;
      case 7:
        stats.defended8Bet++;
        console.log('  → BB defended vs 8-bet');
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
      // Raw counts for debugging
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
      // Raw counts for debugging
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
