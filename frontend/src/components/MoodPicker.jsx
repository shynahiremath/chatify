
import { useEffect, useRef, useState } from "react";
import { PaletteIcon } from "lucide-react";
import { MOODS, useThemeStore } from "../store/useThemeStore";

function MoodPicker() {
  const { mood, setMood } = useThemeStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", close);

    return () => {
      document.removeEventListener("mousedown", close);
    };
  }, []);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-label="Change mood theme"
        aria-expanded={open}
        title="Change mood theme"
        className="text-slate-500 dark:text-slate-400 hover:text-cyan-500 transition-colors"
      >
        <PaletteIcon size={20} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-xl">
          <p className="px-3 py-2 text-xs text-slate-400">
            Pick a mood
          </p>

          {MOODS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setMood(item.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-700 ${
                mood === item.id
                  ? "text-cyan-500 font-semibold"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              <span>{item.emoji}</span>
              <span>{item.label}</span>

              {mood === item.id && (
                <span className="ml-auto" aria-label="Selected">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default MoodPicker;
