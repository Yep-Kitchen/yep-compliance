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
          DEFAULT: "#F5C65A",   // golden – buttons, active states
          dark:    "#C9A24A",   // darker gold – hover
          light:   "#FFE08A",   // light yellow – sidebar
          cream:   "#FFF6D5",   // very light cream – page bg
        },
        brown: {
          DEFAULT: "#6B5B3E",   // dark warm brown – text
          light:   "#8a7355",
        },
      },
    },
  },
  plugins: [],
};

export default config;
