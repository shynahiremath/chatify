import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { useScheduleStore } from "./useScheduleStore";
import { useGameStore } from "./useGameStore";
import { useSosStore } from "./useSosStore"; // NEW SOS

const BASE_URL =
  import.meta.env.MODE === "development" ? "http://localhost:3000" : "/";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false, // true while an avatar/username/status save is in flight
  socket: null,
  onlineUsers: [],

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("Error in authCheck:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully!");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Signup failed");
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Logged in successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error("Error logging out");
      console.log("Logout error:", error);
    }
  },

  // data can be { profilePic } and/or { username } and/or { statusMessage }.
  // Returns true/false so callers (inline editors) know whether to exit edit mode.
  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
      return true;
    } catch (error) {
      console.log("Error in update profile:", error);
      toast.error(error.response?.data?.message || "Update failed");
      return false;
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket?.connected) return;

    // withCredentials sends the jwt cookie so socketAuthMiddleware can read it
    const socket = io(BASE_URL, { withCredentials: true });
    socket.connect();

    set({ socket });

    // listen for the online users list sent by the server
    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    // a reminder fired (or fired while you were offline)
    socket.on("reminder", ({ id, text, missed }) => {
      toast(`${missed ? "Missed reminder" : "Reminder"}: ${text}`, {
        icon: "⏰",
        duration: 15000,
      });
      useScheduleStore.getState().removeSent(id);
    });

    // one of my scheduled messages was just sent
    socket.on("scheduledSent", ({ scheduledId }) => {
      toast.success("Your scheduled message was sent");
      useScheduleStore.getState().removeSent(scheduledId);
    });

    // mini-games (invites, moves, results)
    useGameStore.getState().bindSocket(socket);

    // NEW SOS: emergency alerts
    useSosStore.getState().bindSocket(socket);
  },

  disconnectSocket: () => {
    useGameStore.getState().unbindSocket();
    useSosStore.getState().unbindSocket(); // NEW SOS
    if (get().socket?.connected) get().socket.disconnect();
    set({ socket: null, onlineUsers: [] });
  },
}));