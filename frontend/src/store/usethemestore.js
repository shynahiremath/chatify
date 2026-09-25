import { create } from "zustand";

const stored = localStorage.getItem("isDarkMode");
// default true: matches the app's original all-dark look for existing users
const initialIsDark = stored === null ? true : stored === "true";

// keep the <html> class in sync so Tailwind's `dark:` variants work everywhere,
// including on the very first paint (called once below, outside the store)
function applyThemeClass(isDark) {
  document.documentElement.classList.toggle("dark", isDark);
}
applyThemeClass(initialIsDark);

export const useThemeStore = create((set, get) => ({
  isDarkMode: initialIsDark,

  toggleTheme: () => {
    const next = !get().isDarkMode;
    localStorage.setItem("isDarkMode", String(next));
    applyThemeClass(next);
    set({ isDarkMode: next });
  },
}));