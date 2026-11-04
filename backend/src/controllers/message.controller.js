
import mongoose from "mongoose";
import { Readable } from "node:stream";
import Message from "../models/Message.js";
import User from "../models/user.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

// Upload browser-recorded Base64 audio to Cloudinary using a stream.
function uploadVoiceToCloudinary(dataUrl) {
  if (
    typeof dataUrl !== "string" ||
    !dataUrl.startsWith("data:audio/") ||
    !dataUrl.includes(";base64,")
  ) {
    throw new Error("Invalid voice audio data URL");
  }

  const base64Data = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const audioBuffer = Buffer.from(base64Data, "base64");

  if (audioBuffer.length === 0) {
    throw new Error("Voice audio is empty");
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "video" },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result?.secure_url) {
          reject(new Error("Cloudinary did not return an audio URL"));
          return;
        }

        resolve(result);
      }
    );

    Readable.from(audioBuffer).pipe(uploadStream);
  });
}

console.log(
  "DEBUG schema has voice:",
  !!Message.schema.path("voice.url")
);

// Reactions the app allows.
const ALLOWED_REACTIONS = [
  "\u{1F44D}",
  "\u2764\uFE0F",
  "\u{1F602}",
  "\u{1F62E}",
  "\u{1F622}",
  "\u{1F64F}",
];

// Fields needed for the reply preview.
const REPLY_FIELDS = "text image senderId isDeleted";

// Notify the other participant when a message changes.
function emitMessageUpdate(message, actorId) {
  const otherUserId = message.senderId.equals(actorId)
    ? message.receiverId
    : message.senderId;

  const socketId = getReceiverSocketId(otherUserId);

  if (socketId) {
    io.to(socketId).emit("messageUpdated", message);
  }
}

// Find a message only if the user belongs to its conversation.
async function findMessageForUser(messageId, userId) {
  if (!mongoose.isValidObjectId(messageId)) {
    return null;
  }

  return Message.findOne({
    _id: messageId,
    $or: [
      { senderId: userId },
      { receiverId: userId },
    ],
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
    console.log("Error in getAllContacts:", error.message);
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
    console.log(
      "Error in getMessages controller:",
      error.message
    );
    res.status(500).json({
      error: "Internal server error",
    });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, file, voice, replyTo } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    console.log(
      "DEBUG voice in request:",
      !!voice,
      "| data length:",
      voice?.data?.length,
      "| duration:",
      voice?.duration
    );

    if (!text && !image && !file && !voice) {
      return res.status(400).json({
        message: "Message cannot be empty",
      });
    }

    if (senderId.equals(receiverId)) {
      return res.status(400).json({
        message: "You cannot send messages to yourself",
      });
    }

    // Validate the reply belongs to this conversation.
    let replyToId = null;

    if (replyTo) {
      if (!mongoose.isValidObjectId(replyTo)) {
        return res.status(400).json({
          message: "Invalid message to reply to",
        });
      }

      const original = await Message.findOne({
        _id: replyTo,
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      });

      if (!original) {
        return res.status(404).json({
          message: "Message to reply to was not found",
        });
      }

      replyToId = original._id;
    }

    let imageUrl;
    let fileData;
    let voiceData;

    // Upload an image to Cloudinary.
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(
        image
      );

      imageUrl = uploadResponse.secure_url;
    }

    // Upload an attached file.
    if (file?.data) {
      const uploadResponse = await cloudinary.uploader.upload(
        file.data,
        { resource_type: "auto" }
      );

      fileData = {
        url: uploadResponse.secure_url,
        name: file.name,
        type: file.type,
        size: file.size,
      };
    }

    // Upload recorded voice audio through a stream.
    // This handles browser data URLs such as audio/webm;codecs=opus.
    if (voice?.data) {
      const uploadResponse = await uploadVoiceToCloudinary(
        voice.data
      );

      voiceData = {
        url: uploadResponse.secure_url,
        duration: voice.duration,
        transcription:
          typeof voice.transcription === "string"
            ? voice.transcription.trim()
            : "",
      };
    }

    // Set initial delivery status.
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

    console.log("DEBUG voice saved:", newMessage.voice);

    await newMessage.populate("replyTo", REPLY_FIELDS);

    // Deliver the message to the receiver in real time.
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    return res.status(201).json(newMessage);
  } catch (error) {
    console.error(
      "Error in sendMessage controller:",
      error.message
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

// PATCH /api/messages/edit/:messageId
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const text =
      typeof req.body.text === "string"
        ? req.body.text.trim()
        : "";

    const userId = req.user._id;

    if (!text) {
      return res.status(400).json({
        message: "Message text cannot be empty",
      });
    }

    const message = await findMessageForUser(
      messageId,
      userId
    );

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    if (!message.senderId.equals(userId)) {
      return res.status(403).json({
        message: "You can only edit your own messages",
      });
    }

    if (message.isDeleted) {
      return res.status(400).json({
        message: "This message was deleted",
      });
    }

    message.text = text;
    message.isEdited = true;

    await message.save();
    await message.populate("replyTo", REPLY_FIELDS);

    emitMessageUpdate(message, userId);

    return res.status(200).json(message);
  } catch (error) {
    console.log(
      "Error in editMessage controller:",
      error.message
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

// DELETE /api/messages/delete/:messageId
// Delete a message for everyone.
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await findMessageForUser(
      messageId,
      userId
    );

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    if (!message.senderId.equals(userId)) {
      return res.status(403).json({
        message: "You can only delete your own messages",
      });
    }

    // Keep the document so replies can still reference it.
    message.text = "";
    message.image = "";
    message.file = undefined;
    message.voice = undefined;
    message.reactions = [];
    message.isDeleted = true;

    await message.save();
    await message.populate("replyTo", REPLY_FIELDS);

    emitMessageUpdate(message, userId);

    return res.status(200).json(message);
  } catch (error) {
    console.log(
      "Error in deleteMessage controller:",
      error.message
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

// PUT /api/messages/react/:messageId
// Toggle or replace your reaction.
export const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!ALLOWED_REACTIONS.includes(emoji)) {
      return res.status(400).json({
        message: "Unsupported reaction",
      });
    }

    const message = await findMessageForUser(
      messageId,
      userId
    );

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    if (message.isDeleted) {
      return res.status(400).json({
        message: "This message was deleted",
      });
    }

    const myId = userId.toString();

    const index = message.reactions.findIndex(
      (reaction) =>
        reaction.userId.toString() === myId
    );

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

    return res.status(200).json(message);
  } catch (error) {
    console.log(
      "Error in reactToMessage controller:",
      error.message
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    // Find all messages involving the logged-in user.
    const messages = await Message.find({
      $or: [
        { senderId: loggedInUserId },
        { receiverId: loggedInUserId },
      ],
    });

    const chatPartnerIds = [
      ...new Set(
        messages.map((message) =>
          message.senderId.toString() ===
          loggedInUserId.toString()
            ? message.receiverId.toString()
            : message.senderId.toString()
        )
      ),
    ];

    const chatPartners = await User.find({
      _id: { $in: chatPartnerIds },
    }).select("-password");

    return res.status(200).json(chatPartners);
  } catch (error) {
    console.error(
      "Error in getChatPartners:",
      error.message
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};
