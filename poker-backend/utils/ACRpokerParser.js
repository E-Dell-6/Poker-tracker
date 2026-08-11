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
    // hero is for the whole session.
    let globalHeroName = null;
    for (const block of blocks) {
        const m = block.match(/^Dealt to (\S+) \[/m);
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
                const seatMatch = line.match(/^Seat (\d+): (\S+) \(\$([\d,]+\.?\d*)\)/);
                if (seatMatch) {
                    const p = createEmptyPlayer();
                    p.seat = parseInt(seatMatch[1], 10);
                    p.name = seatMatch[2];
                    p.stack = parseMoney(seatMatch[3]);
                    if (buttonSeat === p.seat) p.isDealer = true;
                    if (globalHeroName && p.name === globalHeroName) p.isHero = true;
                    currentHand.players.push(p);
                    continue;
                }
                // Seat announced but not actually dealt in (no stack shown yet)
                if (/^Seat \d+:/.test(line)) continue;

                if (line.startsWith('*** FLOP ***')) {
                    currentHand.board.flop = extractACRBoardCards(line, false);
                    currentStreet = 'FLOP';
                    continue;
                }
                if (line.startsWith('*** TURN ***')) {
                    currentHand.board.turn = extractACRBoardCards(line, true);
                    currentStreet = 'TURN';
                    continue;
                }
                if (line.startsWith('*** RIVER ***')) {
                    currentHand.board.river = extractACRBoardCards(line, true);
                    currentStreet = 'RIVER';
                    continue;
                }

                if (line.startsWith('Dealt to ')) {
                    const m = line.match(/^Dealt to (\S+) \[(.+)\]/);
                    if (m) {
                        const hp = currentHand.players.find(p => p.name === m[1]);
                        if (hp) {
                            hp.holeCards = m[2].split(/\s+/).filter(Boolean);
                            hp.isHero = true;
                        }
                    }
                    continue;
                }

                if (/^\S+ shows \[/.test(line)) {
                    const m = line.match(/^(\S+) shows \[(.+?)\]/);
                    if (m) {
                        const name = m[1];
                        const cards = m[2].split(/\s+/).filter(c => c && c !== '-');
                        const hp = currentHand.players.find(p => p.name === name);
                        if (hp) hp.showedHand = cards;
                        pushZeroAmountAction(currentHand, 'SHOW_HAND', name, currentStreet);
                    }
                    continue;
                }

                if (/^\S+ does not show$/.test(line)) {
                    const name = line.split(' ')[0];
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
                const uncalledMatch = line.match(/^Uncalled bet \(\$([\d,]+\.?\d*)\) returned to (\S+)/);
                if (uncalledMatch) {
                    const amt = parseMoney(uncalledMatch[1]);
                    const name = uncalledMatch[2];
                    const p = currentHand.players.find(pl => pl.name === name);
                    if (p) p.winnings = (p.winnings || 0) + amt;
                    continue;
                }
                if (/^Main pot /.test(line)) continue;
                if (/waits for (the )?big blind$/.test(line)) continue;

                if (/^\S+ (posts|calls|raises|bets|folds|checks)\b/.test(line)) {
                    parseACRAction(line, currentHand.actions, currentStreet);
                    continue;
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

            const winMatch = line.match(/^Seat \d+: (\S+).*\bwon \$([\d,]+\.?\d*)/);
            if (winMatch) {
                const name = winMatch[1];
                const amount = parseMoney(winMatch[2]);
                if (!currentHand.winners.includes(name)) currentHand.winners.push(name);
                const wp = currentHand.players.find(p => p.name === name);
                if (wp) wp.winnings = (wp.winnings || 0) + amount;
                continue;
            }
            continue; // other summary lines (e.g. "folded on the Pre-Flop") carry no data we need
        }

        if (currentHand.finalPotSize === undefined || currentHand.finalPotSize === null) {
            currentHand.finalPotSize = 0;
        }

        computeHandProfits(currentHand);
        hands.push(currentHand);
    }

    return hands;
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

function parseACRAction(line, actionArr, street) {
    const action = createEmptyAction();
    action.street = street;
    action.player = line.split(' ')[0];

    let amount = 0;

    if (/posts the small blind/.test(line)) {
        action.actionType = 'POST_SB';
        amount = parseMoney(line.match(/\$([\d,]+\.?\d*)/)[1]);
    } else if (/posts the big blind/.test(line)) {
        action.actionType = 'POST_BB';
        amount = parseMoney(line.match(/\$([\d,]+\.?\d*)/)[1]);
    } else if (/^\S+ posts \$/.test(line)) {
        // Dead blind / missed-blind post with no explicit sb/bb label.
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
// Flop has one bracket group (all 3 cards). Turn/River have two groups
// (the running board, then the single new card) — we only want the new card.
function extractACRBoardCards(line, newCardOnly) {
    const groups = line.match(/\[([^\]]*)\]/g) || [];
    if (groups.length === 0) return [];
    const target = newCardOnly ? groups[groups.length - 1] : groups[0];
    return target.replace('[', '').replace(']', '').trim().split(/\s+/).filter(Boolean);
}