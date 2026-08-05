/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./constants.tsx",
    "./types.ts",
    "./components/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
    "./data/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Pathmora 统一配色：近黑底 + 克制紫
        primary: "#7c6cff",
        secondary: "#a78bfa",
        dark: "#07070e",
        card: "#12121c",
        // 语义化 token（新设计系统，映射到 styles.css 的 CSS 变量，支持透明度修饰符）
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        "surface-3": "rgb(var(--surface-3) / <alpha-value>)",
        body: "rgb(var(--text-body) / <alpha-value>)",
        muted: "rgb(var(--text-muted) / <alpha-value>)",
        faint: "rgb(var(--text-faint) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        "line-strong": "rgb(var(--line-strong) / <alpha-value>)",
        // 暗夜霓虹
        neon: "rgb(var(--neon) / <alpha-value>)",
        "neon-2": "rgb(var(--neon-2) / <alpha-value>)",
        "neon-3": "rgb(var(--neon-3) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Fira Code", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(124,108,255,0.35)",
        "glow-sm": "0 0 12px rgba(124,108,255,0.25)",
        "glow-neon": "0 0 20px rgba(139,92,246,0.5), 0 0 44px rgba(34,211,238,0.16)",
        "glow-cyan": "0 0 16px rgba(34,211,238,0.45)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
