export const DEFAULT_LINE_OA_ID = '@454hwmgg';
export const DEFAULT_LINE_OA_URL = 'https://line.me/R/ti/p/@454hwmgg';

export interface LineOaInfo {
  id: string;
  url: string;
  displayLabel: string;
}

const LEGACY_LINE_IDS = ['@792zqqbw', '@5jvdqky', 'digitecteam'];

/**
 * Normalizes a LINE OA ID or URL (e.g. "@454hwmgg", "454hwmgg", or "https://line.me/R/ti/p/@454hwmgg")
 * into a guaranteed-scannable LINE Add Friend URL and clean display label.
 */
export function normalizeLineOaInfo(rawInput?: string | null): LineOaInfo {
  const trimmed = (rawInput || '').trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed || LEGACY_LINE_IDS.some((legacy) => lower.includes(legacy))) {
    return {
      id: DEFAULT_LINE_OA_ID,
      url: DEFAULT_LINE_OA_URL,
      displayLabel: `LINE: ${DEFAULT_LINE_OA_ID}`,
    };
  }

  // If user pasted a full URL (e.g. https://line.me/R/ti/p/@454hwmgg or https://lin.ee/xxxx)
  if (/^https?:\/\//i.test(trimmed)) {
    const idMatch = trimmed.match(/@[a-zA-Z0-9._-]+/);
    if (idMatch) {
      const id = idMatch[0];
      return {
        id,
        url: trimmed,
        displayLabel: `LINE: ${id}`,
      };
    }
    const lastSegment = trimmed.split('/').filter(Boolean).pop() || DEFAULT_LINE_OA_ID;
    const displayId = lastSegment.startsWith('@') ? lastSegment : `@${lastSegment}`;
    return {
      id: displayId,
      url: trimmed,
      displayLabel: `LINE: ${displayId}`,
    };
  }

  // User entered a LINE ID (with or without leading @)
  const cleanId = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
  const encodedId = encodeURIComponent(cleanId).replace(/%40/g, '@');
  return {
    id: cleanId,
    url: `https://line.me/R/ti/p/${encodedId}`,
    displayLabel: `LINE: ${cleanId}`,
  };
}
