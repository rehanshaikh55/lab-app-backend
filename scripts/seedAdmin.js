// Create an AdminJS admin, or reset an existing admin's password.
//
//   node scripts/seedAdmin.js <email> <new-password> [name]
//
// Uses MONGO_URI from .env, so it changes whichever database that points to.
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Admin from "../models/admin.js";

const [email, plainPassword, name = "Admin"] = process.argv.slice(2);

if (!email || !plainPassword) {
  console.error("Usage: node scripts/seedAdmin.js <email> <new-password> [name]");
  process.exit(1);
}
if (plainPassword.length < 10) {
  console.error("Use a password of at least 10 characters.");
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const hashed = await bcrypt.hash(plainPassword, 10);
  const existing = await Admin.findOne({ email: email.toLowerCase() });

  if (existing) {
    existing.password = hashed;
    await existing.save();
    console.log(`Password reset for admin ${existing.email}`);
  } else {
    await Admin.create({ name, email, password: hashed, role: "superadmin" });
    console.log(`Created superadmin ${email.toLowerCase()}`);
  }

  await mongoose.disconnect();
};

run().catch((e) => { console.error(e); process.exit(1); });
