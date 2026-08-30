import mongoose from 'mongoose';
import Favorite from '../model/favourites.js';
import Session from '../model/Session.js';

async function getOrCreateUserFaves(userId) {
  let faves = await Favorite.findOne({ userId });
  if (!faves) faves = await Favorite.create({ userId, hands: [] });
  return faves;
}

export async function getUserFavourites(userId) {
  const faves = await Favorite.findOne({ userId });
  return faves ? faves.hands : [];
}

// handData is req.body with `userId` already stripped out. Empty ({}) means
// "look this hand up across the user's sessions" rather than "here's the
// hand to save" - mirrors the original route's exact branching.
export async function toggleFavourite(userId, handId, handData) {
  const faves = await getOrCreateUserFaves(userId);

  const existingIndex = faves.hands.findIndex(h => h._id && h._id.toString() === handId);
  if (existingIndex !== -1) {
    faves.hands.splice(existingIndex, 1);
    await faves.save();
    return { hands: faves.hands, isFavorited: false };
  }

  if (handData && Object.keys(handData).length > 0) {
    faves.hands.push(handData);
    await faves.save();
    return { hands: faves.hands, isFavorited: true };
  }

  const sessions = await Session.find({ userId }).lean();
  let foundHand = null, foundSession = null;
  for (const session of sessions) {
    const hand = session.hands?.find(h => h._id && h._id.toString() === handId);
    if (hand) { foundHand = hand; foundSession = session; break; }
  }
  if (!foundHand) return { error: 'hand-not-found' };

  faves.hands.push({
    ...foundHand,
    sessionDate: foundSession.date,
    sessionGameType: foundSession.gameType,
    sessionCurrency: foundSession.currency,
    sessionId: foundSession._id,
  });
  await faves.save();
  return { hands: faves.hands, isFavorited: true };
}

// No faves-null guard here, matching the original handler exactly - a
// missing Favorite doc throws (caught by the controller as a 500), it
// isn't treated as a distinct not-found case like the other handlers below.
export async function updateHoleCards(userId, handId, { holeCards, playerSeatNumber }) {
  const faves = await Favorite.findOne({ userId });
  const hand = faves.hands.find(h => h._id && h._id.toString() === handId);
  if (!hand) return { error: 'hand-not-found' };
  const player = hand.players.find(p => p.seat === playerSeatNumber);
  if (holeCards) player.holeCards = holeCards;
  await faves.save();
  return { hand };
}

export async function addAction(userId, handId, { actionType, amount = 0, street, playerSeatNumber }) {
  const faves = await Favorite.findOne({ userId });
  if (!faves) return { error: 'favourites-not-found' };
  const hand = faves.hands.find(h => h._id && h._id.toString() === handId);
  if (!hand) return { error: 'hand-not-found' };
  const player = hand.players.find(p => p.seat === playerSeatNumber);
  if (!player) return { error: 'player-not-found' };
  const lastPotSize = hand.actions.length > 0 ? hand.actions[hand.actions.length - 1].potSizeAfter : 0;
  const newAction = { street, actionType, amount, player: player.name, potSizeAfter: lastPotSize + amount };
  hand.actions.push(newAction);
  faves.markModified('hands');
  await faves.save();
  return { action: newAction, actions: hand.actions, potSize: newAction.potSizeAfter };
}

export async function renamePlayer(userId, handId, { newName, playerSeatNumber }) {
  const faves = await Favorite.findOne({ userId });
  if (!faves) return { error: 'favourites-not-found' };
  const hand = faves.hands.find(h => h._id && h._id.toString() === handId);
  if (!hand) return { error: 'hand-not-found' };
  const player = hand.players.find(p => p.seat === playerSeatNumber);
  if (!player) return { error: 'player-not-found' };
  player.name = newName;
  faves.markModified('hands');
  await faves.save();
  return { hand };
}

export async function setBlinds(userId, handId, dealerSeat) {
  const faves = await Favorite.findOne({ userId });
  if (!faves) return { error: 'favourites-not-found' };
  const hand = faves.hands.find(h => h._id && h._id.toString() === handId);
  if (!hand) return { error: 'hand-not-found' };
  const totalPlayers = hand.players.length;
  const sbSeat = (dealerSeat + 1) % totalPlayers;
  const bbSeat = (dealerSeat + 2) % totalPlayers;
  const sbPlayer = hand.players.find(p => p.seat === sbSeat);
  const bbPlayer = hand.players.find(p => p.seat === bbSeat);
  if (!sbPlayer || !bbPlayer) return { error: 'blind-players-not-found' };
  hand.players.forEach(p => p.isDealer = false);
  const dealerPlayer = hand.players.find(p => p.seat === dealerSeat);
  if (dealerPlayer) dealerPlayer.isDealer = true;
  if (!hand.actions) hand.actions = [];
  hand.actions.push({ player: sbPlayer.name, street: "PREFLOP", actionType: "POST_SB", amount: 0.5 });
  hand.actions.push({ player: bbPlayer.name, street: "PREFLOP", actionType: "POST_BB", amount: 1 });
  faves.markModified('hands');
  await faves.save();
  return { dealerSeat, sbSeat, bbSeat, actions: hand.actions };
}

export async function deleteFavourite(userId, handId) {
  const faves = await Favorite.findOne({ userId });
  if (!faves) return { error: 'favourites-not-found' };
  const handIndex = faves.hands.findIndex(h => h._id && h._id.toString() === handId);
  if (handIndex === -1) return { error: 'hand-not-found' };
  faves.hands.splice(handIndex, 1);
  faves.markModified('hands');
  await faves.save();
}

export async function clearFavourites(userId) {
  await Favorite.deleteMany({ userId });
}

// Joins Favorite + Session, never touches Person - lives here (with the
// data it reads) rather than in personService.js despite the personId param.
export async function getStarredItemsForPerson(userId, personId) {
  const faves = await Favorite.findOne({ userId });
  const starredHands = (faves?.hands || []).filter(hand =>
    hand.players?.some(p => p.personId && p.personId.toString() === personId)
  );

  const starredSessions = await Session.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        starred: true,
        'hands.players.personId': new mongoose.Types.ObjectId(personId),
      },
    },
    { $project: { hands: 0 } },
    { $sort: { uploadDate: -1 } },
  ]);

  return { starredHands, starredSessions };
}
