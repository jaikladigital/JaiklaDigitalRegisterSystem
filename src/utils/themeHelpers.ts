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

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex);
  const intVal = parseInt(normalized.slice(1), 16);
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255,
  };
}

export function mixHexColors(hexA: string, hexB: string, weightA: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const wA = Math.max(0, Math.min(1, weightA));
  const wB = 1 - wA;
  return rgbToHex(a.r * wA + b.r * wB, a.g * wA + b.g * wB, a.b * wA + b.b * wB);
}

export function getHoverShadeHex(hex: string): string {
  return mixHexColors(hex, '#000000', 0.8);
}

export function getLightTintHex(hex: string): string {
  return mixHexColors(hex, '#ffffff', 0.1);
}

function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number) => {
    const srgb = c / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getPairContrastRatio(hexA: string, hexB: string): number {
  const lumA = getRelativeLuminance(hexA);
  const lumB = getRelativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getContrastRatioAgainstWhite(hex: string): number {
  return getPairContrastRatio(hex, '#ffffff');
}

/**
 * Progressively darkens a color until it meets at least minRatio contrast against white.
 */
export function suggestAccessibleShade(hex: string, minRatio = 4.55): string {
  let candidate = normalizeHexColor(hex);
  if (getContrastRatioAgainstWhite(candidate) >= minRatio) {
    return candidate;
  }
  for (let step = 95; step >= 10; step -= 3) {
    const mixed = mixHexColors(candidate, '#000000', step / 100);
    if (getContrastRatioAgainstWhite(mixed) >= minRatio) {
      return mixed;
    }
  }
  return '#1e293b';
}

export interface ContrastFeedback {
  ratio: number;
  level: 'excellent' | 'good' | 'low';
  shortLabel: string;
  label: string;
}

export function getContrastFeedback(hex: string): ContrastFeedback {
  const ratio = getContrastRatioAgainstWhite(hex);
  const rounded = Math.round(ratio * 10) / 10;
  if (ratio >= 4.5) {
    return {
      ratio: rounded,
      level: 'excellent',
      shortLabel: `คมชัดดีเยี่ยม ${rounded}:1`,
      label: `ความคมชัดดีเยี่ยม (${rounded}:1) อ่านง่ายบนปุ่มข้อความสีขาว`,
    };
  }
  if (ratio >= 3.0) {
    return {
      ratio: rounded,
      level: 'good',
      shortLabel: `คมชัดปานกลาง ${rounded}:1`,
      label: `ความคมชัดปานกลาง (${rounded}:1) เหมาะกับหัวข้อและปุ่มขนาดใหญ่`,
    };
  }
  return {
    ratio: rounded,
    level: 'low',
    shortLabel: `สีสว่าง ${rounded}:1`,
    label: `สีค่อนข้างสว่าง (${rounded}:1) ตัวอักษรสีขาวบนปุ่มอาจอ่านยาก แนะนำปรับเข้มขึ้น`,
  };
}
