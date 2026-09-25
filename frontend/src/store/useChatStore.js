import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  allContacts: [],
  chats: [],
  messages: [],
  activeTab: "chats",
  selectedUser: null,
  searchQuery: "", // sidebar search text
  typingUsers: {}, // NEW: { userId: true } for users currently typing to me
  lastSeenMap: {}, // NEW: { userId: ISO date } updated live when someone goes offline
  replyingTo: null, // NEW: the message I'm currently replying to
  editingMessage: null, // NEW: the message I'm currently editing
  isUsersLoading: false,
  isMessagesLoading: false,
  isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === true,
  toggleSound: () => {
    localStorage.setItem("isSoundEnabled", !get().isSoundEnabled);
    set({ isSoundEnabled: !get().isSoundEnabled });
  },

  // clear the search box when switching between Chats / Contacts
  setActiveTab: (tab) => set({ activeTab: tab, searchQuery: "" }),
  setSelectedUser: (selectedUser) =>
    set({ selectedUser, replyingTo: null, editingMessage: null }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  // ---------- message actions ----------
  startReply: (message) =>
    set({
      // keep only what the quote preview needs
      replyingTo: {
        _id: message._id,
        text: message.text,
        image: message.image,
        senderId: message.senderId,
        isDeleted: message.isDeleted,
      },
      editingMessage: null,
    }),
  startEdit: (message) => set({ editingMessage: message, replyingTo: null }),
  clearComposerMode: () => set({ replyingTo: null, editingMessage: null }),

  // replace a message with its updated version (edit / delete / reaction).
  // Also refreshes the quote preview in any message that replies to it.
  applyMessageUpdate: (updated) => {
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m._id === updated._id) return updated;
        if (m.replyTo?._id === updated._id) {
          return {
            ...m,
            replyTo: {
              ...m.replyTo,
              text: updated.text,
              image: updated.image,
              isDeleted: updated.isDeleted,
            },
          };
        }
        return m;
      }),
    }));
  },

  editMessage: async (messageId, text) => {
    try {
      const res = await axiosInstance.patch(`/messages/edit/${messageId}`, { text });
      get().applyMessageUpdate(res.data);
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not edit message");
      return false;
    }
  },

  deleteMessage: async (messageId) => {
    try {
      const res = await axiosInstance.delete(`/messages/delete/${messageId}`);
      get().applyMessageUpdate(res.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete message");
    }
  },

  // same emoji again removes my reaction, a different one replaces it (server decides)
  toggleReaction: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.put(`/messages/react/${messageId}`, { emoji });
      get().applyMessageUpdate(res.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not react");
    }
  },

  // ---------- things we send to the server ----------
  emitTyping: (receiverId) => {
    useAuthStore.getState().socket?.emit("typing", { to: receiverId });
  },
  emitStopTyping: (receiverId) => {
    useAuthStore.getState().socket?.emit("stopTyping", { to: receiverId });
  },
  markMessagesAsRead: (senderId) => {
    useAuthStore.getState().socket?.emit("markMessagesRead", { senderId });
  },

  // ---------- things the server tells us (independent of the open chat) ----------
  subscribeToSocketEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("typing", ({ from }) => {
      set((state) => ({ typingUsers: { ...state.typingUsers, [from]: true } }));
    });

    socket.on("stopTyping", ({ from }) => {
      set((state) => ({ typingUsers: { ...state.typingUsers, [from]: false } }));
    });

    // someone went offline: remember when, and clear any stuck "typing..."
    socket.on("userLastSeen", ({ userId, lastSeen }) => {
      set((state) => ({
        lastSeenMap: { ...state.lastSeenMap, [userId]: lastSeen },
        typingUsers: { ...state.typingUsers, [userId]: false },
      }));
    });

    // the person I messaged came online -> my "sent" messages become "delivered"
    socket.on("messagesDelivered", ({ receiverId }) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.receiverId === receiverId && m.status === "sent"
            ? { ...m, status: "delivered" }
            : m
        ),
      }));
    });

    // the person I messaged opened the chat -> my messages become "read"
    // the other person edited / deleted / reacted to a message
    socket.on("messageUpdated", (updated) => {
      get().applyMessageUpdate(updated);
    });

    socket.on("messagesRead", ({ by }) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.receiverId === by && m.status !== "read"
            ? { ...m, status: "read" }
            : m
        ),
      }));
    });
  },

  unsubscribeFromSocketEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("typing");
    socket.off("stopTyping");
    socket.off("userLastSeen");
    socket.off("messagesDelivered");
    socket.off("messagesRead");
    socket.off("messageUpdated");
  },

  getAllContacts: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/contacts");
      set({ allContacts: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMyChatPartners: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/chats");
      set({ chats: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessagesByUserId: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });

      // tell the server I've now seen everything they sent me
      const hasUnread = res.data.some(
        (m) => m.senderId === userId && m.status !== "read"
      );
      if (hasUnread) get().markMessagesAsRead(userId);
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, replyingTo } = get();
    const { authUser } = useAuthStore.getState();

    const tempId = `temp-${Date.now()}`;

    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text,
      image: messageData.image,
      createdAt: new Date().toISOString(),
      replyTo: replyingTo, // quote preview shows immediately
      reactions: [],
      status: "sent",
      isOptimistic: true,
    };

    // show the message immediately
    set({ messages: [...get().messages, optimisticMessage], replyingTo: null });

    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        { ...messageData, replyTo: replyingTo?._id }
      );
      // swap the temp message for the saved one.
      // uses get() so any message that arrived in the meantime is not lost
      set({
        messages: get().messages.map((m) => (m._id === tempId ? res.data : m)),
      });
    } catch (error) {
      // remove only the failed optimistic message
      set({ messages: get().messages.filter((m) => m._id !== tempId) });
      toast.error(error.response?.data?.message || "Something went wrong");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("newMessage", (newMessage) => {
      // only show it if it came from the chat that's currently open
      if (newMessage.senderId !== selectedUser._id) return;
      set({ messages: [...get().messages, newMessage] });
      // I'm looking at this chat right now, so it counts as read
      get().markMessagesAsRead(selectedUser._id);
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) socket.off("newMessage");
  },
}));