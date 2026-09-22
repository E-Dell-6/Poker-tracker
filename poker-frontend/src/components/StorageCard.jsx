import { HardDrive } from "lucide-react";
import { formatBytes } from "../utils/formatBytes";
import "./StorageCard.css";

// What GET /api/user/storage reports: the running counters the import quota
// is enforced against (see checkImportQuota in the backend). An absolute
// account total, never filtered - it answers "how close am I to being
// refused an import", which no time or source selector bears on.

// Warn before the quota actually refuses an import, not at the wall.
const WARN_PCT = 75;
const DANGER_PCT = 90;

// True percentage, for the number shown to the user. The counters are
// approximate (BSON size, maintained by $inc) so they can in principle drift
// past the limit - clamp rather than report over 100%.
function pctOf(used, limit) {
  if (!limit) return 0;
  return Math.min(100, Math.max(0, (used / limit) * 100));
}

// Bar width only. A non-zero-but-tiny library gets a visible sliver so "some"
// never looks identical to "none" - deliberately kept apart from the figure
// above, since flooring the displayed number would report 25MB of 2GB as 2%.
function barWidth(pct) {
  if (pct <= 0) return 0;
  return Math.max(2, pct);
}

// Rounding alone would show a used-but-barely account as a flat "0%".
function fmtPct(pct) {
  if (pct > 0 && pct < 1) return "<1%";
  return `${Math.round(pct)}%`;
}

function level(pct) {
  if (pct >= DANGER_PCT) return "danger";
  if (pct >= WARN_PCT) return "warn";
  return "ok";
}

export function StorageCard({ storage }) {
  if (!storage) return null;

  const { bytesUsed = 0, bytesLimit = 0, handsUsed = 0, handsLimit = 0, sessionCount = 0 } = storage;

  const bytesPct = pctOf(bytesUsed, bytesLimit);
  const handsPct = pctOf(handsUsed, handsLimit);
  // Whichever quota is closest to refusing an import is the one that matters.
  const tone = level(Math.max(bytesPct, handsPct));

  return (
    <div className="storage-card">
      <div className="storage-card-title"><HardDrive size={16} /> Storage</div>

      <div className="storage-headline">
        <span className="storage-used">{formatBytes(bytesUsed)}</span>
        <span className="storage-of">of {formatBytes(bytesLimit)} used</span>
        <span className={`storage-pct ${tone}`}>{fmtPct(bytesPct)}</span>
      </div>

      <div className="storage-bar">
        <div className={`storage-bar-fill ${tone}`} style={{ width: `${barWidth(bytesPct)}%` }} />
      </div>

      <div className="storage-grid">
        {[
          { label: "Hands Stored", val: handsUsed.toLocaleString() },
          { label: "Hand Limit",   val: handsLimit.toLocaleString() },
          { label: "Sessions",     val: sessionCount.toLocaleString() },
        ].map(({ label, val }) => (
          <div className="storage-stat" key={label}>
            <div className="storage-stat-label">{label}</div>
            <div className="storage-stat-value">{val}</div>
          </div>
        ))}
      </div>

      <div className="storage-note">
        Imported hand histories. Uploaded files are discarded after parsing.
      </div>
    </div>
  );
}

export default StorageCard;
