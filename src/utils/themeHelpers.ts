export interface ThemePreset {
  id: string;
  name: string;
  subtitle: string;
  primary: string;
  secondary: string;
  accent: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'crimson-gala',
    name: 'Crimson Gala',
    subtitle: 'ค่าเริ่มต้น หรูหรา โดดเด่น',
    primary: '#e11d48',
    secondary: '#3b82f6',
    accent: '#10b981',
  },
  {
    id: 'royal-indigo',
    name: 'Royal Indigo',
    subtitle: 'งานประกาศรางวัล / Tech Summit',
    primary: '#4f46e5',
    secondary: '#0ea5e9',
    accent: '#f59e0b',
  },
  {
    id: 'emerald-prestige',
    name: 'Emerald Prestige',
    subtitle: 'งานสัมมนา / สุขภาพและความยั่งยืน',
    primary: '#059669',
    secondary: '#0f766e',
    accent: '#d97706',
  },
  {
    id: 'sapphire-corporate',
    name: 'Sapphire Corporate',
    subtitle: 'องค์กร / ประชุมผู้บริหาร',
    primary: '#1d4ed8',
    secondary: '#4f46e5',
    accent: '#0891b2',
  },
  {
    id: 'violet-luxury',
    name: 'Violet Luxury',
    subtitle: 'อีเวนต์บันเทิง / แฟชั่น',
    primary: '#7c3aed',
    secondary: '#db2777',
    accent: '#0d9488',
  },
  {
    id: 'obsidian-gold',
    name: 'Obsidian & Gold',
    subtitle: 'ทางการ ระดับ VIP',
    primary: '#1e293b',
    secondary: '#475569',
    accent: '#b45309',
  },
];

export function isValidHexColor(val: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(val.trim());
}

export function normalizeHexColor(val: unknown, fallback = '#e11d48'): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  return fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex);
  const intVal = parseInt(normalized.slice(1), 16);
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255,
  };
}

function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number) => {
    const srgb = c / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastRatioAgainstWhite(hex: string): number {
  const lum = getRelativeLuminance(hex);
  return (1.0 + 0.05) / (lum + 0.05);
}

export interface ContrastFeedback {
  ratio: number;
  level: 'excellent' | 'good' | 'low';
  label: string;
}

export function getContrastFeedback(hex: string): ContrastFeedback {
  const ratio = getContrastRatioAgainstWhite(hex);
  const rounded = Math.round(ratio * 10) / 10;
  if (ratio >= 4.5) {
    return {
      ratio: rounded,
      level: 'excellent',
      label: `ความคมชัดดีเยี่ยม (${rounded}:1) อ่านง่ายบนปุ่มสีขาว`,
    };
  }
  if (ratio >= 3.0) {
    return {
      ratio: rounded,
      level: 'good',
      label: `ความคมชัดปานกลาง (${rounded}:1) เหมาะกับหัวข้อและปุ่มขนาดใหญ่`,
    };
  }
  return {
    ratio: rounded,
    level: 'low',
    label: `สีค่อนข้างสว่าง (${rounded}:1) ตัวอักษรสีขาวบนปุ่มอาจอ่านยาก แนะนำเฉดที่เข้มขึ้น`,
  };
}
