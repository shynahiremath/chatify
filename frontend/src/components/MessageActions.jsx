import { useEffect, useRef, useState } from "react";
import {
  ChevronDownIcon,
  CopyIcon,
  PencilIcon,
  ReplyIcon,
  Trash2Icon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

// Keep this list identical to ALLOWED_REACTIONS in message.controller.js.
// (the heart is written with escapes so the invisible variation selector can't get lost)
const QUICK_REACTIONS = [
  "\u{1F44D}", // thumbs up
  "\u2764\uFE0F", // red heart
  "\u{1F602}", // laughing
  "\u{1F62E}", // surprised
  "\u{1F622}", // sad
  "\u{1F64F}", // folded hands
];

function MessageActions({ message, isMine }) {
  const { authUser } = useAuthStore();
  const { startReply, startEdit, deleteMessage, toggleReaction } = useChatStore();

  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);

  const myReaction = message.reactions?.find((r) => r.userId === authUser._id)?.emoji;
  const hasText = Boolean(message.text);

  // close when clicking anywhere else
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const toggleMenu = () => {
    if (!open && buttonRef.current) {
      // not enough room below (near the input box)? open the menu upwards
      const rect = buttonRef.current.getBoundingClientRect();
      setOpenUp(window.innerHeight - rect.bottom < 320);
    }
    setOpen((prev) => !prev);
  };

  const close = () => setOpen(false);

  const handleCopy = async () => {
    close();
    try {
      await navigator.clipboard.writeText(message.text);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  const handleDelete = () => {
    close();
    if (window.confirm("Delete this message for everyone?")) {
      deleteMessage(message._id);
    }
  };

  const itemClass =
    "w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors";

  return (
    <div ref={wrapperRef} className="contents">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        aria-label="Message options"
        aria-expanded={open}
        className={`absolute top-1 right-1 z-10 rounded-full bg-black/25 p-0.5 text-white/90 hover:bg-black/40 transition-opacity focus:opacity-100 ${
          open ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
        }`}
      >
        <ChevronDownIcon className="size-4" />
      </button>

      {open && (
        <div
          className={`absolute z-30 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-xl ${
            openUp ? "bottom-full mb-1" : "top-full mt-1"
          } ${isMine ? "right-0" : "left-0"}`}
        >
          {/* quick reactions */}
          <div className="flex justify-between px-2 py-2 border-b border-slate-200 dark:border-slate-700">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  close();
                  toggleReaction(message._id, emoji);
                }}
                className={`size-8 rounded-full text-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                  myReaction === emoji ? "bg-cyan-500/30" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="py-1 text-sm">
            <button
              type="button"
              className={itemClass}
              onClick={() => {
                close();
                startReply(message);
              }}
            >
              <ReplyIcon className="size-4" /> Reply
            </button>

            {hasText && (
              <button type="button" className={itemClass} onClick={handleCopy}>
                <CopyIcon className="size-4" /> Copy
              </button>
            )}

            {isMine && hasText && (
              <button
                type="button"
                className={itemClass}
                onClick={() => {
                  close();
                  startEdit(message);
                }}
              >
                <PencilIcon className="size-4" /> Edit
              </button>
            )}

            {isMine && (
              <button
                type="button"
                className={`${itemClass} text-red-400`}
                onClick={handleDelete}
              >
                <Trash2Icon className="size-4" /> Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MessageActions;
