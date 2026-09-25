// Returns "Today", "Yesterday", or a readable date like "Mon, 14 Sep 2026"
export function getDateLabel(dateInput) {
  const date = new Date(dateInput);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

// True when two timestamps fall on different calendar days
export function isDifferentDay(a, b) {
  return new Date(a).toDateString() !== new Date(b).toDateString();
}

function formatTime(dateInput) {
  return new Date(dateInput).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

// "Last seen today at 4:31 PM", "Last seen yesterday at ...", "Last seen Mon, 14 Sep at ..."
// Falls back to "Offline" when we have no last-seen time yet
export function formatLastSeen(dateInput) {
  if (!dateInput) return "Offline";

  const label = getDateLabel(dateInput);
  const time = formatTime(dateInput);

  if (label === "Today") return `Last seen today at ${time}`;
  if (label === "Yesterday") return `Last seen yesterday at ${time}`;
  return `Last seen ${label} at ${time}`;
}
