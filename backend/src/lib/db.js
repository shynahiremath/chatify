import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const conn= await mongoose.connect(process.env.MONGO_URI)
    console.log('Connected to MongoDB:', conn.connection.host)
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1); // Exit the process with an error code
  }
};