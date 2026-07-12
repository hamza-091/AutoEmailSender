import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1C2541",
        slate: "#3A4466",
        paper: "#FAFAF8",
        graphite: "#6B7280",
        brass: "#B8935A",
        brassDark: "#9C7A45",
        line: "#E4E1D8",
        successGreen: "#4A7C59",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
