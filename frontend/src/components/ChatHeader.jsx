import { useEffect } from "react";
import { ArrowLeftIcon, XIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { formatLastSeen } from "../lib/dateUtils";

function ChatHeader() {
  const { selectedUser, setSelectedUser, typingUsers, lastSeenMap } =
    useChatStore();
  const { onlineUsers } = useAuthStore();
  const isOnline = onlineUsers.includes(selectedUser._id);
  const isTyping = typingUsers[selectedUser._id];
  // live value (set when they go offline this session) wins over the fetched one
  const lastSeen = lastSeenMap[selectedUser._id] ?? selectedUser.lastSeen;

  // a custom status ("Busy", "At work") replaces the plain Online/Offline text,
  // but typing always wins since it's more current
  const statusText = isTyping
    ? "typing..."
    : selectedUser.statusMessage
      ? selectedUser.statusMessage
      : isOnline
        ? "Online"
        : formatLastSeen(lastSeen);
  const statusColor = isTyping
    ? "text-cyan-500 dark:text-cyan-400"
    : !isOnline && !selectedUser.statusMessage
      ? "text-slate-500 dark:text-slate-400"
      : isOnline
        ? "text-green-600 dark:text-green-400"
        : "text-slate-500 dark:text-slate-400";

  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key !== "Escape") return;
      // first Escape cancels a reply/edit in progress, the next one closes the chat
      const { replyingTo, editingMessage, clearComposerMode } =
        useChatStore.getState();
      if (replyingTo || editingMessage) {
        clearComposerMode();
        return;
      }
      setSelectedUser(null);
    };
    window.addEventListener("keydown", handleEscKey);
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [setSelectedUser]);

  return (
    <div className="flex justify-between items-center bg-white/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/50 max-h-[84px] px-4 md:px-6 flex-1">
      <div className="flex items-center space-x-3 min-w-0">
        {/* Back button: mobile only */}
        <button
          onClick={() => setSelectedUser(null)}
          aria-label="Back to chats"
          className="md:hidden text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 -ml-1"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>

        <div className={`avatar ${isOnline ? "online" : "offline"}`}>
          <div className="w-12 rounded-full">
            <img
              src={selectedUser.profilePic || "/avatar.png"}
              alt={selectedUser.username}
            />
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="text-slate-800 dark:text-slate-200 font-medium truncate">
            {selectedUser.username}
          </h3>
          <p className={`text-sm truncate ${statusColor}`}>{statusText}</p>
        </div>
      </div>

      {/* Close button: desktop only (mobile uses the back arrow) */}
      <button
        onClick={() => setSelectedUser(null)}
        aria-label="Close chat"
        className="hidden md:block"
      >
        <XIcon className="w-5 h-5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer" />
      </button>
    </div>
  );
}

export default ChatHeader;
