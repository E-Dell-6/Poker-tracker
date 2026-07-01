export function findHero(records) {

    for (const record of records) {
        const line = String(record.entry || "");

     
        if (line.startsWith("Your hand is ")) {
            
            const cards = line.substring(13).trim();
            const searchString = ` shows a ${cards}`;

            
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
           
        }
    }

    console.warn("⚠️ [findHero] Failed. 'Your hand is' was found, but those cards were never shown.");
    
    for (const record of records) {
        const line = String(record.entry || "");
        if (line.includes('"Hero @')) return "Hero";
    }

    return null;
}

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