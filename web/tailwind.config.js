/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#060b18", 900: "#0a1226", 850: "#0d1730", 800: "#101a33", 700: "#1a2745", 600: "#27395f" },
        // Flat signal palette — solid colors only, no gradients.
        critical: "#ef4444",
        urgent: "#f59e0b",
        ok: "#22c55e",
        info: "#38bdf8",
        violet: "#a78bfa",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-grotesk)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
