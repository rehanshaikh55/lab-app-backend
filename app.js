import "dotenv/config";
import Fastify from "fastify";
import { connectDB } from "./config/connect.js";
import { PORT } from "./config/config.js";
import { admin, buildAdminRouter } from "./config/setup.js";
import './config/firebase.js';
import  {registerRoutes}  from "./routes/index.js";
import websocket from '@fastify/websocket';
import cors from 'cors'

const start = async () => {
  await connectDB(process.env.MONGO_URI);
  const app = Fastify();

 await app.register(websocket)

  await registerRoutes(app);
  await buildAdminRouter(app);

  app.listen({ port: PORT, host: "0.0.0.0" }, (err, addr) => {
    if (err) {
      console.log(err);
    } else {
      console.log(`Lab app started on Port: ${PORT}${admin.options.rootPath}`);
    }
  });
 


};

start();