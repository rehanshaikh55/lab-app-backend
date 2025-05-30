import { authRoutes } from "./authRoutes.js";



const prefix ="/api"
export const registerRoutes = async(fastify)=>{
    fastify.register(authRoutes,{prefix:prefix})
  
}