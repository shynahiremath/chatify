import { useEffect, useRef, useState } from "react";
import {
  ClockIcon,
  FileIcon,
  ImageIcon,
  MicIcon,
  SendIcon,
  SmileIcon,
  SquareIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import toast from "react-hot-toast";
import useKeyboardSound from "../hooks/useKeyboardSound";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import ScheduleModal from "./ScheduleModal";

function MessageInput() {
  const { playRandomKeyStrokeSound } = useKeyboardSound();

  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVoice, setRecordedVoice] = useState(null);
  const [transcription, setTranscription] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
  const emojiWrapperRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingStartRef = useRef(0);
  const recordingStreamRef = useRef(null);

  const speechRecognitionRef = useRef(null);
  const keepListeningRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const transcriptionRef = useRef("");

  const wasEditingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

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

  const receiverId = selectedUser?._id;

  const updateTranscription = (value) => {
    transcriptionRef.current = value;
    setTranscription(value);
  };

  // ---------- EDIT EXISTING MESSAGE ----------
  // Only the FIRST setText needs the eslint-disable comment. Putting one above
  // the second setText makes lint report an "unused eslint-disable" warning.
  useEffect(() => {
    if (editingMessage) {
      wasEditingRef.current = true;

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(editingMessage.text || "");

      textInputRef.current?.focus();
    } else if (wasEditingRef.current) {
      wasEditingRef.current = false;
      setText("");
    }
  }, [editingMessage]);

  // ---------- FOCUS INPUT WHEN REPLYING ----------
  useEffect(() => {
    if (replyingTo) {
      textInputRef.current?.focus();
    }
  }, [replyingTo]);

  const composerMessage = editingMessage || replyingTo;

  const composerPreview = composerMessage
    ? composerMessage.text ||
      (composerMessage.image ? "📷 Photo" : "") ||
      (composerMessage.file ? `📎 ${composerMessage.file.name}` : "") ||
      (composerMessage.voice?.url ? "🎤 Voice message" : "")
    : "";

  const hasAttachment = Boolean(
    imagePreview || attachedFile || recordedVoice
  );

  // ---------- TYPING INDICATOR ----------
  const stopTyping = () => {
    clearTimeout(typingTimeoutRef.current);

    if (isTypingRef.current && receiverId) {
      isTypingRef.current = false;
      emitStopTyping(receiverId);
    }
  };

  const handleTextChange = (e) => {
    const value = e.target.value;
    setText(value);

    if (isSoundEnabled) {
      playRandomKeyStrokeSound();
    }

    if (!value.trim()) {
      stopTyping();
      return;
    }

    if (!isTypingRef.current && receiverId) {
      isTypingRef.current = true;
      emitTyping(receiverId);
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 1500);
  };

  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);

      if (isTypingRef.current && receiverId) {
        isTypingRef.current = false;
        emitStopTyping(receiverId);
      }
    };
  }, [receiverId, emitStopTyping]);

  // ---------- CLOSE EMOJI PICKER WHEN CLICKING OUTSIDE ----------
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

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // ---------- CLEAN UP MICROPHONE AND AUDIO PREVIEW ----------
  useEffect(() => {
    return () => {
      keepListeningRef.current = false;

      recordingStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.onresult = null;
        speechRecognitionRef.current.onend = null;
        speechRecognitionRef.current.onerror = null;

        try {
          speechRecognitionRef.current.abort();
        } catch {
          // Speech recognition may already have stopped.
        }
      }

      if (recordedVoice?.url) {
        URL.revokeObjectURL(recordedVoice.url);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- SPEECH RECOGNITION ----------
  const startSpeechRecognition = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error(
        "Speech recognition is not supported in this browser. You can still send voice recordings."
      );
      return null;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onresult = (event) => {
      let finalText = finalTranscriptRef.current;
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const spokenText = result[0].transcript;

        if (result.isFinal) {
          finalText += `${spokenText} `;
        } else {
          interimText += spokenText;
        }
      }

      finalTranscriptRef.current = finalText;
      interimTranscriptRef.current = interimText;

      updateTranscription(`${finalText} ${interimText}`.trim());
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);

      // These errors cannot be fixed by restarting, so stop trying.
      if (
        ["not-allowed", "service-not-allowed", "audio-capture", "network"].includes(
          event.error
        )
      ) {
        keepListeningRef.current = false;

        if (event.error === "network") {
          toast.error(
            "Speech recognition needs an internet connection. You can still send the recording."
          );
        }
      }
    };

    recognition.onend = () => {
      // Keep any words that were heard but not yet marked final.
      const pending = interimTranscriptRef.current.trim();

      if (pending) {
        finalTranscriptRef.current += `${pending} `;
        interimTranscriptRef.current = "";
      }

      // Browsers end recognition on their own after a pause or about a
      // minute. While the user is still recording, start it again.
      if (keepListeningRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          // Could not restart, fall through and finish.
        }
      }

      setIsTranscribing(false);
      updateTranscription(finalTranscriptRef.current.trim());
    };

    try {
      speechRecognitionRef.current = recognition;
      recognition.start();
      setIsTranscribing(true);
      return recognition;
    } catch (error) {
      console.error("Could not start speech recognition:", error);
      speechRecognitionRef.current = null;
      keepListeningRef.current = false;
      setIsTranscribing(false);
      return null;
    }
  };

  // ---------- SEND MESSAGE ----------
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (isRecording || isSending) {
      return;
    }

    if (!text.trim() && !hasAttachment) {
      return;
    }

    if (isSoundEnabled) {
      playRandomKeyStrokeSound();
    }

    stopTyping();

    // Editing sends only the edited text.
    if (editingMessage) {
      const newText = text.trim();

      if (!newText) {
        return;
      }

      if (newText === editingMessage.text) {
        clearComposerMode();
        return;
      }

      const ok = await editMessage(editingMessage._id, newText);

      if (ok) {
        clearComposerMode();
      }

      return;
    }

    setIsSending(true);

    try {
      let voicePayload;

      // Prepare the recorded audio and its recognised text.
      if (recordedVoice) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();

          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => {
            reject(new Error("Could not read the voice recording."));
          };

          reader.readAsDataURL(recordedVoice.blob);
        });

        voicePayload = {
          data: dataUrl,
          duration: recordedVoice.duration,
          transcription: transcriptionRef.current.trim(),
        };
      }

      // Normal typed messages stay ordinary text messages.
      // Recorded voice messages send BOTH the audio and the text.
      const messageText = recordedVoice
        ? transcriptionRef.current.trim()
        : text.trim();

      await sendMessage({
        text: messageText,
        image: imagePreview || undefined,
        file: attachedFile
          ? {
              data: attachedFile.data,
              name: attachedFile.name,
              type: attachedFile.type,
              size: attachedFile.size,
            }
          : undefined,
        voice: voicePayload,
      });

      setText("");
      setImagePreview(null);
      setAttachedFile(null);

      if (recordedVoice?.url) {
        URL.revokeObjectURL(recordedVoice.url);
      }

      setRecordedVoice(null);
      finalTranscriptRef.current = "";
      interimTranscriptRef.current = "";
      updateTranscription("");
      setIsTranscribing(false);
      setShowEmojiPicker(false);

      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Could not send message:", error);
      toast.error("Could not send the message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // ---------- START VOICE RECORDING ----------
  const startRecording = async () => {
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        !window.MediaRecorder
      ) {
        toast.error("Voice recording is not supported in this browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      recordingStreamRef.current = stream;
      recordedChunksRef.current = [];
      finalTranscriptRef.current = "";
      interimTranscriptRef.current = "";
      updateTranscription("");

      const recorder = new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      recordingStartRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const duration = Math.round(
          (Date.now() - recordingStartRef.current) / 1000
        );

        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;

        // Stop listening for speech. keepListeningRef is already false here,
        // so recognition will finish instead of restarting.
        keepListeningRef.current = false;

        if (speechRecognitionRef.current) {
          try {
            speechRecognitionRef.current.stop();
          } catch {
            // Recognition may already have stopped.
          }
        }

        speechRecognitionRef.current = null;

        if (duration < 1 || blob.size === 0) {
          setIsTranscribing(false);
          toast.error("Recording was too short. Please try again.");
          finalTranscriptRef.current = "";
          interimTranscriptRef.current = "";
          updateTranscription("");
          return;
        }

        setImagePreview(null);
        setAttachedFile(null);

        setRecordedVoice({
          blob,
          url: URL.createObjectURL(blob),
          duration,
        });
      };

      recorder.onerror = (event) => {
        console.error("Recording error:", event.error);
        toast.error("There was a problem recording your voice.");
      };

      recorder.start();
      setIsRecording(true);

      keepListeningRef.current = true;
      startSpeechRecognition();
    } catch (error) {
      console.error("Error starting recording:", error);

      keepListeningRef.current = false;

      recordingStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      recordingStreamRef.current = null;
      setIsRecording(false);
      setIsTranscribing(false);

      toast.error(
        error.name === "NotAllowedError"
          ? "Microphone permission was denied."
          : "Couldn't start recording."
      );
    }
  };

  // ---------- STOP RECORDING ----------
  const stopRecording = () => {
    keepListeningRef.current = false;

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
  };

  // ---------- DISCARD RECORDING ----------
  const discardRecording = () => {
    keepListeningRef.current = false;

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch {
        // Recognition may already have stopped.
      }
    }

    speechRecognitionRef.current = null;

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }

    recordingStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;

    setIsRecording(false);
    setIsTranscribing(false);

    if (recordedVoice?.url) {
      URL.revokeObjectURL(recordedVoice.url);
    }

    setRecordedVoice(null);
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    updateTranscription("");
  };

  // ---------- INSERT EMOJI ----------
  const handleEmojiClick = (emojiData) => {
    const input = textInputRef.current;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;

    const newText =
      text.slice(0, start) + emojiData.emoji + text.slice(end);

    setText(newText);

    requestAnimationFrame(() => {
      input?.focus();

      const position = start + emojiData.emoji.length;
      input?.setSelectionRange(position, position);
    });
  };

  // ---------- IMAGE ATTACHMENT ----------
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      e.target.value = "";
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error("That image is too large (maximum 15 MB).");
      e.target.value = "";
      return;
    }

    setAttachedFile(null);

    const reader = new FileReader();

    reader.onloadend = () => setImagePreview(reader.result);
    reader.onerror = () => toast.error("Could not read the image.");

    reader.readAsDataURL(file);
  };

  // ---------- GENERAL FILE ATTACHMENT ----------
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error("That file is too large (maximum 15 MB).");
      e.target.value = "";
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

    reader.onerror = () => toast.error("Could not read the file.");

    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const removeFile = () => {
    setAttachedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ---------- USER INTERFACE ----------
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
                    replyingTo?.senderId === authUser?._id
                      ? "yourself"
                      : selectedUser?.username || "user"
                  }`}
            </p>

            <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
              {composerPreview}
            </p>
          </div>

          <button
            type="button"
            onClick={clearComposerMode}
            aria-label="Cancel reply or edit"
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      )}

      {/* IMAGE PREVIEW */}
      {imagePreview && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Image preview"
              className="w-20 h-20 object-cover rounded-lg border border-slate-300 dark:border-slate-700"
            />

            <button
              onClick={removeImage}
              type="button"
              aria-label="Remove image"
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-900 hover:bg-slate-300"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* FILE PREVIEW */}
      {attachedFile && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center gap-2 bg-slate-100 dark:bg-slate-800/70 rounded-lg px-3 py-2 w-fit max-w-full">
          <FileIcon className="size-5 text-cyan-600 dark:text-cyan-400 shrink-0" />

          <div className="min-w-0">
            <p className="text-sm text-slate-700 dark:text-slate-200 truncate">
              {attachedFile.name}
            </p>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatBytes(attachedFile.size)}
            </p>
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

      {/* RECORDED VOICE PREVIEW */}
      {recordedVoice && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center gap-2 bg-slate-100 dark:bg-slate-800/70 rounded-lg px-3 py-2 w-fit max-w-full">
          <audio
            controls
            src={recordedVoice.url}
            className="h-8 max-w-[220px]"
          />

          <span className="text-xs text-slate-500 dark:text-slate-400">
            {recordedVoice.duration}s
          </span>

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

      {/* EDITABLE TEXT FOR THE VOICE MESSAGE */}
      {recordedVoice && (
        <div className="max-w-3xl mx-auto mb-3 rounded-lg bg-slate-100 dark:bg-slate-800/70 px-3 py-2">
          <label
            htmlFor="voice-transcript"
            className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
          >
            Text shown under your voice message (you can edit it)
          </label>

          <textarea
            id="voice-transcript"
            rows={2}
            maxLength={1000}
            value={transcription}
            onChange={(e) => updateTranscription(e.target.value)}
            placeholder="No text was recognised. You can type it here, or leave it empty."
            className="w-full resize-none bg-transparent text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
        </div>
      )}

      <form
        onSubmit={handleSendMessage}
        className="max-w-3xl mx-auto flex space-x-2 md:space-x-4"
      >
        {/* RECORDING STATUS OR NORMAL TEXT INPUT */}
        {isRecording ? (
          <div className="flex-1 min-w-0 flex items-center gap-3 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800/50 rounded-lg px-4 py-2">
            <span className="relative flex size-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full size-2.5 bg-red-500" />
            </span>

            <span className="text-red-600 dark:text-red-300 text-sm truncate">
              {isTranscribing
                ? "Recording and transcribing..."
                : "Recording..."}
            </span>
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

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* EMOJI BUTTON */}
        {!isRecording && !recordedVoice && (
          <div className="relative" ref={emojiWrapperRef}>
            <button
              type="button"
              onClick={() =>
                setShowEmojiPicker((previous) => !previous)
              }
              aria-label="Add emoji"
              className={`h-full bg-slate-100 dark:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg px-3 md:px-4 transition-colors ${
                showEmojiPicker
                  ? "text-cyan-500"
                  : "text-slate-500 dark:text-slate-400"
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

        {/* IMAGE BUTTON */}
        {!isRecording && !recordedVoice && (
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            aria-label="Attach image"
            disabled={Boolean(editingMessage)}
            className={`bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg px-3 md:px-4 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              imagePreview ? "text-cyan-500" : ""
            }`}
          >
            <ImageIcon className="w-5 h-5" />
          </button>
        )}

        {/* FILE BUTTON */}
        {!isRecording && !recordedVoice && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file"
            disabled={Boolean(editingMessage)}
            className={`hidden sm:block bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg px-3 md:px-4 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              attachedFile ? "text-cyan-500" : ""
            }`}
          >
            <FileIcon className="w-5 h-5" />
          </button>
        )}

        {/* SCHEDULE BUTTON */}
        {!isRecording && !recordedVoice && !editingMessage && (
          <button
            type="button"
            onClick={() => setShowSchedule(true)}
            aria-label="Schedule a message or reminder"
            className="hidden sm:block bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg px-3 md:px-4 transition-colors"
          >
            <ClockIcon className="w-5 h-5" />
          </button>
        )}

        {/* MICROPHONE / STOP RECORDING BUTTON */}
        {!text.trim() &&
          !imagePreview &&
          !attachedFile &&
          !recordedVoice &&
          !editingMessage && (
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              aria-label={
                isRecording ? "Stop recording" : "Record a voice message"
              }
              className={`rounded-lg px-3 md:px-4 transition-colors ${
                isRecording
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {isRecording ? (
                <SquareIcon className="w-5 h-5" />
              ) : (
                <MicIcon className="w-5 h-5" />
              )}
            </button>
          )}

        {/* SEND BUTTON */}
        <button
          type="submit"
          disabled={
            (!text.trim() && !hasAttachment) || isRecording || isSending
          }
          aria-label="Send message"
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg px-3 md:px-4 py-2 font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </form>

      {/* SCHEDULE WINDOW */}
      {showSchedule && (
        <ScheduleModal
          initialText={text}
          onClose={() => setShowSchedule(false)}
          onScheduled={() => setText("")}
        />
      )}
    </div>
  );
}

export default MessageInput;