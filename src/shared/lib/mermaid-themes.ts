export interface MermaidThemeVariables {
  [key: string]: string;
  background: string;
  lineColor: string;
  primaryBorderColor: string;
  primaryColor: string;
  primaryTextColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  textColor: string;
}

export const mermaidThemes: Record<string, MermaidThemeVariables> = {
  amber: {
    background: "#fefce8",
    lineColor: "#a16207",
    primaryBorderColor: "#ca8a04",
    primaryColor: "#eab308",
    primaryTextColor: "#ffffff",
    secondaryColor: "#fef08a",
    tertiaryColor: "#fefce8",
    textColor: "#854d0e",
  },

  bronze: {
    background: "#fef3c7",
    lineColor: "#92400e",
    primaryBorderColor: "#b45309",
    primaryColor: "#d97706",
    primaryTextColor: "#ffffff",
    secondaryColor: "#fcd34d",
    tertiaryColor: "#fef3c7",
    textColor: "#78350f",
  },
  charcoal: {
    background: "#111827",
    lineColor: "#6b7280",
    primaryBorderColor: "#334155",
    primaryColor: "#475569",
    primaryTextColor: "#f8fafc",
    secondaryColor: "#1f2937",
    tertiaryColor: "#374151",
    textColor: "#f9fafb",
  },
  // Warm Family
  coral: {
    background: "#fff7ed",
    lineColor: "#c2410c",
    primaryBorderColor: "#ea580c",
    primaryColor: "#f97316",
    primaryTextColor: "#ffffff",
    secondaryColor: "#fed7aa",
    tertiaryColor: "#fff7ed",
    textColor: "#9a3412",
  },
  crimson: {
    background: "#fef2f2",
    lineColor: "#b91c1c",
    primaryBorderColor: "#dc2626",
    primaryColor: "#ef4444",
    primaryTextColor: "#ffffff",
    secondaryColor: "#fecaca",
    tertiaryColor: "#fef2f2",
    textColor: "#991b1b",
  },

  // Classic Green Family
  emerald: {
    background: "#f0fdf4",
    lineColor: "#166534",
    primaryBorderColor: "#16a34a",
    primaryColor: "#22c55e",
    primaryTextColor: "#ffffff",
    secondaryColor: "#dcfce7",
    tertiaryColor: "#f0fdf4",
    textColor: "#166534",
  },
  indigo: {
    background: "#eef2ff",
    lineColor: "#4338ca",
    primaryBorderColor: "#4f46e5",
    primaryColor: "#6366f1",
    primaryTextColor: "#ffffff",
    secondaryColor: "#c7d2fe",
    tertiaryColor: "#eef2ff",
    textColor: "#3730a3",
  },
  lime: {
    background: "#f4f4af",
    lineColor: "#4d7c0f",
    primaryBorderColor: "#65a30d",
    primaryColor: "#84cc16",
    primaryTextColor: "#ffffff",
    secondaryColor: "#d4ed87",
    tertiaryColor: "#f4f4af",
    textColor: "#415f0b",
  },

  mint: {
    background: "#f0fdf4",
    lineColor: "#059669",
    primaryBorderColor: "#10b981",
    primaryColor: "#6ee7b7",
    primaryTextColor: "#ffffff",
    secondaryColor: "#a7f3d0",
    tertiaryColor: "#ecfdf5",
    textColor: "#047857",
  },
  // Cool Blue Family
  ocean: {
    background: "#eff6ff",
    lineColor: "#0369a1",
    primaryBorderColor: "#0284c7",
    primaryColor: "#0ea5e9",
    primaryTextColor: "#ffffff",
    secondaryColor: "#bae6fd",
    tertiaryColor: "#eff6ff",
    textColor: "#1e40af",
  },
  rose: {
    background: "#fdf2f8",
    lineColor: "#c026d3",
    primaryBorderColor: "#db2777",
    primaryColor: "#ec4899",
    primaryTextColor: "#ffffff",
    secondaryColor: "#fbcfe8",
    tertiaryColor: "#fdf2f8",
    textColor: "#be185d",
  },

  sky: {
    background: "#f0f9ff",
    lineColor: "#0284c7",
    primaryBorderColor: "#0ea5e9",
    primaryColor: "#38bdf8",
    primaryTextColor: "#ffffff",
    secondaryColor: "#bae6fd",
    tertiaryColor: "#f0f9ff",
    textColor: "#0369a1",
  },
  // Dark Professional
  slate: {
    background: "#0f172a",
    lineColor: "#334155",
    primaryBorderColor: "#475569",
    primaryColor: "#64748b",
    primaryTextColor: "#f8fafc",
    secondaryColor: "#1e293b",
    tertiaryColor: "#1e293b",
    textColor: "#f1f5f9",
  },

  // Green Variations
  teal: {
    background: "#f0fdfa",
    lineColor: "#115e59",
    primaryBorderColor: "#0d9488",
    primaryColor: "#14b8a6",
    primaryTextColor: "#ffffff",
    secondaryColor: "#ccfbf1",
    tertiaryColor: "#f0fdfa",
    textColor: "#0f766e",
  },
  // Purple/Pink Family
  violet: {
    background: "#faf5ff",
    lineColor: "#7c3aed",
    primaryBorderColor: "#9333ea",
    primaryColor: "#a855f7",
    primaryTextColor: "#ffffff",
    secondaryColor: "#e9d5ff",
    tertiaryColor: "#faf5ff",
    textColor: "#581c87",
  },
} as const;

export type MermaidCustomTheme = keyof typeof mermaidThemes;

export const themeGroups = [
  {
    label: "Green",
    themes: ["emerald", "teal", "lime", "mint"] as MermaidCustomTheme[],
  },
  {
    label: "Warm",
    themes: ["coral", "amber", "crimson", "bronze"] as MermaidCustomTheme[],
  },
  {
    label: "Cool",
    themes: ["ocean", "sky", "indigo"] as MermaidCustomTheme[],
  },
  {
    label: "Purple / Pink",
    themes: ["violet", "rose"] as MermaidCustomTheme[],
  },
  {
    label: "Dark",
    themes: ["slate", "charcoal"] as MermaidCustomTheme[],
  },
] as const;
