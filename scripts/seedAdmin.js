import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Admin from "../models/admin.js";

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("DB connected");

  const email = "shaikhrehan1016@gmail.com";
  const plainPassword = "rehan786";
  const hashed = await bcrypt.hash(plainPassword, 10);

  const existing = await Admin.findOne({ email });

  if (existing) {
    existing.password = hashed;
    await existing.save();
    console.log("Admin password updated (hashed)");
  } else {
    await Admin.create({ name: "Rehan", email, password: hashed, role: "superadmin" });
    console.log("Admin created with hashed password");
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((e) => { console.error(e); process.exit(1); });
