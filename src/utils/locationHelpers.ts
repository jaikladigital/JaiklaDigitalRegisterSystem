export interface GeoFetchResult {
  ok: boolean;
  lat?: number;
  lng?: number;
  source?: 'gps' | 'network' | 'ip';
  label?: string;
  reason?: 'permission_denied' | 'unavailable' | 'timeout' | 'unsupported';
  message?: string;
}

export function isValidCoordinates(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/**
 * Extracts latitude/longitude from plain coordinate strings or Google Maps URLs.
 */
export function parseCoordinatesFromText(input: string): { lat: number; lng: number } | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Google Maps !3d<lat>!4d<lng> pattern (most accurate pin location in place URLs)
  const dataPinMatch = trimmed.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dataPinMatch) {
    const lat = parseFloat(dataPinMatch[1]);
    const lng = parseFloat(dataPinMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }

  // 2. Google Maps /@<lat>,<lng> pattern
  const atMatch = trimmed.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }

  // 3. Query param patterns: ?q=lat,lng, ?ll=lat,lng, &center=lat,lng, &query=lat,lng
  const queryMatch = trimmed.match(/(?:[?&](?:q|ll|center|query|destination)=)(-?\d+(?:\.\d+)?)(?:,|%2C|\s+)(-?\d+(?:\.\d+)?)/i);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }

  // 4. Plain coordinate string: "13.7563, 100.5018" or "13.7563 100.5018"
  const plainMatch = trimmed.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (plainMatch) {
    const lat = parseFloat(plainMatch[1]);
    const lng = parseFloat(plainMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }

  return null;
}

const getPositionAsync = (options: PositionOptions): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject({ code: 0, message: 'Geolocation unsupported' });
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

/**
 * Resilient current-location fetcher:
 * 1) High-accuracy GPS
 * 2) Low-accuracy Wi-Fi / network triangulation retry
 * 3) Optional IP-based approximate fallback (for admin event setup when GPS hardware is unavailable)
 */
export async function getResilientLocation(options?: { allowIpFallback?: boolean }): Promise<GeoFetchResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    if (options?.allowIpFallback) {
      return await fetchIpApproximateLocation();
    }
    return {
      ok: false,
      reason: 'unsupported',
      message: 'เบราว์เซอร์หรืออุปกรณ์นี้ไม่รองรับการดึงพิกัดอัตโนมัติ',
    };
  }

  try {
    const pos = await getPositionAsync({
      enableHighAccuracy: true,
      timeout: 6500,
      maximumAge: 60000,
    });
    return {
      ok: true,
      lat: Number(pos.coords.latitude.toFixed(6)),
      lng: Number(pos.coords.longitude.toFixed(6)),
      source: 'gps',
    };
  } catch (err1: any) {
    // If user explicitly denied permission, don't retry GPS; optionally explain clearly
    if (err1?.code === 1) {
      return {
        ok: false,
        reason: 'permission_denied',
        message: 'เบราว์เซอร์ถูกปิดสิทธิ์การเข้าถึงตำแหน่ง กรุณากดอนุญาต (Allow Location) ที่แถบ URL หรือค้นหาชื่อสถานที่ด้านล่างแทน',
      };
    }

    // Retry with lower accuracy (helps laptops/desktops where high-accuracy GPS fails)
    try {
      const pos2 = await getPositionAsync({
        enableHighAccuracy: false,
        timeout: 7500,
        maximumAge: 300000,
      });
      return {
        ok: true,
        lat: Number(pos2.coords.latitude.toFixed(6)),
        lng: Number(pos2.coords.longitude.toFixed(6)),
        source: 'network',
      };
    } catch (err2: any) {
      if (err2?.code === 1) {
        return {
          ok: false,
          reason: 'permission_denied',
          message: 'เบราว์เซอร์ถูกปิดสิทธิ์การเข้าถึงตำแหน่ง กรุณาอนุญาตการเข้าถึงตำแหน่งในตั้งค่าเบราว์เซอร์',
        };
      }

      if (options?.allowIpFallback) {
        const ipRes = await fetchIpApproximateLocation();
        if (ipRes.ok) return ipRes;
      }

      return {
        ok: false,
        reason: err2?.code === 3 ? 'timeout' : 'unavailable',
        message: 'อุปกรณ์นี้ไม่สามารถส่งสัญญาณตำแหน่ง GPS ได้ (มักพบในคอมพิวเตอร์ตั้งโต๊ะหรือการเปิดผ่าน iframe) แนะนำให้ค้นหาชื่อสถานที่หรือวางลิงก์ Google Maps แทน',
      };
    }
  }
}

async function fetchIpApproximateLocation(): Promise<GeoFetchResult> {
  try {
    const res = await fetch('/api/location/ip-approx');
    if (res.ok) {
      const data = await res.json();
      if (typeof data?.lat === 'number' && typeof data?.lng === 'number' && isValidCoordinates(data.lat, data.lng)) {
        const parts = [data.city, data.region, data.country].filter(Boolean);
        return {
          ok: true,
          lat: Number(data.lat.toFixed(6)),
          lng: Number(data.lng.toFixed(6)),
          source: 'ip',
          label: parts.length > 0 ? `ตำแหน่งโดยประมาณ (${parts.join(', ')})` : 'ตำแหน่งโดยประมาณจากเครือข่าย',
        };
      }
    }
  } catch {
    // ignore network error
  }
  return {
    ok: false,
    reason: 'unavailable',
    message: 'ไม่สามารถดึงตำแหน่งอัตโนมัติได้ กรุณาค้นหาชื่อสถานที่หรือวางลิงก์ Google Maps ด้านล่าง',
  };
}

export function buildOpenStreetMapEmbedUrl(lat: number, lng: number): string {
  const deltaLat = 0.0045;
  const deltaLng = 0.0065;
  const bbox = `${(lng - deltaLng).toFixed(6)},${(lat - deltaLat).toFixed(6)},${(lng + deltaLng).toFixed(6)},${(lat + deltaLat).toFixed(6)}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)},${lng.toFixed(6)}`;
}
