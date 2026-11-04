import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

export const useScheduleStore = create((set, get) => ({
  items: [],
  isLoading: false,
  isSaving: false,

  fetchScheduled: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get("/scheduled");
      set({ items: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load scheduled items");
    } finally {
      set({ isLoading: false });
    }
  },

  schedule: async ({ kind, receiverId, text, sendAt }) => {
    set({ isSaving: true });
    try {
      const res = await axiosInstance.post("/scheduled", { kind, receiverId, text, sendAt });
      const next = [...get().items, res.data].sort(
        (a, b) => new Date(a.sendAt) - new Date(b.sendAt)
      );
      set({ items: next });
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not schedule it");
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  cancel: async (id) => {
    try {
      await axiosInstance.delete(`/scheduled/${id}`);
      set({ items: get().items.filter((item) => item._id !== id) });
      toast.success("Cancelled");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not cancel it");
    }
  },

  removeSent: (id) => set({ items: get().items.filter((item) => item._id !== id) }),
}));