import { useAuthStore } from "../store/useAuthStore";

function ChatPage() {
  const { logout } = useAuthStore();

  return (
    <div className="relative z-10 text-white">
      ChatPage
      <button onClick={logout}>Logout</button>
    </div>
  );
}

export default ChatPage;