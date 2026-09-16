import User from "../models/user.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../lib/utils.js";

export const signup = async(req, res) => {
  const { username, email, password } = req.body;
  try{
    if(!username || !email || !password){
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    if(newUser){
    await newUser.save();
    generateToken(newUser._id, res);
    
    res.status(201).json({ 
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      profilePic: newUser.profilePic,
    });
    } else{
      res.status(400).json({ message: "User creation failed" });
    }
   } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};