
import daisyui from "daisyui";

const accent = (shade) => `rgb(var(--accent-${shade}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cyan: {
          200: accent(200),
          300: accent(300),
          400: accent(400),
          500: accent(500),
          600: accent(600),
          700: accent(700),
        },
      },
      animation: {
        border: "border 4s linear infinite",
      },
      keyframes: {
        border: {
          to: { "--border-angle": "360deg" },
        },
      },
    },
  },
  plugins: [daisyui],
};
