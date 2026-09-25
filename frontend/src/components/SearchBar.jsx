import { SearchIcon, XIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

function SearchBar() {
  const { searchQuery, setSearchQuery, activeTab } = useChatStore();

  return (
    <div className="px-4 pb-2">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={activeTab === "chats" ? "Search chats..." : "Search contacts..."}
          aria-label="Search"
          className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 pl-9 pr-9 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default SearchBar;
