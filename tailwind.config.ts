import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["var(--font-instrument-serif)", "Georgia", "serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#FBEC5D",
          dark: "#EDD930",
          light: "#FDF07A",
        },
        brown: {
          DEFAULT: "#3C3425",
          light: "#5a4e38",
        },
      },
    },
  },
  plugins: [],
};

export default config;
