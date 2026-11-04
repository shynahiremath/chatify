
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  LogOutIcon,
  MoonIcon,
  PencilIcon,
  SunIcon,
  VolumeOffIcon,
  Volume2Icon,
  XIcon,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useThemeStore } from "../store/useThemeStore";
import MoodPicker from "./MoodPicker";

const mouseClickSound = new Audio("/sounds/mouse-click.mp3");

const STATUS_PRESETS = [
  "Available",
  "Busy",
  "At work",
  "In a meeting",
  "Away",
];

function ProfileHeader() {
  const { logout, authUser, updateProfile, isUpdatingProfile } = useAuthStore();
  const { isSoundEnabled, toggleSound } = useChatStore();
  const { isDarkMode, toggleTheme } = useThemeStore();

  const [selectedImg, setSelectedImg] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onloadend = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);

      const ok = await updateProfile({ profilePic: base64Image });
      if (!ok) setSelectedImg(null);
    };
  };

  return (
    <div className="p-6 border-b border-slate-200 dark:border-slate-700/50">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="avatar online shrink-0">
            <button
              type="button"
              className="size-14 rounded-full overflow-hidden relative group"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUpdatingProfile}
              aria-label="Change profile photo"
            >
              <img
                src={selectedImg || authUser.profilePic || "/avatar.png"}
                alt="User"
                className="size-full object-cover"
              />

              {isUpdatingProfile ? (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="loading loading-spinner loading-sm text-white" />
                </div>
              ) : (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-white text-xs">Change</span>
                </div>
              )}
            </button>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          <div className="min-w-0">
            <UsernameEditor
              username={authUser.username}
              onSave={updateProfile}
            />

            <StatusEditor
              statusMessage={authUser.statusMessage}
              onSave={updateProfile}
            />
          </div>
        </div>

        <div className="flex gap-4 items-center shrink-0">
          <MoodPicker />

          <button
            type="button"
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            onClick={toggleTheme}
            aria-label={
              isDarkMode ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {isDarkMode ? (
              <SunIcon className="size-5" />
            ) : (
              <MoonIcon className="size-5" />
            )}
          </button>

          <button
            type="button"
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            onClick={logout}
            aria-label="Log out"
          >
            <LogOutIcon className="size-5" />
          </button>

          <button
            type="button"
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            aria-label={isSoundEnabled ? "Mute sounds" : "Unmute sounds"}
            onClick={() => {
              mouseClickSound.currentTime = 0;
              mouseClickSound
                .play()
                .catch((error) => console.log("Audio play failed:", error));
              toggleSound();
            }}
          >
            {isSoundEnabled ? (
              <Volume2Icon className="size-5" />
            ) : (
              <VolumeOffIcon className="size-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Inline username editor
function UsernameEditor({ username, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(username);
  const [isSaving, setIsSaving] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const startEditing = () => {
    setValue(username);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setValue(username);
    setIsEditing(false);
  };

  const commit = async () => {
    if (isSaving) return;

    const trimmed = value.trim();

    if (!trimmed || trimmed === username) {
      setValue(username);
      setIsEditing(false);
      return;
    }

    setIsSaving(true);

    try {
      const ok = await onSave({ username: trimmed });

      if (ok) {
        setIsEditing(false);
      } else {
        setValue(username);
      }
    } catch (error) {
      console.error("Could not update username:", error);
      setValue(username);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          value={value}
          disabled={isSaving}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }

            if (e.key === "Escape") {
              cancelEditing();
            }
          }}
          onBlur={commit}
          maxLength={30}
          aria-label="Edit username"
          className="bg-slate-100 dark:bg-slate-900/60 border border-cyan-500/60 rounded px-2 py-0.5 text-slate-800 dark:text-slate-200 font-medium text-base w-36 focus:outline-none"
        />

        {isSaving ? (
          <span className="loading loading-spinner loading-xs text-cyan-400" />
        ) : (
          <CheckIcon className="size-4 text-cyan-400" />
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className="group flex items-center gap-1.5 max-w-[200px]"
    >
      <h3 className="text-slate-800 dark:text-slate-200 font-medium text-base truncate">
        {username}
      </h3>

      <PencilIcon className="size-3.5 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
    </button>
  );
}

// Inline status editor with preset choices
function StatusEditor({ statusMessage, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [value, setValue] = useState(statusMessage || "");
  const [isSaving, setIsSaving] = useState(false);

  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const commitRef = useRef(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const startEditing = () => {
    setValue(statusMessage || "");
    setShowPresets(false);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setValue(statusMessage || "");
    setShowPresets(false);
    setIsEditing(false);
  };

  const commit = useCallback(async () => {
    if (isSaving) return;

    const trimmed = value.trim();

    if (trimmed === (statusMessage || "")) {
      setIsEditing(false);
      setShowPresets(false);
      return;
    }

    setIsSaving(true);

    try {
      const ok = await onSave({ statusMessage: trimmed });

      if (ok) {
        setIsEditing(false);
      } else {
        setValue(statusMessage || "");
      }
    } catch (error) {
      console.error("Could not update status:", error);
      setValue(statusMessage || "");
    } finally {
      setIsSaving(false);
      setShowPresets(false);
    }
  }, [isSaving, value, statusMessage, onSave]);

  // Keep the latest commit function available to the outside-click listener.
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  // Save the status when the user clicks outside the editor.
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target)
      ) {
        commitRef.current?.();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditing]);

  const choosePreset = async (preset) => {
    if (isSaving) return;

    setValue(preset);
    setIsSaving(true);

    try {
      const ok = await onSave({ statusMessage: preset });

      if (ok) {
        setIsEditing(false);
      } else {
        setValue(statusMessage || "");
      }
    } catch (error) {
      console.error("Could not update status:", error);
      setValue(statusMessage || "");
    } finally {
      setIsSaving(false);
      setShowPresets(false);
    }
  };

  if (isEditing) {
    return (
      <div ref={wrapperRef} className="relative">
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            value={value}
            disabled={isSaving}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setShowPresets(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }

              if (e.key === "Escape") {
                cancelEditing();
              }
            }}
            maxLength={40}
            placeholder="Set a status..."
            aria-label="Edit status message"
            className="bg-slate-100 dark:bg-slate-900/60 border border-cyan-500/60 rounded px-2 py-0.5 text-slate-700 dark:text-slate-300 text-xs w-40 focus:outline-none"
          />

          {isSaving && (
            <span className="loading loading-spinner loading-xs text-cyan-400" />
          )}

          {!isSaving && value && (
            <button
              type="button"
              aria-label="Clear status"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choosePreset("")}
              className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>

        {showPresets && (
          <div className="absolute z-20 mt-1 w-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-xl">
            {STATUS_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choosePreset(preset)}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className="group flex items-center gap-1.5"
    >
      <p className="text-slate-500 dark:text-slate-400 text-xs truncate max-w-[160px]">
        {statusMessage || "Online"}
      </p>

      <PencilIcon className="size-3 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
    </button>
  );
}

export default ProfileHeader;
