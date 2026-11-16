// Reset an app user's password (patients, lab staff, etc.; not AdminJS admins,
// use seedAdmin.js for those).
//
//   node scripts/resetUserPassword.js <email> <new-password>
//
// Uses MONGO_URI from .env, so it changes whichever database that points to.
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/user.js";

const [email, newPassword] = process.argv.slice(2);

if (!email || !newPassword) {
  console.error("Usage: node scripts/resetUserPassword.js <email> <new-password>");
  process.exit(1);
}
if (newPassword.length < 6) {
  console.error("The app requires a password of at least 6 characters.");
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exitCode = 1;
  } else {
    // Same hashing as authService.resetPassword.
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();
    console.log(`Password reset for user ${user.email}`);
  }
  await mongoose.disconnect();
};

run().catch((e) => { console.error(e); process.exit(1); });
