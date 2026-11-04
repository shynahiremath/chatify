import User from "../models/user.js";

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],            // diagonals
];

const INVITE_TTL_MS = 60 * 1000;

function getWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { mark: board[a], line: [a, b, c] };
    }
  }
  return null;
}

// io and getSocketId are passed in, so this file never imports socket.js
// (that would be a circular import).
export function createGameManager(io, getSocketId) {
  const games = new Map();    // gameId -> game
  const userGame = new Map(); // userId -> gameId (one game per user)
  let counter = 0;

  const send = (userId, event, payload) => {
    const socketId = getSocketId(userId);
    if (socketId) io.to(socketId).emit(event, payload);
  };

  const sendBoth = (game, event, payload) => {
    send(game.players.X, event, payload);
    send(game.players.O, event, payload);
  };

  // what the clients are allowed to see (no timers etc.)
  const view = (g) => ({
    id: g.id,
    players: g.players,
    names: g.names,
    board: g.board,
    turn: g.turn,
    status: g.status, // "invited" | "playing" | "finished"
    winner: g.winner, // "X" | "O" | null
    line: g.line,
    reason: g.reason, // "win" | "draw" | "forfeit" | null
  });

  const removeGame = (g) => {
    clearTimeout(g.timer);
    games.delete(g.id);
    if (userGame.get(g.players.X) === g.id) userGame.delete(g.players.X);
    if (userGame.get(g.players.O) === g.id) userGame.delete(g.players.O);
  };

  // cancelled / declined / expired invite
  const close = (g, message) => {
    sendBoth(g, "game:closed", { gameId: g.id, message });
    removeGame(g);
  };

  // game over: tell both players the final board, then free them for a new game
  const finish = (g, { winner = null, line = null, reason }) => {
    g.status = "finished";
    g.winner = winner;
    g.line = line;
    g.reason = reason;
    sendBoth(g, "game:update", { game: view(g) });
    removeGame(g);
  };

  const invite = async (socket, userId, data) => {
    const to = String(data?.to || "");
    if (!to || to === userId) return;

    try {
      if (userGame.has(userId)) {
        return socket.emit("game:error", { message: "Finish your current game first" });
      }
      if (userGame.has(to)) {
        return socket.emit("game:error", { message: "That user is already in a game" });
      }
      if (!getSocketId(to)) {
        return socket.emit("game:error", { message: "That user is offline" });
      }

      const users = await User.find({ _id: { $in: [userId, to] } }).select("username");
      const nameOf = (id) =>
        users.find((u) => String(u._id) === id)?.username || "Player";

      // the await above let time pass, so check again
      if (userGame.has(userId) || userGame.has(to) || !getSocketId(to)) {
        return socket.emit("game:error", { message: "Could not start the game, try again" });
      }

      const game = {
        id: `g${Date.now()}-${++counter}`,
        players: { X: userId, O: to }, // inviter is X and goes first
        names: { X: nameOf(userId), O: nameOf(to) },
        board: Array(9).fill(null),
        turn: "X",
        status: "invited",
        winner: null,
        line: null,
        reason: null,
        timer: null,
      };

      games.set(game.id, game);
      userGame.set(userId, game.id);
      userGame.set(to, game.id);

      game.timer = setTimeout(() => {
        const g = games.get(game.id);
        if (g && g.status === "invited") close(g, "Invite expired");
      }, INVITE_TTL_MS);

      send(to, "game:invite", { game: view(game) });
      send(userId, "game:update", { game: view(game) }); // inviter sees "waiting..."
    } catch (error) {
      console.error("game invite error:", error);
      socket.emit("game:error", { message: "Could not send the invite" });
    }
  };

  const accept = (userId, data) => {
    const g = games.get(data?.gameId);
    if (!g || g.status !== "invited" || g.players.O !== userId) return;

    clearTimeout(g.timer);
    g.status = "playing";
    sendBoth(g, "game:update", { game: view(g) });
  };

  const move = (userId, data) => {
    const g = games.get(data?.gameId);
    if (!g || g.status !== "playing") return;

    const mark =
      g.players.X === userId ? "X" : g.players.O === userId ? "O" : null;
    if (!mark || g.turn !== mark) return; // not your game or not your turn

    const index = data.index;
    if (!Number.isInteger(index) || index < 0 || index > 8) return;
    if (g.board[index]) return; // cell already taken

    g.board[index] = mark;

    const win = getWinner(g.board);
    if (win) return finish(g, { winner: win.mark, line: win.line, reason: "win" });
    if (g.board.every(Boolean)) return finish(g, { reason: "draw" });

    g.turn = mark === "X" ? "O" : "X";
    sendBoth(g, "game:update", { game: view(g) });
  };

  // used for: decline, cancel invite, forfeit, and disconnect
  const leave = (userId) => {
    const g = games.get(userGame.get(userId));
    if (!g) return;

    if (g.status === "invited") {
      return close(g, g.players.X === userId ? "Invite cancelled" : "Invite declined");
    }

    const leaverMark = g.players.X === userId ? "X" : "O";
    finish(g, { winner: leaverMark === "X" ? "O" : "X", reason: "forfeit" });
  };

  return {
    register(socket, userId) {
      const id = String(userId);
      socket.on("game:invite", (data) => invite(socket, id, data));
      socket.on("game:accept", (data) => accept(id, data));
      socket.on("game:move", (data) => move(id, data));
      socket.on("game:leave", () => leave(id));
    },
    onDisconnect(userId) {
      leave(String(userId));
    },
  };
}