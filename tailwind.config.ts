import type { Config } from "tailwindcss";

// UNLOCK design tokens.
// Palette: violet-black void (not pure #000), volt for one word / primary action,
// magenta + gold reserved only for "reward won" moments — never decorative chrome.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0B0A14",
        ink: "#15132A",
        ink2: "#1E1B3A",
        fog: "#ECE9F7",
        mute: "#8B87A8",
        volt: "#C6FF3D",
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
