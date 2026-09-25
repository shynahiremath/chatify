import mongoose from "mongoose";
import Message from "../models/Message.js";
import User from "../models/user.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

// Reactions the app allows. Keep this list identical to QUICK_REACTIONS in MessageActions.jsx.
// (the heart is written with escapes so the invisible variation selector can't get lost)
const ALLOWED_REACTIONS = [
  "\u{1F44D}", // thumbs up
  "\u2764\uFE0F", // red heart
  "\u{1F602}", // laughing
  "\u{1F62E}", // surprised
  "\u{1F622}", // sad
  "\u{1F64F}", // folded hands
];

// which fields of the replied-to message the client needs for the quote preview
const REPLY_FIELDS = "text image senderId isDeleted";

// tell the other person in the chat that a message changed (edit / delete / reaction)
function emitMessageUpdate(message, actorId) {
  const otherUserId = message.senderId.equals(actorId)
    ? message.receiverId
    : message.senderId;
  const socketId = getReceiverSocketId(otherUserId);
  if (socketId) io.to(socketId).emit("messageUpdated", message);
}

// find a message, but only if the user is one of the two people in the conversation
async function findMessageForUser(messageId, userId) {
  if (!mongoose.isValidObjectId(messageId)) return null;
  return Message.findOne({
    _id: messageId,
    $or: [{ senderId: userId }, { receiverId: userId }],
  });
}

export const getAllContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId },
    }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.log("Error in getAllContacts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMessagesByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: userToChatId } = req.params;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("replyTo", REPLY_FIELDS);

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, file, voice, replyTo } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!text && !image && !file && !voice) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }
    if (senderId.equals(receiverId)) {
      return res.status(400).json({ message: "You cannot send messages to yourself" });
    }

    // if this is a reply, the original must exist in THIS conversation
    let replyToId = null;
    if (replyTo) {
      if (!mongoose.isValidObjectId(replyTo)) {
        return res.status(400).json({ message: "Invalid message to reply to" });
      }
      const original = await Message.findOne({
        _id: replyTo,
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      });
      if (!original) {
        return res.status(404).json({ message: "Message to reply to was not found" });
      }
      replyToId = original._id;
    }

    let imageUrl, fileData, voiceData;
    if (image) {
      // upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }
    if (file?.data) {
      // resource_type "auto" lets Cloudinary accept PDFs, zips, docs, etc.,
      // not just images/video
      const uploadResponse = await cloudinary.uploader.upload(file.data, {
        resource_type: "auto",
      });
      fileData = {
        url: uploadResponse.secure_url,
        name: file.name,
        type: file.type,
        size: file.size,
      };
    }
    if (voice?.data) {
      // Cloudinary has no separate "audio" resource type — "video" is what
      // handles standalone audio files (webm/mp3/etc)
      const uploadResponse = await cloudinary.uploader.upload(voice.data, {
        resource_type: "video",
      });
      voiceData = { url: uploadResponse.secure_url, duration: voice.duration };
    }

    // if the receiver is online the message is delivered right away
    const receiverSocketId = getReceiverSocketId(receiverId);

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      file: fileData,
      voice: voiceData,
      replyTo: replyToId,
      status: receiverSocketId ? "delivered" : "sent",
    });

    await newMessage.save();
    await newMessage.populate("replyTo", REPLY_FIELDS);

    // send the message in real time if the receiver is online
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PATCH /api/messages/edit/:messageId   body: { text }
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
    const userId = req.user._id;

    if (!text) {
      return res.status(400).json({ message: "Message text cannot be empty" });
    }

    const message = await findMessageForUser(messageId, userId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (!message.senderId.equals(userId)) {
      return res.status(403).json({ message: "You can only edit your own messages" });
    }
    if (message.isDeleted) {
      return res.status(400).json({ message: "This message was deleted" });
    }

    message.text = text;
    message.isEdited = true;
    await message.save();
    await message.populate("replyTo", REPLY_FIELDS);

    emitMessageUpdate(message, userId);
    res.status(200).json(message);
  } catch (error) {
    console.log("Error in editMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// DELETE /api/messages/delete/:messageId   (delete for everyone)
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await findMessageForUser(messageId, userId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (!message.senderId.equals(userId)) {
      return res.status(403).json({ message: "You can only delete your own messages" });
    }

    // soft delete: keep the document so replies to it still resolve
    message.text = "";
    message.image = "";
    message.file = undefined;
    message.voice = undefined;
    message.reactions = [];
    message.isDeleted = true;
    await message.save();
    await message.populate("replyTo", REPLY_FIELDS);

    emitMessageUpdate(message, userId);
    res.status(200).json(message);
  } catch (error) {
    console.log("Error in deleteMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PUT /api/messages/react/:messageId   body: { emoji }
// same emoji again removes your reaction, a different emoji replaces it
export const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!ALLOWED_REACTIONS.includes(emoji)) {
      return res.status(400).json({ message: "Unsupported reaction" });
    }

    const message = await findMessageForUser(messageId, userId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.isDeleted) {
      return res.status(400).json({ message: "This message was deleted" });
    }

    const myId = userId.toString();
    const index = message.reactions.findIndex((r) => r.userId.toString() === myId);

    if (index === -1) {
      message.reactions.push({ userId, emoji });
    } else if (message.reactions[index].emoji === emoji) {
      message.reactions.splice(index, 1);
    } else {
      message.reactions[index].emoji = emoji;
    }

    await message.save();
    await message.populate("replyTo", REPLY_FIELDS);

    emitMessageUpdate(message, userId);
    res.status(200).json(message);
  } catch (error) {
    console.log("Error in reactToMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    // find all the messages where the logged-in user is either sender or receiver
    const messages = await Message.find({
      $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
    });

    const chatPartnerIds = [
      ...new Set(
        messages.map((msg) =>
          msg.senderId.toString() === loggedInUserId.toString()
            ? msg.receiverId.toString()
            : msg.senderId.toString()
        )
      ),
    ];

    const chatPartners = await User.find({
      _id: { $in: chatPartnerIds },
    }).select("-password");

    res.status(200).json(chatPartners);
  } catch (error) {
    console.error("Error in getChatPartners: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};