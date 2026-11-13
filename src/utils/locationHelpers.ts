export interface GeoFetchResult {
  ok: boolean;
  lat?: number;
  lng?: number;
  source?: 'gps' | 'network' | 'ip';
  label?: string;
  reason?: 'permission_denied' | 'unavailable' | 'timeout' | 'unsupported';
  message?: string;
}

export interface VenueSearchResult {
  placeId: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  type?: string;
  source?: 'popular' | 'api' | 'photon' | 'nominatim' | 'coords';
}

interface CuratedVenueEntry {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  type: string;
  keywords: string[];
  quickPick?: boolean;
}

export const THAI_POPULAR_VENUES: CuratedVenueEntry[] = [
  {
    id: 'impact-muangthong',
    name: 'อิมแพ็ค เมืองทองธานี (IMPACT Muang Thong Thani)',
    displayName: 'อิมแพ็ค เมืองทองธานี, ถ.ป๊อปปูล่า, ต.บ้านใหม่, อ.ปากเกร็ด, จ.นนทบุรี 11120',
    lat: 13.913426,
    lng: 100.547626,
    type: 'ศูนย์แสดงสินค้าและนิทรรศการ',
    keywords: ['อิมแพ็ค', 'impact', 'เมืองทอง', 'เมืองทองธานี', 'muang thong', 'นนทบุรี'],
    quickPick: true,
  },
  {
    id: 'impact-challenger',
    name: 'อาคารอิมแพ็ค ชาเลนเจอร์ (IMPACT Challenger)',
    displayName: 'อาคารอิมแพ็ค ชาเลนเจอร์ 1-3, เมืองทองธานี, อ.ปากเกร็ด, จ.นนทบุรี 11120',
    lat: 13.912905,
    lng: 100.546605,
    type: 'ฮอลล์จัดงานและคอนเสิร์ต',
    keywords: ['อิมแพ็ค', 'impact', 'ชาเลนเจอร์', 'challenger', 'เมืองทอง'],
  },
  {
    id: 'impact-arena',
    name: 'อิมแพ็ค อารีน่า เมืองทองธานี (IMPACT Arena)',
    displayName: 'อิมแพ็ค อารีน่า, ถ.ป๊อปปูล่า, เมืองทองธานี, อ.ปากเกร็ด, จ.นนทบุรี 11120',
    lat: 13.911562,
    lng: 100.548383,
    type: 'อารีน่า/คอนเสิร์ตฮอลล์',
    keywords: ['อิมแพ็ค', 'impact', 'อารีน่า', 'arena', 'เมืองทอง'],
  },
  {
    id: 'impact-forum',
    name: 'อาคารอิมแพ็ค ฟอรั่ม (IMPACT Forum)',
    displayName: 'อิมแพ็ค ฟอรั่ม, ถ.ป๊อปปูล่า, เมืองทองธานี, อ.ปากเกร็ด, จ.นนทบุรี 11120',
    lat: 13.915976,
    lng: 100.547264,
    type: 'ศูนย์ประชุม',
    keywords: ['อิมแพ็ค', 'impact', 'ฟอรั่ม', 'forum', 'เมืองทอง'],
  },
  {
    id: 'qsncc',
    name: 'ศูนย์การประชุมแห่งชาติสิริกิติ์ (QSNCC)',
    displayName: 'ศูนย์การประชุมแห่งชาติสิริกิติ์, ถ.รัชดาภิเษก, คลองเตย, กรุงเทพฯ 10110',
    lat: 13.723579,
    lng: 100.559496,
    type: 'ศูนย์การประชุมแห่งชาติ',
    keywords: ['สิริกิติ์', 'ศูนย์ประชุมสิริกิติ์', 'ศูนย์สิริกิติ์', 'qsncc', 'queen sirikit', 'คลองเตย'],
    quickPick: true,
  },
  {
    id: 'bitec-bangna',
    name: 'ไบเทค บางนา (BITEC Bangna)',
    displayName: 'ศูนย์นิทรรศการและการประชุมไบเทค, ถ.เทพรัตน, เขตบางนา, กรุงเทพฯ 10260',
    lat: 13.669173,
    lng: 100.609515,
    type: 'ศูนย์นิทรรศการและการประชุม',
    keywords: ['ไบเทค', 'bitec', 'บางนา', 'bangna', 'ไบเทคบุรี'],
    quickPick: true,
  },
  {
    id: 'centralworld',
    name: 'เซ็นทรัลเวิลด์ (centralwOrld Live / Convention)',
    displayName: 'เซ็นทรัลเวิลด์, ถ.ราชดำริ, เขตปทุมวัน, กรุงเทพฯ 10330',
    lat: 13.746635,
    lng: 100.539335,
    type: 'ศูนย์การค้าและฮอลล์จัดงาน',
    keywords: ['เซ็นทรัลเวิลด์', 'centralworld', 'central world', 'ctw', 'ราชประสงค์', 'ปทุมวัน'],
    quickPick: true,
  },
  {
    id: 'iconsiam',
    name: 'ไอคอนสยาม / ทรู ไอคอน ฮอลล์ (TRUE ICON HALL)',
    displayName: 'ไอคอนสยาม, ถ.เจริญนคร, เขตคลองสาน, กรุงเทพฯ 10600',
    lat: 13.726718,
    lng: 100.510519,
    type: 'ศูนย์การค้าและฮอลล์จัดงาน',
    keywords: ['ไอคอนสยาม', 'iconsiam', 'true icon hall', 'ทรู ไอคอน', 'เจริญนคร', 'คลองสาน'],
    quickPick: true,
  },
  {
    id: 'samyan-mitrtown',
    name: 'สามย่านมิตรทาวน์ ฮอลล์ (Samyan Mitrtown Hall)',
    displayName: 'สามย่านมิตรทาวน์, ถ.พระรามที่ 4, เขตปทุมวัน, กรุงเทพฯ 10330',
    lat: 13.733614,
    lng: 100.528451,
    type: 'ฮอลล์จัดงานและศูนย์ประชุม',
    keywords: ['สามย่าน', 'มิตรทาวน์', 'samyan', 'mitrtown', 'พระราม 4'],
    quickPick: true,
  },
  {
    id: 'royal-paragon-hall',
    name: 'พารากอน ฮอลล์ (Paragon Hall - Siam Paragon)',
    displayName: 'สยามพารากอน ชั้น 5, ถ.พระรามที่ 1, เขตปทุมวัน, กรุงเทพฯ 10330',
    lat: 13.746233,
    lng: 100.534740,
    type: 'ฮอลล์จัดงานและคอนเสิร์ต',
    keywords: ['พารากอน', 'สยามพารากอน', 'paragon', 'royal paragon hall', 'สยาม'],
  },
  {
    id: 'union-hall',
    name: 'ยูเนี่ยน ฮอลล์ (Union Hall - Union Mall)',
    displayName: 'ยูเนี่ยน มอลล์ ชั้น 6, ถ.ลาดพร้าว, เขตจตุจักร, กรุงเทพฯ 10900',
    lat: 13.813019,
    lng: 100.561288,
    type: 'ฮอลล์จัดงาน',
    keywords: ['ยูเนี่ยน', 'union', 'union hall', 'ลาดพร้าว', 'ห้าแยกลาดพร้าว'],
  },
  {
    id: 'centara-grand-ctw',
    name: 'โรงแรมเซ็นทารา แกรนด์ แอท เซ็นทรัลเวิลด์',
    displayName: 'เซ็นทารา แกรนด์ และบางกอกคอนเวนชันเซ็นเตอร์, ปทุมวัน, กรุงเทพฯ 10330',
    lat: 13.747625,
    lng: 100.538767,
    type: 'โรงแรมและศูนย์ประชุม',
    keywords: ['เซ็นทารา', 'centara', 'เซ็นทาราแกรนด์', 'บางกอกคอนเวนชัน'],
  },
  {
    id: 'centara-ladprao',
    name: 'โรงแรมเซ็นทารา แกรนด์ เซ็นทรัลพลาซา ลาดพร้าว',
    displayName: 'ถ.พหลโยธิน, แขวงจตุจักร, เขตจตุจักร, กรุงเทพฯ 10900',
    lat: 13.818056,
    lng: 100.560833,
    type: 'โรงแรมและศูนย์ประชุม',
    keywords: ['เซ็นทารา ลาดพร้าว', 'centara ladprao', 'เซ็นทรัลลาดพร้าว', 'bcc hall'],
  },
  {
    id: 'marriott-marquis',
    name: 'แบงค็อก แมริออท มาร์คีส์ ควีนส์ปาร์ค',
    displayName: 'ซ.สุขุมวิท 22, แขวงคลองตัน, เขตคลองเตย, กรุงเทพฯ 10110',
    lat: 13.729402,
    lng: 100.565348,
    type: 'โรงแรมและห้องประชุม',
    keywords: ['แมริออท', 'marriott', 'marquis', 'ควีนส์ปาร์ค', 'สุขุมวิท 22'],
  },
  {
    id: 'uob-live-emsphere',
    name: 'UOB LIVE / ดิ เอ็มสเฟียร์ (EMSPHERE)',
    displayName: 'ศูนย์การค้าดิ เอ็มสเฟียร์, ถ.สุขุมวิท, เขตคลองเตย, กรุงเทพฯ 10110',
    lat: 13.732758,
    lng: 100.567568,
    type: 'ฮอลล์จัดงานและคอนเสิร์ต',
    keywords: ['uob live', 'emsphere', 'เอ็มสเฟียร์', 'สุขุมวิท'],
  },
  {
    id: 'thailand-cultural-centre',
    name: 'ศูนย์วัฒนธรรมแห่งประเทศไทย',
    displayName: 'ถ.เทียมร่วมมิตร, เขตห้วยขวาง, กรุงเทพฯ 10310',
    lat: 13.765242,
    lng: 100.573968,
    type: 'หอประชุมและศูนย์วัฒนธรรม',
    keywords: ['ศูนย์วัฒนธรรม', 'cultural centre', 'ห้วยขวาง', 'รัชดา'],
  },
  {
    id: 'rajamangala',
    name: 'ราชมังคลากีฬาสถาน (Rajamangala Stadium)',
    displayName: 'ถ.รามคำแหง, แขวงหัวหมาก, เขตบางกะปิ, กรุงเทพฯ 10240',
    lat: 13.755482,
    lng: 100.622138,
    type: 'สนามกีฬาและคอนเสิร์ต',
    keywords: ['ราชมังคลา', 'rajamangala', 'หัวหมาก', 'กกท', 'รามคำแหง'],
  },
  {
    id: 'muangthai-live',
    name: 'เมืองไทย รัชดาลัย เธียเตอร์ / เอสพลานาด',
    displayName: 'เอสพลานาด รัชดาภิเษก, เขตดินแดง, กรุงเทพฯ 10400',
    lat: 13.766218,
    lng: 100.569828,
    type: 'โรงละครและฮอลล์',
    keywords: ['รัชดาลัย', 'เมืองไทย', 'เอสพลานาด', 'rachadalai', 'esplanade'],
  },
  {
    id: 'mcc-hall-bangkapi',
    name: 'MCC Hall เดอะมอลล์ ไลฟ์สโตร์ บางกะปิ',
    displayName: 'เดอะมอลล์ บางกะปิ, ถ.ลาดพร้าว, เขตบางกะปิ, กรุงเทพฯ 10240',
    lat: 13.765985,
    lng: 100.642571,
    type: 'ฮอลล์จัดงาน',
    keywords: ['mcc hall', 'เดอะมอลล์', 'บางกะปิ', 'the mall bangkapi'],
  },
  {
    id: 'cmecc-chiangmai',
    name: 'ศูนย์ประชุมและแสดงสินค้านานาชาติฯ เชียงใหม่ (CMECC)',
    displayName: 'ต.ช้างเผือก, อ.เมืองเชียงใหม่, จ.เชียงใหม่ 50300',
    lat: 18.828647,
    lng: 98.960452,
    type: 'ศูนย์ประชุมนานาชาติ',
    keywords: ['เชียงใหม่', 'chiang mai', 'cmecc', 'ศูนย์ประชุมเชียงใหม่', 'ช้างเผือก'],
  },
  {
    id: 'kice-khonkaen',
    name: 'ศูนย์ประชุมและแสดงสินค้านานาชาติ ขอนแก่น (KICE)',
    displayName: 'ถ.มิตรภาพ, ต.เมืองเก่า, อ.เมืองขอนแก่น, จ.ขอนแก่น 40000',
    lat: 16.395896,
    lng: 102.811748,
    type: 'ศูนย์ประชุมนานาชาติ',
    keywords: ['ขอนแก่น', 'khon kaen', 'kice', 'ไคซ์', 'ศูนย์ประชุมขอนแก่น'],
  },
  {
    id: 'psu-icc-hatyai',
    name: 'ศูนย์ประชุมนานาชาติฯ ม.อ. หาดใหญ่ (PSU ICC)',
    displayName: 'มหาวิทยาลัยสงขลานครินทร์, อ.หาดใหญ่, จ.สงขลา 90110',
    lat: 7.007419,
    lng: 100.501573,
    type: 'ศูนย์ประชุมนานาชาติ',
    keywords: ['หาดใหญ่', 'สงขลา', 'hat yai', 'psu icc', 'ม.อ.', 'ศูนย์ประชุมหาดใหญ่'],
  },
  {
    id: 'peach-pattaya',
    name: 'ศูนย์ประชุมพีช พัทยา (PEACH - Royal Cliff)',
    displayName: 'เขาพระตำหนัก, เมืองพัทยา, อ.บางละมุง, จ.ชลบุรี 20150',
    lat: 12.921912,
    lng: 100.859918,
    type: 'ศูนย์ประชุมและโรงแรม',
    keywords: ['พัทยา', 'pattaya', 'peach', 'royal cliff', 'ชลบุรี'],
  },
  {
    id: 'chulalongkorn',
    name: 'หอประชุมจุฬาลงกรณ์มหาวิทยาลัย',
    displayName: 'ถ.พญาไท, แขวงวังใหม่, เขตปทุมวัน, กรุงเทพฯ 10330',
    lat: 13.738379,
    lng: 100.532056,
    type: 'มหาวิทยาลัยและหอประชุม',
    keywords: ['จุฬา', 'จุฬาลงกรณ์', 'chula', 'chulalongkorn'],
  },
  {
    id: 'thammasat-rangsit',
    name: 'มหาวิทยาลัยธรรมศาสตร์ ศูนย์รังสิต (ยิมเนเซียม / อุทยานเรียนรู้)',
    displayName: 'ถ.พหลโยธิน, ต.คลองหนึ่ง, อ.คลองหลวง, จ.ปทุมธานี 12120',
    lat: 14.073441,
    lng: 100.601283,
    type: 'มหาวิทยาลัยและศูนย์ประชุม',
    keywords: ['ธรรมศาสตร์', 'รังสิต', 'thammasat', 'rangsit', 'ปทุมธานี'],
  },
  {
    id: 'thunder-dome',
    name: 'ธันเดอร์โดม เมืองทองธานี (Thunder Dome)',
    displayName: 'เมืองทองธานี, ต.บ้านใหม่, อ.ปากเกร็ด, จ.นนทบุรี 11120',
    lat: 13.914189,
    lng: 100.549944,
    type: 'ฮอลล์คอนเสิร์ต',
    keywords: ['ธันเดอร์โดม', 'thunder dome', 'thunderdome', 'อิมแพ็ค', 'เมืองทอง'],
  },
];

