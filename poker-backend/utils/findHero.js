
export function findHero(logLines) {
    let currentHeroCards = null;

    for (const line of logLines) {
        
        // 1. Capture the "Private" cards
        if (line.startsWith("Your hand is")) {
            // Use your existing helper to get the raw card string or array
            // e.g., returns "8♥, K♥"
            currentHeroCards = parseCardsString(line); 
        }

        // 2. Look for the "Public" reveal
        // Pattern: "PlayerName @ ID shows a [Cards]"
        if (line.includes(" shows a ") && currentHeroCards) {
            
            // Check if this line contains the exact same cards we are holding
            if (line.includes(currentHeroCards)) {
                
                // EXTRACT THE NAME
                // Line format: "Nate Higgers @ s9p1qZMXYl shows a 8♥, K♥."
                const namePart = line.split(" shows a ")[0];
                
                // Use your existing name extraction logic here to get just "Nate Higgers"
                // (This assumes you have a helper to strip the ID if needed)
                const heroName = extractNameFromSegment(namePart); 
                
                console.log(`Hero identified as: ${heroName}`);
                return heroName;
            }
        }
    }

    return null; // Hero never showed their hand
}