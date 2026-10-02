/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f5f4ef",
        ink: { DEFAULT: "#0c0c0d", soft: "#3b3b3f", mute: "#5f5f66" },
        line: "#e2e0d8",
        volt: { DEFAULT: "#d2f53c", deep: "#b5d92a" },
        danger: "#c2410c",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "system-ui", "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: { card: "0 1px 0 #e2e0d8, 0 12px 32px -18px rgba(12,12,13,.25)" },
    },
  },
  plugins: [],
};