export const QUICK_PICK_VENUES: VenueSearchResult[] = THAI_POPULAR_VENUES.filter((v) => v.quickPick).map((v) => ({
  placeId: v.id,
  name: v.name,
  displayName: v.displayName,
  lat: v.lat,
  lng: v.lng,
  type: v.type,
  source: 'popular',
}));

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
 * Safely fetches an endpoint and parses JSON without throwing on plain-text or HTML server errors.
 */
export async function safeFetchJson<T = any>(
  url: string,
  init?: RequestInit,
  timeoutMs = 5000
): Promise<{ ok: boolean; status: number; data: T | null; rawText: string; isJson: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: init?.signal || controller.signal,
    });
    const rawText = await res.text();
    const trimmed = rawText.trim();
    const looksLikeJson =
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'));

    if (!looksLikeJson) {
      return {
        ok: false,
        status: res.status,
        data: null,
        rawText: trimmed,
        isJson: false,
      };
    }

    try {
      const parsed = JSON.parse(trimmed) as T;
      return {
        ok: res.ok,
        status: res.status,
        data: parsed,
        rawText: trimmed,
        isJson: true,
      };
    } catch {
      return {
        ok: false,
        status: res.status,
        data: null,
        rawText: trimmed,
        isJson: false,
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      rawText: err?.message || 'Network error',
      isJson: false,
    };
  } finally {
    clearTimeout(timer);
  }
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

