import mongoose from "mongoose";


export const connectDB =async(uri)=>{
    try {
        
        await mongoose.connect(uri)
     console.log("database connected ✅");
     
    } catch (error) {
        console.log("error occured",error);
        
    }
}