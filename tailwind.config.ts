import type { Config } from "tailwindcss";

// Tokens taken directly from docs/DESIGN.md — do not add colors here
// without adding them to DESIGN.md first.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0F6B4F",
        ink: "#101A1E",
        paper: "#F1F4F3",
        panel: "#FFFFFF",
        line: "#D3DCDA",
        muted: "#5C6B70",
        positive: "#0F6B4F",
        negative: "#C0362C",
        warning: "#E0932B",
        online: "#2563A6",
        cash: "#5C6B70",
      },
      borderRadius: {
        card: "12px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
