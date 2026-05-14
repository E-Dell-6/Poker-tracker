import { parse } from 'csv-parse/sync';
import { createEmptyAction, createEmptyHand, createEmptyPlayer } from './DefaultSchemas.js';

export function parsePokerNowLog(csvContent) {
    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
    });

    if (records.length > 0 && records[0].entry === undefined) {
        throw new Error("CSV missing 'entry' column.");
    }

    const sortedRecords = records.sort((a, b) => Number(a.order) - Number(b.order));

    // --- STEP 1: IDENTIFY THE GLOBAL HERO (PERSISTENT FIX) ---
    let globalHeroName = null;
    let tempHeroCards = null;

    for (const record of sortedRecords) {
        const line = String(record.entry || "");
        if (line.startsWith("Your hand is ")) {
            tempHeroCards = getHoleCards(line).sort().join(',');
        }
        if (line.includes(" shows a ") && tempHeroCards) {
            const shownCards = extractShownCards(line).sort().join(',');
            if (shownCards === tempHeroCards) {
                globalHeroName = getPlayerName(line);
                break;
            }
        }
        if (line.toLowerCase().startsWith("-- ending hand")) tempHeroCards = null;
    }

    // --- STEP 2: MAIN PARSING ---
    const hands = [];
    let currentHand = null;
    let handNumber = 1;
    let currentStreet = 'PREFLOP';

    for (const record of sortedRecords) {
        const line = String(record.entry || "");
        if (line === "" || line.startsWith("Game Config") || line.startsWith("The admin") || line.startsWith("*")) continue;

        if (line.startsWith("-- starting hand")) {
            if (currentHand) hands.push(currentHand);
            currentHand = createEmptyHand();
            currentHand.handIndex = handNumber++;
            currentHand.datePlayed = record.at;

            const gameTypeStr = getGameType(line);
            currentHand.gameType = gameTypeStr === "No Limit Texas Hold'em" ? 'NLH' : 'PLO';
            currentStreet = 'PREFLOP';

            const dealerName = getDealerName(line);
            if (dealerName) currentHand.dealerName = dealerName;

            if (globalHeroName) currentHand.heroName = globalHeroName;
            continue;
        }

        if (!currentHand) continue;

        if (line.startsWith("Player stacks:")) {
            currentHand.players = parsePlayerStacks(line.substring(15));

            if (globalHeroName) {
                const hp = currentHand.players.find(p => p.name === globalHeroName);
                if (hp) hp.isHero = true;
            }

            if (currentHand.dealerName) {
                const dp = currentHand.players.find(p => p.name === currentHand.dealerName);
                if (dp) dp.isDealer = true;
            }
            continue;
        }

        if (line.startsWith("Your hand is ")) {
            const cards = getHoleCards(line);
            if (globalHeroName) {
                const hp = currentHand.players?.find(p => p.name === globalHeroName);
                if (hp) {
                    hp.holeCards = cards;
                    hp.isHero = true;
                }
            }
            continue;
        }

        // --- BOARD CARDS ---
        if (line.startsWith("Flop:")) {
            currentHand.board.flop = extractBoardCards(line);
            currentStreet = "FLOP";
            continue;
        }
        if (line.startsWith("Turn:")) {
            currentHand.board.turn = extractBoardCards(line);
            currentStreet = "TURN";
            continue;
        }
        if (line.startsWith("River:")) {
            currentHand.board.river = extractBoardCards(line);
            currentStreet = "RIVER";
            continue;
        }

        // --- SHOW HAND ---
        // PokerNow lines: `"Player @ ID" shows a Ah, Kd.`
        if (line.includes(" shows a ")) {
            const playerName = getPlayerName(line);
            const cards = extractShownCards(line);
            if (playerName && currentHand.players) {
                const player = currentHand.players.find(p => p.name === playerName);
                if (player) {
                    player.showedHand = cards;
                }
            }
            // Emit a SHOW_HAND action so the replayer steps through it
            const action = createEmptyAction();
            action.street = currentStreet;
            action.actionType = "SHOW_HAND";
            action.player = playerName;
            action.amount = 0;
            const prevPot = currentHand.actions.length > 0
                ? currentHand.actions[currentHand.actions.length - 1].potSizeAfter
                : 0;
            action.potSizeAfter = prevPot;
            currentHand.actions.push(action);
            continue;
        }

        // --- MUCK HAND ---
        // PokerNow lines: `"Player @ ID" mucks a hand`
        if (line.includes(" mucks a hand")) {
            const playerName = getPlayerName(line);
            const action = createEmptyAction();
            action.street = currentStreet;
            action.actionType = "MUCK";
            action.player = playerName;
            action.amount = 0;
            const prevPot = currentHand.actions.length > 0
                ? currentHand.actions[currentHand.actions.length - 1].potSizeAfter
                : 0;
            action.potSizeAfter = prevPot;
            currentHand.actions.push(action);
            continue;
        }

        // --- ACTIONS ---
        if (/calls|raises|posts|bets|checks|folds/.test(line)) {
            getAction(line, currentHand.actions, currentStreet);
            continue;
        }

        // --- WINNERS ---
        if (line.includes(" collected ") || line.startsWith("Uncalled bet of")) {
            let winnerName = getPlayerName(line);
            let amountStr = line.includes("collected")
                ? line.split(" collected ")[1].split(" ")[0]
                : line.split("Uncalled bet of ")[1].split(" returned")[0];
            let winAmount = parseInt(amountStr.replace(/,/g, ''), 10);

            if (winnerName) {
                if (!currentHand.winners.includes(winnerName)) currentHand.winners.push(winnerName);
                const wp = currentHand.players.find(p => p.name === winnerName);
                if (wp) wp.winnings = (wp.winnings || 0) + winAmount;
                currentHand.finalPotSize += winAmount;
            }
            continue;
        }

        if (line.toLowerCase().startsWith("-- ending hand")) {
            hands.push(currentHand);
            currentHand = null;
            continue;
        }
    }

    if (currentHand) hands.push(currentHand);
    return hands;
}

