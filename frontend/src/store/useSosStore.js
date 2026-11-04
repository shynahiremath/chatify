import { create } from "zustand";
import toast from "react-hot-toast";

// The socket lives here so this store doesn't import useAuthStore.
let socketRef = null;
let watchId = null;
let lastSent = 0;
let audioCtx = null;

// alerts that were already closed, so a late alert can't pop them back up
const resolvedIds = new Set();

const MAX_CONTACTS = 5;

// keep sending my position to the server while my SOS is active
const startWatch = () => {
  if (!navigator.geolocation || watchId != null) return;
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (Date.now() - lastSent < 15000) return;
      lastSent = Date.now();
      socketRef?.emit("sos:location", {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 10000 }
  );
};

const stopWatch = () => {
  if (watchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
};

// beep + vibrate. Browsers block sound until the user has clicked on the page
// once, so everything is wrapped in try/catch and fails silently.
const alarm = () => {
  try {
    navigator.vibrate?.([300, 150, 300, 150, 300]);
  } catch {
    /* ignore */
  }
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
  } catch {
    /* ignore */
  }
};

export const useSosStore = create((set, get) => ({
  sos: null, // my own active SOS
  starting: false, // true between tapping SOS and the server confirming
  incoming: [], // SOS alerts from people who picked me as a contact

  setupOpen: false,
  users: [],
  selected: [],
  loadingContacts: false,
  savingContacts: false,

  bindSocket: (socket) => {
    socketRef = socket;

    socket.on("sos:state", ({ sos }) => {
      set({ sos, starting: false });
      if (sos) startWatch();
      else stopWatch();
    });

    socket.on("sos:alert", ({ sos }) => {
      if (resolvedIds.has(sos.id)) return; // already closed, ignore late alert
      set((state) => {
        const exists = state.incoming.some((a) => a.id === sos.id);
        return {
          incoming: exists
            ? state.incoming.map((a) => (a.id === sos.id ? sos : a))
            : [...state.incoming, sos],
        };
      });
      alarm();
    });

    socket.on("sos:resolved", ({ alertId, from, message }) => {
      resolvedIds.add(alertId);
      // remove by alert id, and also any alert from that sender
      set((state) => ({
        incoming: state.incoming.filter(
          (a) => a.id !== alertId && (!from || a.from !== from)
        ),
      }));
      if (message) toast(message, { icon: "🆘", duration: 8000 });
    });

    socket.on("sos:error", ({ message }) => {
      set({ starting: false });
      toast.error(message, { duration: 8000 });
    });
  },

  unbindSocket: () => {
    if (socketRef) {
      socketRef.off("sos:state");
      socketRef.off("sos:alert");
      socketRef.off("sos:resolved");
      socketRef.off("sos:error");
    }
    socketRef = null;
    stopWatch();
    resolvedIds.clear();
    set({ sos: null, starting: false, incoming: [], setupOpen: false });
  },

  // ---------- me pressing SOS ----------
  trigger: () => {
    if (!socketRef || get().sos || get().starting) return;
    set({ starting: true });

    const emit = (location) => socketRef?.emit("sos:start", { location });

    if (!navigator.geolocation) return emit(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => emit({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        toast("Couldn't get your location, sending SOS without it", { icon: "📍" });
        emit(null);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
    );
  },

  // "I'm safe"
  cancel: () => {
    socketRef?.emit("sos:cancel");
    stopWatch();
    set({ sos: null });
  },

  // ---------- me being someone's emergency contact ----------
  ack: (alertId) => {
    resolvedIds.add(alertId);
    socketRef?.emit("sos:ack", { alertId });
    set((state) => ({ incoming: state.incoming.filter((a) => a.id !== alertId) }));
  },

  // ---------- choosing my emergency contacts ----------
  openSetup: () => {
    set({ setupOpen: true });
    get().loadContacts();
  },
  closeSetup: () => set({ setupOpen: false }),

  loadContacts: () => {
    if (!socketRef) {
      toast.error("Not connected yet, refresh the page");
      return;
    }
    set({ loadingContacts: true });
    socketRef.emit("sos:getContacts", (res) => {
      if (res?.ok) set({ users: res.users, selected: res.selected });
      else toast.error(res?.message || "Could not load contacts");
      set({ loadingContacts: false });
    });
  },

  toggleContact: (id) => {
    const { selected } = get();
    if (selected.includes(id)) {
      set({ selected: selected.filter((x) => x !== id) });
    } else if (selected.length >= MAX_CONTACTS) {
      toast(`You can pick up to ${MAX_CONTACTS} contacts`);
    } else {
      set({ selected: [...selected, id] });
    }
  },

  saveContacts: () => {
    if (!socketRef) return;
    set({ savingContacts: true });
    socketRef.emit("sos:setContacts", { contacts: get().selected }, (res) => {
      if (res?.ok) {
        toast.success("Emergency contacts saved");
        set({ setupOpen: false });
      } else {
        toast.error(res?.message || "Could not save contacts");
      }
      set({ savingContacts: false });
    });
  },
}));