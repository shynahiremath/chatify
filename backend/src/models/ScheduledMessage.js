import mongoose from "mongoose";

const scheduledMessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // empty for reminders: a reminder goes back to the sender only
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    kind: {
      type: String,
      enum: ["message", "reminder"],
      default: "message",
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    sendAt: {
      type: Date,
      required: true,
    },
    // pending -> processing -> sent | failed
    // a reminder that fires while its owner is offline becomes "missed"
    status: {
      type: String,
      enum: ["pending", "processing", "sent", "failed", "missed", "cancelled"],
      default: "pending",
    },
    error: {
      type: String,
    },
  },
  { timestamps: true }
);

scheduledMessageSchema.index({ status: 1, sendAt: 1 });
scheduledMessageSchema.index({ senderId: 1, status: 1 });

const ScheduledMessage = mongoose.model("ScheduledMessage", scheduledMessageSchema);

export default ScheduledMessage;