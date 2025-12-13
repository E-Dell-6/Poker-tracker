import { parse } from 'csv-parse/sync';
import { createEmptyAction, createEmptyHand, createEmptyPlayer } from './DefaultSchemas';
import { findHero } from './findHero';

export function parsePokerNowLog(csvContent){
    const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true
    });

    let sortedRecords = records.sort((a, b) => {
        return Number(a.order) - Number(b.order);
    });


    let heroName = detectHeroName(sortedRecords);
    if (!heroName){
        console.warn("⚠️ Warning: Could not auto-detect Hero (Hero never showed cards).");
        console.warn("Falling back to manual config name...");
        process.exit(1);
    }
    console.log(`✅ Hero identified as: ${heroName}`);

    let recordsLength = sortedRecords.length;
    let handNumber = 1;

    for (i = 0; i < recordLength; i++){
        let entry = sortedRecordsrecords[i].entry;

        if (entry.startsWith("-- starting Hand")){
            let currentHand = createEmptyHand();
            currentHand.handIndex = handNumber;
            handNumber++;  
            currentHand.datePlayed = sortedRecords[i].at;
            if (getGameName(entry) === "No Limit Texas Hold'em"){
                currentHand.gameType = 'NLH';
            }
            if (getGameName(entry) === "Pot Limit Omaha"){
                currentHand.gameType = 'PLO';
            }

            i++;
            entry = sortedRecords[i].entry;
        }
        while (entry.includes("joined the game with a stack of")){
            i++;
            entry = sortedRecords[i].entry;
        }
        if (entry.startsWith("Player stacks:")){
            let originalString = entry;
            let prefixToRemove = "Player stacks: ";  
            let newEntry = originalString.substring(prefixToRemove.length);

            currentHand.players = parsePlayers(newEntry, heroName);
            i++;
            entry = sortedRecords[i].entry;
        }
        if (entry.startsWith("Your hand is ")){
            const heroCards = getHoleCards(entry);
            const heroPlayer = currentHand.players.find(player => player.isHero === true); 

            if (heroPlayer) {
                heroPlayer.holeCards = heroCards;
            }
            i++;
            entry = sortedRecords[i].entry;
        }  
        let street = 'PREFLOP';
        const actionArr = [];
        while (entry.includes(" calls ") || entry.includes(" raises ") || entry.includes(" posts ") || entry.includes(" folds ")) {
            getAction(entry, actionArr, street);
            i++; 
            entry = sortedRecords[i].entry;
            if (entry.includes("FLOP:")){
                currentHand.board.flop = extractBoardCards(entry);
                street = "FLOP";
                i++;
                entry = sortedRecords[i].entry;
                continue;
            }
            if (entry.includes("TURN:")){
                currentHand.board.turn = extractBoardCards(entry);
                street = "TURN";
                i++;
                entry = sortedRecords[i].entry;
                continue;
            }
            if (entry.includes("RIVER:")){
                currentHand.board.river = extractBoardCards(entry);
                street = "RIVER";
                i++;
                entry = sortedRecords[i].entry;
                continue;
            }
        }
        const winnerArr = [];
        let potSize = 0;
        while (entry.includes("collected")) {
            const winnerName = getPlayerName(entry);

            const textAfterCollected = entry.split(" collected ")[1];
            let amountStr = textAfterCollected.split(" ")[0];
            amountStr = amountStr.split(',').join('');
            const winAmount = parseInt(amountStr);

            winnerArr.push(winnerName);
            potsize += winAmount;
            
            i++;
            entry = sortedRecords[i].entry;
        }
        if (entry.startsWith("Uncalled bet of")){
            const winnerName = getPlayerName(entry);

            const amountPart = entry.split("Uncalled bet of ")[1];
            let amountStr = amountPart.split(" returned to")[0];
            amountStr = amountStr.split(',').join('').trim();
            const winAmount = parseInt(amountStr);
 
            winnerArr.push(winnerName);
            potsize += winAmount;

            i++;
            entry = sortedRecords[i].entry;
        }


        currentHand.winners = winnerArr;
        currentHand.finalPotSize = potSize;
        if (entry.startsWith(-- endingHand)){
            i++;
        }
        if (entry.includes("shows a ")){
            const showerName = getPlayerName(entry);
            if (showerName = heroName){
                i++; 
                entry = sortedRecords[i].entry;
                continue;
            }
            else{
                let cardString = entry.split(" shows a ")[1];

                if (cardString && cardString.endsWith('.')) {
                    cardString = cardString.slice(0, -1);
                }
                if (cardString) {
                    const cardsArray = cardString.split(',').map(card => card.trim());
                    
                    const winnerObj = currentHand.players.find(p => p.playerName === showerName);
                    
                    if (winnerObj) {
                        winnerObj.showedHand = cardsArray;
                    }
                }

        }

        
    }
    console.log(sortedRecords.length);
}

function getPlayerName(entry) {
    // 1. Find the start and end of the quoted section
    const startQuote = entry.indexOf('"');
    const endQuote = entry.lastIndexOf('"');

    // Safety check: if no quotes, it's not a player line
    if (startQuote === -1 || endQuote === -1) return null;

    // 2. Extract the full string (e.g., "Nate Higgers @ s9p1qZMXYl")
    const fullString = entry.substring(startQuote + 1, endQuote);

    // 3. Find the separator " @ " from the right side
    const separatorIndex = fullString.lastIndexOf(' @ ');

    // 4. If separator exists, cut it off. Otherwise, take the whole string.
    if (separatorIndex !== -1) {
        return fullString.substring(0, separatorIndex).trim();
    }
    
    return fullString.trim();
}

