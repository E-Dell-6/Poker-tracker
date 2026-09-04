import crypto from 'crypto';
import SharedHand from '../model/sharedHand.js';
import { SHARE } from '../config/limits.js';

const generateShareId = () => crypto.randomBytes(9).toString('base64url').slice(0, 12);

const isExpired = (doc) =>
  !doc.createdAt || Date.now() - doc.createdAt.getTime() >= SHARE.LINK_TTL_SECONDS * 1000;

export async function getSharedHand(req, res) {
  try {
    const doc = await SharedHand.findOne({ shareId: req.params.shareId });
    if (!doc) return res.status(404).json({ error: 'Hand not found or link has expired.' });

    // The TTL index is what actually deletes the doc, but it can't be the
    // thing that decides whether to serve it: Mongo's TTL monitor runs on
    // its own schedule (about once a minute), and if the index was never
    // built on this deployment it never runs at all - either way the link
    // would keep working past its expiry. Checking the date here means the
    // deletion is a cleanup, not the enforcement.
    if (isExpired(doc)) {
      await SharedHand.deleteOne({ _id: doc._id }).catch(() => {});
      return res.status(404).json({ error: 'Hand not found or link has expired.' });
    }

    res.json({ hand: doc.hand });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch shared hand.', details: err.message });
  }
}

export async function createShareLink(req, res) {
  try {
    const { userId, hand } = req.body;
    if (!hand?._id) return res.status(400).json({ error: 'hand._id is required.' });

    const existing = await SharedHand.findOne({ userId, handId: hand._id.toString() });
    // An expired doc that the TTL sweep hasn't reached yet must not be
    // handed back as a live link - its remaining lifetime is zero or less.
    // Replacing it also keeps re-sharing from being a way to silently
    // extend a link that has already run out.
    if (existing && !isExpired(existing)) return res.json({ shareId: existing.shareId });
    if (existing) await SharedHand.deleteOne({ _id: existing._id });

    const shareId = generateShareId();
    await SharedHand.create({ shareId, userId, handId: hand._id.toString(), hand });
    res.status(201).json({ shareId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create share link.', details: err.message });
  }
}

export async function deleteShareLink(req, res) {
  try {
    const { userId } = req.body;
    const doc = await SharedHand.findOneAndDelete({ shareId: req.params.shareId, userId });
    if (!doc) return res.status(404).json({ error: 'Share link not found or you do not own it.' });
    res.json({ message: 'Share link revoked.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke share link.', details: err.message });
  }
}
