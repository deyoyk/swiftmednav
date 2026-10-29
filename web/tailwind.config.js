/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#060b18", 900: "#0a1226", 800: "#101a33", 700: "#1a2745" },
        critical: "#ef4444",
        urgent: "#f59e0b",
        ok: "#22c55e"
      },
      fontFamily: { sans: ["Inter", "Geist", "system-ui", "sans-serif"] }
    }
  },
  plugins: []
};
