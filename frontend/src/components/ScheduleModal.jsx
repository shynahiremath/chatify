import { useEffect, useState } from "react";
import { BellIcon, SendIcon, Trash2Icon, XIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useChatStore } from "../store/useChatStore";
import { useScheduleStore } from "../store/useScheduleStore";

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatWhen(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ScheduleModal({ initialText = "", onClose, onScheduled }) {
  const { selectedUser } = useChatStore();
  const { items, isLoading, isSaving, fetchScheduled, schedule, cancel } =
    useScheduleStore();

  const [kind, setKind] = useState("message");
  const [text, setText] = useState(initialText);
  const [when, setWhen] = useState("");

  useEffect(() => {
    fetchScheduled();
  }, [fetchScheduled]);

  const inOneHour = () => {
    const d = new Date();
    d.setHours(d.getHours() + 1, d.getMinutes(), 0, 0);
    return d;
  };
  const tomorrowAt9 = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return toast.error("Write something first");
    if (!when) return toast.error("Pick a date and time");

    const date = new Date(when);
    if (date.getTime() < Date.now() + 5000) {
      return toast.error("Pick a time in the future");
    }

    const ok = await schedule({
      kind,
      receiverId: kind === "message" ? selectedUser._id : undefined,
      text: text.trim(),
      sendAt: date.toISOString(),
    });
    if (ok) {
      toast.success(`Scheduled for ${formatWhen(date.toISOString())}`);
      onScheduled?.();
      onClose();
    }
  };

  const visibleItems = items.filter(
    (item) => item.kind === "reminder" || item.receiverId === selectedUser._id
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-800 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Schedule
          </h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <XIcon className="size-5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind("message")}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                kind === "message"
                  ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                  : "bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400"
              }`}
            >
              <SendIcon className="size-4" />
              Send to {selectedUser.username}
            </button>
            <button
              type="button"
              onClick={() => setKind("reminder")}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                kind === "reminder"
                  ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                  : "bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400"
              }`}
            >
              <BellIcon className="size-4" />
              Remind me
            </button>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={
              kind === "message" ? "Message to send later..." : "What should I remind you about?"
            }
            className="w-full rounded-lg bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
          />

          <div>
            <input
              type="datetime-local"
              value={when}
              min={toLocalInputValue(new Date())}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full rounded-lg bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setWhen(toLocalInputValue(inOneHour()))}
                className="text-xs rounded-full px-3 py-1 bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                In 1 hour
              </button>
              <button
                type="button"
                onClick={() => setWhen(toLocalInputValue(tomorrowAt9()))}
                className="text-xs rounded-full px-3 py-1 bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Tomorrow 9 AM
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg py-2 font-medium disabled:opacity-60"
          >
            {isSaving ? "Scheduling..." : kind === "message" ? "Schedule message" : "Set reminder"}
          </button>
        </form>

        <div className="mt-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            Upcoming
          </p>
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : visibleItems.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing scheduled yet.</p>
          ) : (
            <ul className="space-y-2">
              {visibleItems.map((item) => (
                <li
                  key={item._id}
                  className="flex items-start gap-2 rounded-lg bg-slate-100 dark:bg-slate-900/40 px-3 py-2"
                >
                  {item.kind === "reminder" ? (
                    <BellIcon className="size-4 mt-0.5 text-cyan-500 shrink-0" />
                  ) : (
                    <SendIcon className="size-4 mt-0.5 text-cyan-500 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700 dark:text-slate-200 truncate">
                      {item.text}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatWhen(item.sendAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => cancel(item._id)}
                    aria-label="Cancel"
                    className="text-slate-400 hover:text-red-400"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScheduleModal;