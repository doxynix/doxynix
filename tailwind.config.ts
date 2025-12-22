import { type Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        bg: "var(--color-bg)",
        "bg-sidebar": "var(--color-bg-sidebar)",
        text: "var(--color-text)",
        "text-secondary": "var(--color-text-secondary)",
        accent: "var(--color-accent)",
        hover: "var(--color-hover)",
        success: "var(--color-success)",
        error: "var(--color-error)",
      },
    },
  },
};

export default config;
