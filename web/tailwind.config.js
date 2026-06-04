/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        oph: {
          primary: "#2563eb",
          "primary-content": "#ffffff",
          secondary: "#0ea5e9",
          accent: "#10b981",
          neutral: "#1f2937",
          "base-100": "#ffffff",
          "base-200": "#eef1f6",
          "base-300": "#d3d9e3",
          "base-content": "#1e293b",
          info: "#0ea5e9",
          success: "#16a34a",
          warning: "#f59e0b",
          error: "#dc2626",
          "--rounded-box": "0.75rem",
          "--rounded-btn": "0.5rem",
        },
      },
      "light",
    ],
  },
};
