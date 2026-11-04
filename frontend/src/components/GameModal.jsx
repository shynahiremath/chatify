import { useGameStore } from "../store/useGameStore";
import { useAuthStore } from "../store/useAuthStore";

function GameModal() {
  const { game, invite, acceptInvite, declineInvite, move, leave, closeGame } =
    useGameStore();
  const authUser = useAuthStore((state) => state.authUser);

  if (!authUser) return null;

  // ---------- someone invited me ----------
  if (invite && !game) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 text-center">
          <p className="text-4xl mb-2">🎮</p>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Tic-Tac-Toe invite
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            <b>{invite.names.X}</b> wants to play with you.
          </p>

          <div className="flex gap-3 mt-5">
            <button
              onClick={declineInvite}
              className="flex-1 rounded-lg py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
            >
              Decline
            </button>
            <button
              onClick={acceptInvite}
              className="flex-1 rounded-lg py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium hover:from-cyan-600 hover:to-cyan-700"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!game) return null;

  // ---------- the game ----------
  const myMark = game.players.X === authUser._id ? "X" : "O";
  const opponentName = myMark === "X" ? game.names.O : game.names.X;
  const waiting = game.status === "invited";
  const finished = game.status === "finished";
  const myTurn = game.status === "playing" && game.turn === myMark;

  let statusText;
  if (waiting) {
    statusText = `Waiting for ${opponentName} to accept...`;
  } else if (finished) {
    if (game.reason === "draw") statusText = "It's a draw!";
    else if (game.winner === myMark) {
      statusText =
        game.reason === "forfeit"
          ? `${opponentName} left. You win!`
          : "You win! 🎉";
    } else {
      statusText = `${opponentName} wins`;
    }
  } else {
    statusText = myTurn ? "Your turn" : `${opponentName}'s turn`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 mb-1">
          <span>
            You are{" "}
            <b className={myMark === "X" ? "text-cyan-500" : "text-pink-500"}>
              {myMark}
            </b>
          </span>
          <span>vs {opponentName}</span>
        </div>

        <h2
          className={`text-center text-lg font-semibold mb-4 ${
            myTurn
              ? "text-cyan-600 dark:text-cyan-400"
              : "text-slate-800 dark:text-slate-100"
          }`}
        >
          {statusText}
        </h2>

        <div className="grid grid-cols-3 gap-2 w-fit mx-auto">
          {game.board.map((cell, i) => (
            <button
              key={i}
              onClick={() => move(i)}
              disabled={!myTurn || Boolean(cell)}
              aria-label={`Cell ${i + 1}${cell ? `, ${cell}` : ""}`}
              className={`size-20 sm:size-24 rounded-lg border text-4xl font-bold transition-colors disabled:cursor-not-allowed ${
                game.line?.includes(i)
                  ? "bg-green-500/20 border-green-500"
                  : "bg-slate-100 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700"
              } ${cell === "X" ? "text-cyan-500" : "text-pink-500"} ${
                myTurn && !cell ? "hover:bg-slate-200 dark:hover:bg-slate-700" : ""
              }`}
            >
              {cell}
            </button>
          ))}
        </div>

        <div className="mt-5 flex justify-center">
          {finished ? (
            <button
              onClick={closeGame}
              className="rounded-lg px-6 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium hover:from-cyan-600 hover:to-cyan-700"
            >
              Close
            </button>
          ) : (
            <button
              onClick={leave}
              className="rounded-lg px-6 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
            >
              {waiting ? "Cancel invite" : "Forfeit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default GameModal;