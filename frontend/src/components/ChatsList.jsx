import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";

function ChatsList() {
  const {
    getMyChatPartners,
    chats,
    isUsersLoading,
    setSelectedUser,
    selectedUser,
    searchQuery,
  } = useChatStore();
  const { onlineUsers } = useAuthStore();

  useEffect(() => {
    getMyChatPartners();
  }, [getMyChatPartners]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;
  if (chats.length === 0) return <NoChatsFound />;

  const query = searchQuery.trim().toLowerCase();
  const filteredChats = query
    ? chats.filter((chat) => chat.username.toLowerCase().includes(query))
    : chats;

  if (filteredChats.length === 0) {
    return (
      <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-6">
        No chats match &ldquo;{searchQuery}&rdquo;
      </p>
    );
  }

  return (
    <>
      {filteredChats.map((chat) => {
        const isActive = selectedUser?._id === chat._id;
        return (
          <div
            key={chat._id}
            className={`p-4 rounded-lg cursor-pointer transition-colors border ${
              isActive
                ? "bg-cyan-500/25 border-cyan-500/50"
                : "bg-cyan-500/10 border-transparent hover:bg-cyan-500/20"
            }`}
            onClick={() => setSelectedUser(chat)}
          >
            <div className="flex items-center gap-3">
              <div
                className={`avatar ${
                  onlineUsers.includes(chat._id) ? "online" : "offline"
                }`}
              >
                <div className="size-12 rounded-full">
                  <img
                    src={chat.profilePic || "/avatar.png"}
                    alt={chat.username}
                  />
                </div>
              </div>
              <div className="min-w-0">
                <h4 className="text-slate-800 dark:text-slate-200 font-medium truncate">
                  {chat.username}
                </h4>
                {chat.statusMessage && (
                  <p className="text-slate-500 dark:text-slate-400 text-xs truncate">{chat.statusMessage}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

export default ChatsList;
