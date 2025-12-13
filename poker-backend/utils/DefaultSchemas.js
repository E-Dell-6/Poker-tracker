export function createEmptyHand (){
    return {
        handIndex: -1,
        gameType: null, 
        datePlayed: null,

        players: [],
        actions: [],
        board: { flop: [], turn: [], river: []},

        winners: [],

        buttonSeat: -1,
        heroSeat: -1,
        finalPotSize: -1
     }
}

export function createEmptyPlayer(){
    return{
        seat: -1,
        name: null,
        stack: -1,
        isDealer: false,
    }
}

export function createEmptyAction(){
    return {
        street: null,
        actionType: null,
        player: null,
        amount: -1,
        potSizeAfter: 0
    }
}