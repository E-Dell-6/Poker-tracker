import { createEmptyAction, createEmptyHand, createEmptyPlayer } from './DefaultSchemas.js';
import { computeHandProfits } from './handProfitCalculator.js';

/**
 * Parses an ACR (America's CardRoom) plain-text hand history export into
 * the same hand/action/player shape produced by parsePokerNowLog.
 *
 * Note on units: ACR logs are real-money ($) hands, unlike PokerNow's play-
 * chip logs. All dollar amounts (stacks, bet sizes, pot sizes, winnings)
 * are converted to integer CENTS (e.g. "$2.07" -> 207) so pot/action math
 * stays exact and never drifts due to floating point rounding.
 *
 * Note on multi-word names: ACR player names can contain spaces (e.g.
 * "Tony Champaroney"), so most lines can't be parsed with a naive \S+
 * token match. The "Seat N: Name ($X.XX)" lines are always the FIRST
 * thing ACR prints for a hand, so by the time we reach any later line
 * (Dealt to / shows / does not show / action lines / summary "won $"
 * lines / Uncalled bet returns) `currentHand.players` already holds the
 * full, correctly-parsed name list for that hand. Those later lines are
 * matched against that known list (see matchKnownPlayerName) instead of
 * being re-parsed with a generic name regex, so a multi-word name is
 * resolved consistently everywhere instead of each call site guessing
 * independently and risking disagreeing with each other.
 */
