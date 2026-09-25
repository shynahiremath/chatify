import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";

function ContactList() {
  const {
    getAllContacts,
    allContacts,
    setSelectedUser,
    selectedUser,
    isUsersLoading,
    searchQuery,
  } = useChatStore();
  const { onlineUsers } = useAuthStore();

  useEffect(() => {
    getAllContacts();
  }, [getAllContacts]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;

  const query = searchQuery.trim().toLowerCase();
  const filteredContacts = query
    ? allContacts.filter((c) => c.username.toLowerCase().includes(query))
    : allContacts;

  if (filteredContacts.length === 0) {
    return (
      <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-6">
        {query ? <>No contacts match &ldquo;{searchQuery}&rdquo;</> : "No contacts yet"}
      </p>
    );
  }

  return (
    <>
      {filteredContacts.map((contact) => {
        const isActive = selectedUser?._id === contact._id;
        return (
          <div
            key={contact._id}
            className={`p-4 rounded-lg cursor-pointer transition-colors border ${
              isActive
                ? "bg-cyan-500/25 border-cyan-500/50"
                : "bg-cyan-500/10 border-transparent hover:bg-cyan-500/20"
            }`}
            onClick={() => setSelectedUser(contact)}
          >
            <div className="flex items-center gap-3">
              <div
                className={`avatar ${
                  onlineUsers.includes(contact._id) ? "online" : "offline"
                }`}
              >
                <div className="size-12 rounded-full">
                  <img
                    src={contact.profilePic || "/avatar.png"}
                    alt={contact.username}
                  />
                </div>
              </div>
              <div className="min-w-0">
                <h4 className="text-slate-800 dark:text-slate-200 font-medium truncate">
                  {contact.username}
                </h4>
                {contact.statusMessage && (
                  <p className="text-slate-500 dark:text-slate-400 text-xs truncate">{contact.statusMessage}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

export default ContactList;
