import mongoose from "mongoose";

const sosContactsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

const SosContacts = mongoose.model("SosContacts", sosContactsSchema);

export default SosContacts;