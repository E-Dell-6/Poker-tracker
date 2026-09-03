import { createEmptyAction, createEmptyHand, createEmptyPlayer } from './DefaultSchemas.js';
import { computeHandProfits } from './handProfitCalculator.js';
import { detectAllIn } from './allInDetector.js';
import { computeAllInEV } from './evCalculator.js';

/**
 * Parses a GGPoker plain-text hand history export into the same
 * hand/action/player shape produced by parseACRLog / parsePokerNowLog.
 *
 * GGPoker's grammar is structurally similar to ACR's (*** STREET ***
 * delimited text) but meaningfully simpler in one big way: every actor
 * line is "name: verb ..." with a colon right after the name, and
 * GGPoker's anonymized player names never contain a space or a colon.
 * That means a plain `line.match(/^(.+?): (.+)$/)` unambiguously splits
 * actor from action with no ACR-style longest-prefix name matching
 * needed. The hero's seat is also always literally named "Hero" in the
 * export, so hero detection doesn't need ACR's global pre-scan for a
 * "Dealt to X [...]" line either.
 *
 * Note on units: like ACR, GGPoker logs are real-money ($) hands, so all
 * dollar amounts (stacks, bet sizes, pot sizes, winnings) are converted to
 * integer CENTS (e.g. "$2.07" -> 207).
 *
 * Note on run-it-twice/three-times: once triggered, GGPoker labels EVERY
 * street marker in the hand with FIRST/SECOND/THIRD, even streets that
 * only happened once (the labeling is hand-wide, not just for the streets
 * that actually diverge - e.g. an all-in on the turn still prints
 * "*** FIRST FLOP ***" for the single, non-duplicated flop). The first
 * (or unlabeled) occurrence of each street feeds `hand.board`; a SECOND
 * occurrence feeds `hand.secondBoard` (same cumulative-per-street shape,
 * consumed by the frontend's existing run-it-twice board display); a
 * THIRD occurrence only flips `isRunTwice` - the schema/frontend support
 * at most two runouts, so a third runout's board isn't retained.
 *
 * Known accepted limitations:
 *  - "EV Cashout" lines (GGPoker's insurance-style feature: "Chooses to EV
 *    Cashout" / "Pays Cashout Risk ($X)" / "Receives Cashout ($X)") aren't
 *    modeled - they fall through to the generic unrecognized-line ignore.
 *    A cashout hand's profit/winnings reflect the literal showdown/summary
 *    figures, not the player's actual cashed-out settlement.
 *  - `potSizeAfter` reproduces the same same-street blind-then-raise
 *    double-counting evCalculator.js already documents as a pre-existing
 *    ACR parser bug (see that file's comments), reproduced here for
 *    consistency rather than fixed - fixing it is a separate change that
 *    should touch both parsers together.
 *  - No confirmed sample of a "does not show"/"mucks" line or a
 *    "sitting out" seat-line suffix, so those aren't explicitly modeled
 *    (fall through to the generic ignore / isSittingOut stays false).
 *
 * @param {string} fileContent
 */