const formatThaiOsmType = (rawType?: string): string => {
  const t = (rawType || '').toLowerCase();
  if (!t) return 'สถานที่';
  if (t.includes('exhibition') || t.includes('convention')) return 'ศูนย์แสดงสินค้า/ประชุม';
  if (t.includes('stadium') || t.includes('arena')) return 'สนามกีฬา/อารีน่า';
  if (t.includes('hotel') || t.includes('resort') || t.includes('hostel')) return 'โรงแรม/ที่พัก';
  if (t.includes('mall') || t.includes('department_store') || t.includes('commercial') || t.includes('retail')) return 'ศูนย์การค้า/อาคารพาณิชย์';
  if (t.includes('university') || t.includes('college') || t.includes('school')) return 'สถานศึกษา';
  if (t.includes('hospital') || t.includes('clinic')) return 'โรงพยาบาล';
  if (t.includes('station') || t.includes('stop') || t.includes('aerodrome') || t.includes('airport')) return 'สถานี/การเดินทาง';
  if (t.includes('theatre') || t.includes('cinema') || t.includes('arts_centre')) return 'โรงละคร/หอศิลป์';
  if (t.includes('temple') || t.includes('place_of_worship')) return 'ศาสนสถาน';
  if (t.includes('park')) return 'สวนสาธารณะ';
  if (t.includes('building') || t.includes('office')) return 'อาคาร/สำนักงาน';
  return 'สถานที่';
};

