import { useChatStore } from "../store/useChatStore";

import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import ProfileHeader from "../components/ProfileHeader";
import ActiveTabSwitch from "../components/ActiveTabSwitch";
import SearchBar from "../components/SearchBar";
import ChatsList from "../components/ChatsList";
import ContactList from "../components/ContactList";
import ChatContainer from "../components/ChatContainer";
import NoConversationPlaceholder from "../components/NoConversationPlaceholder";

function ChatPage() {
  const { activeTab, selectedUser } = useChatStore();

  return (
    // full screen height on mobile, fixed 800px on larger screens
    <div className="relative w-full max-w-6xl h-[calc(100dvh-2rem)] md:h-[800px] md:max-h-[calc(100dvh-2rem)]">
      <BorderAnimatedContainer>
        {/* LEFT SIDE - on mobile it's hidden once a chat is open */}
        <div
          className={`w-full md:w-80 bg-white/70 dark:bg-slate-800/50 backdrop-blur-sm flex-col ${
            selectedUser ? "hidden md:flex" : "flex"
          }`}
        >
          <ProfileHeader />
          <ActiveTabSwitch />
          <SearchBar />

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {activeTab === "chats" ? <ChatsList /> : <ContactList />}
          </div>
        </div>

        {/* RIGHT SIDE - on mobile it's hidden until a chat is selected */}
        <div
          className={`flex-1 min-w-0 flex-col bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm ${
            selectedUser ? "flex" : "hidden md:flex"
          }`}
        >
          {selectedUser ? <ChatContainer /> : <NoConversationPlaceholder />}
        </div>
      </BorderAnimatedContainer>
    </div>
  );
}

export default ChatPage;