// `computeEv: false` skips the all-in EV computation below. That call is
// by far the most expensive thing per hand - a preflop all-in runs 5000
// Monte Carlo trials, each evaluating all C(7,5)=21 five-card subsets per
// player, so one hand can cost ~210k evaluations - and it blocks the event
// loop for every other request while it runs. Bulk imports turn it off
// here and run it as a separate pass that yields between chunks (see
// services/importRunner.js). Defaults to true so every existing caller,
// and the parser tests, behave exactly as before.
export function parseGGPokerLog(fileContent, { computeEv = true } = {}) {
    const text = String(fileContent || '').replace(/\r\n/g, '\n');

    // Hands are separated by a blank line and each one starts with
    // "Poker Hand #...".
    const blocks = text
        .split(/\n(?=Poker Hand #)/)
        .map(b => b.trim())
        .filter(b => b.length > 0);

    if (blocks.length === 0) {
        throw new Error("No GGPoker hands found in file.");
    }

    const hands = [];

    for (const block of blocks) {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) continue;

        const headerMatch = lines[0].match(
            /^Poker Hand #(\S+): (.+?) \((\$[\d,.]+\/\$[\d,.]+)\) - (\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})$/
        );
        if (!headerMatch) continue; // not a recognizable hand block, skip it

        const currentHand = createEmptyHand();
        // headerMatch[1] is GGPoker's own hand id ("HD1234567..."). It was
        // matched but discarded before per-hand dedup existed.
        currentHand.handId = headerMatch[1];
        currentHand.gameType = /omaha/i.test(headerMatch[2]) ? 'PLO' : 'NLH';
        currentHand.stakes = headerMatch[3];

        // GGPoker's header doesn't label a timezone; treated as UTC, the
        // same assumption ACR's own "... UTC" suffix makes explicit.
        const iso = headerMatch[4].replace(/\//g, '-').replace(' ', 'T') + 'Z';
        currentHand.datePlayed = new Date(iso);

        currentHand.players = [];

        let buttonSeat = null;
        const tableLine = lines[1] || '';

        // Unlike ACR's cash-game gap, this line is always present in
        // GGPoker exports, so no filename-fallback is needed.
        const tableMatch = tableLine.match(/Table '(.+?)' (\d+)-max/);
        const maxSeatsMatch = tableLine.match(/(\d+)-max/);
        if (maxSeatsMatch) currentHand.maxSeats = parseInt(maxSeatsMatch[1], 10);
        currentHand.tableName = tableMatch ? tableMatch[1] : null;

        const buttonMatch = tableLine.match(/Seat #(\d+) is the button/);
        if (buttonMatch) buttonSeat = parseInt(buttonMatch[1], 10);

        let currentStreet = 'PREFLOP';
        let inSummary = false;
        const seenStreets = new Set();

        for (let i = 2; i < lines.length; i++) {
            const line = lines[i];

            if (line === '*** HOLE CARDS ***') continue;
            if (/^\*\*\* (?:FIRST |SECOND |THIRD )?SHOWDOWN \*\*\*/.test(line)) continue;

            if (line.startsWith('*** SUMMARY ***')) {
                inSummary = true;
                continue;
            }

            if (!inSummary) {
                // Seat line: "Seat N: name ($X.XX in chips)". GGPoker names
                // never contain spaces, but (.+?) is kept non-greedy for
                // safety/symmetry with the other line shapes below.
                const seatMatch = line.match(/^Seat (\d+): (.+?) \(\$([\d,]+\.?\d*) in chips\)$/);
                if (seatMatch) {
                    const p = createEmptyPlayer();
                    p.seat = parseInt(seatMatch[1], 10);
                    p.name = seatMatch[2];
                    p.stack = parseMoney(seatMatch[3]);
                    if (buttonSeat === p.seat) p.isDealer = true;
                    if (p.name === 'Hero') p.isHero = true;
                    currentHand.players.push(p);
                    continue;
                }
                if (/^Seat \d+:/.test(line)) continue; // fallback: unmatched seat-line shape

                const streetMatch = line.match(/^\*\*\* (?:(FIRST|SECOND|THIRD) )?(FLOP|TURN|RIVER) \*\*\*/);
                if (streetMatch) {
                    const runLabel = streetMatch[1] || null;
                    const streetName = streetMatch[2]; // 'FLOP' | 'TURN' | 'RIVER'
                    const streetKey = streetName.toLowerCase();
                    currentStreet = streetName;
                    const cards = extractGGBoardCards(line);

                    if (runLabel === 'SECOND' || runLabel === 'THIRD') {
                        currentHand.isRunTwice = true;
                    }

                    if (!runLabel || runLabel === 'FIRST') {
                        if (!seenStreets.has(streetKey)) {
                            currentHand.board[streetKey] = cards;
                            seenStreets.add(streetKey);
                        }
                    } else if (runLabel === 'SECOND') {
                        if (!currentHand.secondBoard) {
                            currentHand.secondBoard = { flop: [], turn: [], river: [] };
                        }
                        currentHand.secondBoard[streetKey] = cards;
                    }
                    // THIRD: isRunTwice already set above; board not retained
                    // (schema/frontend support at most two runouts).
                    continue;
                }

                if (line.startsWith('Dealt to ')) {
                    // Every player gets a "Dealt to X" line, but only the
                    // hero's has cards - others have no brackets at all.
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
                    continue; // non-hero "Dealt to X" (no brackets) is a no-op
                }

                const uncalledMatch = line.match(/^Uncalled bet \(\$([\d,]+\.?\d*)\) returned to (.+)$/);
                if (uncalledMatch) {
                    const amt = parseMoney(uncalledMatch[1]);
                    const name = uncalledMatch[2];
                    const p = currentHand.players.find(pl => pl.name === name);
                    if (p) p.winnings = (p.winnings || 0) + amt;
                    continue;
                }

                // Generic "name: verb ..." grammar covers both actions and
                // "shows [...]" reveals - GGPoker names have no spaces or
                // colons, so this split is unambiguous with no need for
                // ACR's longest-known-name matching.
                const actorMatch = line.match(/^(.+?): (.+)$/);
                if (actorMatch) {
                    const actorName = actorMatch[1];
                    const rest = actorMatch[2];

                    if (rest.startsWith('shows [')) {
                        const cardsStart = 'shows ['.length;
                        // First ']' after the cards, not the last one in the
                        // line - "(a pair of Twos [board refs])"-style
                        // descriptions can carry a second bracketed group.
                        const bracketEnd = rest.indexOf(']', cardsStart);
                        const cardsPart = bracketEnd !== -1 ? rest.slice(cardsStart, bracketEnd) : '';
                        const cards = cardsPart.split(/\s+/).filter(c => c && c !== '-');
                        const hp = currentHand.players.find(p => p.name === actorName);
                        if (hp) hp.showedHand = cards;
                        pushZeroAmountAction(currentHand, 'SHOW_HAND', actorName, currentStreet);
                        continue;
                    }

                    parseGGAction(rest, actorName, currentHand.actions, currentStreet);
                    continue;
                }

                continue; // unrecognized line (e.g. EV Cashout lines), ignore
            }

            // --- SUMMARY section ---
            if (line.startsWith('Total pot')) {
                const m = line.match(/Total pot \$([\d,]+\.?\d*)/);
                if (m) currentHand.finalPotSize = parseMoney(m[1]);
                continue;
            }
            if (line.startsWith('Hand was run ')) continue;
            if (/^(?:FIRST |SECOND |THIRD )?Board \[/.test(line)) continue; // redundant with street-marker board

            // "Seat N: name ..." - names have no spaces, so the actor is
            // just the first whitespace-delimited token after the colon,
            // no cross-referencing against the player list needed (unlike
            // ACR's multi-word names).
            const summarySeatMatch = line.match(/^Seat \d+: (\S+)(.*)$/);
            if (summarySeatMatch) {
                const name = summarySeatMatch[1];
                const rest = summarySeatMatch[2];
                // A run-it-multiple-times hand's summary line can contain
                // several "won ($X)"/"collected ($X)" segments joined by
                // ", and " (one per runout) - sum every match rather than
                // just the first.
                const wonRe = /(?:won|collected) \(\$([\d,]+\.?\d*)\)/g;
                let totalWon = 0;
                let m;
                while ((m = wonRe.exec(rest)) !== null) {
                    totalWon += parseMoney(m[1]);
                }
                if (totalWon > 0) {
                    if (!currentHand.winners.includes(name)) currentHand.winners.push(name);
                    const wp = currentHand.players.find(p => p.name === name);
                    if (wp) wp.winnings = (wp.winnings || 0) + totalWon;
                }
                continue;
            }
            continue;
        }

        if (currentHand.finalPotSize === undefined || currentHand.finalPotSize === null) {
            currentHand.finalPotSize = 0;
        }

        anonymizeNonHeroNames(currentHand);

        computeHandProfits(currentHand);
        detectAllIn(currentHand);
        currentHand.allInEV = computeEv ? computeAllInEV(currentHand) : null;
        hands.push(currentHand);
    }

    // GGPoker exports list hands newest-first (descending timestamp) down
    // the file. sessionImportService.js relies on parsedHands[0] being the
    // SESSION'S FIRST hand (for session.date/gameType), and hand-order-
    // dependent UI (replay navigation, EV graph x-axis) expects
    // chronological order too - so reverse into ascending order and
    // reassign handIndex accordingly before returning.
    hands.sort((a, b) => a.datePlayed - b.datePlayed);
    hands.forEach((h, i) => { h.handIndex = i + 1; });

    return hands;
}

// GGPoker's "anonymized" opponent names (e.g. "abc12345") are still a
// stable per-account identifier - the same string reappears across every
// hand an opponent plays, in this file and in later imports. Storing that
// verbatim would let the app quietly build a persistent profile of a
// GGPoker player the user never consented to identify, so it's replaced
// here with a seat-based label that's meaningful only within this one
// hand. Hero is left untouched - this is about not fingerprinting
// opponents, not about hiding the user's own data from themselves.
function anonymizeNonHeroNames(hand) {
    const nameMap = new Map();
    for (const p of hand.players) {
        if (!p.isHero) nameMap.set(p.name, `Seat ${p.seat}`);
    }
    if (nameMap.size === 0) return;

    for (const p of hand.players) {
        const label = nameMap.get(p.name);
        if (label) p.name = label;
    }
    for (const a of hand.actions) {
        const label = nameMap.get(a.player);
        if (label) a.player = label;
    }
    hand.winners = hand.winners.map(name => nameMap.get(name) ?? name);
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

// `rest` is the action line already stripped of the leading "name: ".
function parseGGAction(rest, playerName, actionArr, street) {
    const action = createEmptyAction();
    action.street = street;
    action.player = playerName;

    let amount = 0;

    if (/^posts small blind/.test(rest)) {
        action.actionType = 'POST_SB';
        const m = rest.match(/\$([\d,]+\.?\d*)/);
        amount = m ? parseMoney(m[1]) : 0;
    } else if (/^posts big blind/.test(rest)) {
        action.actionType = 'POST_BB';
        const m = rest.match(/\$([\d,]+\.?\d*)/);
        amount = m ? parseMoney(m[1]) : 0;
    } else if (/^posts /.test(rest)) {
        // Unlabeled/other posts (e.g. "posts missed blind $X") - matches
        // ACR's own precedent of mapping generic dead-blind posts to
        // POST_BB rather than inventing an unmodeled action type.
        action.actionType = 'POST_BB';
        const m = rest.match(/\$([\d,]+\.?\d*)/);
        amount = m ? parseMoney(m[1]) : 0;
    } else if (/^straddle /.test(rest)) {
        // GGPoker allows a player to straddle (and, rarely, re-straddle
        // themselves for a bigger amount - "straddle $2" immediately
        // followed by another "straddle $4" from the same player). Each
        // "straddle $X" line is the player's new TOTAL preflop
        // commitment so far, i.e. raise-to semantics, NOT an amount to
        // add on top - confirmed against a real double-straddle hand
        // where treating it as additive would have the player investing
        // more than their starting stack, but treating each line as a
        // running total (posts BB -> raise-to first straddle -> raise-to
        // second straddle) lands exactly on their all-in stack size.
        // ActionSchema has no distinct STRADDLE type, and BET/RAISE share
        // identical "amount is the new street total" math in
        // handProfitCalculator.js, so RAISE is used here - this does mean
        // a straddle shows up as a preflop raise for stats purposes
        // (e.g. PFR%), which is a reasonable approximation (a straddle is
        // itself a voluntary aggressive action) rather than a schema
        // change touching every other consumer of the action enum.
        action.actionType = 'RAISE';
        const m = rest.match(/\$([\d,]+\.?\d*)/);
        amount = m ? parseMoney(m[1]) : 0;
    } else if (/^calls /.test(rest)) {
        action.actionType = 'CALL';
        const m = rest.match(/calls \$([\d,]+\.?\d*)/);
        amount = m ? parseMoney(m[1]) : 0;
    } else if (/^raises /.test(rest)) {
        action.actionType = 'RAISE';
        const m = rest.match(/raises \$[\d,]+\.?\d* to \$([\d,]+\.?\d*)/);
        amount = m ? parseMoney(m[1]) : 0;
    } else if (/^bets /.test(rest)) {
        action.actionType = 'BET';
        const m = rest.match(/bets \$([\d,]+\.?\d*)/);
        amount = m ? parseMoney(m[1]) : 0;
    } else if (/^folds/.test(rest)) {
        action.actionType = 'FOLD';
    } else if (/^checks/.test(rest)) {
        action.actionType = 'CHECK';
    } else {
        return; // not a recognized action line (e.g. EV Cashout lines)
    }

    action.amount = amount;
    const prevPot = actionArr.length > 0 ? actionArr[actionArr.length - 1].potSizeAfter : 0;
    action.potSizeAfter = prevPot + amount;
    actionArr.push(action);
}

function parseMoney(str) {
    return Math.round(parseFloat(String(str).replace(/,/g, '')) * 100);
}

// GGPoker board lines look like:
//   *** FLOP *** [6s Kd Kh]
//   *** TURN *** [6s Kd Kh] [Ad]
//   *** RIVER *** [6s Kd Kh Ad] [8s]
// (optionally prefixed "*** FIRST/SECOND/THIRD FLOP/TURN/RIVER ***") - same
// cumulative bracket-join convention as ACR's extractACRBoardCards.
// Duplicated locally rather than imported since that helper is private to
// ACRPokerParser.js and this is only a handful of lines.
function extractGGBoardCards(line) {
    const groups = line.match(/\[([^\]]*)\]/g) || [];
    if (groups.length === 0) return [];
    return groups
        .map(g => g.slice(1, -1).trim())
        .join(' ')
        .split(/\s+/)
        .filter(Boolean);
}
