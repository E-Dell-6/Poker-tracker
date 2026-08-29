// Buckets an effective stack (in big blinds) into a coarse depth category.
// Thresholds are named constants, not magic numbers, so they're easy to
// retune without hunting through call sites.
export const STACK_DEPTH_THRESHOLDS = {
  SHORT_MAX_BB: 40,  // < this is 'short'
  MID_MAX_BB: 100    // <= this (and >= SHORT_MAX_BB) is 'mid'; above it is 'deep'
};

export function getStackDepthBucket(effectiveStackBB) {
  if (effectiveStackBB < STACK_DEPTH_THRESHOLDS.SHORT_MAX_BB) return 'short';
  if (effectiveStackBB <= STACK_DEPTH_THRESHOLDS.MID_MAX_BB) return 'mid';
  return 'deep';
}
