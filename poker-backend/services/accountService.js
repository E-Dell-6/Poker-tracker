import UserModel from '../model/User.js';
import Session from '../model/Session.js';
import LiveSession from '../model/LiveSession.js';
import People from '../model/People.js';
import PlayerStats from '../model/PlayerStats.js';
import HandLedger from '../model/HandLedger.js';
import ImportJob from '../model/ImportJob.js';
import Favorite from '../model/favourites.js';
import SharedHand from '../model/sharedHand.js';
import { removeJobStagingDir } from './importRunner.js';

// Erases everything a user owns. Ordering here is the whole substance of the
// function - see the two comments below.
export async function purgeAccount(userId) {
  // Staging directories are files on the host disk, not Mongo rows. Deleting
  // the ImportJob documents first would strand them, and the orphan sweep
  // that would eventually catch them only runs at boot.
  const jobs = await ImportJob.find({ userId }).select('_id').lean();
  for (const job of jobs) {
    await removeJobStagingDir(job._id).catch(() => {});
  }

  await Promise.all([
    Session.deleteMany({ userId }),
    HandLedger.deleteMany({ userId }),
    LiveSession.deleteMany({ userId }),
    People.deleteMany({ userId }),
    PlayerStats.deleteMany({ userId }),
    Favorite.deleteMany({ userId }),
    ImportJob.deleteMany({ userId }),
    // sharedHand.userId is typed String (model/sharedHand.js:6) while every
    // other model here uses ObjectId. Passing an ObjectId matches nothing and
    // silently leaves live public share links behind, still serving hands
    // from an account that no longer exists.
    SharedHand.deleteMany({ userId: String(userId) }),
  ]);

  // Last, deliberately. If anything above throws, the account still exists
  // and the user can retry - the alternative leaves orphaned rows with no
  // owner and no way to reach them.
  await UserModel.deleteOne({ _id: userId });
}