export function parseACRLog(fileContent) {
    const text = String(fileContent || '').replace(/\r\n/g, '\n');

    // Hands are separated by a blank line and each one starts with "Hand #...".
    const blocks = text
        .split(/\n(?=Hand #)/)
        .map(b => b.trim())
        .filter(b => b.length > 0);

    if (blocks.length === 0) {
        throw new Error("No ACR hands found in file.");
    }

    // ACR only reveals hole cards for the hero ("Dealt to X [..]"), so the
    // first occurrence of that line anywhere in the file tells us who the
    // hero is for the whole session. There's only ever one "[" (the hole
    // cards) on this line, so a greedy match up to " [" correctly captures
    // a multi-word name without any ambiguity.
    let globalHeroName = null;
    for (const block of blocks) {
        const m = block.match(/^Dealt to (.+) \[/m);
        if (m) {
            globalHeroName = m[1];
            break;
        }
    }

    const hands = [];
    let handNumber = 1;

    for (const block of blocks) {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) continue;

        const headerMatch = lines[0].match(
            /^Hand #(\S+) - (.+?) - (\$[\d,.]+\/\$[\d,.]+) - (\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) UTC/
        );
        if (!headerMatch) continue; // not a recognizable hand block, skip it

        const currentHand = createEmptyHand();
        currentHand.handIndex = handNumber++;
        currentHand.gameType = /omaha/i.test(headerMatch[2]) ? 'PLO' : 'NLH';
        currentHand.stakes = headerMatch[3];

        const iso = headerMatch[4].replace(/\//g, '-').replace(' ', 'T') + 'Z';
        currentHand.datePlayed = new Date(iso);

        if (globalHeroName) currentHand.heroName = globalHeroName;
        currentHand.players = [];

        let buttonSeat = null;
        const buttonMatch = (lines[1] || '').match(/Seat #(\d+) is the button/);
        if (buttonMatch) buttonSeat = parseInt(buttonMatch[1], 10);

        let currentStreet = 'PREFLOP';
        let inSummary = false;

        for (let i = 2; i < lines.length; i++) {
            const line = lines[i];

            if (line === '*** HOLE CARDS ***' || line === '*** SHOW DOWN ***') continue;

            if (line.startsWith('*** SUMMARY ***')) {
                inSummary = true;
                continue;
            }

            if (!inSummary) {
                // Seat line: "Seat N: Name ($X.XX)" optionally followed by
                // " is sitting out". (.+?) allows a multi-word name; the
                // trailing $ anchor plus the optional group means we
                // actually look for "is sitting out" instead of the old
                // code's unanchored match silently ignoring it.
                const seatMatch = line.match(/^Seat (\d+): (.+?) \(\$([\d,]+\.?\d*)\)(\s+is sitting out)?$/);
                if (seatMatch) {
                    const p = createEmptyPlayer();
                    p.seat = parseInt(seatMatch[1], 10);
                    p.name = seatMatch[2];
                    p.stack = parseMoney(seatMatch[3]);
                    p.isSittingOut = Boolean(seatMatch[4]);
                    if (buttonSeat === p.seat) p.isDealer = true;
                    if (globalHeroName && p.name === globalHeroName) p.isHero = true;
                    currentHand.players.push(p);
                    continue;
                }

                // Seat announced but not yet in the hand, e.g.
                // "Seat 4: AlexSexy will be allowed to play after the button"
                const waitingMatch = line.match(/^Seat (\d+): (.+?) will be allowed to play after the button$/);
                if (waitingMatch) {
                    const p = createEmptyPlayer();
                    p.seat = parseInt(waitingMatch[1], 10);
                    p.name = waitingMatch[2];
                    p.stack = null;
                    p.isSittingOut = true;
                    if (buttonSeat === p.seat) p.isDealer = true;
                    if (globalHeroName && p.name === globalHeroName) p.isHero = true;
                    currentHand.players.push(p);
                    continue;
                }

                if (/^Seat \d+:/.test(line)) continue; // fallback: any other unmatched seat-line format

                if (line.startsWith('*** FLOP ***')) {
                    currentHand.board.flop = extractACRBoardCards(line);
                    currentStreet = 'FLOP';
                    continue;
                }
                if (line.startsWith('*** TURN ***')) {
                    currentHand.board.turn = extractACRBoardCards(line);
                    currentStreet = 'TURN';
                    continue;
                }
                if (line.startsWith('*** RIVER ***')) {
                    currentHand.board.river = extractACRBoardCards(line);
                    currentStreet = 'RIVER';
                    continue;
                }

                if (line.startsWith('Dealt to ')) {
                    // Only one "[" on this line (the hole cards), so slicing
                    // on its index handles a multi-word name with no ambiguity.
                    const bracketStart = line.indexOf('[');
                    const bracketEnd = line.lastIndexOf(']');
                    if (bracketStart !== -1 && bracketEnd !== -1) {
                        const name = line.slice('Dealt to '.length, bracketStart).trim();
                        const cards = line.slice(bracketStart + 1, bracketEnd);
                        const hp = currentHand.players.find(p => p.name === name);
                        if (hp) {
                            hp.holeCards = cards.split(/\s+/).filter(Boolean);
                            hp.isHero = true;
                        }
                    }
                    continue;
                }

                const showsIdx = line.indexOf(' shows [');
                if (showsIdx !== -1) {
                    const name = line.slice(0, showsIdx);
                    const cardsStart = showsIdx + ' shows ['.length;
                    // Use the FIRST ']' after the hole cards, not the last
                    // ']' in the line — lines like "shows [Ac 4c] (two pair,
                    // Fours and Deuces [4d 4c 2d 2c Ac])" have a second
                    // bracketed group (the hand description's board refs)
                    // whose closing bracket comes later in the line.
                    const bracketEnd = line.indexOf(']', cardsStart);
                    const cardsPart = bracketEnd !== -1
                        ? line.slice(cardsStart, bracketEnd)
                        : '';
                    const cards = cardsPart.split(/\s+/).filter(c => c && c !== '-');
                    const hp = currentHand.players.find(p => p.name === name);
                    if (hp) hp.showedHand = cards;
                    pushZeroAmountAction(currentHand, 'SHOW_HAND', name, currentStreet);
                    continue;
                }

                const DOES_NOT_SHOW = ' does not show';
                if (line.endsWith(DOES_NOT_SHOW)) {
                    const name = line.slice(0, -DOES_NOT_SHOW.length);
                    pushZeroAmountAction(currentHand, 'MUCK', name, currentStreet);
                    continue;
                }

                // Informational lines that don't map to a recorded action.
                // Pot totals are read from the SUMMARY's "Total pot" line
                // instead, so an uncalled bet return is never counted as a
                // win against `finalPotSize`/`winners` — the player is just
                // getting their own excess bet back, not winning it off
                // someone else. But the returned amount IS added to their
                // `winnings` here, because computeHandProfits needs it to
                // correctly net "chips back" against "chips put in" for
                // this hand — otherwise a raise that goes uncalled would
                // look like a pure loss of the full raise size.
                // Name runs to the end of the line, so it can be a
                // multi-word name with no ambiguity.
                const uncalledMatch = line.match(/^Uncalled bet \(\$([\d,]+\.?\d*)\) returned to (.+)$/);
                if (uncalledMatch) {
                    const amt = parseMoney(uncalledMatch[1]);
                    const name = uncalledMatch[2];
                    const p = currentHand.players.find(pl => pl.name === name);
                    if (p) p.winnings = (p.winnings || 0) + amt;
                    continue;
                }
                if (/^Main pot /.test(line)) continue;

                // "Name waits for big blind" means the player is seated but
                // hasn't been dealt into THIS hand yet (waiting for their
                // forced BB post). Their seat line above has no "is sitting
                // out" suffix, so without this they'd be left looking like a
                // fully active player who simply never acted. Mark them the
                // same way the "will be allowed to play after the button"
                // case above already does, so the UI treats both the same.
                const waitsMatch = line.match(/^(.+?) waits for (the )?big blind$/);
                if (waitsMatch) {
                    const name = matchKnownPlayerName(waitsMatch[1], currentHand.players) || waitsMatch[1];
                    const p = currentHand.players.find(pl => pl.name === name);
                    if (p) p.isSittingOut = true;
                    continue;
                }

                // Action lines ("Name posts/calls/raises/bets/folds/checks
                // ..."). The actor's name is resolved against the hand's
                // already-known player list (longest name first, so
                // "Tony Champaroney" is preferred over a bare "Tony")
                // instead of assuming the name is a single token.
                const actorName = matchKnownPlayerName(line, currentHand.players);
                if (actorName) {
                    const rest = line.slice(actorName.length);
                    if (/^\s+(posts|calls|raises|bets|folds|checks)\b/.test(rest)) {
                        parseACRAction(line, actorName, currentHand.actions, currentStreet);
                        continue;
                    }
                }

                continue; // unrecognized line, ignore
            }

            // --- SUMMARY section ---
            if (line.startsWith('Total pot')) {
                const m = line.match(/Total pot \$([\d,]+\.?\d*)/);
                if (m) currentHand.finalPotSize = parseMoney(m[1]);
                continue;
            }
            if (line.startsWith('Board [')) continue; // already captured street-by-street above

            const summarySeatMatch = line.match(/^Seat \d+: (.+)$/);
            if (summarySeatMatch) {
                const rest = summarySeatMatch[1];
                const name = matchKnownPlayerName(rest, currentHand.players);
                if (name) {
                    const wonMatch = rest.slice(name.length).match(/\bwon \$([\d,]+\.?\d*)/);
                    if (wonMatch) {
                        const amount = parseMoney(wonMatch[1]);
                        if (!currentHand.winners.includes(name)) currentHand.winners.push(name);
                        const wp = currentHand.players.find(p => p.name === name);
                        if (wp) wp.winnings = (wp.winnings || 0) + amount;
                    }
                }
                continue; // other summary lines (e.g. "folded on the Pre-Flop") carry no data we need
            }
            continue;
        }

        if (currentHand.finalPotSize === undefined || currentHand.finalPotSize === null) {
            currentHand.finalPotSize = 0;
        }

        computeHandProfits(currentHand);
        hands.push(currentHand);
    }

    return hands;
}

// Resolves the player name that `text` starts with, matching against the
// hand's already-parsed player list rather than guessing from whitespace.
// Longest names are tried first so a multi-word name (e.g.
// "Tony Champaroney") is preferred over a shorter name that happens to be
// a prefix of it (e.g. "Tony") — this is what keeps every call site
// (actions, shows, summary lines, etc.) agreeing on the same name instead
// of each one independently truncating it.
function matchKnownPlayerName(text, players) {
    const sorted = [...players].sort((a, b) => b.name.length - a.name.length);
    for (const p of sorted) {
        const name = p.name;
        if (text === name || text.startsWith(name + ' ') || text.startsWith(name + '[')) {
            return name;
        }
    }
    return null;
}

function pushZeroAmountAction(currentHand, actionType, playerName, street) {
    const action = createEmptyAction();
    action.street = street;
    action.actionType = actionType;
    action.player = playerName;
    action.amount = 0;
    const prevPot = currentHand.actions.length > 0
        ? currentHand.actions[currentHand.actions.length - 1].potSizeAfter
        : 0;
    action.potSizeAfter = prevPot;
    currentHand.actions.push(action);
}

function parseACRAction(line, playerName, actionArr, street) {
    const action = createEmptyAction();
    action.street = street;
    action.player = playerName;

    let amount = 0;

    if (/posts the small blind/.test(line)) {
        action.actionType = 'POST_SB';
        amount = parseMoney(line.match(/\$([\d,]+\.?\d*)/)[1]);
    } else if (/posts the big blind/.test(line)) {
        action.actionType = 'POST_BB';
        amount = parseMoney(line.match(/\$([\d,]+\.?\d*)/)[1]);
    } else if (/ posts \$/.test(line)) {
        // Dead blind / missed-blind post with no explicit sb/bb label.
        action.actionType = 'POST_BB';
        const m = line.match(/\$([\d,]+\.?\d*)/);
        amount = m ? parseMoney(m[1]) : 0;
    } else if (/ posts /.test(line)) {
        // Broader posts variant, e.g. "posts dead $0.07" or "posts missed $0.05" —
        // the amount always follows a "$", regardless of what word sits between
        // "posts" and the dollar sign, so this still just grabs the first $amount.
        // Placed after the "posts the small/big blind" and bare "posts $" checks
        // above so it only catches whatever those didn't.
        action.actionType = 'POST_BB';
        const m = line.match(/\$([\d,]+\.?\d*)/);
        amount = m ? parseMoney(m[1]) : 0;
    } else if (/ calls /.test(line)) {
        action.actionType = 'CALL';
        const m = line.match(/calls \$([\d,]+\.?\d*)/);
        amount = m ? parseMoney(m[1]) : 0;
    } else if (/ raises /.test(line)) {
        action.actionType = 'RAISE';
        const m = line.match(/raises \$[\d,]+\.?\d* to \$([\d,]+\.?\d*)/);
        amount = m ? parseMoney(m[1]) : 0;
    } else if (/ bets /.test(line)) {
        action.actionType = 'BET';
        const m = line.match(/bets \$([\d,]+\.?\d*)/);
        amount = m ? parseMoney(m[1]) : 0;
    } else if (/ folds/.test(line)) {
        action.actionType = 'FOLD';
    } else if (/ checks/.test(line)) {
        action.actionType = 'CHECK';
    } else {
        return; // not a recognized action line
    }

    action.amount = amount;
    const prevPot = actionArr.length > 0 ? actionArr[actionArr.length - 1].potSizeAfter : 0;
    action.potSizeAfter = prevPot + amount;
    actionArr.push(action);
}

function parseMoney(str) {
    return Math.round(parseFloat(String(str).replace(/,/g, '')) * 100);
}

// ACR board lines look like:
//   *** FLOP *** [6s Kd Kh]
//   *** TURN *** [6s Kd Kh] [Ad]
//   *** RIVER *** [6s Kd Kh Ad] [8s]
function extractACRBoardCards(line) {
    const groups = line.match(/\[([^\]]*)\]/g) || [];
    if (groups.length === 0) return [];
    return groups
        .map(g => g.slice(1, -1).trim())
        .join(' ')
        .split(/\s+/)
        .filter(Boolean);
}