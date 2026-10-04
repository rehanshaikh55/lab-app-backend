import User from '../../models/user.js';
import Session from '../../models/session.js';
import Booking from '../../models/booking.js';

export const runAccountDeletion = async ({ now = new Date(), log } = {}) => {
  const due = await User.find({ deletionScheduledAt: { $lte: now, $ne: null } }).limit(50);
  let purged = 0;
  for (const u of due) {
    // Hard-delete personal fields; preserve booking analytics anonymously.
    await Session.deleteMany({ user: u._id });
    await Booking.updateMany({ user: u._id }, { $unset: { userAddress: '', patient: '' } });
    u.name = 'Deleted User';
    // email is `unique: true, sparse: true` (not required) on the User schema — setting it
    // undefined removes the path entirely, and the sparse index simply skips documents
    // without the field, so multiple anonymized users can coexist without a uniqueness
    // conflict. (If email were `required: true` this save() would throw; it is not.)
    u.email = undefined;
    u.phone = undefined;
    u.passwordHash = undefined;
    u.addresses = [];
    u.dependents = [];
    u.gender = undefined;
    u.birthDate = undefined;
    u.deletionScheduledAt = null;
    u.fcmToken = undefined;
    await u.save();
    purged += 1;
  }
  log?.info({ purged }, 'Account deletion job complete');
  return purged;
};
