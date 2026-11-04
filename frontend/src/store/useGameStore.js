import { create } from "zustand";
import toast from "react-hot-toast";

// The socket lives here instead of being imported from useAuthStore,
// so the two stores don't import each other.
let socketRef = null;

// Games I closed myself. The server's final "game over" update for them
// should not pop the modal back open.
const dismissed = new Set();

export const useGameStore = create((set, get) => ({
  game: null,   // the game I'm in (waiting, playing or just finished)
  invite: null, // an invite someone sent me

  bindSocket: (socket) => {
    socketRef = socket;

    socket.on("game:invite", ({ game }) => set({ invite: game }));

    socket.on("game:update", ({ game }) => {
      if (dismissed.has(game.id)) return;
      const { invite } = get();
      set({ game, invite: invite?.id === game.id ? null : invite });
    });

    socket.on("game:closed", ({ gameId, message }) => {
      toast(message, { icon: "🎮" });
      const { game, invite } = get();
      set({
        game: game?.id === gameId ? null : game,
        invite: invite?.id === gameId ? null : invite,
      });
    });

    socket.on("game:error", ({ message }) => toast.error(message));
  },

  unbindSocket: () => {
    if (socketRef) {
      socketRef.off("game:invite");
      socketRef.off("game:update");
      socketRef.off("game:closed");
      socketRef.off("game:error");
    }
    socketRef = null;
    set({ game: null, invite: null });
  },

  sendInvite: (to) => socketRef?.emit("game:invite", { to }),

  acceptInvite: () => {
    const { invite } = get();
    if (!invite) return;
    socketRef?.emit("game:accept", { gameId: invite.id });
    set({ invite: null });
  },

  declineInvite: () => {
    socketRef?.emit("game:leave");
    set({ invite: null });
  },

  move: (index) => {
    const { game } = get();
    if (game) socketRef?.emit("game:move", { gameId: game.id, index });
  },

  // cancel an invite or forfeit a running game
  leave: () => {
    const { game } = get();
    if (game) dismissed.add(game.id);
    socketRef?.emit("game:leave");
    set({ game: null });
  },

  // close the result screen of a finished game
  closeGame: () => set({ game: null }),
}));