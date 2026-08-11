export function computeHandProfits(hand) {
    const invested = {};
    let streetBets = {};
    let lastStreet = null;

    for (const action of hand.actions ?? []) {
        if (action.street !== lastStreet) {
            streetBets = {};
            lastStreet = action.street;
        }
        const name = action.player;
        if (!name) continue;
        const amount = Number(action.amount) || 0;
        const previousBet = streetBets[name] || 0;

        switch (action.actionType) {
            case 'POST_SB':
            case 'POST_BB':
                streetBets[name] = amount;
                invested[name] = (invested[name] || 0) + amount;
                break;
            case 'BET':
            case 'RAISE': {
                const add = amount - previousBet;
                streetBets[name] = amount;
                invested[name] = (invested[name] || 0) + add;
                break;
            }
            case 'CALL':
                streetBets[name] = previousBet + amount;
                invested[name] = (invested[name] || 0) + amount;
                break;
            default:
                break; // FOLD / CHECK / SHOW_HAND / MUCK move no chips
        }
    }

    for (const player of hand.players ?? []) {
        const chipsIn = invested[player.name] || 0;
        const chipsBack = player.winnings || 0;
        player.profitLoss = chipsBack - chipsIn;
    }
}