// --- HELPERS ---

function getDealerName(entry) {
    const dealerMatch = entry.match(/\(dealer:\s*"([^"]+)"\)/);
    if (!dealerMatch) return null;
    return dealerMatch[1].split(' @ ')[0].trim();
}

export function extractBoardCards(entry) {
    let cardPart = entry;
    const colonIndex = entry.indexOf(':');
    if (colonIndex !== -1) cardPart = entry.substring(colonIndex + 1);

    return cardPart
        .replace('[', ',')
        .replace(']', '')
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0)
        .map(convertToStandardNotation);
}

function extractShownCards(entry) {
    const cardPart = entry.split(" shows a ")[1];
    if (!cardPart) return [];
    return cardPart.replace('.', '').split(', ').map(convertToStandardNotation);
}

function getPlayerName(entry) {
    const match = entry.match(/"([^"]+)"/);
    if (!match) return null;
    return match[1].split(' @ ')[0].trim();
}

function getHoleCards(entry) {
    return entry.substring(13).trim().split(', ').map(convertToStandardNotation);
}

const suitMap = { '♥': 'h', '♦': 'd', '♣': 'c', '♠': 's' };
function convertToStandardNotation(card) {
    const suit = card.slice(-1);
    let rank = card.slice(0, -1);
    if (rank === '10') rank = 'T';
    return `${rank}${suitMap[suit] || suit}`;
}

function getGameType(entry) {
    const parts = entry.split(') ');
    return parts[1] ? parts[1].split(' (dealer')[0].trim() : "";
}

function parsePlayerStacks(playerString) {
    return playerString.split(" | ").map(pStr => {
        const p = createEmptyPlayer();
        const seatMatch = pStr.match(/#(\d+)/);
        const nameMatch = pStr.match(/"([^"]+)"/);
        const stackMatch = pStr.match(/\((\d+,?\d*)\)/);

        if (seatMatch) p.seat = parseInt(seatMatch[1]);
        if (nameMatch) p.name = nameMatch[1].split(' @ ')[0].trim();
        if (stackMatch) p.stack = parseInt(stackMatch[1].replace(',', ''));
        return p;
    });
}

function getAction(entry, actionArr, street) {
    const action = createEmptyAction();
    action.street = street;
    action.player = getPlayerName(entry);

    if (entry.includes("small blind")) action.actionType = "POST_SB";
    else if (entry.includes("big blind")) action.actionType = "POST_BB";
    else if (entry.includes("calls")) action.actionType = "CALL";
    else if (entry.includes("raises")) action.actionType = "RAISE";
    else if (entry.includes("bets")) action.actionType = "BET";
    else if (entry.includes("folds")) action.actionType = "FOLD";
    else action.actionType = "CHECK";

    // Extract the action amount cleanly.
    // PokerNow formats: `calls 500`, `bets 1000`, `raises to 2000`, `posts small blind of 25`
    // We grab the first number after the action keyword to avoid grabbing pot sizes
    // that sometimes appear later in the line (e.g. "... and the pot is 3000").
    let amount = 0;
    const callMatch   = entry.match(/calls (\d[\d,]*)/);
    const raiseMatch  = entry.match(/raises to (\d[\d,]*)/);
    const betMatch    = entry.match(/bets (\d[\d,]*)/);
    const blindMatch  = entry.match(/blind of (\d[\d,]*)/);

    if (action.actionType === "CALL" && callMatch)              amount = parseInt(callMatch[1].replace(/,/g, ''), 10);
    else if (action.actionType === "RAISE" && raiseMatch)       amount = parseInt(raiseMatch[1].replace(/,/g, ''), 10);
    else if (action.actionType === "BET" && betMatch)           amount = parseInt(betMatch[1].replace(/,/g, ''), 10);
    else if ((action.actionType === "POST_SB" || action.actionType === "POST_BB") && blindMatch)
                                                                amount = parseInt(blindMatch[1].replace(/,/g, ''), 10);

    action.amount = amount;
    const prevPot = actionArr.length > 0 ? actionArr[actionArr.length - 1].potSizeAfter : 0;
    action.potSizeAfter = prevPot + action.amount;
    actionArr.push(action);
}