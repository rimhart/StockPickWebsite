import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#08111f",
        panel: "rgba(8, 17, 31, 0.72)",
        line: "rgba(148, 163, 184, 0.18)",
        positive: "#2dd4bf",
        caution: "#f59e0b",
        accent: "#60a5fa",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(96, 165, 250, 0.18), 0 18px 60px rgba(0, 0, 0, 0.35)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at top, rgba(96, 165, 250, 0.24), transparent 30%), linear-gradient(180deg, rgba(8,17,31,1), rgba(3,7,18,1))",
      },
      animation: {
        float: "float 10s ease-in-out infinite",
        pulseSlow: "pulseSlow 6s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        pulseSlow: {
          "0%, 100%": { opacity: "0.65" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;