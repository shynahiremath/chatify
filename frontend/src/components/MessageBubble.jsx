import {
  BanIcon,
  CheckCheckIcon,
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  FileIcon,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import MessageActions from "./MessageActions";

// A saved voice message always has an audio url. While a voice message is
// still being sent (optimistic), it has no url yet. An empty `voice` object
// (for example one created by a schema default) must NOT count as a voice
// message, otherwise every text message shows a fake "Voice message" box.
function isVoiceMessage(message) {
  if (!message?.voice) return false;
  if (message.voice.url) return true;
  return Boolean(message.isOptimistic);
}

// Message delivery status
function MessageStatus({ message }) {
  if (message.isOptimistic) {
    return (
      <ClockIcon
        className="size-3.5 opacity-75"
        aria-label="Sending"
      />
    );
  }

  const status = message.status || "delivered";

  if (status === "sent") {
    return (
      <CheckIcon
        className="size-3.5 text-white/70"
        aria-label="Sent"
      />
    );
  }

  if (status === "delivered") {
    return (
      <CheckCheckIcon
        className="size-3.5 text-white/70"
        aria-label="Delivered"
      />
    );
  }

  return (
    <CheckCheckIcon
      className="size-3.5 text-blue-900"
      aria-label="Read"
    />
  );
}

// Reply preview
function ReplyPreview({ reply, onJump }) {
  const { authUser } = useAuthStore();
  const { selectedUser } = useChatStore();

  const label =
    reply.senderId === authUser?._id
      ? "You"
      : selectedUser?.username || "User";

  const preview = reply.isDeleted
    ? "This message was deleted"
    : reply.text ||
      (reply.image ? "📷 Photo" : "") ||
      (reply.file ? `📎 ${reply.file.name}` : "") ||
      (reply.voice?.url ? "🎤 Voice message" : "");

  return (
    <button
      type="button"
      onClick={() => onJump?.(reply._id)}
      className="block w-full text-left mb-2 rounded-md border-l-4 border-cyan-300 bg-black/20 px-2 py-1 text-xs"
    >
      <span className="block font-semibold text-cyan-200">
        {label}
      </span>

      <span
        className={`block truncate opacity-80 ${
          reply.isDeleted ? "italic" : ""
        }`}
      >
        {preview}
      </span>
    </button>
  );
}

// Format voice duration
function formatDuration(seconds) {
  const totalSeconds = Number(seconds) || 0;
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

// Format file size
function formatBytes(bytes) {
  if (!bytes) return "";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageBubble({
  message,
  isMine,
  isHighlighted,
  onJumpToMessage,
}) {
  const { authUser } = useAuthStore();
  const { toggleReaction } = useChatStore();

  const hasVoice = isVoiceMessage(message);

  // Group reactions
  const grouped = {};

  (message.reactions ?? []).forEach((reaction) => {
    grouped[reaction.emoji] ??= {
      count: 0,
      mine: false,
    };

    grouped[reaction.emoji].count += 1;

    if (reaction.userId === authUser?._id) {
      grouped[reaction.emoji].mine = true;
    }
  });

  const reactionEntries = Object.entries(grouped);

  const canUseActions =
    !message.isDeleted && !message.isOptimistic;

  return (
    <div className={`chat ${isMine ? "chat-end" : "chat-start"}`}>
      <div
        className={`chat-bubble relative group transition-shadow ${
          isMine
            ? "bg-cyan-600 text-white"
            : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
        } ${isHighlighted ? "ring-2 ring-cyan-400" : ""}`}
      >
        {canUseActions && (
          <MessageActions
            message={message}
            isMine={isMine}
          />
        )}

        {message.replyTo && (
          <ReplyPreview
            reply={message.replyTo}
            onJump={onJumpToMessage}
          />
        )}

        {message.isDeleted ? (
          <p className="italic opacity-70 flex items-center gap-1.5">
            <BanIcon className="size-4" />
            This message was deleted
          </p>
        ) : (
          <>
            {/* IMAGE */}
            {message.image && (
              <img
                src={message.image}
                alt="Shared"
                className="rounded-lg h-48 object-cover"
              />
            )}

            {/* FILE */}
            {message.file &&
              (message.file.url ? (
                <a
                  href={message.file.url}
                  target="_blank"
                  rel="noreferrer"
                  download={message.file.name}
                  className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 hover:bg-black/30 transition-colors"
                >
                  <FileIcon className="size-6 shrink-0" />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">
                      {message.file.name}
                    </p>

                    <p className="text-xs opacity-70">
                      {formatBytes(message.file.size)}
                    </p>
                  </div>

                  <DownloadIcon className="size-4 shrink-0 opacity-70" />
                </a>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 opacity-75">
                  <FileIcon className="size-6 shrink-0" />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">
                      {message.file.name}
                    </p>

                    <p className="text-xs opacity-70">
                      Sending...
                    </p>
                  </div>
                </div>
              ))}

            {/* VOICE MESSAGE PLAYER */}
            {hasVoice &&
              (message.voice.url ? (
                <div className="flex items-center gap-2">
                  <audio
                    controls
                    src={message.voice.url}
                    className="h-8 max-w-[220px]"
                  />

                  {message.voice.duration != null && (
                    <span className="text-xs opacity-70">
                      {formatDuration(message.voice.duration)}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 opacity-75 w-fit">
                  <span className="text-sm">
                    🎤 Voice message
                  </span>

                  <span className="text-xs opacity-70">
                    Sending...
                  </span>
                </div>
              ))}

            {/* MESSAGE TEXT
                For voice messages this is the recognised text, shown
                underneath the audio player. */}
            {message.text && (
              <p
                className={`break-words whitespace-pre-wrap pr-4 ${
                  message.image || message.file || hasVoice
                    ? "mt-2"
                    : ""
                }`}
              >
                {message.text}
              </p>
            )}

            {/* Older voice messages saved the text only inside
                voice.transcription, so show it when there is no message text */}
            {hasVoice && !message.text && message.voice.transcription && (
              <p className="mt-2 break-words whitespace-pre-wrap pr-4">
                {message.voice.transcription}
              </p>
            )}
          </>
        )}

        {/* REACTIONS */}
        {reactionEntries.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {reactionEntries.map(([emoji, { count, mine }]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => toggleReaction(message._id, emoji)}
                aria-label={`React with ${emoji}`}
                className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs ${
                  mine
                    ? "bg-black/40 border-white/40"
                    : "bg-black/20 border-transparent"
                }`}
              >
                <span>{emoji}</span>
                {count > 1 && <span>{count}</span>}
              </button>
            ))}
          </div>
        )}

        {/* TIME, EDITED STATUS AND DELIVERY TICKS */}
        <div className="text-xs mt-1 flex items-center gap-1">
          <span className="opacity-75">
            {message.createdAt
              ? new Date(message.createdAt).toLocaleTimeString(
                  undefined,
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )
              : ""}
          </span>

          {message.isEdited && !message.isDeleted && (
            <span className="opacity-75 italic">edited</span>
          )}

          {isMine && !message.isDeleted && (
            <MessageStatus message={message} />
          )}
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;
