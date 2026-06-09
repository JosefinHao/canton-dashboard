import type { Config } from "tailwindcss";

/* ============================================================================
   CANTON CURRENT BRAND — off-brand palette remap
   Source of truth: website_analysis/CURRENT_SYSTEM (Canton Brand Guide v2 +
   live theme). The codebase has ~500 hardcoded Tailwind color utilities
   (text-green-500, bg-blue-400, border-pink-500, …) that bypass the design
   tokens. Rather than edit every call site, we re-point the off-brand color
   FAMILIES at Canton-hued ramps here. Each ramp preserves the per-shade
   lightness of Tailwind's defaults, so existing light-bg / dark-text pairings
   keep their contrast — only the hue shifts onto the Canton palette.
   Canton: Yellow #F3FF97 · Purple #875CFF · Lilac #D5A5E3 · Orange #e07b1a · Error #D92D20
   ========================================================================== */
const yellowRamp = { 50:"hsl(67 100% 96%)",100:"hsl(67 100% 92%)",200:"hsl(67 96% 85%)",300:"hsl(68 95% 80%)",400:"hsl(68 82% 67%)",500:"hsl(70 70% 53%)",600:"hsl(72 74% 43%)",700:"hsl(74 78% 34%)",800:"hsl(76 70% 27%)",900:"hsl(78 64% 21%)",950:"hsl(80 60% 13%)",DEFAULT:"hsl(68 95% 80%)" };
const purpleRamp = { 50:"hsl(256 100% 96%)",100:"hsl(256 100% 93%)",200:"hsl(256 100% 87%)",300:"hsl(256 100% 81%)",400:"hsl(256 100% 74%)",500:"hsl(256 100% 68%)",600:"hsl(256 82% 58%)",700:"hsl(256 70% 48%)",800:"hsl(256 60% 38%)",900:"hsl(256 54% 28%)",950:"hsl(256 54% 18%)",DEFAULT:"hsl(256 100% 68%)" };
const lilacRamp = { 50:"hsl(286 60% 96%)",100:"hsl(286 60% 93%)",200:"hsl(286 56% 88%)",300:"hsl(286 53% 82%)",400:"hsl(286 53% 77%)",500:"hsl(286 50% 68%)",600:"hsl(287 45% 58%)",700:"hsl(288 42% 47%)",800:"hsl(289 40% 37%)",900:"hsl(290 38% 28%)",950:"hsl(290 38% 18%)",DEFAULT:"hsl(286 53% 77%)" };
const redRamp = { 50:"hsl(4 80% 96%)",100:"hsl(4 80% 92%)",200:"hsl(4 78% 85%)",300:"hsl(4 76% 75%)",400:"hsl(4 74% 62%)",500:"hsl(4 73% 49%)",600:"hsl(2 76% 43%)",700:"hsl(358 76% 36%)",800:"hsl(356 78% 30%)",900:"hsl(354 78% 24%)",950:"hsl(352 80% 15%)",DEFAULT:"hsl(4 73% 49%)" };
const orangeRamp = { 50:"hsl(33 90% 96%)",100:"hsl(33 90% 90%)",200:"hsl(32 88% 80%)",300:"hsl(31 85% 68%)",400:"hsl(30 82% 58%)",500:"hsl(29 79% 49%)",600:"hsl(27 80% 43%)",700:"hsl(25 80% 35%)",800:"hsl(23 78% 28%)",900:"hsl(22 75% 22%)",950:"hsl(20 75% 14%)",DEFAULT:"hsl(29 79% 49%)" };

/* Map each off-brand Tailwind family onto a Canton ramp.
   Greens/lime → Canton chartreuse-yellow (positive). Reds/rose → Canton error.
   Amber/orange → Canton orange (warning). All cool hues → Canton purple.
   Pink/fuchsia → Canton lilac. Neutral grays are left as-is (already on-brand). */
const cantonPaletteRemap = {
  green: yellowRamp, emerald: yellowRamp, lime: yellowRamp, yellow: yellowRamp,
  red: redRamp, rose: redRamp,
  amber: orangeRamp, orange: orangeRamp,
  blue: purpleRamp, sky: purpleRamp, indigo: purpleRamp, violet: purpleRamp, cyan: purpleRamp, teal: purpleRamp,
  pink: lilacRamp, fuchsia: lilacRamp,
};

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Off-brand Tailwind families re-pointed at Canton ramps (see top of file).
        ...cantonPaletteRemap,
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Neon colors
        neon: {
          pink: "hsl(var(--neon-pink))",
          purple: "hsl(var(--neon-purple))",
          blue: "hsl(var(--neon-blue))",
          cyan: "hsl(var(--neon-cyan))",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
      },
      letterSpacing: {
        widest: "0.2em",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "glow-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 20px hsl(var(--primary) / 0.4)",
          },
          "50%": {
            boxShadow: "0 0 40px hsl(var(--primary) / 0.6)",
          },
        },
        "neon-flicker": {
          "0%, 100%": {
            opacity: "1",
          },
          "50%": {
            opacity: "0.8",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "neon-flicker": "neon-flicker 3s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
