import "dotenv/config";
import fastifySession from "@fastify/session";
import ConnectMongoDBSession from "connect-mongodb-session";
import bcrypt from 'bcryptjs';
import Admin from "../models/admin.js";

const MongoDBStore = ConnectMongoDBSession(fastifySession);

// Lazily create session store with a proper database name to avoid SRV issues
export const createSessionStore = () => {
  try {
    const dbName = process.env.DB_NAME || "labzy";
    const baseUri = process.env.MONGO_URI || "mongodb://localhost:27017/labzy";
    // If using SRV connection and environment cannot resolve DNS, skip external store to prevent crashes
    if (baseUri.startsWith("mongodb+srv://")) {
      console.log("Session store skipped: SRV URI detected; falling back to in-memory sessions for AdminJS.");
      return null;
    }
    // Ensure the connection string contains a database name
    const sessionUri = baseUri.includes("/?")
      ? baseUri.replace("/?", `/${dbName}?`)
      : baseUri.match(/mongodb(\+srv)?:\/\/[^/]+\/?$/)
      ? `${baseUri}${dbName}`
      : baseUri; // already has db name

    const store = new MongoDBStore({
      uri: sessionUri,
      collection: "sessions",
      databaseName: dbName,
    });

    store.on("error", (error) => {
      console.log("session store error", error);
    });

    return store;
  } catch (error) {
    console.log("failed to initialize session store", error);
    return null;
  }
};

export const authenticate = async (email, password) => {
  if (email && password) {
    const user = await Admin.findOne({ email });
    if (!user) {
      return null;
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      return Promise.resolve({ email });
    } else {
      return null;
    }
  }

  return null;
};

export const PORT = process.env.PORT || 3000;
export const COOKIE_PASSWORD = process.env.COOKIE_PASSWORD || "cookie_gwhweshshshsfhhhshshspassword";