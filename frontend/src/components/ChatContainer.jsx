import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { getDateLabel, isDifferentDay } from "../lib/dateUtils";
import ChatHeader from "./ChatHeader";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";
import MessageInput from "./MessageInput";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import MessageBubble from "./MessageBubble";

function ChatContainer() {
  const {
    selectedUser,
    getMessagesByUserId,
    messages,
    isMessagesLoading,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

  const [highlightedId, setHighlightedId] = useState(null);
  const highlightTimeoutRef = useRef(null);

  useEffect(() => {
    getMessagesByUserId(selectedUser._id);
    subscribeToMessages();

    // clean up so listeners don't pile up when switching chats
    return () => unsubscribeFromMessages();
  }, [
    selectedUser,
    getMessagesByUserId,
    subscribeToMessages,
    unsubscribeFromMessages,
  ]);

  // scroll down only when a NEW message arrives, not when an old one is
  // edited / deleted / reacted to (that would yank the chat to the bottom)
  const lastMessageId = messages[messages.length - 1]?._id;
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lastMessageId]);

  // clicking a reply's quote scrolls to the original message and flashes it
  const jumpToMessage = (messageId) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(messageId);
    clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => setHighlightedId(null), 1500);
  };

  useEffect(() => () => clearTimeout(highlightTimeoutRef.current), []);

  return (
    <>
      <ChatHeader />

      <div className="flex-1 px-4 md:px-6 overflow-y-auto py-8">
        {messages.length > 0 && !isMessagesLoading ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, index) => {
              const showDateSeparator =
                index === 0 ||
                isDifferentDay(messages[index - 1].createdAt, msg.createdAt);

              return (
                <div key={msg._id} id={`msg-${msg._id}`} className="space-y-6">
                  {/* DATE SEPARATOR */}
                  {showDateSeparator && (
                    <div className="flex justify-center">
                      <span className="text-xs text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-full px-3 py-1">
                        {getDateLabel(msg.createdAt)}
                      </span>
                    </div>
                  )}

                  <MessageBubble
                    message={msg}
                    isMine={msg.senderId === authUser._id}
                    isHighlighted={highlightedId === msg._id}
                    onJumpToMessage={jumpToMessage}
                  />
                </div>
              );
            })}
            {/* scroll target */}
            <div ref={messageEndRef} />
          </div>
        ) : isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : (
          <NoChatHistoryPlaceholder name={selectedUser.username} />
        )}
      </div>

      <MessageInput />
    </>
  );
}

export default ChatContainer;
