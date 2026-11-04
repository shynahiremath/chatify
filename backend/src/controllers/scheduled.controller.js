import mongoose from "mongoose";
import ScheduledMessage from "../models/ScheduledMessage.js";
import User from "../models/user.js";

const MAX_PENDING_PER_USER = 50;
const MAX_AHEAD_MS = 365 * 24 * 60 * 60 * 1000; // one year

// POST /api/scheduled   body: { kind, receiverId, text, sendAt }
export const createScheduled = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { receiverId, text, sendAt } = req.body;
    const kind = req.body.kind ?? "message";

    if (kind !== "message" && kind !== "reminder") {
      return res.status(400).json({ message: "Invalid type" });
    }

    const cleanText = typeof text === "string" ? text.trim() : "";
    if (!cleanText) {
      return res.status(400).json({ message: "Text cannot be empty" });
    }
    if (cleanText.length > 2000) {
      return res.status(400).json({ message: "Text is too long (max 2000 characters)" });
    }

    const when = new Date(sendAt);
    if (Number.isNaN(when.getTime())) {
      return res.status(400).json({ message: "Pick a valid date and time" });
    }
    const now = Date.now();
    if (when.getTime() < now + 5000) {
      return res.status(400).json({ message: "Pick a time in the future" });
    }
    if (when.getTime() > now + MAX_AHEAD_MS) {
      return res.status(400).json({ message: "That is too far ahead (max 1 year)" });
    }

    let receiver = null;
    if (kind === "message") {
      if (!mongoose.isValidObjectId(receiverId)) {
        return res.status(400).json({ message: "Invalid recipient" });
      }
      if (senderId.equals(receiverId)) {
        return res.status(400).json({ message: "You cannot message yourself, use a reminder instead" });
      }
      const exists = await User.exists({ _id: receiverId });
      if (!exists) {
        return res.status(404).json({ message: "Recipient not found" });
      }
      receiver = receiverId;
    }

    const pendingCount = await ScheduledMessage.countDocuments({
      senderId,
      status: "pending",
    });
    if (pendingCount >= MAX_PENDING_PER_USER) {
      return res.status(400).json({ message: "You have too many scheduled items (max 50)" });
    }

    const item = await ScheduledMessage.create({
      senderId,
      receiverId: receiver,
      kind,
      text: cleanText,
      sendAt: when,
    });

    res.status(201).json(item);
  } catch (error) {
    console.log("Error in createScheduled:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/scheduled   my upcoming items, soonest first
export const listScheduled = async (req, res) => {
  try {
    const items = await ScheduledMessage.find({
      senderId: req.user._id,
      status: "pending",
    }).sort({ sendAt: 1 });

    res.status(200).json(items);
  } catch (error) {
    console.log("Error in listScheduled:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/scheduled/:id   cancel one that has not been sent yet
export const cancelScheduled = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const item = await ScheduledMessage.findOneAndUpdate(
      { _id: id, senderId: req.user._id, status: "pending" },
      { status: "cancelled" },
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ message: "Not found, or it was already sent" });
    }

    res.status(200).json({ _id: item._id });
  } catch (error) {
    console.log("Error in cancelScheduled:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};