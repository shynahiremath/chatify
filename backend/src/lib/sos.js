import mongoose from "mongoose";
import User from "../models/user.js";
import Message from "../models/Message.js";
import SosContacts from "../models/SosContacts.js";

const NAG_INTERVAL_MS = 30 * 1000;          // re-alert every 30s
const CHAT_REPEAT_EVERY = 4;                // ...and re-send the chat message every 4th nag (2 min)
const MAX_ACTIVE_MS = 30 * 60 * 1000;       // give up after 30 minutes
const KEEP_AFTER_REPLY_MS = 10 * 60 * 1000; // keep an answered SOS around so a refresh still shows it
const MAX_CONTACTS = 5;

const mapsLink = (loc) => `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;

function parseLocation(raw) {
  if (typeof raw?.lat !== "number" || typeof raw?.lng !== "number") return null;
  if (!Number.isFinite(raw.lat) || !Number.isFinite(raw.lng)) return null;
  if (Math.abs(raw.lat) > 90 || Math.abs(raw.lng) > 180) return null;
  return { lat: raw.lat, lng: raw.lng };
}

// io and getSocketId are passed in, so this file never imports socket.js
// (that would be a circular import).
export function createSosManager(io, getSocketId) {
  const alerts = new Map(); // senderUserId -> alert
  let counter = 0;

  const send = (userId, event, payload) => {
    const socketId = getSocketId(userId);
    if (socketId) io.to(socketId).emit(event, payload);
  };
  const isOnline = (userId) => Boolean(getSocketId(userId));

  // what the person who pressed SOS sees
  const senderView = (a) => ({
    id: a.id,
    status: a.status, // "active" | "acknowledged"
    nags: a.nags,
    startedAt: a.startedAt,
    contactCount: a.contacts.length,
    onlineCount: a.contacts.filter(isOnline).length,
    hasLocation: Boolean(a.location),
    ackBy: a.ackBy, // { id, name } | null
  });

  // what an emergency contact sees
  const contactView = (a) => ({
    id: a.id,
    from: a.userId,
    name: a.name,
    location: a.location,
    nags: a.nags,
    startedAt: a.startedAt,
  });

  const notifySender = (a) => send(a.userId, "sos:state", { sos: senderView(a) });
  const pushAlert = (a) => {
    for (const contactId of a.contacts) {
      send(contactId, "sos:alert", { sos: contactView(a) });
    }
  };

  // tells every contact to close this alert's popup
  const resolveForContacts = (a, messageFor) => {
    for (const c of a.contacts) {
      send(c, "sos:resolved", {
        alertId: a.id,
        from: a.userId,
        message: messageFor(c),
      });
    }
  };

  const chatText = (a, repeat) =>
    [
      repeat ? "🚨 I STILL NEED HELP. Please reply!" : `🚨 SOS! I need help.`,
      a.location ? `📍 My location: ${mapsLink(a.location)}` : "📍 Location unavailable",
      "Please reply or call me as soon as you see this.",
    ].join("\n");

  // saves a normal chat message to every contact and pushes it live
  const sendChat = async (a, text) => {
    for (const contactId of a.contacts) {
      try {
        const msg = await Message.create({
          senderId: a.userId,
          receiverId: contactId,
          text,
          status: isOnline(contactId) ? "delivered" : "sent",
        });
        send(contactId, "newMessage", msg);
      } catch (error) {
        console.log("SOS chat message error:", error.message);
      }
    }
  };

  const removeAlert = (a) => {
    clearTimeout(a.timer);
    if (alerts.get(a.userId) === a) alerts.delete(a.userId);
  };

  const isLive = (a) => alerts.get(a.userId) === a && a.status === "active";

  const scheduleNag = (a) => {
    a.timer = setTimeout(() => nag(a), NAG_INTERVAL_MS);
  };

  // someone replied (tapped "I'm on it" or sent a chat message)
  const acknowledge = async (a, byId) => {
    if (a.status !== "active") return;
    a.status = "acknowledged"; // set first so a double reply can't run this twice
    clearTimeout(a.timer);

    let name = "Your contact";
    try {
      const u = await User.findById(byId).select("username");
      if (u) name = u.username;
    } catch (error) {
      console.log("SOS ack lookup error:", error.message);
    }
    a.ackBy = { id: byId, name };

    notifySender(a);
    resolveForContacts(a, (c) =>
      c === byId
        ? `${a.name} knows you're responding`
        : `${name} is responding to ${a.name}'s SOS`
    );
    a.timer = setTimeout(() => removeAlert(a), KEEP_AFTER_REPLY_MS);
  };

  const expire = (a) => {
    resolveForContacts(a, () => `${a.name}'s SOS expired`);
    removeAlert(a);
    send(a.userId, "sos:error", {
      message:
        "SOS stopped after 30 minutes with no reply. If you still need help, call your local emergency number.",
    });
    send(a.userId, "sos:state", { sos: null });
  };

  // runs every 30s while nobody has replied
  const nag = async (a) => {
    if (!isLive(a)) return;
    if (Date.now() - a.startedAt.getTime() > MAX_ACTIVE_MS) return expire(a);

    try {
      // a chat message from any contact since the SOS started counts as a reply
      const reply = await Message.findOne({
        senderId: { $in: a.contacts },
        receiverId: a.userId,
        createdAt: { $gt: a.startedAt },
      }).select("senderId");

      if (!isLive(a)) return; // changed while we were waiting on the database
      if (reply) return acknowledge(a, String(reply.senderId));
    } catch (error) {
      console.log("SOS reply check error:", error.message);
    }

    a.nags += 1;
    pushAlert(a);
    notifySender(a);
    if (a.nags % CHAT_REPEAT_EVERY === 0) await sendChat(a, chatText(a, true));

    if (isLive(a)) scheduleNag(a);
  };

  const start = async (socket, userId, name, data) => {
    const existing = alerts.get(userId);
    if (existing) return notifySender(existing);

    try {
      const doc = await SosContacts.findOne({ userId });
      const contacts = (doc?.contacts || []).map(String);
      if (contacts.length === 0) {
        return socket.emit("sos:error", {
          message: "Add at least one emergency contact first (tap the ⚙️ next to SOS)",
        });
      }

      // the await above let time pass, so check again
      if (alerts.has(userId)) return notifySender(alerts.get(userId));

      const a = {
        id: `s${Date.now()}-${++counter}`,
        userId,
        name,
        contacts,
        location: parseLocation(data?.location),
        startedAt: new Date(),
        nags: 0,
        status: "active",
        ackBy: null,
        timer: null,
      };

      alerts.set(userId, a);
      notifySender(a);
      pushAlert(a);
      scheduleNag(a);
      await sendChat(a, chatText(a, false));
    } catch (error) {
      console.error("SOS start error:", error);
      socket.emit("sos:error", { message: "Could not send the SOS, try again" });
    }
  };

  const updateLocation = (userId, data) => {
    const a = alerts.get(userId);
    if (!a || a.status !== "active") return;
    const loc = parseLocation(data);
    if (loc) a.location = loc; // contacts get it with the next alert
  };

  // the sender tapped "I'm safe": close the popup on every contact's screen
  const cancel = (userId) => {
    const a = alerts.get(userId);
    if (!a) return;

    a.status = "cancelled"; // so a nag that is mid-flight can't send another alert
    resolveForContacts(a, () => `${a.name} says they're safe`);
    removeAlert(a);
    send(userId, "sos:state", { sos: null });
  };

  // an emergency contact taps "I'm on it"
  const ack = (userId, data) => {
    const a = [...alerts.values()].find((x) => x.id === data?.alertId);
    if (!a || a.status !== "active" || !a.contacts.includes(userId)) return;
    acknowledge(a, userId);
  };

  const getContacts = async (userId, cb) => {
    const reply = (payload) => typeof cb === "function" && cb(payload);
    try {
      const doc = await SosContacts.findOne({ userId });
      const users = await User.find({ _id: { $ne: userId } })
        .select("username profilePic")
        .limit(200);
      reply({
        ok: true,
        selected: (doc?.contacts || []).map(String),
        users: users.map((u) => ({
          _id: String(u._id),
          username: u.username,
          profilePic: u.profilePic,
        })),
      });
    } catch (error) {
      console.error("SOS getContacts error:", error);
      reply({ ok: false, message: "Could not load contacts" });
    }
  };

  const setContacts = async (userId, data, cb) => {
    const reply = (payload) => typeof cb === "function" && cb(payload);
    try {
      const raw = Array.isArray(data?.contacts) ? data.contacts : [];
      const ids = [...new Set(raw.map(String))].filter(
        (id) => id !== userId && mongoose.isValidObjectId(id)
      );
      if (ids.length > MAX_CONTACTS) {
        return reply({ ok: false, message: `Pick up to ${MAX_CONTACTS} contacts` });
      }
      const found = await User.countDocuments({ _id: { $in: ids } });
      if (found !== ids.length) {
        return reply({ ok: false, message: "One of those users no longer exists" });
      }
      await SosContacts.findOneAndUpdate(
        { userId },
        { contacts: ids },
        { upsert: true, new: true }
      );
      reply({ ok: true, selected: ids });
    } catch (error) {
      console.error("SOS setContacts error:", error);
      reply({ ok: false, message: "Could not save contacts" });
    }
  };

  return {
    register(socket, userId) {
      const id = String(userId);
      const name = socket.user?.username || "Someone";

      socket.on("sos:start", (data) => start(socket, id, name, data));
      socket.on("sos:location", (data) => updateLocation(id, data));
      socket.on("sos:cancel", () => cancel(id));
      socket.on("sos:ack", (data) => ack(id, data));
      socket.on("sos:getContacts", (cb) => getContacts(id, cb));
      socket.on("sos:setContacts", (data, cb) => setContacts(id, data, cb));

      // catch up after a refresh / login
      const mine = alerts.get(id);
      if (mine) socket.emit("sos:state", { sos: senderView(mine) });
      for (const a of alerts.values()) {
        if (a.status === "active" && a.contacts.includes(id)) {
          socket.emit("sos:alert", { sos: contactView(a) });
        }
      }
    },
  };
}