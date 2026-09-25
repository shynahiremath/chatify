import { Server } from "socket.io";
import http from "http";
import express from "express";
import mongoose from "mongoose";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import Message from "../models/Message.js";
import User from "../models/user.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [ENV.CLIENT_URL],
    credentials: true,
  },
});

// apply authentication middleware to all socket connections
io.use(socketAuthMiddleware);

// this is for storing online users: { userId: socketId }
const userSocketMap = {};

// we will use this function to check if the user is online or not
export function getReceiverSocketId(userId) {
  if (userId == null) return undefined;
  const key = String(userId);
  return Object.hasOwn(userSocketMap, key) ? userSocketMap[key] : undefined;
}

io.on("connection", async (socket) => {
  console.log("A user connected:", socket.user.username);

  const userId = socket.userId;
  userSocketMap[userId] = socket.id;

  // send events to all connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // ---------- TYPING INDICATOR ----------
  socket.on("typing", ({ to } = {}) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) io.to(receiverSocketId).emit("typing", { from: userId });
  });

  socket.on("stopTyping", ({ to } = {}) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) io.to(receiverSocketId).emit("stopTyping", { from: userId });
  });

  // ---------- READ RECEIPTS ----------
  // the client emits this when it opens a chat (or receives a message in the open chat)
  socket.on("markMessagesRead", async ({ senderId } = {}) => {
    if (typeof senderId !== "string" || !mongoose.isValidObjectId(senderId)) return;

    try {
      const result = await Message.updateMany(
        { senderId, receiverId: userId, status: { $ne: "read" } },
        { status: "read" }
      );

      if (result.modifiedCount > 0) {
        const senderSocketId = getReceiverSocketId(senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit("messagesRead", { by: userId });
        }
      }
    } catch (error) {
      console.log("Error in markMessagesRead:", error.message);
    }
  });

  // ---------- DELIVERED ----------
  // messages sent to this user while they were offline are now delivered
  try {
    const pendingSenderIds = await Message.distinct("senderId", {
      receiverId: userId,
      status: "sent",
    });

    if (pendingSenderIds.length > 0) {
      await Message.updateMany(
        { receiverId: userId, status: "sent" },
        { status: "delivered" }
      );

      pendingSenderIds.forEach((senderId) => {
        const senderSocketId = getReceiverSocketId(senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit("messagesDelivered", { receiverId: userId });
        }
      });
    }
  } catch (error) {
    console.log("Error marking messages as delivered:", error.message);
  }

  // ---------- DISCONNECT + LAST SEEN ----------
  socket.on("disconnect", async () => {
    console.log("A user disconnected:", socket.user.username);

    // if the user opened another tab, that newer socket owns the entry now
    if (userSocketMap[userId] !== socket.id) return;

    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    const lastSeen = new Date();
    try {
      await User.findByIdAndUpdate(userId, { lastSeen });
    } catch (error) {
      console.log("Error saving last seen:", error.message);
    }
    io.emit("userLastSeen", { userId, lastSeen });
  });
});

export { io, app, server };
