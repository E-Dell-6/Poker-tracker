import mongoose from "mongoose";

export function createEmptyHand (){
    return {
        _id: new mongoose.Types.ObjectId(),
        handIndex: -1,
        gameType: null, 
        datePlayed: null,

        players: [],
        actions: [],
        board: { flop: [], turn: [], river: []},

        winners: [],
        finalPotSize: 0
     }
}

export function createEmptyPlayer(){
    return{
        seat: -1,
        name: null,
        stack: -1,
        isDealer: false,
        winnings: 0,
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