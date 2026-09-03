import { parsePokerNowLog } from './pokerNowParser.js';
import { parseACRLog } from './ACRPokerParser.js';
import { parseGGPokerLog } from './GGPokerParser.js';

/**
 * Sniffs the uploaded file content to figure out which poker site it came
 * from. PokerNow exports are CSVs with an "entry" column; ACR exports are
 * plain text starting with lines like "Hand #123456789 - Holdem ..."; GGPoker
 * exports are plain text starting with lines like "Poker Hand #HD123: Hold'em
 * No Limit ($0.05/$0.1) - ...". No collision risk between ACR/GGPoker: ACR's
 * check requires the line to literally start with "Hand #", which GGPoker's
 * "Poker Hand #..." line never does.
 */
export function detectPokerFileFormat(content) {
    const text = String(content || '');
    const firstLine = (text.split('\n').find(l => l.trim() !== '') || '').trim();

    if (/^Hand #\S+ - /.test(firstLine)) return 'ACR';
    if (/^Poker Hand #\S+: /.test(firstLine)) return 'GGPOKER';

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
    if (format === 'GGPOKER') {
        return { format, hands: parseGGPokerLog(content) };
    }
    if (format === 'POKERNOW') {
        return { format, hands: parsePokerNowLog(content) };
    }

    throw new Error("Unrecognized file format. Expected a PokerNow CSV export, an ACR hand history .txt export, or a GGPoker hand history .txt export.");
}