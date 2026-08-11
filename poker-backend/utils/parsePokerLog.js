import { parsePokerNowLog } from './pokerNowParser.js';
import { parseACRLog } from './ACRPokerParser.js';

/**
 * Sniffs the uploaded file content to figure out which poker site it came
 * from. PokerNow exports are CSVs with an "entry" column; ACR exports are
 * plain text starting with lines like "Hand #123456789 - Holdem ...".
 */
export function detectPokerFileFormat(content) {
    const text = String(content || '');
    const firstLine = (text.split('\n').find(l => l.trim() !== '') || '').trim();

    if (/^Hand #\S+ - /.test(firstLine)) return 'ACR';

    // PokerNow's CSV header row includes an "entry" column (quoted or not).
    if (/(^|,)"?entry"?(,|$)/i.test(firstLine)) return 'POKERNOW';

    return 'UNKNOWN';
}

/**
 * Detects the file format and parses it with the matching parser.
 * Returns { format, hands }. Throws if the format can't be identified.
 */
export function parsePokerLog(content) {
    const format = detectPokerFileFormat(content);

    if (format === 'ACR') {
        return { format, hands: parseACRLog(content) };
    }
    if (format === 'POKERNOW') {
        return { format, hands: parsePokerNowLog(content) };
    }

    throw new Error("Unrecognized file format. Expected a PokerNow CSV export or an ACR hand history .txt export.");
}