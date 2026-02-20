import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // AURA brand — deep space dark + blue accent
        aura: {
          bg: "#0a0e1a",
          card: "#0f1629",
          border: "#1e2d4a",
          accent: "#3b82f6",
          green: "#22c55e",
          red: "#ef4444",
          yellow: "#f59e0b",
          muted: "#6b7280",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