/**
 * Searches built-in curated major Thai MICE & event venues instantly (0ms, works offline & on any host).
 */
export function searchPopularVenues(query: string): VenueSearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const tokens = q.split(/\s+/).filter(Boolean);

  return THAI_POPULAR_VENUES.filter((v) => {
    const haystack = `${v.name} ${v.displayName} ${v.keywords.join(' ')}`.toLowerCase();
    return tokens.every((tk) => haystack.includes(tk));
  }).map((v) => ({
    placeId: v.id,
    name: v.name,
    displayName: v.displayName,
    lat: v.lat,
    lng: v.lng,
    type: v.type,
    source: 'popular',
  }));
}

function normalizePhotonFeatures(features: any[]): VenueSearchResult[] {
  if (!Array.isArray(features)) return [];
  return features
    .map((f: any, idx: number): VenueSearchResult | null => {
      const coords = f?.geometry?.coordinates;
      const lng = Array.isArray(coords) ? Number(coords[0]) : NaN;
      const lat = Array.isArray(coords) ? Number(coords[1]) : NaN;
      if (!isValidCoordinates(lat, lng)) return null;

      const p = f?.properties || {};
      const name = String(p.name || p.street || p.city || p.state || 'สถานที่').trim();
      const addressParts = [
        p.name,
        p.street,
        p.district,
        p.city || p.town || p.village,
        p.county,
        p.state,
        p.postcode,
        p.country,
      ]
        .map((x) => (typeof x === 'string' ? x.trim() : ''))
        .filter(Boolean);

      const dedupedParts = addressParts.filter((part, i) => addressParts.indexOf(part) === i);
      const displayName = dedupedParts.join(', ') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      return {
        placeId: `photon-${p.osm_type || 'N'}-${p.osm_id || idx}`,
        name,
        displayName,
        lat,
        lng,
        type: formatThaiOsmType(p.osm_value || p.osm_key || p.type),
        source: 'photon',
      };
    })
    .filter((item): item is VenueSearchResult => item !== null);
}

