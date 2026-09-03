import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#f3f6fb",
        ink: "#eceff3",
        ink2: "#e2e5ea",
        fog: "#1d1d1f",
        mute: "#6e6e73",
        volt: "#111111",
        magenta: "#1d1d1f",
        gold: "#FFC24B"
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"]
      }
    }
  },
  plugins: [
    function ({ addUtilities }: { addUtilities: (u: Record<string, Record<string, string>>) => void }) {
      addUtilities({
        ".clip-keyhole": {
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 24px 100%, 0 calc(100% - 24px))"
        },
        ".clip-keyhole-sm": {
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 14px 100%, 0 calc(100% - 14px))"
        }
      });
    }
  ]
};

export default config;
