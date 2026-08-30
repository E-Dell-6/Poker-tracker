import {
  getUserFavourites,
  toggleFavourite,
  updateHoleCards,
  addAction,
  renamePlayer,
  setBlinds,
  deleteFavourite,
  clearFavourites,
} from '../services/favouritesService.js';

export async function listFavourites(req, res) {
  try {
    const hands = await getUserFavourites(req.body.userId);
    res.json(hands);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch favourites", details: error.message });
  }
}

export async function toggleFavouriteHand(req, res) {
  try {
    const { userId, ...handData } = req.body;
    const result = await toggleFavourite(userId, req.params.id, handData);
    if (result.error === 'hand-not-found') return res.status(404).json({ error: "Hand not found" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle favourite", details: error.message });
  }
}

export async function patchHoleCards(req, res) {
  try {
    const { userId, holeCards, playerSeatNumber } = req.body;
    const result = await updateHoleCards(userId, req.params.id, { holeCards, playerSeatNumber });
    if (result.error === 'hand-not-found') return res.status(400).json({ error: "hand not found" });
    res.json({ hand: result.hand, message: "Hand updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update favourites", details: error.message });
  }
}

export async function patchAction(req, res) {
  try {
    const { userId, actionType, amount = 0, street, playerSeatNumber } = req.body;
    const result = await addAction(userId, req.params.id, { actionType, amount, street, playerSeatNumber });
    if (result.error === 'favourites-not-found') return res.status(404).json({ error: "Favorites not found" });
    if (result.error === 'hand-not-found') return res.status(404).json({ error: "Hand not found" });
    if (result.error === 'player-not-found') return res.status(404).json({ error: `Player not found at seat ${playerSeatNumber}` });
    res.status(200).json({ message: "Action added successfully", action: result.action, actions: result.actions, potSize: result.potSize });
  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
}

export async function patchName(req, res) {
  try {
    const { userId, newName, playerSeatNumber } = req.body;
    const result = await renamePlayer(userId, req.params.id, { newName, playerSeatNumber });
    if (result.error === 'favourites-not-found') return res.status(404).json({ error: "Favorites not found" });
    if (result.error === 'hand-not-found') return res.status(404).json({ error: "Hand not found" });
    if (result.error === 'player-not-found') return res.status(404).json({ error: "Player not found" });
    res.json({ hand: result.hand, message: "Player name updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update player name", details: error.message });
  }
}

export async function patchBlinds(req, res) {
  try {
    const { userId, dealerSeat } = req.body;
    const result = await setBlinds(userId, req.params.id, dealerSeat);
    if (result.error === 'favourites-not-found') return res.status(404).json({ error: "Favorites not found" });
    if (result.error === 'hand-not-found') return res.status(404).json({ error: "Hand not found" });
    if (result.error === 'blind-players-not-found') return res.status(400).json({ error: "Could not find players for blind positions" });
    res.json({ success: true, dealerSeat: result.dealerSeat, sbSeat: result.sbSeat, bbSeat: result.bbSeat, actions: result.actions });
  } catch (err) {
    res.status(500).json({ error: "Failed to update dealer and blinds", details: err.message });
  }
}

export async function removeFavourite(req, res) {
  try {
    const result = await deleteFavourite(req.body.userId, req.params.id);
    if (result?.error === 'favourites-not-found') return res.status(404).json({ error: "Favorites document not found" });
    if (result?.error === 'hand-not-found') return res.status(404).json({ error: "Hand not found in favourites" });
    res.json({ message: "Deleted favourite hand" });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function clearAllFavourites(req, res) {
  try {
    await clearFavourites(req.body.userId);
    res.json({ message: "All favourites cleared successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear favourites", details: error.message });
  }
}
