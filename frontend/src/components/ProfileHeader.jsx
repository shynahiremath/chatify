import { useEffect, useRef, useState } from "react";
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

const mouseClickSound = new Audio("/sounds/mouse-click.mp3");

// quick presets shown above the status input, tap to use as-is
const STATUS_PRESETS = ["Available", "Busy", "At work", "In a meeting", "Away"];

function ProfileHeader() {
  const { logout, authUser, updateProfile, isUpdatingProfile } = useAuthStore();
  const { isSoundEnabled, toggleSound } = useChatStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const [selectedImg, setSelectedImg] = useState(null);

  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onloadend = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);
      const ok = await updateProfile({ profilePic: base64Image });
      if (!ok) setSelectedImg(null); // revert the preview if the upload failed
    };
  };

  return (
    <div className="p-6 border-b border-slate-200 dark:border-slate-700/50">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* AVATAR */}
          <div className="avatar online shrink-0">
            <button
              className="size-14 rounded-full overflow-hidden relative group"
              onClick={() => fileInputRef.current.click()}
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
                  <span className="loading loading-spinner loading-sm text-white"></span>
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

          {/* USERNAME & STATUS */}
          <div className="min-w-0">
            <UsernameEditor username={authUser.username} onSave={updateProfile} />
            <StatusEditor statusMessage={authUser.statusMessage} onSave={updateProfile} />
          </div>
        </div>

        {/* BUTTONS */}
        <div className="flex gap-4 items-center shrink-0">
          {/* THEME TOGGLE BTN */}
          <button
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            onClick={toggleTheme}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? <SunIcon className="size-5" /> : <MoonIcon className="size-5" />}
          </button>

          {/* LOGOUT BTN */}
          <button
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            onClick={logout}
            aria-label="Log out"
          >
            <LogOutIcon className="size-5" />
          </button>

          {/* SOUND TOGGLE BTN */}
          <button
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            aria-label={isSoundEnabled ? "Mute sounds" : "Unmute sounds"}
            onClick={() => {
              // play click sound before toggling
              mouseClickSound.currentTime = 0; // reset to start
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

// Click the username (or the pencil) to edit it inline. Enter/blur saves,
// Escape reverts. Doesn't call the API if nothing actually changed.
function UsernameEditor({ username, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(username);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);

  // the server may reject the change (name taken); reflect the real value if
  // it updates from elsewhere while we're not mid-edit
  useEffect(() => {
    if (!isEditing) setValue(username);
  }, [username, isEditing]);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const commit = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === username) {
      setValue(username);
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    const ok = await onSave({ username: trimmed });
    setIsSaving(false);
    if (ok) setIsEditing(false);
    else setValue(username); // roll back on failure (e.g. name taken)
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
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setValue(username);
              setIsEditing(false);
            }
          }}
          onBlur={commit}
          maxLength={30}
          className="bg-slate-100 dark:bg-slate-900/60 border border-cyan-500/60 rounded px-2 py-0.5 text-slate-800 dark:text-slate-200 font-medium text-base w-36 focus:outline-none"
        />
        {isSaving ? (
          <span className="loading loading-spinner loading-xs text-cyan-400"></span>
        ) : (
          <CheckIcon className="size-4 text-cyan-400" />
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group flex items-center gap-1.5 max-w-[200px]"
    >
      <h3 className="text-slate-800 dark:text-slate-200 font-medium text-base truncate">{username}</h3>
      <PencilIcon className="size-3.5 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
    </button>
  );
}

// Same pattern as the username editor, plus a preset dropdown. An empty
// status falls back to showing "Online" as a placeholder, unedited.
function StatusEditor({ statusMessage, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [value, setValue] = useState(statusMessage || "");
  const [isSaving, setIsSaving] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isEditing) setValue(statusMessage || "");
  }, [statusMessage, isEditing]);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        commit();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, value]);

  const commit = async () => {
    const trimmed = value.trim();
    if (trimmed === (statusMessage || "")) {
      setIsEditing(false);
      setShowPresets(false);
      return;
    }
    setIsSaving(true);
    const ok = await onSave({ statusMessage: trimmed });
    setIsSaving(false);
    setShowPresets(false);
    if (ok) setIsEditing(false);
    else setValue(statusMessage || "");
  };

  const choosePreset = async (preset) => {
    setValue(preset);
    setIsSaving(true);
    const ok = await onSave({ statusMessage: preset });
    setIsSaving(false);
    setShowPresets(false);
    if (ok) setIsEditing(false);
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
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setValue(statusMessage || "");
                setIsEditing(false);
                setShowPresets(false);
              }
            }}
            maxLength={40}
            placeholder="Set a status..."
            className="bg-slate-100 dark:bg-slate-900/60 border border-cyan-500/60 rounded px-2 py-0.5 text-slate-700 dark:text-slate-300 text-xs w-40 focus:outline-none"
          />
          {isSaving && (
            <span className="loading loading-spinner loading-xs text-cyan-400"></span>
          )}
          {!isSaving && value && (
            <button
              type="button"
              aria-label="Clear status"
              onMouseDown={(e) => e.preventDefault()} // keep focus so blur doesn't fire first
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
                onMouseDown={(e) => e.preventDefault()} // keep focus so blur doesn't fire first
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
      onClick={() => setIsEditing(true)}
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
