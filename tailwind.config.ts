import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/renderer/**/*.{ts,tsx,html}", "./index.html"],
  theme: {
    extend: {
      colors: {
        background: "#0D0E1A",
        surface: "#141528",
        "surface-2": "#1C1E38",
        border: "#252845",
        accent: {
          DEFAULT: "#F97316",
          foreground: "#FFFFFF",
        },
        viral: {
          hot: "#EF4444",
          warm: "#F97316",
          cool: "#6B7280",
        },
        text: {
          primary: "#E8EAF6",
          secondary: "#8892B0",
          muted: "#555A7A",
        },
        live: "#22C55E",
        purple: {
          DEFAULT: "#8B5CF6",
          light: "#A78BFA",
          dark: "#6D28D9",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "gradient-investments": "linear-gradient(135deg, #7C3AED 0%, #4F46E5 50%, #2563EB 100%)",
        "gradient-economy-br": "linear-gradient(135deg, #059669 0%, #0D9488 50%, #0891B2 100%)",
        "gradient-economy-int": "linear-gradient(135deg, #2563EB 0%, #4F46E5 50%, #7C3AED 100%)",
        "gradient-geopolitics": "linear-gradient(135deg, #EA580C 0%, #DC2626 50%, #BE185D 100%)",
        "gradient-crypto": "linear-gradient(135deg, #D97706 0%, #F97316 50%, #EA580C 100%)",
        "gradient-general": "linear-gradient(135deg, #475569 0%, #334155 50%, #1E293B 100%)",
      },
      boxShadow: {
        card: "0 4px 24px rgba(0, 0, 0, 0.4)",
        "card-hover": "0 8px 32px rgba(0, 0, 0, 0.6)",
        accent: "0 4px 20px rgba(249, 115, 22, 0.25)",
        glow: "0 0 40px rgba(139, 92, 246, 0.15)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-in",
        "bounce-subtle": "bounceSubtle 1.2s ease-in-out infinite",
      },
      keyframes: {
        bounceSubtle: {
          "0%, 100%": { transform: "translateX(-50%) translateY(0)" },
          "50%": { transform: "translateX(-50%) translateY(-4px)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideIn: {
          "0%": { transform: "translateX(20px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
    },
  },
  plugins: [animate],
};

export default config;
