
import { create } from "zustand";

export const MOODS = [
  { id: "default", label: "Classic", emoji: "💠" },
  { id: "calm", label: "Calm", emoji: "🌿" },
  { id: "focus", label: "Focus", emoji: "🎯" },
  { id: "energetic", label: "Energetic", emoji: "⚡" },
  { id: "cozy", label: "Cozy", emoji: "🌸" },
];

// Restore saved dark mode
const storedDark = localStorage.getItem("isDarkMode");
const initialIsDark =
  storedDark === null ? true : storedDark === "true";

// Restore saved mood
const storedMood = localStorage.getItem("mood");

const initialMood = MOODS.some((m) => m.id === storedMood)
  ? storedMood
  : "default";

// Apply dark mode to the HTML element
function applyThemeClass(isDark) {
  document.documentElement.classList.toggle("dark", isDark);
}

// Apply mood colours to the HTML element
function applyMood(mood) {
  document.documentElement.dataset.mood = mood;
}

// Apply saved preferences on startup
applyThemeClass(initialIsDark);
applyMood(initialMood);

export const useThemeStore = create((set, get) => ({
  isDarkMode: initialIsDark,
  mood: initialMood,

  // Existing dark mode functionality
  toggleTheme: () => {
    const next = !get().isDarkMode;

    localStorage.setItem("isDarkMode", String(next));
    applyThemeClass(next);

    set({ isDarkMode: next });
  },

  // New mood selection functionality
  setMood: (mood) => {
    if (!MOODS.some((m) => m.id === mood)) return;

    localStorage.setItem("mood", mood);
    applyMood(mood);

    set({ mood });
  },
}));
