import ScheduledMessage from "../models/ScheduledMessage.js";
import Message from "../models/Message.js";
import { getReceiverSocketId, io } from "./socket.js";

const TICK_MS = 15 * 1000;

let timer = null;
let isRunning = false;

async function deliver(item) {
  const senderSocketId = getReceiverSocketId(item.senderId);

  // reminder: goes back to the person who set it
  if (item.kind === "reminder") {
    if (!senderSocketId) {
      item.status = "missed";
      await item.save();
      return;
    }
    io.to(senderSocketId).emit("reminder", { id: item._id, text: item.text });
    item.status = "sent";
    await item.save();
    return;
  }

  // scheduled message: behaves like a normal send
  const receiverSocketId = getReceiverSocketId(item.receiverId);
  const message = await Message.create({
    senderId: item.senderId,
    receiverId: item.receiverId,
    text: item.text,
    status: receiverSocketId ? "delivered" : "sent",
  });

  if (receiverSocketId) io.to(receiverSocketId).emit("newMessage", message);
  if (senderSocketId) {
    io.to(senderSocketId).emit("scheduledSent", {
      message,
      scheduledId: item._id,
    });
  }

  item.status = "sent";
  await item.save();
}

export async function processDueScheduled() {
  if (isRunning) return;
  isRunning = true;

  try {
    while (true) {
      const item = await ScheduledMessage.findOneAndUpdate(
        { status: "pending", sendAt: { $lte: new Date() } },
        { status: "processing" },
        { sort: { sendAt: 1 }, new: true }
      );
      if (!item) break;

      try {
        await deliver(item);
      } catch (error) {
        console.log("Scheduled item failed:", error.message);
        item.status = "failed";
        item.error = String(error.message).slice(0, 200);
        await item.save();
      }
    }
  } catch (error) {
    console.log("Scheduler error:", error.message);
  } finally {
    isRunning = false;
  }
}

export async function startScheduler() {
  if (timer) return;

  try {
    await ScheduledMessage.updateMany({ status: "processing" }, { status: "pending" });
  } catch (error) {
    console.log("Scheduler cleanup failed:", error.message);
  }

  timer = setInterval(processDueScheduled, TICK_MS);
  processDueScheduled();
  console.log("Scheduler started");
}