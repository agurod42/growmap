import type { Config } from "tailwindcss";
import { heroui } from "@heroui/react";

const heroUiPlugin = heroui() as unknown as NonNullable<Config["plugins"]>[number];

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx,mjs}",
    "./node_modules/@heroui/**/@heroui/theme/dist/**/*.{js,ts,jsx,tsx,mjs}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "sans-serif"]
      }
    }
  },
  darkMode: "class",
  plugins: [heroUiPlugin]
};

export default config;