function normalizeNominatimItems(items: any[]): VenueSearchResult[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item: any, idx: number): VenueSearchResult | null => {
      const lat = Number(item?.lat);
      const lng = Number(item?.lon);
      if (!isValidCoordinates(lat, lng)) return null;

      const fullDisplay = String(item?.display_name || '').trim();
      const name = String(item?.name || fullDisplay.split(',')[0] || 'สถานที่').trim();

      return {
        placeId: `nom-${item?.place_id || idx}`,
        name,
        displayName: fullDisplay || name,
        lat,
        lng,
        type: formatThaiOsmType(item?.type || item?.class),
        source: 'nominatim',
      };
    })
    .filter((item): item is VenueSearchResult => item !== null);
}

function mergeVenueResults(groups: VenueSearchResult[][]): VenueSearchResult[] {
  const merged: VenueSearchResult[] = [];
  for (const group of groups) {
    for (const item of group) {
      if (!isValidCoordinates(item.lat, item.lng)) continue;
      // Avoid exact near-duplicate pins (< ~45m) with identical normalized name
      const itemNorm = item.name.toLowerCase().replace(/\s+/g, '');
      const isDuplicate = merged.some((existing) => {
        const dist = Math.hypot(existing.lat - item.lat, existing.lng - item.lng);
        const existingNorm = existing.name.toLowerCase().replace(/\s+/g, '');
        const sameName = existingNorm === itemNorm || existingNorm.includes(itemNorm) || itemNorm.includes(existingNorm);
        return dist < 0.00045 && sameName;
      });
      if (!isDuplicate) {
        merged.push(item);
      }
    }
  }
  return merged.slice(0, 10);
}

