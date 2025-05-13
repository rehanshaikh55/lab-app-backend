import "dotenv/config";
import Fastify from "fastify";
import { connectDB } from "./config/connect.js";
import { PORT } from "./config/config.js";
import { admin, buildAdminRouter } from "./config/setup.js";
//import { registerRoutes } from "./routes/index.js";
import fastifySocketIO from "fastify-socket.io";
import cors from 'cors'

const start = async () => {
  await connectDB(process.env.MONGO_URI);
  const app = Fastify();

  app.register(fastifySocketIO,{
    cors:{
      origin:'*'
    },
    pingInterval:10000,
    pingTimeout:5000,
    transports:['websocket']
  })

  //await registerRoutes(app);
  await buildAdminRouter(app);

  app.listen({ port: PORT, host: "0.0.0.0" }, (err, addr) => {
    if (err) {
      console.log(err);
    } else {
      console.log(`Lab app started on Port: ${PORT}${admin.options.rootPath}`);
    }
  });
 
app.ready().then(()=>{
  app.io.on("connection",(socket)=>{
      console.log("user connected");
      socket.on("joinRoom",(orderId)=>{
        socket.join(orderId)
        console.log(`user joined room ${orderId}`);
        
      })
      socket.on('disconnect',()=>{
        console.log("user disconnected");
      })
  })
})

};

start();