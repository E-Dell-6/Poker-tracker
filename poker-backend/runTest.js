import fs from 'fs';
import { parsePokerNowLog } from './utils/pokerNowParser.js';

// 1. Read the CSV file from your hard drive
try {
  const csvContent = fs.readFileSync('poker_now_log_pglZFYzj3JHoepuuCnVIxxDXW.csv', 'utf8');
  
  // 2. Call the function you wrote
  console.log("--- Starting Parse ---");
  parsePokerNowLog(csvContent);

} catch (err) {
  console.error("Error reading file:", err.message);
  console.log("Make sure the CSV filename matches exactly and is in this folder.");
}