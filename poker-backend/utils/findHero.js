export function findHero(records) {
    console.log("🔍 [findHero] Scanning log for Hero identity...");

    // We need to loop through ALL hands, because Hero might have folded the first few.
    for (const record of records) {
        const line = String(record.entry || "");

        // 1. Found a hand dealt to us
        if (line.startsWith("Your hand is ")) {
            // Extract the cards: "Your hand is Q♥, 9♠" -> "Q♥, 9♠"
            const cards = line.substring(13).trim();
            const searchString = ` shows a ${cards}`;

            // 2. Inner Loop: Did anyone show THESE specific cards?
            for (const matchRecord of records) {
                const matchLine = String(matchRecord.entry || "");
                
                if (matchLine.includes(searchString)) {
                    const foundName = getPlayerName(matchLine);
                    
                    if (foundName) {
                        console.log(`✅ [findHero] Success! Hero is "${foundName}" (Matched hand: ${cards})`);
                        return foundName;
                    }
                }
            }
            // If we get here, it means we found "Your hand is..." but no one showed it (Hero folded).
            // We continue the outer loop to check the NEXT hand.
        }
    }

    console.warn("⚠️ [findHero] Failed. 'Your hand is' was found, but those cards were never shown.");
    
    // Fallback: Look for explicit "Hero" name (often used in manual configs)
    for (const record of records) {
        const line = String(record.entry || "");
        if (line.includes('"Hero @')) return "Hero";
    }

    return null;
}

// --- Helper Function ---
function getPlayerName(entry) {
    const startQuote = entry.indexOf('"');
    const endQuote = entry.lastIndexOf('"');
    
    if (startQuote === -1 || endQuote === -1) return null;

    const fullString = entry.substring(startQuote + 1, endQuote);
    const separatorIndex = fullString.lastIndexOf(' @ ');

    if (separatorIndex !== -1) {
        return fullString.substring(0, separatorIndex).trim();
    }
    
    return fullString.trim();
}