function getGameType(entry){
    const firstParenEnd = entry.indexOf(') ('); 

    if (firstParenEnd === -1) {
        return "Unknown Game Type";
    }

    const gameTypeStart = firstParenEnd + 3; 
    const gameTypeEnd = entry.indexOf(')', gameTypeStart);
    if (gameTypeEnd === -1) {
        return "Unknown Game Type";
    }
 
    const gameType = entry.substring(gameTypeStart, gameTypeEnd).trim();
    return gameType;
}



function parsePlayerStacks(playerString, heroName){
    const playerStringArr = playerString.split (" | ");

    const players = [];
    
    playerStringArr.forEach((playerStr) => {
        const newPlayer = createEmptyPlayer();

        const seatEndIndex = playerStr.indexOf(' ');
        const seatNumber = parseInt(playerStr.substring(1, seatEndIndex));
        newPlayer.seat = seatNumber;

        const quoteStart = playerStr.indexOf('"') + 1;
        const quoteEnd = playerStr.lastIndexOf('"');
        const nameWithID = playerStr.substring(quoteStart, quoteEnd);

        const atIndex = nameWithID.lastIndexOf(' @ ');
        const displayName = nameWithID.substring(0, atIndex).trim();
        newPlayer.name = displayName;
        if (displayName = heroName){
            newPlayer.isDealer = true;
        }

        const stackStart = playerStr.lastIndexOf('(') + 1;
        const stackEnd = playerStr.lastIndexOf(')');
        const stackSize = parseInt(playerStr.substring(stackStart, stackEnd));
        newPlayer.stack = stackSize;

        players.push(newPlayer);
    });
    return players;
}

const suitMap = {
    '♥': 'h', // Hearts
    '♦': 'd', // Diamonds
    '♣': 'c', // Clubs
    '♠': 's', // Spades
};
function getHoleCards (entry){
    let prefixToRemove = "Your hand is ";  
    const cardsString = entry.substring(prefixToRemove.length).trim();

    const symbolicCards = cardsString.split(', ');

    const holeCards = symbolicCards.map(convertToStandardNotation);
    return holeCards;
}

function getAction(entry, actionArr, street) {
    const newAction = createEmptyAction();
    newAction.street = street;
    newAction.player = getPlayerName(entry);

    // --- 1. Determine Action Type ---
    if (entry.includes("small blind")) newAction.actionType = "POST_SB";
    else if (entry.includes("big blind")) newAction.actionType = "POST_BB";
    else if (entry.includes("calls")) newAction.actionType = "CALL";
    else if (entry.includes("raises")) newAction.actionType = "RAISE";
    else if (entry.includes("bets")) newAction.actionType = "BET";
    else if (entry.includes("folds")) newAction.actionType = "FOLD";
    else if (entry.includes("checks")) newAction.actionType = "CHECK";
    else if (entry.includes("shows")) newAction.actionType = "SHOW_HAND";
    else if (entry.includes("mucks")) newAction.actionType = "MUCK";
    else return; 

    // --- 2. Extract the Number (Raw) ---
    const words = entry.trim().split(" ");
    let extractedAmount = 0;
    
    // Scan backwards for number
    for (let i = words.length - 1; i >= 0; i--) {
        let cleanWord = words[i];
        if (cleanWord.endsWith('.')) cleanWord = cleanWord.slice(0, -1);
        
        const val = parseInt(cleanWord, 10);
        if (!isNaN(val)) {
            extractedAmount = val;
            break;
        }
    }
    newAction.amount = extractedAmount;
    
    let currentPot = 0;
    if (actionArr.length > 0) {
        currentPot = actionArr[actionArr.length - 1].potSizeAfter || 0;
    }

    let addedAmount = 0;

    if (["POST_SB", "POST_BB", "BET", "CALL"].includes(newAction.actionType)) {
        addedAmount = extractedAmount;
    } 
    else if (newAction.actionType === "RAISE") {
        
        let playerStreetCommitment = 0;
        for (const action of actionArr) {
            if (action.player === newAction.player && action.street === street) {
                if (action.actionType === "RAISE") {
                    // "Raises TO X" resets their commitment to X
                    playerStreetCommitment = action.amount;
                } else if (["BET", "CALL", "POST_SB", "POST_BB"].includes(action.actionType)) {
                    // "Bets X" adds X to their commitment
                    playerStreetCommitment += action.amount;
                }
            }
        }
        addedAmount = extractedAmount - playerStreetCommitment;
        if (addedAmount < 0) addedAmount = 0;
    }
    newAction.potSizeAfter = currentPot + addedAmount;

    actionArr.push(newAction);
}

/**
 * Extracts board cards from a log line into a clean array.
 * Handles formats: "Flop: [Ah, Ks, 2d]" and "River: Ah, Ks, 2d, 9c [Th]"
 * STRICT NO REGEX.
 * * @param {string} entry - The log line containing card data.
 * @returns {string[]} An array of card strings (e.g., ["Ah", "Ks", "2d"]).
 */
export function extractBoardCards(entry) {
    // 1. Remove the "Street:" prefix (Flop:, Turn:, River:)
    // We look for the colon and take everything after it.
    let cardPart = entry;
    const colonIndex = entry.indexOf(':');
    
    if (colonIndex !== -1) {
        cardPart = entry.substring(colonIndex + 1);
    }

    cardPart = cardPart.split('[').join(',');

    // 3. Remove the closing bracket ']' completely.
    cardPart = cardPart.split(']').join('');

    // 4. Split by comma to get individual items
    const rawCards = cardPart.split(',');

    // 5. Clean up the array
    const cleanCards = [];
    
    for (let i = 0; i < rawCards.length; i++) {
        const card = rawCards[i].trim(); // Remove spaces around " Qs "
        
        // Only add if it's not an empty string (which happens if line started with [)
        if (card.length > 0) {
            cleanCards.push(card);
        }
    }

    return cleanCards;
}