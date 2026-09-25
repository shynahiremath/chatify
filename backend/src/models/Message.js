import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    emoji: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
    },
    image: {
      type: String,
    },
    // NEW: a shared file attachment (any type) uploaded via Cloudinary
    file: {
      url: { type: String },
      name: { type: String },
      type: { type: String }, // the browser MIME type, e.g. "application/pdf"
      size: { type: Number }, // bytes
    },
    // sent -> delivered (receiver online) -> read (receiver opened the chat)
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },

    // NEW: the message this one is replying to (if any)
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    // NEW: set when the sender edits the text
    isEdited: {
      type: Boolean,
      default: false,
    },
    // NEW: "delete for everyone" is a soft delete, so replies to it still make sense
    isDeleted: {
      type: Boolean,
      default: false,
    },
    // NEW: at most one reaction per user per message
    reactions: {
      type: [reactionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// speeds up the "mark as delivered / read" updates
messageSchema.index({ receiverId: 1, status: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;