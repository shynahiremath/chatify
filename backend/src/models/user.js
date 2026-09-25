import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    profilePic: {
      type: String,
      default: "",
    },
    // updated whenever the user's socket disconnects
    lastSeen: {
      type: Date,
      default: null,
    },
    // NEW: short status line shown next to the username, e.g. "Busy", "At work"
    statusMessage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;