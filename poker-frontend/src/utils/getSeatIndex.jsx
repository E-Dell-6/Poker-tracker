export function getSeatIndex(dealerIndex, playerIndex, totalPlayers) {
    // Return null if dealer hasn't been set yet
    if (dealerIndex === null || dealerIndex === undefined) return null;
    
    if (dealerIndex === playerIndex) return 'dealer';
    
    const smallBlindIndex = (dealerIndex + 1) % totalPlayers;
    const bigBlindIndex = (dealerIndex + 2) % totalPlayers;
    
    if (playerIndex === smallBlindIndex) return 'small blind';
    if (playerIndex === bigBlindIndex) return 'big blind';
    
    // Calculate position relative to dealer
    let positionFromDealer = (playerIndex - dealerIndex + totalPlayers) % totalPlayers;
    
    if (totalPlayers === 2) {
        return playerIndex === dealerIndex ? 'dealer/small blind' : 'big blind';
    }
    
    if (positionFromDealer === 3) return 'under the gun';
    if (positionFromDealer === totalPlayers - 1) return 'cutoff';
    if (positionFromDealer === totalPlayers - 2) return 'hijack';
    
    // Early, middle, or late position
    if (positionFromDealer <= 4) return 'early position';
    if (positionFromDealer <= totalPlayers - 3) return 'middle position';
    return 'late position';
}