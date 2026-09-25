import { useEffect, useRef, useState } from "react";
import { FileIcon, ImageIcon, MicIcon, SendIcon, SmileIcon, Trash2Icon, XIcon } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import toast from "react-hot-toast";
import useKeyboardSound from "../hooks/useKeyboardSound";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";

function MessageInput() {
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null); // { data, name, type, size }
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVoice, setRecordedVoice] = useState(null); // { blob, url, duration }

  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
  const emojiWrapperRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingStartRef = useRef(0);
  const recordingStreamRef = useRef(null);

  const {
    sendMessage,
    isSoundEnabled,
    selectedUser,
    emitTyping,
    emitStopTyping,
    replyingTo,
    editingMessage,
    editMessage,
    clearComposerMode,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  // entering edit mode loads the old text into the box; leaving it clears the box
  const wasEditingRef = useRef(false);
  useEffect(() => {
    if (editingMessage) {
      wasEditingRef.current = true;
      setText(editingMessage.text || "");
      textInputRef.current?.focus();
    } else if (wasEditingRef.current) {
      wasEditingRef.current = false;
      setText("");
    }
  }, [editingMessage]);

  // start typing right away after tapping Reply
  useEffect(() => {
    if (replyingTo) textInputRef.current?.focus();
  }, [replyingTo]);

  const composerMessage = editingMessage || replyingTo;
  const composerPreview = composerMessage
    ? composerMessage.text ||
      (composerMessage.image ? "📷 Photo" : "") ||
      (composerMessage.file ? `📎 ${composerMessage.file.name}` : "")
    : "";

  const hasAttachment = Boolean(imagePreview || attachedFile || recordedVoice);

  // ---------- typing indicator ----------
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const receiverId = selectedUser._id;

  const stopTyping = () => {
    clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      emitStopTyping(receiverId);
    }
  };

  const handleTextChange = (e) => {
    const value = e.target.value;
    setText(value);
    isSoundEnabled && playRandomKeyStrokeSound();

    if (!value.trim()) {
      stopTyping();
      return;
    }

    // only tell the server once when typing starts, not on every keystroke
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emitTyping(receiverId);
    }
    // no keystroke for 1.5s = stopped typing
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 1500);
  };

  // switching to another chat (or leaving) must not leave "typing..." stuck
  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);
      if (isTypingRef.current) {
        isTypingRef.current = false;
        emitStopTyping(receiverId);
      }
    };
  }, [receiverId, emitStopTyping]);

  // close the emoji picker when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        emojiWrapperRef.current &&
        !emojiWrapperRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // stop the mic and free the preview URL if the component unmounts mid-recording/preview
  useEffect(() => {
    return () => {
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (recordedVoice) URL.revokeObjectURL(recordedVoice.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !hasAttachment) return;
    if (isSoundEnabled) playRandomKeyStrokeSound();
    stopTyping();

    // editing an existing message instead of sending a new one
    if (editingMessage) {
      const newText = text.trim();
      if (!newText) return;
      if (newText === editingMessage.text) {
        clearComposerMode(); // nothing changed
        return;
      }
      const ok = await editMessage(editingMessage._id, newText);
      if (ok) clearComposerMode();
      return;
    }

    let voicePayload;
    if (recordedVoice) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(recordedVoice.blob);
      });
      voicePayload = { data: dataUrl, duration: recordedVoice.duration };
    }

    sendMessage({
      text: text.trim(),
      image: imagePreview,
      file: attachedFile
        ? { data: attachedFile.data, name: attachedFile.name, type: attachedFile.type, size: attachedFile.size }
        : undefined,
      voice: voicePayload,
    });
    setText("");
    setImagePreview(null);
    setAttachedFile(null);
    if (recordedVoice) URL.revokeObjectURL(recordedVoice.url);
    setRecordedVoice(null);
    setShowEmojiPicker(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ---------- voice recording ----------
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      recordedChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordingStartRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const duration = Math.round((Date.now() - recordingStartRef.current) / 1000);
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        recordingStreamRef.current = null;

        if (duration < 1) {
          toast.error("Recording was too short");
          return;
        }
        setImagePreview(null);
        setAttachedFile(null);
        setRecordedVoice({ blob, url: URL.createObjectURL(blob), duration });
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.log("Error starting recording:", error);
      toast.error(
        error.name === "NotAllowedError"
          ? "Microphone permission was denied"
          : "Couldn't start recording"
      );
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const discardRecording = () => {
    if (recordedVoice) URL.revokeObjectURL(recordedVoice.url);
    setRecordedVoice(null);
  };

  // insert the emoji where the cursor is, not just at the end
  const handleEmojiClick = (emojiData) => {
    const input = textInputRef.current;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;
    const newText = text.slice(0, start) + emojiData.emoji + text.slice(end);
    setText(newText);

    // put the cursor right after the inserted emoji
    requestAnimationFrame(() => {
      input?.focus();
      const pos = start + emojiData.emoji.length;
      input?.setSelectionRange(pos, pos);
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("That image is too large (max 15 MB)");
      return;
    }

    setAttachedFile(null); // an image and a file are mutually exclusive per message
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  // any non-image file: PDFs, docs, zips, etc.
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("That file is too large (max 15 MB)");
      return;
    }

    setImagePreview(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedFile({
        data: reader.result,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-3 md:p-4 border-t border-slate-200 dark:border-slate-700/50">
      {/* REPLY / EDIT BAR */}
      {composerMessage && (
        <div className="max-w-3xl mx-auto mb-3 flex items-start gap-3 rounded-lg bg-slate-100 dark:bg-slate-800/70 border-l-4 border-cyan-500 px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
              {editingMessage
                ? "Editing message"
                : `Replying to ${
                    replyingTo.senderId === authUser._id
                      ? "yourself"
                      : selectedUser.username
                  }`}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 truncate">{composerPreview}</p>
          </div>
          <button
            type="button"
            onClick={clearComposerMode}
            aria-label="Cancel"
            className="text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      )}

      {imagePreview && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-slate-300 dark:border-slate-700"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-900 hover:bg-slate-300"
              type="button"
              aria-label="Remove image"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {attachedFile && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center gap-2 bg-slate-100 dark:bg-slate-800/70 rounded-lg px-3 py-2 w-fit max-w-full">
          <FileIcon className="size-5 text-cyan-600 dark:text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{attachedFile.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{formatBytes(attachedFile.size)}</p>
          </div>
          <button
            onClick={removeFile}
            type="button"
            aria-label="Remove file"
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 ml-2"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {recordedVoice && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center gap-2 bg-slate-100 dark:bg-slate-800/70 rounded-lg px-3 py-2 w-fit">
          <audio controls src={recordedVoice.url} className="h-8" />
          <span className="text-xs text-slate-500 dark:text-slate-400">{recordedVoice.duration}s</span>
          <button
            onClick={discardRecording}
            type="button"
            aria-label="Discard recording"
            className="text-slate-400 hover:text-red-400 ml-1"
          >
            <Trash2Icon className="w-4 h-4" />
          </button>
        </div>
      )}

      <form
        onSubmit={handleSendMessage}
        className="max-w-3xl mx-auto flex space-x-2 md:space-x-4"
      >
        {isRecording ? (
          // recording takes over the bar: text input is unavailable while recording
          <div className="flex-1 min-w-0 flex items-center gap-3 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800/50 rounded-lg px-4 py-2">
            <span className="relative flex size-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full size-2.5 bg-red-500" />
            </span>
            <span className="text-red-600 dark:text-red-300 text-sm">Recording...</span>
          </div>
        ) : (
          <input
            type="text"
            ref={textInputRef}
            value={text}
            onChange={handleTextChange}
            disabled={Boolean(recordedVoice)}
            className="flex-1 min-w-0 bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-lg py-2 px-4 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-60"
            placeholder="Type your message..."
          />
        )}

        <input
          type="file"
          accept="image/*"
          ref={imageInputRef}
          onChange={handleImageChange}
          className="hidden"
        />
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

        {/* EMOJI BUTTON + POPUP */}
        {!isRecording && (
        <div className="relative" ref={emojiWrapperRef}>
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            aria-label="Add emoji"
            className={`h-full bg-slate-100 dark:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg px-3 md:px-4 transition-colors ${
              showEmojiPicker ? "text-cyan-500" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <SmileIcon className="w-5 h-5" />
          </button>

          {showEmojiPicker && (
            <div className="absolute bottom-full right-0 mb-2 z-20">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                theme={isDarkMode ? "dark" : "light"}
                width={Math.min(320, window.innerWidth - 32)}
                height={380}
                lazyLoadEmojis
                previewConfig={{ showPreview: false }}
              />
            </div>
          )}
        </div>
        )}

        {!isRecording && (
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          aria-label="Attach image"
          disabled={!!editingMessage}
          className={`bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg px-3 md:px-4 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            imagePreview ? "text-cyan-500" : ""
          }`}
        >
          <ImageIcon className="w-5 h-5" />
        </button>
        )}

        {!isRecording && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file"
          disabled={!!editingMessage}
          className={`hidden sm:block bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg px-3 md:px-4 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            attachedFile ? "text-cyan-500" : ""
          }`}
        >
          <FileIcon className="w-5 h-5" />
        </button>
        )}

        {/* MIC: tap to start, tap again to stop. Hidden once there's text or another attachment. */}
        {!text.trim() && !imagePreview && !attachedFile && !editingMessage && (
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            aria-label={isRecording ? "Stop recording" : "Record a voice message"}
            className={`rounded-lg px-3 md:px-4 transition-colors ${
              isRecording
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <MicIcon className="w-5 h-5" />
          </button>
        )}

        <button
          type="submit"
          disabled={(!text.trim() && !hasAttachment) || isRecording}
          aria-label="Send message"
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg px-3 md:px-4 py-2 font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

export default MessageInput;