/**
 * Multi-layer resilient venue search:
 * 1) Direct coordinate / Google Maps URL detection
 * 2) Instant curated Thai popular event venues
 * 3) Backend API (/api/location/search) with safe JSON parsing (never throws SyntaxError on non-JSON proxy/Vercel errors)
 * 4) Direct browser CORS fallback to Photon & OpenStreetMap Nominatim
 */
export async function searchVenueLocations(
  query: string
): Promise<{ results: VenueSearchResult[]; usedFallback?: boolean }> {
  const q = query.trim();
  if (q.length < 2) return { results: [] };

  // 1. Direct coordinate or Google Maps URL pasted into search box
  const directCoords = parseCoordinatesFromText(q);
  if (directCoords) {
    return {
      results: [
        {
          placeId: `coords-${directCoords.lat}-${directCoords.lng}`,
          name: `พิกัดที่ระบุ (${directCoords.lat.toFixed(5)}, ${directCoords.lng.toFixed(5)})`,
          displayName: `ใช้พิกัดละติจูด ${directCoords.lat.toFixed(6)}, ลองจิจูด ${directCoords.lng.toFixed(6)}`,
          lat: directCoords.lat,
          lng: directCoords.lng,
          type: 'พิกัดโดยตรง',
          source: 'coords',
        },
      ],
    };
  }

  // 2. Instant curated Thai event venues match
  const popularMatches = searchPopularVenues(q);

  // 3. Try our backend proxy first (handles Google Maps key if configured + Photon + Nominatim)
  const apiRes = await safeFetchJson<{ results?: any[]; error?: string }>(
    `/api/location/search?q=${encodeURIComponent(q)}`,
    undefined,
    4500
  );

  if (apiRes.ok && apiRes.isJson && Array.isArray(apiRes.data?.results) && apiRes.data.results.length > 0) {
    const normalizedApi: VenueSearchResult[] = apiRes.data.results
      .map((item: any, idx: number): VenueSearchResult | null => {
        const lat = Number(item?.lat);
        const lng = Number(item?.lng);
        if (!isValidCoordinates(lat, lng)) return null;
        const displayName = String(item?.displayName || '').trim();
        const name = String(item?.name || displayName.split(',')[0] || 'สถานที่').trim();
        return {
          placeId: String(item?.placeId || `api-${idx}`),
          name,
          displayName: displayName || name,
          lat,
          lng,
          type: item?.type && /[ก-๙]/.test(String(item.type)) ? String(item.type) : formatThaiOsmType(item?.type),
          source: 'api',
        };
      })
      .filter((x): x is VenueSearchResult => x !== null);

    return {
      results: mergeVenueResults([popularMatches, normalizedApi]),
    };
  }

  // 4. Direct browser CORS fallback (when backend returns non-JSON like Vercel 500 or empty)
  let fallbackResults: VenueSearchResult[] = [];

  const photonRes = await safeFetchJson<{ features?: any[] }>(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6`,
    undefined,
    5000
  );
  if (photonRes.ok && photonRes.isJson && Array.isArray(photonRes.data?.features)) {
    fallbackResults = normalizePhotonFeatures(photonRes.data.features);
  }

  if (fallbackResults.length === 0) {
    const nomUrl = new URL('https://nominatim.openstreetmap.org/search');
    nomUrl.searchParams.set('format', 'json');
    nomUrl.searchParams.set('q', q);
    nomUrl.searchParams.set('limit', '6');
    nomUrl.searchParams.set('addressdetails', '1');
    nomUrl.searchParams.set('accept-language', 'th,en');

    const nomRes = await safeFetchJson<any[]>(
      nomUrl.toString(),
      { headers: { Accept: 'application/json' } },
      5500
    );
    if (nomRes.ok && nomRes.isJson && Array.isArray(nomRes.data)) {
      fallbackResults = normalizeNominatimItems(nomRes.data);
    }
  }

  return {
    results: mergeVenueResults([popularMatches, fallbackResults]),
    usedFallback: !apiRes.ok,
  };
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
    if (err1?.code === 1) {
      return {
        ok: false,
        reason: 'permission_denied',
        message: 'เบราว์เซอร์ถูกปิดสิทธิ์การเข้าถึงตำแหน่ง กรุณากดอนุญาต (Allow Location) ที่แถบ URL หรือค้นหาชื่อสถานที่ด้านล่างแทน',
      };
    }

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
  const apiRes = await safeFetchJson<{ lat?: number; lng?: number; city?: string; region?: string; country?: string }>(
    '/api/location/ip-approx',
    undefined,
    4000
  );
  if (apiRes.ok && apiRes.data && typeof apiRes.data.lat === 'number' && typeof apiRes.data.lng === 'number' && isValidCoordinates(apiRes.data.lat, apiRes.data.lng)) {
    const parts = [apiRes.data.city, apiRes.data.region, apiRes.data.country].filter(Boolean);
    return {
      ok: true,
      lat: Number(apiRes.data.lat.toFixed(6)),
      lng: Number(apiRes.data.lng.toFixed(6)),
      source: 'ip',
      label: parts.length > 0 ? `ตำแหน่งโดยประมาณ (${parts.join(', ')})` : 'ตำแหน่งโดยประมาณจากเครือข่าย',
    };
  }

  // Direct CORS fallback via ipwho.is if backend route unavailable
  const directIp = await safeFetchJson<{ success?: boolean; latitude?: number; longitude?: number; city?: string; region?: string; country?: string }>(
    'https://ipwho.is/',
    undefined,
    4000
  );
  if (directIp.ok && directIp.data?.success && typeof directIp.data.latitude === 'number' && typeof directIp.data.longitude === 'number' && isValidCoordinates(directIp.data.latitude, directIp.data.longitude)) {
    const parts = [directIp.data.city, directIp.data.region, directIp.data.country].filter(Boolean);
    return {
      ok: true,
      lat: Number(directIp.data.latitude.toFixed(6)),
      lng: Number(directIp.data.longitude.toFixed(6)),
      source: 'ip',
      label: parts.length > 0 ? `ตำแหน่งโดยประมาณ (${parts.join(', ')})` : 'ตำแหน่งโดยประมาณจากเครือข่าย',
    };
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
