import type { Config } from "tailwindcss";

// Light store canvas. fog is type. volt is the single action colour.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#ffffff",
        ink: "#f5f5f7",
        ink2: "#e8e8ed",
        fog: "#1d1d1f",
        mute: "#6e6e73",
        volt: "#0071e3",
        magenta: "#FF3DCB",
        gold: "#FFC24B"
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"]
      },
      clipPath: {
        keyhole: "polygon(0 0, 100% 0, 100% 100%, 24px 100%, 0 calc(100% - 24px))"
      }
    }
  },
  plugins: [
    function ({ addUtilities }: any) {
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
