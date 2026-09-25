import User from "../models/user.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../lib/utils.js";
import { sendWelcomeEmail } from "../emails/emailHandlers.js";
import { ENV } from "../lib/env.js";
import cloudinary from "../lib/cloudinary.js";

export const signup = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    if (!username || !email || !password) {
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

    await newUser.save();
    generateToken(newUser._id, res);

    res.status(201).json({
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      profilePic: newUser.profilePic,
      statusMessage: newUser.statusMessage,
    });

    try {
      await sendWelcomeEmail(newUser.email, newUser.username, ENV.CLIENT_URL);
    } catch (emailError) {
      console.error("Error sending welcome email:", emailError);
    }
  } catch (error) {
    console.error("Error in signup:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      profilePic: user.profilePic,
      statusMessage: user.statusMessage,
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = async (_, res) => {
  res.cookie("jwt", "", { maxAge: 0 });
  res.status(200).json({ message: "Logged out successfully" });
};

// PUT /api/auth/update-profile
// body can include any of: profilePic, username, statusMessage.
// Only the fields that are present get updated, so this covers avatar-only,
// username-only, and status-only saves without extra routes.
export const updateProfile = async (req, res) => {
  try {
    const { profilePic, username, statusMessage } = req.body;
    const userId = req.user._id;

    const hasProfilePic = typeof profilePic === "string" && profilePic.length > 0;
    const hasUsername = typeof username === "string";
    const hasStatusMessage = typeof statusMessage === "string";

    if (!hasProfilePic && !hasUsername && !hasStatusMessage) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const update = {};

    if (hasUsername) {
      const trimmed = username.trim();
      if (trimmed.length < 2 || trimmed.length > 30) {
        return res
          .status(400)
          .json({ message: "Username must be between 2 and 30 characters" });
      }
      const taken = await User.findOne({ username: trimmed, _id: { $ne: userId } });
      if (taken) {
        return res.status(400).json({ message: "That username is already taken" });
      }
      update.username = trimmed;
    }

    if (hasStatusMessage) {
      const trimmed = statusMessage.trim().slice(0, 40);
      update.statusMessage = trimmed;
    }

    if (hasProfilePic) {
      const uploadResponse = await cloudinary.uploader.upload(profilePic);
      update.profilePic = uploadResponse.secure_url;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, update, {
      new: true,
      runValidators: true,
    }).select("-password");

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error updating profile:", error);

    if (error.code === 11000) {
      return res.status(400).json({ message: "That username is already taken" });
    }
    res.status(500).json({
      message: "Internal server error",
    });
  }
};