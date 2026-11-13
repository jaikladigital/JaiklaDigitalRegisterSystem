/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import React, { useContext, useMemo, useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  generateTicketImage,
  generateTicketPDF,
} from "../utils/ticketGenerator";
import { getEmailHtml, EmailTheme } from "../utils/emailTemplates";
import { PendingEmail, Table, TicketPayload, ZoneType } from "../types";
import { ZONES, generateInitialTables, getZoneStyle } from "../data";
import { logStaffAction } from "../lib/logger";
import { 
  calculateTicketDrinkRevenue, 
  getTicketWelcomeDrinksInfo, 
  calculateDrinkPrice 
} from "../utils/welcomeDrinks";
import {
  Users,
  Banknote,
  Map as MapIcon,
  Gift,
  Settings,
  Image as ImageIcon,
  Palette,
  Monitor,
  GlassWater,
  BarChart3,
  Printer,
  Save,
  RefreshCw,
  RotateCcw,
  Tags,
  Edit2,
  Plus,
  Minus,
  Trash2,
  LayoutGrid,
  Mail,
  Wand2,
  Loader2,
  Languages,
  Download,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Store,
  History,
  Landmark,
  FileSpreadsheet,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  GripVertical,
  SlidersHorizontal,
  MessageSquare,
  Check,
  Search,
  MapPin,
  Compass,
  Link2,
  Sparkles,
  Eye,
  AlertTriangle,
  Crosshair,
  Lock,
  Timer,
  CheckCircle2,
  AlertCircle,
  Info,
  X,
} from "lucide-react";
import {
  buildOpenStreetMapEmbedUrl,
  getResilientLocation,
  isValidCoordinates,
  parseCoordinatesFromText,
} from "../utils/locationHelpers";
import {
  THEME_PRESETS,
  getContrastFeedback,
  isValidHexColor,
  normalizeHexColor,
} from "../utils/themeHelpers";
import { motion } from "motion/react";
import { SURVEY_TOPICS } from "./SurveyView";
import { ConfigContext } from "../ConfigContext";
import UserManagementView from "./UserManagementView";
import StaffLogsView from "./StaffLogsView";
import { storage, auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  clearTicketsAndReleaseSeats,
  executeChunkedBatch,
  getFriendlyFirestoreError,
  sanitizeForFirestore,
} from "../lib/firebaseCollections";
import { ref, deleteObject } from "firebase/storage";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  orderBy,
  deleteDoc,
  setDoc,
  getDocs,
  addDoc,
} from "firebase/firestore";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const RenderCustomArrow = ({ 
  direction, 
  className = "w-24 h-24", 
  style 
}: { 
  direction: string; 
  className?: string; 
  style?: React.CSSProperties; 
}) => {
  let rotation = 0;
  switch (direction) {
    case "⬆": rotation = 0; break;
    case "↗": rotation = 45; break;
    case "➡": rotation = 90; break;
    case "↘": rotation = 135; break;
    case "⬇": rotation = 180; break;
    case "↙": rotation = 225; break;
    case "⬅": rotation = 270; break;
    case "↖": rotation = 315; break;
    default: rotation = 0;
  }

  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
      style={{ 
        transform: `rotate(${rotation}deg)`, 
        transformOrigin: "center",
        display: "inline-block",
        ...style 
      }}
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="6,11 12,5 18,11" />
    </svg>
  );
};

const updateTablesIncrementally = (
  currentTables: Table[],
  countConfig: Record<string, number>,
  zonesConfig: Record<string, any>,
) => {
  let nextTables = [...currentTables];

  // Clean up tables for zones that no longer exist
  nextTables = nextTables.filter(
    (t) =>
      countConfig[t.zoneId as string] !== undefined &&
      zonesConfig[t.zoneId as string] !== undefined,
  );

  let maxIdNum = 0;
  nextTables.forEach((t) => {
    if (t.id.startsWith("T")) {
      const num = parseInt(t.id.replace("T", ""), 10);
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
  });

  Object.keys(countConfig).forEach((zoneId) => {
    const targetCount = countConfig[zoneId] || 0;
    const currentZoneTables = nextTables.filter((t) => t.zoneId === zoneId);

    if (targetCount > currentZoneTables.length) {
      const toAdd = targetCount - currentZoneTables.length;
      const seatsPerTable = zonesConfig[zoneId]?.seatsPerTable || 10;
      const pricePerSeat = zonesConfig[zoneId]?.pricePerSeat || 0;

      for (let i = 0; i < toAdd; i++) {
        maxIdNum++;
        const newId = `T${maxIdNum.toString().padStart(3, "0")}`;
        const seats = Array.from({ length: seatsPerTable }).map((_, idx) => ({
          id: idx + 1,
          status: "available" as const,
        }));

        nextTables.push({
          id: newId,
          zoneId,
          seats,
        });
      }
    } else if (targetCount < currentZoneTables.length) {
      let toRemove = currentZoneTables.length - targetCount;

      // Try to remove empty tables first
      currentZoneTables.sort((a, b) => {
        const aEmpty = a.seats.every((s) => s.status === "available") ? 1 : 0;
        const bEmpty = b.seats.every((s) => s.status === "available") ? 1 : 0;
        if (aEmpty !== bEmpty) return aEmpty - bEmpty;

        const numA = parseInt(a.id.replace("T", "")) || 0;
        const numB = parseInt(b.id.replace("T", "")) || 0;
        return numB - numA; // Remove the highest ID numbers first
      });

      const idsToRemove = currentZoneTables.slice(-toRemove).map((t) => t.id);
      nextTables = nextTables.filter((t) => !idsToRemove.includes(t.id));
    }

    // Check if we need to adjust seats in existing tables for this zone
    const targetSeatsPerTable = zonesConfig[zoneId]?.seatsPerTable || 10;
    const pricePerSeat = zonesConfig[zoneId]?.pricePerSeat || 0;
    nextTables = nextTables.map((t) => {
      if (t.zoneId !== zoneId) return t;
      if (t.seats.length === targetSeatsPerTable) return t;

      let newSeats = [...t.seats];
      if (newSeats.length > targetSeatsPerTable) {
        // Trim from end
        newSeats = newSeats.slice(0, targetSeatsPerTable);
      } else if (newSeats.length < targetSeatsPerTable) {
        // Add empty seats
        const toAddSeats = targetSeatsPerTable - newSeats.length;
        for (let i = 0; i < toAddSeats; i++) {
          newSeats.push({
            id: newSeats.length + 1,
            status: "available",
          });
        }
      }
      return { ...t, seats: newSeats };
    });
  });

  return nextTables;
};

const getTablesToBeDeletedWithReservations = (
  currentTables: Table[],
  countConfig: Record<string, number>,
  zonesConfig: Record<string, any>,
): Table[] => {
  let nextTables = [...currentTables];

  // Also include tables for zones that no longer exist
  const deletedZoneTables = nextTables.filter(
    (t) =>
      countConfig[t.zoneId as string] === undefined ||
      zonesConfig[t.zoneId as string] === undefined,
  );

  const tablesWithReservations: Table[] = [];

  // Check deleted zones first
  deletedZoneTables.forEach((t) => {
    const hasReservations = t.seats.some((s) => s.status !== "available");
    if (hasReservations) {
      tablesWithReservations.push(t);
    }
  });

  // Now, for existing zones where targetCount < current tables count
  Object.keys(countConfig).forEach((zoneId) => {
    const targetCount = countConfig[zoneId] || 0;
    const currentZoneTables = nextTables.filter((t) => t.zoneId === zoneId);

    if (targetCount < currentZoneTables.length) {
      const toRemove = currentZoneTables.length - targetCount;

      const sortedZoneTables = [...currentZoneTables];
      sortedZoneTables.sort((a, b) => {
        const aEmpty = a.seats.every((s) => s.status === "available") ? 1 : 0;
        const bEmpty = b.seats.every((s) => s.status === "available") ? 1 : 0;
        if (aEmpty !== bEmpty) return aEmpty - bEmpty;

        const numA = parseInt(a.id.replace("T", ""), 10) || 0;
        const numB = parseInt(b.id.replace("T", ""), 10) || 0;
        return numB - numA;
      });

      const tablesRemoved = sortedZoneTables.slice(-toRemove);
      tablesRemoved.forEach((t) => {
        const hasReservations = t.seats.some((s) => s.status !== "available");
        if (hasReservations) {
          tablesWithReservations.push(t);
        }
      });
    }
  });

  return tablesWithReservations;
};

const LayoutIcon = ({ type, color }: { type: string; color: string }) => {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background container just to give it size */}
      <rect width="48" height="48" rx="8" fill="transparent" />

      {type === "banquet" && (
        <g transform="translate(4, 2)">
          {[
            [10, 10],
            [30, 10],
            [10, 34],
            [30, 34],
          ].map(([x, y], idx) => (
            <g key={idx} transform={`translate(${x}, ${y})`}>
              <circle
                cx="0"
                cy="0"
                r="4.5"
                fill="white"
                stroke={color}
                strokeWidth="1.5"
              />
              {[...Array(8)].map((_, i) => (
                <circle
                  key={i}
                  cx={7.5 * Math.cos((i * Math.PI) / 4)}
                  cy={7.5 * Math.sin((i * Math.PI) / 4)}
                  r="1"
                  fill="#94a3b8"
                />
              ))}
            </g>
          ))}
        </g>
      )}

      {type === "cabaret" && (
        <g transform="translate(4, 2)">
          {[
            [10, 10],
            [30, 10],
            [10, 34],
            [30, 34],
          ].map(([x, y], idx) => (
            <g key={idx} transform={`translate(${x}, ${y})`}>
              <circle
                cx="0"
                cy="0"
                r="4.5"
                fill="white"
                stroke={color}
                strokeWidth="1.5"
              />
              {[...Array(5)].map((_, i) => (
                <circle
                  key={i}
                  cx={7.5 * Math.cos(Math.PI + (i * Math.PI) / 4)}
                  cy={7.5 * Math.sin(Math.PI + (i * Math.PI) / 4)}
                  r="1"
                  fill="#94a3b8"
                />
              ))}
            </g>
          ))}
        </g>
      )}

      {type === "u-shape" && (
        <>
          <path
            d="M12 10 V34 H36 V10"
            fill="none"
            stroke={color}
            strokeWidth="5"
          />
          <path
            d="M12 10 V34 H36 V10"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
          />
          {/* Chairs Left */}
          {[12, 18, 24, 30].map((y) => (
            <circle key={`l-${y}`} cx="7" cy={y} r="1.5" fill="#94a3b8" />
          ))}
          {/* Chairs Bottom */}
          {[18, 24, 30].map((x) => (
            <circle key={`b-${x}`} cx={x} cy="39" r="1.5" fill="#94a3b8" />
          ))}
          {/* Chairs Right */}
          {[12, 18, 24, 30].map((y) => (
            <circle key={`r-${y}`} cx="41" cy={y} r="1.5" fill="#94a3b8" />
          ))}
        </>
      )}

      {type === "theatre" && (
        <>
          <rect x="14" y="8" width="20" height="2" fill={color} />
          <g transform="translate(0, 2)">
            {[0, 1, 2, 3].map((row) => (
              <g key={row} transform={`translate(0, ${row * 6})`}>
                {[0, 1, 2, 3, 4].map((col) => (
                  <rect
                    key={`l-${col}`}
                    x={8 + col * 3}
                    y={16}
                    width="2"
                    height="2.5"
                    rx="0.5"
                    fill="#94a3b8"
                  />
                ))}
                {[0, 1, 2, 3, 4].map((col) => (
                  <rect
                    key={`r-${col}`}
                    x={26 + col * 3}
                    y={16}
                    width="2"
                    height="2.5"
                    rx="0.5"
                    fill="#94a3b8"
                  />
                ))}
              </g>
            ))}
          </g>
        </>
      )}

      {type === "classroom" && (
        <>
          <rect x="14" y="6" width="20" height="2" fill={color} />
          {[0, 1, 2, 3].map((row) => (
            <g key={row} transform={`translate(0, ${row * 8})`}>
              <rect
                x="8"
                y={14}
                width="14"
                height="3"
                fill="none"
                stroke={color}
                strokeWidth="1"
              />
              <rect
                x="26"
                y={14}
                width="14"
                height="3"
                fill="none"
                stroke={color}
                strokeWidth="1"
              />
              {[0, 1, 2].map((col) => (
                <rect
                  key={`c1-${col}`}
                  x={10 + col * 4}
                  y={18}
                  width="2"
                  height="2"
                  rx="0.5"
                  fill="#94a3b8"
                />
              ))}
              {[0, 1, 2].map((col) => (
                <rect
                  key={`c2-${col}`}
                  x={28 + col * 4}
                  y={18}
                  width="2"
                  height="2"
                  rx="0.5"
                  fill="#94a3b8"
                />
              ))}
            </g>
          ))}
        </>
      )}

      {type === "boardroom" && (
        <>
          <rect
            x="16"
            y="10"
            width="16"
            height="28"
            fill="none"
            stroke={color}
            strokeWidth="3"
          />
          <rect
            x="16"
            y="10"
            width="16"
            height="28"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
          />
          {[14, 20, 26, 34].map((y) => (
            <React.Fragment key={y}>
              <circle cx="12" cy={y} r="1.5" fill="#94a3b8" />
              <circle cx="36" cy={y} r="1.5" fill="#94a3b8" />
            </React.Fragment>
          ))}
          <circle cx="24" cy="6" r="1.5" fill="#94a3b8" />
          <circle cx="24" cy="42" r="1.5" fill="#94a3b8" />
        </>
      )}

      {type === "chevron" && (
        <>
          <g transform="translate(0, 4)">
            {[0, 1, 2, 3].map((row) => (
              <g key={row} transform={`translate(0, ${row * 9})`}>
                <g transform="translate(14, 8) rotate(-15) translate(-14, -8)">
                  <rect
                    x="6"
                    y="6"
                    width="16"
                    height="3"
                    fill="none"
                    stroke={color}
                    strokeWidth="1"
                  />
                  {[1, 2, 3].map((i) => (
                    <circle
                      key={i}
                      cx={6 + i * 4.5 - 1}
                      cy="11"
                      r="1"
                      fill="#94a3b8"
                    />
                  ))}
                </g>
                <g transform="translate(34, 8) rotate(15) translate(-34, -8)">
                  <rect
                    x="26"
                    y="6"
                    width="16"
                    height="3"
                    fill="none"
                    stroke={color}
                    strokeWidth="1"
                  />
                  {[1, 2, 3].map((i) => (
                    <circle
                      key={i}
                      cx={26 + i * 4.5 - 1}
                      cy="11"
                      r="1"
                      fill="#94a3b8"
                    />
                  ))}
                </g>
              </g>
            ))}
          </g>
        </>
      )}

      {type === "circle-of-chairs" && (
        <g transform="translate(24, 24)">
          {[...Array(16)].map((_, i) => (
            <g
              key={i}
              transform={`rotate(${i * (360 / 16)}) translate(0, -16)`}
            >
              <path d="M-1.5,0 L1.5,0 L1.5,-2 L-1.5,-2 Z" fill="#94a3b8" />
            </g>
          ))}
          <circle cx="0" cy="0" r="3" fill={color} />
        </g>
      )}
    </svg>
  );
};

type AdminTabId =
  | "overview"
  | "move_seats"
  | "users"
  | "logs"
  | "emails"
  | "notifications"
  | "slips"
  | "booths";

interface AdminTabMeta {
  id: AdminTabId;
  label: string;
  description: string;
  renderIcon: (className?: string) => React.ReactNode;
}

const ADMIN_TABS_CONFIG: AdminTabMeta[] = [
  {
    id: "overview",
    label: "ภาพรวม & ตั้งค่า",
    description: "สรุปยอดขาย ผังโซนที่นั่ง ตั้งค่าระบบ และเครื่องมือพิมพ์บัตร/ป้าย",
    renderIcon: (className = "w-3.5 h-3.5") => <LayoutGrid className={className} />,
  },
  {
    id: "move_seats",
    label: "จัดการย้ายที่นั่ง",
    description: "ค้นหาบัตรลูกค้าเพื่อเปลี่ยนโต๊ะหรือที่นั่ง พร้อมส่งบัตร PDF ใหม่",
    renderIcon: (className = "w-3.5 h-3.5") => <MapIcon className={className} />,
  },
  {
    id: "users",
    label: "สิทธิ์ผู้ใช้งาน",
    description: "อนุมัติบัญชีผู้ใช้งานและกำหนดบทบาทแอดมิน สตาฟ หรือลูกค้า",
    renderIcon: (className = "w-3.5 h-3.5") => <ShieldAlert className={className} />,
  },
  {
    id: "logs",
    label: "ประวัติสตาฟ",
    description: "ตรวจสอบบันทึกการสแกน การรับเครื่องดื่ม และกิจกรรมเจ้าหน้าที่",
    renderIcon: (className = "w-3.5 h-3.5") => <Activity className={className} />,
  },
  {
    id: "emails",
    label: "ติดตามอีเมล",
    description: "ตรวจสอบสถานะการส่งอีเมลตั๋วและส่งอีเมลซ้ำกรณีตกหล่น",
    renderIcon: (className = "w-3.5 h-3.5") => <Mail className={className} />,
  },
  {
    id: "notifications",
    label: "แจ้งเตือน SMS/LINE",
    description: "ตั้งค่าการแจ้งเตือนผ่าน LINE และข้อความอัตโนมัติถึงลูกค้า",
    renderIcon: (className = "w-3.5 h-3.5") => <MessageSquare className={className} />,
  },
  {
    id: "slips",
    label: "จัดการสลิป",
    description: "ตรวจสอบและอนุมัติสลิปโอนเงินที่รอการยืนยันจากลูกค้า",
    renderIcon: (className = "w-3.5 h-3.5") => <Banknote className={className} />,
  },
  {
    id: "booths",
    label: "บูธกิจกรรม & รายงาน",
    description: "สร้างบูธ ตั้งค่าส่วนแบ่ง GP และดูรายงานสรุปยอดขายสุทธิ",
    renderIcon: (className = "w-3.5 h-3.5") => <Store className={className} />,
  },
];

const DEFAULT_ADMIN_TABS_ORDER: AdminTabId[] = ADMIN_TABS_CONFIG.map((t) => t.id);

const ADMIN_TABS_BY_ID: Record<AdminTabId, AdminTabMeta> = ADMIN_TABS_CONFIG.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<AdminTabId, AdminTabMeta>
);

const normalizeAdminTabsOrder = (rawOrder?: unknown): AdminTabId[] => {
  const validSet = new Set<string>(DEFAULT_ADMIN_TABS_ORDER);
  const result: AdminTabId[] = [];
  if (Array.isArray(rawOrder)) {
    for (const item of rawOrder) {
      if (typeof item === "string" && validSet.has(item) && !result.includes(item as AdminTabId)) {
        result.push(item as AdminTabId);
      }
    }
  }
  for (const fallbackId of DEFAULT_ADMIN_TABS_ORDER) {
    if (!result.includes(fallbackId)) {
      result.push(fallbackId);
    }
  }
  return result;
};

const areTabOrdersEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((item, idx) => item === b[idx]);

export default function AdminDashboardView({
  tables,
  setTables,
  tickets,
  setMyTickets,
  surveys,
  pendingEmails,
  setPendingEmails,
  onOpenLuckyDraw,
  onResetApp,
  booths = [],
  boothScanLogs = [],
  onPreviewTheme,
}: {
  tables: Table[];
  setTables?: any;
  tickets: TicketPayload[];
  setMyTickets?: any;
  surveys?: any[];
  pendingEmails?: PendingEmail[];
  setPendingEmails?: any;
  onOpenLuckyDraw: () => void;
  onResetApp?: () => void;
  booths?: any[];
  boothScanLogs?: any[];
  onPreviewTheme?: (preview: {
    themeColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    enableSecondaryColor?: boolean;
    enableAccentColor?: boolean;
  } | null) => void;
}) {
  const { config, setConfig } = useContext(ConfigContext);

  const [localConfig, setLocalConfig] = useState(config);
  const [hasChanges, setHasChanges] = useState(false);
  const [helpRequests, setHelpRequests] = useState<any[]>([]);

  // Location Picker states
  const [locationSearchQuery, setLocationSearchQuery] = useState("");
  const [locationSearchResults, setLocationSearchResults] = useState<
    Array<{ placeId: string; displayName: string; lat: number; lng: number; type?: string }>
  >([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationMapInput, setLocationMapInput] = useState("");
  const [isResolvingMapInput, setIsResolvingMapInput] = useState(false);
  const [isFetchingCurrentLocation, setIsFetchingCurrentLocation] = useState(false);
  const [showMapPreview, setShowMapPreview] = useState(true);

  // Hex text input drafts for smooth typing before valid 6-char hex
  const [primaryHexInput, setPrimaryHexInput] = useState(() =>
    normalizeHexColor(config?.themeColor, "#e11d48").toUpperCase()
  );
  const [secondaryHexInput, setSecondaryHexInput] = useState(() =>
    normalizeHexColor(config?.secondaryColor, "#3b82f6").toUpperCase()
  );
  const [accentHexInput, setAccentHexInput] = useState(() =>
    normalizeHexColor(config?.accentColor, "#10b981").toUpperCase()
  );

  // Booth management states inside AdminDashboardView
  const [bFormId, setBFormId] = useState("");
  const [bFormName, setBFormName] = useState("");
  const [bFormOwner, setBFormOwner] = useState("");
  const [bFormPromptPayId, setBFormPromptPayId] = useState("");
  const [bFormPromptPayName, setBFormPromptPayName] = useState("");
  const [bFormDesc, setBFormDesc] = useState("");
  const [bFormIsSaving, setBFormIsSaving] = useState(false);
  const [bLogSearch, setBLogSearch] = useState("");
  const [bLogFilterBooth, setBLogFilterBooth] = useState("");
  const DEFAULT_BOOTH_GP_PERCENT = 15;
  const BOOTH_SETTINGS_DRAFT_KEY = "booth_settings_draft_v1";
  const savedBoothGpPercent =
    typeof config?.boothGpPercent === "number" && !isNaN(config.boothGpPercent)
      ? Math.min(50, Math.max(0, config.boothGpPercent))
      : DEFAULT_BOOTH_GP_PERCENT;
  const [bGpPercent, setBGpPercent] = useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(BOOTH_SETTINGS_DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.gpPercent === "number" && !isNaN(parsed.gpPercent)) {
            return Math.min(50, Math.max(0, parsed.gpPercent));
          }
        }
      } catch {
        // ignore storage errors
      }
    }
    return savedBoothGpPercent;
  });
  const [hasBoothDraft, setHasBoothDraft] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return Boolean(localStorage.getItem(BOOTH_SETTINGS_DRAFT_KEY));
      } catch {
        return false;
      }
    }
    return false;
  });
  const [isBoothSettingsSaving, setIsBoothSettingsSaving] = useState(false);

  const updateBoothGpPercent = (nextVal: number) => {
    const clamped = Math.min(50, Math.max(0, Math.round(Number(nextVal) || 0)));
    setBGpPercent(clamped);
    setHasBoothDraft(true);
    try {
      localStorage.setItem(
        BOOTH_SETTINGS_DRAFT_KEY,
        JSON.stringify({ gpPercent: clamped, updatedAt: Date.now() })
      );
    } catch {
      // ignore storage quota errors
    }
  };

  useEffect(() => {
    if (!hasBoothDraft) {
      setBGpPercent(savedBoothGpPercent);
    }
  }, [savedBoothGpPercent, hasBoothDraft]);

  const isBoothSettingsDirty = bGpPercent !== savedBoothGpPercent;
  const isBoothSettingsAtDefault =
    bGpPercent === DEFAULT_BOOTH_GP_PERCENT &&
    savedBoothGpPercent === DEFAULT_BOOTH_GP_PERCENT;

  const [showSurveyClearConfirm, setShowSurveyClearConfirm] = useState(false);
  const [isClearingSurveys, setIsClearingSurveys] = useState(false);
  const [isConfirmProcessing, setIsConfirmProcessing] = useState(false);
  const [customConfirm, setCustomConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    colorType?: 'rose' | 'amber' | 'indigo' | 'slate';
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  type ToastType = 'success' | 'error' | 'warning' | 'info';
  interface ToastItem {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    details?: string;
  }
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [expandedToastDetails, setExpandedToastDetails] = useState<Record<string, boolean>>({});

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showToast = (opts: {
    type?: ToastType;
    title: string;
    message?: string;
    details?: string;
    durationMs?: number;
  }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const type = opts.type || 'info';
    setToasts((prev) => [...prev.slice(-3), { id, type, title: opts.title, message: opts.message, details: opts.details }]);
    const duration = opts.durationMs ?? (type === 'error' ? 9000 : 5000);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  };

  const showConfirm = (options: {
    title: string;
    message: string;
    confirmText: string;
    colorType?: 'rose' | 'amber' | 'indigo' | 'slate';
    onConfirm: () => void | Promise<void>;
  }) => {
    setIsConfirmProcessing(false);
    setCustomConfirm({
      isOpen: true,
      ...options,
    });
  };
  
  // Custom interactive PDF/Print reporting system state & handlers
  const [isReportModalOpen, setReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState<"summary" | "attendees" | "survey" | "labels">("summary");
  const [labelFilterZone, setLabelFilterZone] = useState<string>("ALL");
  const [labelType, setLabelType] = useState<"seats" | "tables" | "all">("seats");
  const [labelColumns, setLabelColumns] = useState<number>(3);
  const [includeGuestName, setIncludeGuestName] = useState<boolean>(true);
  const [labelArrowDir, setLabelArrowDir] = useState<string>("⬆");
  
  // Custom Direction Signs state
  const [directionSigns, setDirectionSigns] = useState<any[]>([]);
  const [editingSignId, setEditingSignId] = useState<string | null>(null);

  const [reportTitle, setReportTitle] = useState("");
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [latestGroupId, setLatestGroupId] = useState("");

  const fetchLatestGroupId = async () => {
    try {
      const res = await fetch("/api/line/latest-group-id");
      const data = await res.json();
      if (data.groupId) {
        setLatestGroupId(data.groupId);
      } else {
        showToast({
          type: 'info',
          title: 'ยังไม่มี Group ID ใหม่',
          message: 'ตรวจสอบให้แน่ใจว่าได้ดึงบอทเข้ากลุ่ม LINE แล้ว',
        });
      }
    } catch (e) {
      console.error(e);
      showToast({
        type: 'error',
        title: 'ไม่สามารถดึงข้อมูล Group ID ได้',
        message: 'กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง',
      });
    }
  };

  useEffect(() => {
    import("firebase/firestore").then(({ collection, query, where, onSnapshot }) => {
      const q = query(collection(db, "users"), where("status", "==", "pending"));
      const unsub = onSnapshot(q, (snap) => {
        setPendingUsersCount(snap.size);
      }, (err) => {
        console.warn("Could not listen to pending users (permission denied or logged out):", err);
      });
      return () => unsub();
    });
  }, []);

  useEffect(() => {
    if (isReportModalOpen) {
      if (reportType === "summary") {
        setReportTitle(`รายงานสรุปสถิติกิจกรรม - ${localConfig.eventName || "EventTicketingPro"}`);
      } else if (reportType === "attendees") {
        setReportTitle(`ทะเบียนรายชื่อและรายงานที่นั่ง - ${localConfig.eventName || "EventTicketingPro"}`);
      } else if (reportType === "survey") {
        setReportTitle(`รายงานวิเคราะห์ความพึงพอใจ - ${localConfig.eventName || "EventTicketingPro"}`);
      } else if (reportType === "labels") {
        setReportTitle(`รายงานพิมพ์ป้ายลาเบล - ${localConfig.eventName || "EventTicketingPro"}`);
      }
    }
  }, [isReportModalOpen, reportType, localConfig.eventName]);

  const handleClearAllSurveys = async () => {
    setIsClearingSurveys(true);
    try {
      const snap = await getDocs(collection(db, "surveys"));
      const promises: any[] = [];
      snap.forEach((d) => {
        promises.push(deleteDoc(doc(db, "surveys", d.id)));
      });
      await Promise.all(promises);
      setShowSurveyClearConfirm(false);
    } catch (e) {
      console.error("Error clearing surveys:", e);
    } finally {
      setIsClearingSurveys(false);
    }
  };

  useEffect(() => {
    // Sync localConfig on initial load if we don't have changes
    if (!hasChanges) {
      setLocalConfig(config);
    }
  }, [config]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collection(db, "help_requests"),
        where("status", "==", "pending"),
        orderBy("timestamp", "desc"),
      ),
      (snap) => {
        const reqs: any[] = [];
        snap.forEach((doc) => reqs.push({ id: doc.id, ...doc.data() }));
        setHelpRequests(reqs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "help_requests");
      }
    );
    return () => unsub();
  }, []);

  const handleResolveHelpRequest = async (id: string) => {
    try {
      await updateDoc(doc(db, "help_requests", id), {
        status: "resolved",
        resolvedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Error resolving help request", e);
    }
  };

  useEffect(() => {
    setPrimaryHexInput(normalizeHexColor(localConfig?.themeColor, "#e11d48").toUpperCase());
  }, [localConfig?.themeColor]);

  useEffect(() => {
    setSecondaryHexInput(normalizeHexColor(localConfig?.secondaryColor, "#3b82f6").toUpperCase());
  }, [localConfig?.secondaryColor]);

  useEffect(() => {
    setAccentHexInput(normalizeHexColor(localConfig?.accentColor, "#10b981").toUpperCase());
  }, [localConfig?.accentColor]);

  useEffect(() => {
    if (!onPreviewTheme) return;
    if (hasChanges) {
      onPreviewTheme({
        themeColor: normalizeHexColor(localConfig?.themeColor, "#e11d48"),
        secondaryColor: normalizeHexColor(localConfig?.secondaryColor, "#3b82f6"),
        accentColor: normalizeHexColor(localConfig?.accentColor, "#10b981"),
        enableSecondaryColor: !!localConfig?.enableSecondaryColor,
        enableAccentColor: !!localConfig?.enableAccentColor,
      });
    } else {
      onPreviewTheme(null);
    }
  }, [
    hasChanges,
    localConfig?.themeColor,
    localConfig?.secondaryColor,
    localConfig?.accentColor,
    localConfig?.enableSecondaryColor,
    localConfig?.enableAccentColor,
  ]);

  useEffect(() => {
    return () => {
      onPreviewTheme?.(null);
    };
  }, []);

  const handleUpdateLocalConfig = (updates: any) => {
    setLocalConfig((prev: any) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleFetchCurrentLocation = async () => {
    setIsFetchingCurrentLocation(true);
    try {
      const result = await getResilientLocation({ allowIpFallback: true });
      if (result.ok && typeof result.lat === "number" && typeof result.lng === "number") {
        handleUpdateLocalConfig({
          eventLat: result.lat.toString(),
          eventLng: result.lng.toString(),
          ...(result.label && !localConfig.eventLocationName
            ? { eventLocationName: result.label }
            : {}),
        });
        setShowMapPreview(true);
        if (result.source === "ip") {
          showToast({
            type: "warning",
            title: "ดึงพิกัดโดยประมาณจากเครือข่ายแล้ว",
            message:
              "อุปกรณ์นี้ไม่ได้ส่งสัญญาณ GPS ระบบจึงระบุตำแหน่งเบื้องต้นให้แทน กรุณาค้นหาชื่อสถานที่หรือวางลิงก์ Google Maps เพื่อความแม่นยำ",
          });
        } else {
          showToast({
            type: "success",
            title: "ดึงตำแหน่งปัจจุบันสำเร็จ",
            message: `บันทึกพิกัด ${result.lat.toFixed(5)}, ${result.lng.toFixed(5)} เรียบร้อยแล้ว (อย่าลืมกดบันทึกการตั้งค่า)`,
          });
        }
      } else {
        showToast({
          type: result.reason === "permission_denied" ? "warning" : "info",
          title:
            result.reason === "permission_denied"
              ? "เบราว์เซอร์ไม่ได้อนุญาตสิทธิ์ตำแหน่ง"
              : "อุปกรณ์นี้ไม่รองรับ GPS อัตโนมัติ",
          message:
            result.message ||
            "กรุณาใช้ช่องค้นหาชื่อสถานที่ หรือวางลิงก์ Google Maps ด้านล่างแทน (แม่นยำกว่าสำหรับการตั้งค่าสถานที่ล่วงหน้า)",
        });
      }
    } finally {
      setIsFetchingCurrentLocation(false);
    }
  };

  const handleSearchVenueLocation = async () => {
    const q = locationSearchQuery.trim();
    if (q.length < 2) {
      showToast({
        type: "warning",
        title: "กรุณาพิมพ์ชื่อสถานที่อย่างน้อย 2 ตัวอักษร",
        message: "เช่น ไบเทค บางนา, เซ็นทรัลเวิลด์, อิมแพ็ค เมืองทองธานี",
      });
      return;
    }
    setIsSearchingLocation(true);
    try {
      const res = await fetch(`/api/location/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "ไม่สามารถค้นหาสถานที่ได้");
      }
      const results = Array.isArray(data?.results) ? data.results : [];
      setLocationSearchResults(results);
      if (results.length === 0) {
        showToast({
          type: "info",
          title: "ไม่พบสถานที่ที่ตรงกับคำค้นหา",
          message: "ลองค้นหาด้วยชื่อสั้นลง หรือวางลิงก์ Google Maps โดยตรงแทน",
        });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "ค้นหาสถานที่ล้มเหลว",
        message: err?.message || "กรุณาลองใหม่อีกครั้ง หรือวางลิงก์ Google Maps แทน",
      });
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleParseMapLinkOrCoords = async (rawOverride?: string) => {
    const raw = (rawOverride ?? locationMapInput).trim();
    if (!raw) {
      showToast({
        type: "warning",
        title: "กรุณาวางลิงก์ Google Maps หรือพิกัด",
        message: "ตัวอย่าง: 13.7563, 100.5018 หรือลิงก์จาก Google Maps",
      });
      return;
    }

    const direct = parseCoordinatesFromText(raw);
    if (direct) {
      handleUpdateLocalConfig({
        eventLat: direct.lat.toFixed(6),
        eventLng: direct.lng.toFixed(6),
      });
      setLocationMapInput("");
      setShowMapPreview(true);
      showToast({
        type: "success",
        title: "ดึงพิกัดสำเร็จ",
        message: `กำหนดพิกัดเป็น ${direct.lat.toFixed(6)}, ${direct.lng.toFixed(6)} เรียบร้อยแล้ว`,
      });
      return;
    }

    if (/^https?:\/\//i.test(raw)) {
      setIsResolvingMapInput(true);
      try {
        const res = await fetch("/api/location/resolve-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: raw }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "ไม่สามารถเปิดลิงก์ได้");
        }
        const fromResolvedUrl = parseCoordinatesFromText(data?.resolvedUrl || "");
        const fromHtml = fromResolvedUrl || parseCoordinatesFromText(data?.htmlSnippet || "");
        if (fromHtml) {
          handleUpdateLocalConfig({
            eventLat: fromHtml.lat.toFixed(6),
            eventLng: fromHtml.lng.toFixed(6),
          });
          setLocationMapInput("");
          setShowMapPreview(true);
          showToast({
            type: "success",
            title: "ดึงพิกัดจากลิงก์ Google Maps สำเร็จ",
            message: `กำหนดพิกัดเป็น ${fromHtml.lat.toFixed(6)}, ${fromHtml.lng.toFixed(6)} เรียบร้อยแล้ว`,
          });
          return;
        }
        showToast({
          type: "warning",
          title: "ไม่พบค่าพิกัดในลิงก์นี้",
          message: "กรุณาเปิดลิงก์ใน Google Maps แล้วคัดลอก URL จากแถบที่อยู่ (ที่มี @ละติจูด,ลองจิจูด) หรือค้นหาชื่อสถานที่แทน",
        });
      } catch (err: any) {
        showToast({
          type: "error",
          title: "ไม่สามารถแปลลิงก์ Google Maps ได้",
          message: err?.message || "กรุณาคัดลอกพิกัดตัวเลขมาวางโดยตรง",
        });
      } finally {
        setIsResolvingMapInput(false);
      }
      return;
    }

    showToast({
      type: "warning",
      title: "รูปแบบพิกัดหรือลิงก์ไม่ถูกต้อง",
      message: "กรุณาวางลิงก์ Google Maps หรือพิมพ์พิกัด เช่น 13.7563, 100.5018",
    });
  };

  const handleResetThemeColors = () => {
    handleUpdateLocalConfig({
      themeColor: "#e11d48",
      secondaryColor: "#3b82f6",
      accentColor: "#10b981",
      enableSecondaryColor: false,
      enableAccentColor: false,
    });
    showToast({
      type: "info",
      title: "คืนค่าธีมสีเริ่มต้นในแบบร่างแล้ว",
      message: "กดปุ่มบันทึกการตั้งค่าเพื่อใช้งานสีเริ่มต้นกับทั้งระบบ",
    });
  };

  const handleSaveConfig = async () => {
    try {
      await setConfig(localConfig);
      setHasChanges(false);
      showToast({
        type: 'success',
        title: 'บันทึกการตั้งค่าสำเร็จ',
        message: 'การเปลี่ยนแปลงข้อมูลงานได้รับการบันทึกเรียบร้อยแล้ว',
      });
    } catch (e) {
      const friendly = getFriendlyFirestoreError(e);
      showToast({
        type: 'error',
        title: 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า',
        message: friendly.message,
        details: friendly.details,
      });
      console.error(e);
    }
  };

  const handleSaveYoutubeLink = async () => {
    try {
      await setConfig((prev: any) => ({ ...prev, emailYoutubeLink: localConfig.emailYoutubeLink }));
      showToast({
        type: 'success',
        title: 'บันทึกลิงก์ YouTube สำเร็จ',
        message: 'บันทึกลิงก์ YouTube ลงฐานข้อมูลเรียบร้อยแล้ว',
      });
    } catch (e) {
      const friendly = getFriendlyFirestoreError(e);
      showToast({
        type: 'error',
        title: 'เกิดข้อผิดพลาดในการบันทึกลิงก์ YouTube',
        message: friendly.message,
        details: friendly.details,
      });
      console.error(e);
    }
  };

  const handleResetConfig = () => {
    showConfirm({
      title: "ยกเลิกการแก้ไขการตั้งค่า?",
      message: "คุณต้องการยกเลิกการแก้ไขและคืนค่ากลับไปเป็นค่าคอนฟิกที่บันทึกไว้ล่าสุดใช่หรือไม่?",
      confirmText: "ใช่, ยกเลิกการแก้ไข",
      colorType: "amber",
      onConfirm: () => {
        setLocalConfig(config);
        setHasChanges(false);
      }
    });
  };

  const activeZones = localConfig.zones || ZONES;
  const activeZonesList = useMemo(() => {
    if (Array.isArray(activeZones)) return activeZones;
    return Object.keys(activeZones).map((key) => ({
      id: key,
      ...activeZones[key]
    }));
  }, [activeZones]);

  // Synchronize direction signs when opening the labels report with direction signs type
  useEffect(() => {
    if (isReportModalOpen && reportType === "labels" && labelType === "all" && directionSigns.length === 0) {
      const initial: any[] = [];
      activeZonesList.forEach((zone: any) => {
        const zoneTables = tables.filter(t => t.zoneId === zone.id);
        if (zoneTables.length > 0) {
          initial.push({
            id: `sign-${zone.id}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            zoneId: zone.id,
            arrowDir: labelArrowDir || "⬆",
            tableIds: zoneTables.map(t => t.id).sort(),
            note: `ทางเข้าโซน ${zone.name}`,
          });
        }
      });
      setDirectionSigns(initial);
    }
  }, [isReportModalOpen, reportType, labelType, tables, activeZonesList]);

  const [editingZones, setEditingZones] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslateTemplate = async (
    mode: "english" | "bilingual",
    field: "body" | "subject" = "body",
  ) => {
    const textToTranslate =
      field === "body"
        ? localConfig.emailTemplateBody
        : localConfig.emailTemplateSubject;
    if (!textToTranslate) return;
    setIsTranslating(true);
    try {
      const resp = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToTranslate,
          mode,
        }),
      });
      const data = await resp.json();
      if (data.translation) {
        if (field === "body") {
          handleUpdateLocalConfig({ emailTemplateBody: data.translation });
        } else {
          handleUpdateLocalConfig({ emailTemplateSubject: data.translation });
        }
        showToast({
          type: 'success',
          title: 'แปลข้อความเรียบร้อยแล้ว',
        });
      } else {
        showToast({
          type: 'error',
          title: 'ไม่สามารถแปลข้อความได้',
          message: data.error || 'Failed to translate',
        });
      }
    } catch (e) {
      console.error(e);
      showToast({
        type: 'error',
        title: 'ไม่สามารถเชื่อมต่อระบบแปลภาษาได้',
        message: 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่',
      });
    } finally {
      setIsTranslating(false);
    }
  };
  const [zoneForm, setZoneForm] = useState(
    localConfig.zoneCounts || { VIP: 20, GOLD: 40, REGULAR: 40 },
  );
  const [priceForm, setPriceForm] = useState(activeZones);

  useEffect(() => {
    if (!editingZones) {
      setZoneForm(localConfig.zoneCounts || { VIP: 20, GOLD: 40, REGULAR: 40 });
      setPriceForm(activeZones);
    }
  }, [localConfig.zoneCounts, activeZones, editingZones]);

  const isMockMode = tickets.some((t) => t.isMock);
  const [isTogglingMock, setIsTogglingMock] = useState(false);

  const handleToggleMockMode = async () => {
    setIsTogglingMock(true);
    try {
      if (isMockMode) {
        const mockTickets = tickets.filter((t) => t.isMock);
        await clearTicketsAndReleaseSeats(mockTickets, tables);
        showToast({
          type: 'success',
          title: 'ปิดโหมดจำลองเรียบร้อยแล้ว',
          message: 'ข้อมูลการจองจำลองถูกลบออกและยอดกลับสู่ข้อมูลจริงแล้ว',
        });
      } else {
        const newTickets: any[] = [];
        const tableUpdates: Record<string, any> = {};

        tables.forEach((tb) => {
          let tbData = JSON.parse(JSON.stringify(tb));
          let modified = false;
          tbData.seats.forEach((seat: any) => {
            if (seat.status === "available" && Math.random() < 0.2) {
              modified = true;
              seat.status = "paid";
              const tId = "MOCK_" + Math.floor(Math.random() * 10000000);
              seat.ticketId = tId;
              const zoneConf = activeZones[tb.zoneId as any] || {
                pricePerSeat: 1000,
              };
              newTickets.push({
                id: tId,
                userName: "Mock User " + Math.floor(Math.random() * 1000),
                phone: "0800000000",
                email: "mock@example.com",
                tableId: tb.id,
                seatIds: [seat.id],
                totalAmount: localConfig.isTicketFree
                  ? 0
                  : zoneConf.pricePerSeat,
                paymentMethod: "Bank Transfer",
                status: "paid",
                qrCodeUrl: "#",
                drinksRedeemed: 0,
                drinkHistory: {},
                createdAt: new Date().toISOString(),
                isMock: true,
              });
            }
          });
          if (modified) tableUpdates[tb.id] = tbData;
        });

        await executeChunkedBatch([
          ...newTickets.map((t) => ({ type: 'set' as const, collectionName: 'tickets', id: t.id, data: t })),
          ...Object.values(tableUpdates).map((tb: any) => ({ type: 'set' as const, collectionName: 'tables', id: tb.id, data: tb })),
        ]);
        showToast({
          type: 'success',
          title: 'เปิดโหมดจำลองสำเร็จ',
          message: `นำเข้าข้อมูลการจองจำลองจำนวน ${newTickets.length} รายการเรียบร้อยแล้ว`,
        });
      }
    } catch (err) {
      console.error(err);
      const friendly = getFriendlyFirestoreError(err);
      showToast({
        type: 'error',
        title: 'เกิดข้อผิดพลาดในการเปิด/ปิดโหมดจำลอง',
        message: friendly.message,
        details: friendly.details,
      });
    }
    setIsTogglingMock(false);
  };

  const totalSeats = tables.reduce((acc, t) => acc + t.seats.length, 0);
  const paidSeatsCount = tables.reduce(
    (acc, t) => acc + t.seats.filter((s) => s.status === "paid").length,
    0,
  );

  const displayRevenue = localConfig.isTicketFree
    ? 0
    : tickets
        .filter((t) => !t.isSponsor)
        .reduce((acc, t) => acc + t.totalAmount, 0);
  const totalSponsorValue = tickets
    .filter((t) => t.isSponsor)
    .reduce((acc, t) => acc + (t.sponsorValue || 0), 0);

  const zoneStats = useMemo(() => {
    const zonesArray = Array.isArray(activeZones) 
      ? activeZones 
      : Object.keys(activeZones).map((key) => ({ id: key, ...activeZones[key] }));

    return zonesArray.map((z: any) => {
      const zoneTables = tables.filter((t) => t.zoneId === z.id);
      const totalSeatsInZone = zoneTables.reduce((sum, t) => sum + t.seats.length, 0);
      const soldSeatsInZone = zoneTables.reduce((sum, t) => sum + t.seats.filter(s => s.status === "paid").length, 0);
      
      const revenueInZone = localConfig.isTicketFree 
        ? 0 
        : tickets
            .filter((t) => !t.isSponsor && t.tableId && tables.find(tbl => tbl.id === t.tableId)?.zoneId === z.id && (t.status === "paid" || t.status === "slip_verified"))
            .reduce((sum, t) => sum + t.totalAmount, 0);
            
      const sponsorsInZoneCount = tickets.filter(t => t.isSponsor && t.tableId && tables.find(tbl => tbl.id === t.tableId)?.zoneId === z.id).length;
      
      return {
        ...z,
        tablesCount: zoneTables.length,
        totalSeats: totalSeatsInZone,
        soldSeats: soldSeatsInZone,
        revenue: revenueInZone,
        sponsorsCount: sponsorsInZoneCount,
      };
    });
  }, [tables, tickets, activeZones, localConfig.isTicketFree]);

  const sortedTickets = useMemo(() => {
    return [...tickets].sort((a, b) => b.totalAmount - a.totalAmount);
  }, [tickets]);

  const processedSurveys = useMemo(() => {
    if (!surveys) return [];
    return surveys.map((s) => {
      const parentTicket = tickets.find((t) => t.id === s.ticketId);
      const tableSeatInfo = parentTicket 
        ? `โต๊ะ ${parentTicket.tableId} (ที่นั่ง ${s.seatId || s.seatIds?.join(", ") || "-"})`
        : s.seatId ? `ที่นั่ง ${s.seatId}` : "-";
      
      const ratingValues = Object.values(s.ratings) as number[];
      const avgRating = ratingValues.length 
        ? ratingValues.reduce((sum, r) => sum + r, 0) / ratingValues.length 
        : 0;

      return {
        ...s,
        guestName: parentTicket?.userName || "ผู้ประเมินไม่ระบุชื่อ",
        tableSeatInfo,
        avgRating,
      };
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [surveys, tickets]);

  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [sponsorForm, setSponsorForm] = useState({
    name: "",
    email: "",
    qtyStr: "",
  });
  const [selectedAllocation, setSelectedAllocation] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "users" | "logs" | "emails" | "notifications" | "slips" | "booths" | "move_seats"
  >(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const tab = p.get("tab");
      if (
        tab &&
        [
          "overview",
          "users",
          "logs",
          "emails",
          "notifications",
          "slips",
          "booths",
          "move_seats",
        ].includes(tab)
      ) {
        return tab as any;
      }
      const saved = sessionStorage.getItem("adminDashboardTab");
      if (
        saved &&
        [
          "overview",
          "users",
          "logs",
          "emails",
          "notifications",
          "slips",
          "booths",
          "move_seats",
        ].includes(saved)
      ) {
        return saved as any;
      }
    }
    return "overview";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("adminDashboardTab", activeTab);
      const url = new URL(window.location.href);
      if (url.searchParams.get("tab") !== activeTab) {
        url.searchParams.set("tab", activeTab);
        window.history.replaceState({}, "", url);
      }
    }
  }, [activeTab]);

  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showTabDropdown, setShowTabDropdown] = useState(false);

  const currentAdminUid = auth.currentUser?.uid || "default";
  const savedFirestoreTabsOrder = useMemo(() => {
    const perUserMap = config?.adminTabsOrders;
    if (perUserMap && typeof perUserMap === "object" && Array.isArray(perUserMap[currentAdminUid])) {
      return normalizeAdminTabsOrder(perUserMap[currentAdminUid]);
    }
    if (Array.isArray(config?.adminTabsOrder)) {
      return normalizeAdminTabsOrder(config.adminTabsOrder);
    }
    return null;
  }, [config?.adminTabsOrders, config?.adminTabsOrder, currentAdminUid]);

  const [userTabsOrder, setUserTabsOrder] = useState<AdminTabId[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const uid = auth.currentUser?.uid;
        if (uid) {
          const stored = localStorage.getItem(`adminTabsOrder_${uid}`);
          if (stored) {
            return normalizeAdminTabsOrder(JSON.parse(stored));
          }
        }
      } catch {
        // ignore storage errors
      }
    }
    return DEFAULT_ADMIN_TABS_ORDER;
  });

  useEffect(() => {
    if (savedFirestoreTabsOrder) {
      setUserTabsOrder(savedFirestoreTabsOrder);
      try {
        if (auth.currentUser?.uid) {
          localStorage.setItem(
            `adminTabsOrder_${auth.currentUser.uid}`,
            JSON.stringify(savedFirestoreTabsOrder)
          );
        }
      } catch {
        // ignore storage errors
      }
    } else if (auth.currentUser?.uid) {
      try {
        const stored = localStorage.getItem(`adminTabsOrder_${auth.currentUser.uid}`);
        if (stored) {
          setUserTabsOrder(normalizeAdminTabsOrder(JSON.parse(stored)));
        }
      } catch {
        // ignore
      }
    }
  }, [savedFirestoreTabsOrder, currentAdminUid]);

  const [showTabOrderModal, setShowTabOrderModal] = useState(false);
  const [draftTabsOrder, setDraftTabsOrder] = useState<AdminTabId[]>(DEFAULT_ADMIN_TABS_ORDER);
  const [draggedTabId, setDraggedTabId] = useState<AdminTabId | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<AdminTabId | null>(null);
  const [isSavingTabOrder, setIsSavingTabOrder] = useState(false);

  const openTabOrderModal = () => {
    setDraftTabsOrder(normalizeAdminTabsOrder(userTabsOrder));
    setDraggedTabId(null);
    setDragOverTabId(null);
    setShowTabDropdown(false);
    setShowTabOrderModal(true);
  };

  const moveDraftTab = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= draftTabsOrder.length) return;
    setDraftTabsOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const pinDraftTabToTop = (index: number) => {
    if (index <= 0 || index >= draftTabsOrder.length) return;
    setDraftTabsOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.unshift(moved);
      return next;
    });
  };

  const handleDraftTabDrop = (targetId: AdminTabId) => {
    if (!draggedTabId || draggedTabId === targetId) {
      setDraggedTabId(null);
      setDragOverTabId(null);
      return;
    }
    setDraftTabsOrder((prev) => {
      const fromIndex = prev.indexOf(draggedTabId);
      const toIndex = prev.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const handleResetDraftTabsOrder = () => {
    setDraftTabsOrder([...DEFAULT_ADMIN_TABS_ORDER]);
  };

  const handleRevertDraftTabsOrder = () => {
    setDraftTabsOrder(normalizeAdminTabsOrder(userTabsOrder));
  };

  const isDraftTabsDirty = !areTabOrdersEqual(draftTabsOrder, userTabsOrder);
  const isDraftTabsAtDefault = areTabOrdersEqual(draftTabsOrder, DEFAULT_ADMIN_TABS_ORDER);
  const isSavedTabsAtDefault = areTabOrdersEqual(userTabsOrder, DEFAULT_ADMIN_TABS_ORDER);

  const handleSaveTabsOrder = async () => {
    const normalized = normalizeAdminTabsOrder(draftTabsOrder);
    setIsSavingTabOrder(true);
    try {
      const uid = auth.currentUser?.uid;
      if (uid) {
        try {
          localStorage.setItem(`adminTabsOrder_${uid}`, JSON.stringify(normalized));
        } catch {
          // ignore storage quota errors
        }
      }
      await setConfig((prev: any) => ({
        ...prev,
        adminTabsOrder: normalized,
        adminTabsOrders: {
          ...(prev?.adminTabsOrders || {}),
          ...(uid ? { [uid]: normalized } : {}),
        },
        adminTabsOrderUpdatedAt: Date.now(),
        adminTabsOrderUpdatedBy: auth.currentUser?.email || "Admin",
      }));
      setUserTabsOrder(normalized);
      setShowTabOrderModal(false);
      await logStaffAction(
        "UPDATE_ADMIN_TABS_ORDER",
        `Updated Admin menu bar order: ${normalized.map((id) => ADMIN_TABS_BY_ID[id]?.label || id).join(" -> ")}`
      );
      showToast({
        type: "success",
        title: "บันทึกลำดับเมนูบาร์เรียบร้อยแล้ว",
        message: "การจัดเรียงเมนูของคุณถูกบันทึกถาวรทั้งในระบบและอุปกรณ์นี้แล้ว",
      });
    } catch (err) {
      console.error("Save admin tabs order error:", err);
      const friendly = getFriendlyFirestoreError(err);
      showToast({
        type: "error",
        title: "ไม่สามารถบันทึกลำดับเมนูได้",
        message: friendly.message,
        details: friendly.details,
      });
    } finally {
      setIsSavingTabOrder(false);
    }
  };

  const handleSaveBooth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bFormName || !bFormOwner) {
      showToast({
        type: 'warning',
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณากรอกชื่อบูธและชื่อผู้ดูแลให้ครบถ้วน',
      });
      return;
    }
    setBFormIsSaving(true);
    try {
      if (bFormId) {
        // Edit flow
        const refD = doc(db, "booths", bFormId);
        await updateDoc(refD, {
          name: bFormName,
          ownerName: bFormOwner,
          promptpayId: bFormPromptPayId,
          promptpayName: bFormPromptPayName,
          description: bFormDesc,
          updatedAt: Date.now()
        });
        
        await addDoc(collection(db, "staff_logs"), {
          action: "EDIT_BOOTH",
          details: `แก้ไขข้อมูลบูธกิจกรรม: ${bFormName}`,
          email: auth.currentUser?.email || "Admin",
          uid: auth.currentUser?.uid || "Admin",
          timestamp: Date.now(),
        });
      } else {
        // Add flow
        const refCol = collection(db, "booths");
        const docRef = await addDoc(refCol, {
          name: bFormName,
          ownerName: bFormOwner,
          promptpayId: bFormPromptPayId,
          promptpayName: bFormPromptPayName,
          description: bFormDesc,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        
        await addDoc(collection(db, "staff_logs"), {
          action: "ADD_BOOTH",
          details: `เพิ่มบูธใหม่สำเร็จ: ${bFormName}`,
          email: auth.currentUser?.email || "Admin",
          uid: auth.currentUser?.uid || "Admin",
          timestamp: Date.now(),
        });
      }
      setBFormId("");
      setBFormName("");
      setBFormOwner("");
      setBFormPromptPayId("");
      setBFormPromptPayName("");
      setBFormDesc("");
      showToast({
        type: 'success',
        title: bFormId ? 'แก้ไขข้อมูลบูธสำเร็จ' : 'เพิ่มบูธใหม่สำเร็จ',
      });
    } catch (err) {
      console.error("Save booth error", err);
      const friendly = getFriendlyFirestoreError(err);
      showToast({
        type: 'error',
        title: 'เกิดข้อผิดพลาดในการบันทึกบูธ',
        message: friendly.message,
        details: friendly.details,
      });
    } finally {
      setBFormIsSaving(false);
    }
  };

  const handleDeleteBooth = (boothId: string, boothName: string) => {
    showConfirm({
      title: "ยืนยันการลบข้อมูลบูธ?",
      message: `คุณกำลังทำการลบบูธ "${boothName}" ออกจากการบริหารบูธกิจกรรมอย่างถาวร รวมถึงจะไม่มีชื่อบูธนี้ให้สตาฟแสกนตรวจหน้างานอีกต่อไป ยืนยันหรือไม่?`,
      confirmText: "ใช่, ยืนยันการลบ",
      colorType: "rose",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "booths", boothId));
          await addDoc(collection(db, "staff_logs"), {
            action: "DELETE_BOOTH",
            details: `ลบบูธกิจกรรม: ${boothName}`,
            email: auth.currentUser?.email || "Admin",
            uid: auth.currentUser?.uid || "Admin",
            timestamp: Date.now(),
          });
          showToast({
            type: 'success',
            title: 'ลบบูธสำเร็จ',
            message: `นำบูธ "${boothName}" ออกจากระบบเรียบร้อยแล้ว`,
          });
        } catch (err) {
          console.error("Delete booth error", err);
          const friendly = getFriendlyFirestoreError(err);
          showToast({
            type: 'error',
            title: 'เกิดข้อผิดพลาดในการลบบูธ',
            message: friendly.message,
            details: friendly.details,
          });
        }
      }
    });
  };

  const handleSaveBoothSettings = async () => {
    setIsBoothSettingsSaving(true);
    try {
      const prevGp = savedBoothGpPercent;
      await setConfig((prev: any) => ({
        ...prev,
        boothGpPercent: bGpPercent,
        boothSettingsUpdatedAt: Date.now(),
        boothSettingsUpdatedBy: auth.currentUser?.email || "Admin",
      }));
      setHasBoothDraft(false);
      try {
        localStorage.removeItem(BOOTH_SETTINGS_DRAFT_KEY);
      } catch {
        // ignore
      }
      await logStaffAction(
        "UPDATE_BOOTH_SETTINGS",
        `Updated Booth Management GP rate from ${prevGp}% to ${bGpPercent}%`
      );
      showToast({
        type: "success",
        title: "บันทึกการตั้งค่าบูธกิจกรรมสำเร็จ",
        message: `บันทึกอัตราส่วนแบ่ง GP ส่วนกลางเป็น ${bGpPercent}% ลงฐานข้อมูลเรียบร้อยแล้ว`,
      });
    } catch (err) {
      console.error("Save booth settings error:", err);
      const friendly = getFriendlyFirestoreError(err);
      showToast({
        type: "error",
        title: "ไม่สามารถบันทึกการตั้งค่าบูธได้",
        message: friendly.message,
        details: friendly.details,
      });
    } finally {
      setIsBoothSettingsSaving(false);
    }
  };

  const handleRevertBoothDraft = () => {
    setBGpPercent(savedBoothGpPercent);
    setHasBoothDraft(false);
    try {
      localStorage.removeItem(BOOTH_SETTINGS_DRAFT_KEY);
    } catch {
      // ignore
    }
    showToast({
      type: "info",
      title: "คืนค่าที่บันทึกล่าสุดแล้ว",
      message: `กลับไปใช้อัตราส่วนแบ่ง GP ที่บันทึกล่าสุด (${savedBoothGpPercent}%)`,
    });
  };

  const handleResetBoothSettings = () => {
    showConfirm({
      title: "ยืนยันรีเซ็ตการตั้งค่าบูธเป็นค่าเริ่มต้น?",
      message: `การดำเนินการนี้จะรีเซ็ตอัตราส่วนแบ่ง GP ส่วนกลางจากปัจจุบัน (${bGpPercent}%) กลับเป็นค่าเริ่มต้นของระบบ (${DEFAULT_BOOTH_GP_PERCENT}%) และบันทึกลงฐานข้อมูลทันที คุณแน่ใจหรือไม่?`,
      confirmText: `รีเซ็ตเป็นค่าเริ่มต้น (${DEFAULT_BOOTH_GP_PERCENT}%)`,
      colorType: "amber",
      onConfirm: async () => {
        setIsBoothSettingsSaving(true);
        try {
          await setConfig((prev: any) => ({
            ...prev,
            boothGpPercent: DEFAULT_BOOTH_GP_PERCENT,
            boothSettingsUpdatedAt: Date.now(),
            boothSettingsUpdatedBy: auth.currentUser?.email || "Admin",
          }));
          setBGpPercent(DEFAULT_BOOTH_GP_PERCENT);
          setHasBoothDraft(false);
          try {
            localStorage.removeItem(BOOTH_SETTINGS_DRAFT_KEY);
          } catch {
            // ignore
          }
          await logStaffAction(
            "RESET_BOOTH_SETTINGS",
            `Reset Booth Management GP rate back to default (${DEFAULT_BOOTH_GP_PERCENT}%)`
          );
          showToast({
            type: "success",
            title: "รีเซ็ตเป็นค่าเริ่มต้นสำเร็จ",
            message: `คืนค่าอัตราส่วนแบ่ง GP ส่วนกลางกลับเป็น ${DEFAULT_BOOTH_GP_PERCENT}% เรียบร้อยแล้ว`,
          });
        } catch (err) {
          console.error("Reset booth settings error:", err);
          const friendly = getFriendlyFirestoreError(err);
          showToast({
            type: "error",
            title: "ไม่สามารถรีเซ็ตการตั้งค่าบูธได้",
            message: friendly.message,
            details: friendly.details,
          });
        } finally {
          setIsBoothSettingsSaving(false);
        }
      },
    });
  };

  const handleExportCSV = () => {
    const csvRows = [
      ["ชื่อบูธกิจกรรม (Booth Name)", "ชื่อเจ้าของร้าน (Owner Name)", "พร้อมเพย์รับเงิน (PromptPay ID)", "บัญชีรับเงิน (Account Name)", "สแกนเล่นกิจกรรมรวม (Visits Count)", "ทำยอดขายรวม (Commerce Count)", "ยอดสะสมสุทธิ (Gross Sales THB)", `ส่วนแบ่งจัดเก็บ GP (${bGpPercent}%)`, `รายรับสุทธิโอนเข้าร้าน (Payout THB)`]
    ];
    
    booths.forEach((b: any) => {
      const logsForBooth = boothScanLogs.filter((log: any) => log.boothId === b.id);
      const totalVisits = logsForBooth.length;
      const commerceLogs = logsForBooth.filter((log: any) => log.salesAmount > 0);
      const totalCommerce = commerceLogs.length;
      const totalSales = commerceLogs.reduce((sum: number, log: any) => sum + (Number(log.salesAmount) || 0), 0);
      
      const gp = (totalSales * bGpPercent) / 100;
      const payout = totalSales - gp;
      
      csvRows.push([
        b.name,
        b.ownerName,
        b.promptpayId || "-",
        b.promptpayName || "-",
        totalVisits.toString(),
        totalCommerce.toString(),
        totalSales.toString(),
        gp.toFixed(2),
        payout.toFixed(2)
      ]);
    });
    
    const csvContent = "\uFEFF" + csvRows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `booth_revenue_share_report_${Date.now()}.csv`);
  };

  const handleDownloadAllSlips = async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const slips = tickets.filter((t) => t.slipUrl);
      const folder = zip.folder("slips");
      if (!folder) return;

      const fetchPromises = slips.map(async (t) => {
        try {
          const response = await fetch(t.slipUrl);
          const blob = await response.blob();

          // Get filename extension safely
          let ext = "jpg";
          if (t.slipUrl.toLowerCase().includes(".png")) ext = "png";
          if (t.slipUrl.toLowerCase().includes(".jpeg")) ext = "jpeg";

          // Filename structure: ticketId_userName.jpg
          const fileName = `${t.id}_${t.userName || "unknown"}.${ext}`;
          folder.file(fileName, blob);
        } catch (err) {
          console.error(`Failed to download slip for ${t.id}`, err);
        }
      });

      await Promise.all(fetchPromises);
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `all_slips_${new Date().getTime()}.zip`);
    } catch (err) {
      console.error("Error creating zip", err);
      showToast({
        type: 'error',
        title: 'เกิดข้อผิดพลาดในการดาวน์โหลดสลิป',
        message: 'กรุณาลองใหม่อีกครั้ง',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const sponsorQty = parseInt(sponsorForm.qtyStr) || 0;

  const bankReport = React.useMemo(() => {
    if (!tickets.length || !tables.length) return [];

    const reportMap: Record<
      string,
      {
        zoneId: string;
        zoneName: string;
        bankName: string;
        bankAccount: string;
        bankAccountName: string;
        totalAmount: number;
        transactionCount: number;
        color: string;
      }
    > = {};

    tickets
      .filter((t) => !t.isSponsor)
      .forEach((t) => {
        const table = tables.find((tb) => tb.id === t.tableId);
        if (!table) return;
        const zoneId = table.zoneId;
        const zoneInfo = activeZones[zoneId as ZoneType];
        if (!zoneInfo) return;

        const groupKey = `${zoneId}_${zoneInfo.bankAccount}`;

        if (!reportMap[groupKey]) {
          reportMap[groupKey] = {
            zoneId,
            zoneName: zoneInfo.name,
            bankName: zoneInfo.bankName || "ไม่ระบุธนาคาร",
            bankAccount: zoneInfo.bankAccount || "ไม่ระบุเลขบัญชี",
            bankAccountName: zoneInfo.bankAccountName || "-",
            totalAmount: 0,
            transactionCount: 0,
            color: zoneInfo.color || "#e11d48",
          };
        }

        reportMap[groupKey].totalAmount += t.totalAmount || 0;
        reportMap[groupKey].transactionCount += 1;
      });

    return Object.values(reportMap);
  }, [tickets, tables, activeZones]);

  const allocateSeats = (
    zoneId: string,
    requiredSeats: number,
    allTables: Table[],
  ) => {
    const zoneTables = allTables
      .filter((t) => t.zoneId === zoneId)
      .map((t) => ({
        id: t.id,
        availSeats: t.seats.filter((s) => s.status === "available"),
      }));

    const totalAvail = zoneTables.reduce(
      (sum, t) => sum + t.availSeats.length,
      0,
    );
    if (totalAvail < requiredSeats) return null;

    let remaining = requiredSeats;
    const allocations: { tableId: string; seatIds: number[] }[] = [];

    const remainder = requiredSeats % 10;
    if (remainder > 0) {
      const candidates = zoneTables.filter(
        (t) => t.availSeats.length >= remainder,
      );
      candidates.sort(
        (a, b) =>
          a.availSeats.length - remainder - (b.availSeats.length - remainder),
      );

      let bestCandidate = candidates.find((c) => c.availSeats.length < 10);
      if (!bestCandidate && candidates.length > 0) {
        bestCandidate = candidates[0];
      }

      if (bestCandidate) {
        allocations.push({
          tableId: bestCandidate.id,
          seatIds: bestCandidate.availSeats
            .slice(0, remainder)
            .map((s) => s.id),
        });
        bestCandidate.availSeats = bestCandidate.availSeats.slice(remainder);
        remaining -= remainder;
      }
    }

    zoneTables.sort((a, b) => b.availSeats.length - a.availSeats.length);
    for (const t of zoneTables) {
      if (remaining === 0) break;
      if (t.availSeats.length > 0) {
        const toTake = Math.min(t.availSeats.length, remaining);
        if (toTake > 0) {
          allocations.push({
            tableId: t.id,
            seatIds: t.availSeats.slice(0, toTake).map((s) => s.id),
          });
          t.availSeats = t.availSeats.slice(toTake);
          remaining -= toTake;
        }
      }
    }

    if (remaining > 0) return null;

    return allocations.reduce(
      (acc, curr) => {
        const existing = acc.find((a) => a.tableId === curr.tableId);
        if (existing) {
          existing.seatIds = [...existing.seatIds, ...curr.seatIds];
        } else {
          acc.push(curr);
        }
        return acc;
      },
      [] as { tableId: string; seatIds: number[] }[],
    );
  };

  const allocationOptions: any[] = [];
  const specificTableOptions: any[] = [];

  if (sponsorQty > 0) {
    Object.keys(activeZones).forEach((zoneId) => {
      const plan = allocateSeats(zoneId, sponsorQty, tables);
      if (plan) {
        allocationOptions.push({
          type: "auto",
          zoneId,
          plan,
        });
      }
    });

    tables.forEach((t) => {
      const avail = t.seats.filter((s) => s.status === "available");
      if (avail.length >= sponsorQty) {
        specificTableOptions.push({
          type: "specific",
          zoneId: t.zoneId,
          plan: [
            {
              tableId: t.id,
              seatIds: avail.slice(0, sponsorQty).map((s) => s.id),
            },
          ],
        });
      }
    });
  }

  // Compute Drinks Consumption
  const { 
    drinkStats, 
    userDrinkStats, 
    drinkTotalRevenue,
    welcomeQuotaTotal,
    welcomeRedeemedTotal,
    welcomeValueSavedTotal
  } = useMemo(() => {
    const dStats: Record<string, number> = {};
    const udStats: {
      name: string;
      total: number;
      details: Record<string, number>;
      tableId: string;
      seatIds: number[];
    }[] = [];
    let dRev = 0;
    let wQuota = 0;
    let wRedeemed = 0;
    let wSaved = 0;

    tickets.forEach((t) => {
      // Calculate ticket-wide drink revenue considering free Welcome Drinks
      const actualRev = calculateTicketDrinkRevenue(t, localConfig, tables);
      dRev += actualRev;

      // Calculate Welcome Drink Quota & Redeemed
      const welcomeInfo = getTicketWelcomeDrinksInfo(t, localConfig, tables);
      wQuota += welcomeInfo.totalAllowance;
      wRedeemed += welcomeInfo.previousRedeemed;

      // Calculate the standard cost without welcome drink discount to find value saved
      let standardCost = 0;
      if (t.drinkHistory) {
        Object.entries(t.drinkHistory).forEach(([dId, qty]) => {
          const d = localConfig.drinks?.find((x: any) => x.id === dId);
          if (d) {
            standardCost += calculateDrinkPrice(d, Number(qty), localConfig.isWholeStoreFree);
          }
        });
      }
      const savedValue = Math.max(0, standardCost - actualRev);
      wSaved += savedValue;

      // Process seat-level history if available
      if (
        t.drinkHistoryBySeat &&
        Object.keys(t.drinkHistoryBySeat).length > 0
      ) {
        Object.entries(t.drinkHistoryBySeat).forEach(([seatIdStr, history]) => {
          let seatTotal = 0;
          Object.entries(history).forEach(([dId, qty]) => {
            dStats[dId] = (dStats[dId] || 0) + qty;
            seatTotal += qty;
          });
          if (seatTotal > 0) {
            udStats.push({
              name: t.userName,
              total: seatTotal,
              details: history,
              tableId: t.tableId,
              seatIds: [parseInt(seatIdStr, 10)],
            });
          }
        });

        // Process any leftover drinks that were ordered without a specific seat ID
        const accountedDrinkHistory: Record<string, number> = {};
        Object.values(t.drinkHistoryBySeat).forEach((history) => {
          Object.entries(history).forEach(([dId, qty]) => {
            accountedDrinkHistory[dId] =
              (accountedDrinkHistory[dId] || 0) + qty;
          });
        });

        if (t.drinkHistory) {
          const leftoverHistory: Record<string, number> = {};
          let leftoverTotal = 0;
          Object.entries(t.drinkHistory).forEach(([dId, qty]) => {
            const accountedQty = accountedDrinkHistory[dId] || 0;
            const leftoverQty = qty - accountedQty;
            if (leftoverQty > 0) {
              leftoverHistory[dId] = leftoverQty;
              leftoverTotal += leftoverQty;
              // Note: We don't add to dStats or dRev here to avoid double counting,
              // but we need to wait, early we didn't process the overall t.drinkHistory.
              // Actually, we SHOULD add to dStats and dRev for the leftover.
              dStats[dId] = (dStats[dId] || 0) + leftoverQty;
            }
          });

          if (leftoverTotal > 0) {
            udStats.push({
              name: t.userName,
              total: leftoverTotal,
              details: leftoverHistory,
              tableId: t.tableId,
              seatIds: t.seatIds,
            });
          }
        }
      } else if (t.drinkHistory) {
        // Fallback for older records without seat-level tracking
        let userTotal = 0;
        Object.entries(t.drinkHistory).forEach(([dId, qty]) => {
          dStats[dId] = (dStats[dId] || 0) + qty;
          userTotal += qty;
        });
        if (userTotal > 0) {
          udStats.push({
            name: t.userName,
            total: userTotal,
            details: t.drinkHistory,
            tableId: t.tableId,
            seatIds: t.seatIds,
          });
        }
      }
    });

    udStats.sort((a, b) => b.total - a.total);
    return {
      drinkStats: dStats,
      userDrinkStats: udStats,
      drinkTotalRevenue: dRev,
      welcomeQuotaTotal: wQuota,
      welcomeRedeemedTotal: wRedeemed,
      welcomeValueSavedTotal: wSaved,
    };
  }, [tickets, localConfig.drinks, tables]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 print:max-w-none print:w-full print:m-0 print:p-0 print:text-slate-800">
      <div className="print:hidden space-y-8">
        {helpRequests.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-500 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-8 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 text-rose-600 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-rose-700">
                แจ้งเตือนขอความช่วยเหลือ ({helpRequests.length} รายการ)!
              </h3>
              <p className="text-rose-600 text-sm font-medium">
                สตาฟต้องการความช่วยเหลือจากแอดมินที่หน้างาน
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            {helpRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white px-4 py-2 rounded-xl flex items-center justify-between gap-4 border border-rose-100 shadow-sm"
              >
                <div className="text-sm">
                  <span className="font-bold text-slate-800">
                    Staff: {req.staffEmail || req.staffUid?.slice(0, 6)}
                  </span>
                  <div className="text-xs text-slate-500">
                    {new Date(req.timestamp).toLocaleTimeString("th-TH")}
                  </div>
                  {req.message && (
                    <div className="text-rose-600 font-medium mt-1">
                      {req.message}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleResolveHelpRequest(req.id)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                >
                  เคลียร์ปัญหา (Resolved)
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4 print:mb-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800">
            แดชบอร์ด (Dashboard)
          </h2>
          <p className="text-slate-500 mt-1">
            ภาพรวมและตั้งค่าระบบ (Overview & Settings)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const regularTickets = tickets.filter((t) => !t.isSponsor);
              if (regularTickets.length === 0) {
                showToast({
                  type: 'info',
                  title: 'ไม่พบตั๋วการจองทั่วไปในระบบ',
                  message: 'ขณะนี้ไม่มียอดขายที่นั่งทั่วไปที่ต้องล้างข้อมูล',
                });
                return;
              }
              const seatCount = regularTickets.reduce((acc, t) => acc + (t.seatIds?.length || 0), 0);
              showConfirm({
                title: "คุณแน่ใจหรือไม่ที่จะล้างยอดขายที่นั่ง?",
                message: `พบตั๋วการจองทั่วไปจำนวน ${regularTickets.length} ใบ (${seatCount} ที่นั่ง) การดำเนินการนี้จะลบตั๋วดังกล่าวออกจากระบบทั้งหมด และคืนสถานะที่นั่งเหล่านั้นให้เป็นว่างอย่างถาวร คุณแน่ใจหรือไม่?`,
                confirmText: "ใช่, ยืนยันล้างยอดขาย",
                colorType: "rose",
                onConfirm: async () => {
                  try {
                    const result = await clearTicketsAndReleaseSeats(regularTickets, tables);
                    await logStaffAction(
                      "CLEAR_REGULAR_TICKETS",
                      `Cleared ${result.deletedCount} regular ticket(s) and reset ${result.releasedSeatsCount} seat(s) across ${result.updatedTablesCount} table(s)`
                    );
                    showToast({
                      type: 'success',
                      title: 'ล้างยอดขายที่นั่งสำเร็จ',
                      message: `ลบตั๋วทั่วไป ${result.deletedCount} ใบ และคืนสิทธิ์ที่นั่งว่าง ${result.releasedSeatsCount} ที่นั่งเรียบร้อยแล้ว`,
                    });
                  } catch (err) {
                    console.error("Error clearing regular tickets:", err);
                    const friendly = getFriendlyFirestoreError(err);
                    showToast({
                      type: 'error',
                      title: 'เกิดข้อผิดพลาดในการล้างยอดขายที่นั่ง',
                      message: friendly.message,
                      details: friendly.details,
                    });
                  }
                }
              });
            }}
            className="print:hidden flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-700 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm active:scale-95"
          >
            <Trash2 className="w-5 h-5" /> ล้างยอดขายที่นั่ง
          </button>
          <button
            onClick={() => {
              const sponsorTickets = tickets.filter((t) => t.isSponsor);
              if (sponsorTickets.length === 0) {
                showToast({
                  type: 'info',
                  title: 'ไม่พบข้อมูลบัตรสปอนเซอร์ในระบบ',
                  message: 'ขณะนี้ไม่มีรายการตั๋วผู้สนับสนุน (Sponsor) ที่ต้องล้างยอด',
                });
                return;
              }
              const sponsorSeatCount = sponsorTickets.reduce((acc, t) => acc + (t.seatIds?.length || 0), 0);
              showConfirm({
                title: "คุณแน่ใจหรือไม่ที่จะล้างยอดบัตรสปอนเซอร์?",
                message: `พบตั๋วผู้สนับสนุน (Sponsor) จำนวน ${sponsorTickets.length} ใบ (${sponsorSeatCount} ที่นั่ง) การล้างยอดจะลบตั๋วผู้สนับสนุนทั้งหมดออกจากระบบ และปรับสถานะที่นั่งเหล่านั้นให้กลับมาว่าง คุณแน่ใจหรือไม่?`,
                confirmText: "ยืนยันล้างยอดสปอนเซอร์",
                colorType: "rose",
                onConfirm: async () => {
                  try {
                    const result = await clearTicketsAndReleaseSeats(sponsorTickets, tables);
                    await logStaffAction(
                      "CLEAR_SPONSOR_TICKETS",
                      `Cleared ${result.deletedCount} sponsor ticket(s) and reset ${result.releasedSeatsCount} seat(s) across ${result.updatedTablesCount} table(s)`
                    );
                    showToast({
                      type: 'success',
                      title: 'ล้างยอดบัตรสปอนเซอร์สำเร็จ',
                      message: `ลบตั๋วผู้สนับสนุน ${result.deletedCount} ใบ และคืนสิทธิ์ที่นั่งว่าง ${result.releasedSeatsCount} ที่นั่งเรียบร้อยแล้ว`,
                    });
                  } catch (err) {
                    console.error("Error clearing sponsor tickets:", err);
                    const friendly = getFriendlyFirestoreError(err);
                    showToast({
                      type: 'error',
                      title: 'เกิดข้อผิดพลาดในการล้างยอดบัตรสปอนเซอร์',
                      message: friendly.message,
                      details: friendly.details,
                    });
                  }
                }
              });
            }}
            className="print:hidden flex items-center gap-2 bg-rose-100 hover:bg-rose-200 text-rose-600 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm active:scale-95"
          >
            <Trash2 className="w-5 h-5" /> ล้างยอดบัตรสปอนเซอร์
          </button>
          <button
            onClick={() => setReportModalOpen(true)}
            className="print:hidden flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95"
          >
            <Printer className="w-5 h-5" /> พิมพ์ / Export PDF
          </button>
        </div>
      </div>

      {/* Clean Adaptive Navigation Bar with Dedicated Menu Customization & Quick-Jump Dropdown */}
      <div className="relative print:hidden mb-8 border-b border-slate-200">
        <div className="flex items-center justify-between gap-2 md:gap-3">
          {/* Clean Scrollable Tab Group */}
          <div className="flex-1 flex items-end gap-1 sm:gap-2 overflow-x-auto whitespace-nowrap hide-scroll-bar no-scrollbar scroll-smooth">
            {normalizeAdminTabsOrder(userTabsOrder).map((tabId) => {
              const meta = ADMIN_TABS_BY_ID[tabId];
              if (!meta) return null;
              const isActive = activeTab === tabId;

              return (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setActiveTab(tabId)}
                  className={`group relative pb-3 pt-1.5 px-2.5 sm:px-3 text-xs sm:text-[13px] font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                  }`}
                >
                  <span
                    className={`transition-colors shrink-0 ${
                      isActive
                        ? "text-primary"
                        : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  >
                    {meta.renderIcon("w-3.5 h-3.5")}
                  </span>
                  <span className="whitespace-nowrap">{meta.label}</span>
                  {tabId === "emails" && pendingEmails?.length ? (
                    <span className="bg-primary text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full shrink-0 font-bold tabular-nums">
                      {pendingEmails.length}
                    </span>
                  ) : null}
                  {tabId === "users" && pendingUsersCount > 0 ? (
                    <span className="bg-rose-500 text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full shrink-0 font-bold tabular-nums">
                      {pendingUsersCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Right Controls: Customize Order Button + Quick-Jump Dropdown */}
          <div className="flex items-center gap-2 shrink-0 pb-2">
            <button
              type="button"
              onClick={openTabOrderModal}
              className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
              title="ปรับแต่งและจัดเรียงลำดับเมนูบาร์"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="hidden md:inline">จัดเรียงเมนู</span>
            </button>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowTabDropdown(!showTabDropdown)}
                className="relative flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                title="เปิดเมนูลัดสลับหน้าจออย่างรวดเร็ว"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="hidden sm:inline">เมนูด่วน</span>
                {pendingUsersCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] leading-none font-black px-1.5 py-0.5 rounded-full tabular-nums">
                    {pendingUsersCount}
                  </span>
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 shrink-0 ${
                    showTabDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showTabDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setShowTabDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-3.5 py-1.5 text-[10px] uppercase font-black tracking-wider text-slate-400 border-b border-slate-100 mb-1 flex items-center justify-between">
                      <span>เมนูลัดแอดมิน</span>
                      <span className="tabular-nums font-bold">
                        {DEFAULT_ADMIN_TABS_ORDER.length} เมนู
                      </span>
                    </div>
                    <div className="max-h-80 overflow-y-auto py-0.5">
                      {normalizeAdminTabsOrder(userTabsOrder).map((id) => {
                        const meta = ADMIN_TABS_BY_ID[id];
                        if (!meta) return null;
                        const isActive = activeTab === id;

                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setActiveTab(id);
                              setShowTabDropdown(false);
                            }}
                            className={`w-full text-left px-3.5 py-2 text-xs font-bold transition flex items-center justify-between gap-2 whitespace-nowrap ${
                              isActive
                                ? "bg-rose-50/70 text-rose-600 font-extrabold"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span
                                className={`shrink-0 ${
                                  isActive ? "text-rose-500" : "text-slate-400"
                                }`}
                              >
                                {meta.renderIcon("w-3.5 h-3.5")}
                              </span>
                              <span className="truncate">{meta.label}</span>
                              {id === "users" && pendingUsersCount > 0 && (
                                <span className="bg-rose-500 text-white text-[10px] leading-none font-black px-1.5 py-0.5 rounded-full tabular-nums shrink-0">
                                  {pendingUsersCount}
                                </span>
                              )}
                              {id === "emails" && pendingEmails?.length ? (
                                <span className="bg-primary text-white text-[10px] leading-none font-black px-1.5 py-0.5 rounded-full tabular-nums shrink-0">
                                  {pendingEmails.length}
                                </span>
                              ) : null}
                            </span>
                            {isActive && (
                              <Check className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-slate-100 mt-1.5 pt-1.5 px-2">
                      <button
                        type="button"
                        onClick={openTabOrderModal}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-primary hover:bg-slate-50 transition whitespace-nowrap cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                        <span>ปรับแต่งลำดับเมนูบาร์</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {activeTab === "overview" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print:grid print:grid-cols-2 print:gap-4 print:mb-6">
            <StatCard
              icon={<Users className="w-6 h-6 text-blue-500" />}
              title="ยอดขายที่นั่ง (Seats Sold)"
              value={`${paidSeatsCount} / ${totalSeats}`}
              bgColor="bg-blue-50"
            />
            <StatCard
              icon={<Banknote className="w-6 h-6 text-emerald-500" />}
              title="ยอดรายได้ (Revenue)"
              value={`฿${displayRevenue.toLocaleString()}`}
              bgColor="bg-emerald-50"
            />
            <StatCard
              icon={<Gift className="w-6 h-6 text-rose-500" />}
              title="มูลค่าสปอนเซอร์ (Comped)"
              value={`฿${totalSponsorValue.toLocaleString()}`}
              bgColor="bg-rose-50"
            />
            <StatCard
              icon={<MapIcon className="w-6 h-6 text-purple-500" />}
              title="จำนวนโต๊ะ (Tables)"
              value={`${tables.length} โต๊ะ`}
              bgColor="bg-purple-50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:block">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 print:break-inside-avoid print:shadow-none print:border-slate-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg">รายการขายล่าสุด</h3>
                <button
                  onClick={() => setShowSponsorModal(true)}
                  className="print:hidden text-xs bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                >
                  <Gift className="w-3 h-3" /> ออกบัตรสปอนเซอร์
                </button>
              </div>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 print:max-h-none print:overflow-visible">
                {tickets.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-10">
                    ยังไม่มีรายการชำระเงิน
                  </p>
                ) : (
                  tickets.map((t) => (
                    <div
                      key={t.id}
                      className="flex justify-between items-start p-3 hover:bg-slate-50 rounded-xl transition border border-slate-100 gap-3 print:break-inside-avoid print:border-slate-300"
                    >
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-bold text-slate-800 break-words whitespace-normal leading-tight text-sm"
                          title={t.userName}
                        >
                          {t.userName}{" "}
                          {t.isSponsor && (
                            <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-md ml-1 inline-block">
                              Sponsor
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 truncate">
                          โต๊ะ {t.tableId} • ที่นั่ง {t.seatIds.join(", ")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`font-bold ${t.isSponsor ? "text-rose-600" : "text-emerald-600"}`}
                        >
                          ฿{t.totalAmount.toLocaleString()}
                        </p>
                        {t.checkInTime ? (
                          <span className="text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded-full font-medium inline-block mt-1 print:border print:border-slate-300">
                            {t.checkedInSeats && t.checkedInSeats.length > 0
                              ? `เช็คอินแล้ว ${t.checkedInSeats.length}/${t.seatIds.length}`
                              : "เช็คอินแล้ว"}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium inline-block mt-1 print:border print:border-emerald-300">
                            รอเช็คอิน
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* LED System Trigger */}
            <div className="print:hidden bg-slate-900 rounded-3xl shadow-sm border border-slate-800 p-6 text-white flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Monitor className="w-48 h-48" />
              </div>

              <h3 className="font-bold text-lg flex items-center gap-2 mb-2 relative z-10">
                <Monitor className="w-5 h-5 text-primary" /> ระบบจอ LED (Big
                Screen)
              </h3>
              <p className="text-slate-400 text-sm mb-8 relative z-10">
                เปิดหน้าต่างระบบจับฉลากสำหรับแสดงผลขึ้นจอแอลอีดีขนาดใหญ่ในโรงแรม
              </p>

              <div className="flex-1 flex flex-col items-center justify-center relative z-10 mt-auto pt-6">
                <button
                  onClick={onOpenLuckyDraw}
                  className="bg-gradient-to-r from-primary to-orange-500 hover:from-primary-hover hover:to-orange-600 text-white w-full py-4 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all transform hover:scale-[1.02]"
                >
                  เปิดหน้าจับฉลาก (Launch LED Mode)
                </button>
              </div>
            </div>
          </div>

          {/* Bank Account Report Section */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mt-6 print:break-inside-avoid print:shadow-none print:border-slate-300">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Banknote className="w-5 h-5 text-emerald-500" />{" "}
              สรุปยอดเงินเข้าบัญชี (Bank Account Summary)
            </h3>

            {bankReport.length === 0 ? (
              <p className="text-slate-400 text-sm py-4 bg-slate-50 rounded-xl text-center print:bg-white print:border print:border-slate-300">
                ยังไม่มีรายการชำระเงิน
              </p>
            ) : (
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-left text-sm whitespace-nowrap print:whitespace-normal">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="py-3 px-4 rounded-l-xl">โซน</th>
                      <th className="py-3 px-4">ธนาคาร</th>
                      <th className="py-3 px-4">ชื่อบัญชี</th>
                      <th className="py-3 px-4">เลขที่บัญชี</th>
                      <th className="py-3 px-4 text-center">จำนวนรายการ</th>
                      <th className="py-3 px-4 text-right rounded-r-xl">
                        ยอดเงินรวม
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bankReport.map((report, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border"
                            style={getZoneStyle(report.color)}
                          >
                            {report.zoneName}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {report.bankName}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {report.bankAccountName}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono text-xs">
                          {report.bankAccount}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                            {report.transactionCount}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-bold text-emerald-600">
                            ฿{report.totalAmount.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200">
                    <tr>
                      <td
                        colSpan={4}
                        className="py-4 px-4 text-right font-bold text-slate-700"
                      >
                        รวมทั้งหมด:
                      </td>
                      <td className="py-4 px-4 text-center font-black text-slate-800">
                        {bankReport.reduce(
                          (acc, row) => acc + row.transactionCount,
                          0,
                        )}{" "}
                        รายการ
                      </td>
                      <td className="py-4 px-4 text-right font-black text-emerald-700 text-lg">
                        ฿
                        {bankReport
                          .reduce((acc, row) => acc + row.totalAmount, 0)
                          .toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Drinks Report Section */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mt-6 print:break-inside-avoid print:shadow-none print:border-slate-300">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
              <BarChart3 className="w-5 h-5 text-indigo-500" />{" "}
              สรุปภาพรวมเครื่องดื่ม (Drinks Consumption Report)
            </h3>

            {/* Welcome Drink Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 print:grid-cols-3">
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-4 rounded-2xl border border-indigo-100 shadow-sm text-left">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block mb-1">
                  โควตา Welcome Drink ทั้งหมด
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-indigo-950 font-sans">
                    {welcomeQuotaTotal.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-indigo-600">แก้ว</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 font-medium">
                  อิงตามโซนและจำนวนที่นั่งของตั๋วทั้งหมด
                </p>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 rounded-2xl border border-emerald-100 shadow-sm text-left">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">
                  แลกรับไปแล้วทั้งหมด
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-emerald-950 font-sans">
                    {welcomeRedeemedTotal.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-emerald-600">แก้ว</span>
                </div>
                {welcomeQuotaTotal > 0 ? (
                  <div className="w-full bg-emerald-200/50 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div 
                      className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (welcomeRedeemedTotal / welcomeQuotaTotal) * 100)}%` }}
                    />
                  </div>
                ) : null}
                <p className="text-[10px] text-slate-500 mt-1 font-medium">
                  คิดเป็น {welcomeQuotaTotal > 0 ? ((welcomeRedeemedTotal / welcomeQuotaTotal) * 100).toFixed(1) : 0}% ของโควตาทั้งหมด
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 rounded-2xl border border-purple-100 shadow-sm text-left">
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block mb-1">
                  มูลค่าส่วนลด Welcome Drink สะสม
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-purple-950 font-sans">
                    ฿{welcomeValueSavedTotal.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-purple-600">บาท</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 font-medium">
                  มูลค่าสิทธิ์ฟรีที่ผู้เข้าร่วมงานประหยัดได้จริง
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Total Drinks Issued */}
              <div className="print:break-inside-avoid">
                <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <GlassWater className="w-4 h-4" /> ยอดแจกจ่ายทั้งหมด
                </h4>
                <div className="space-y-3">
                  {Object.keys(drinkStats).length === 0 ? (
                    <p className="text-slate-400 text-sm py-4 bg-slate-50 rounded-xl text-center print:bg-white print:border print:border-slate-300">
                      ยังไม่มีการแลกเครื่องดื่ม
                    </p>
                  ) : (
                    localConfig.drinks?.map((drink: any) => {
                      const qty = drinkStats[drink.id] || 0;
                      if (qty === 0) return null;
                      return (
                        <div
                          key={drink.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 print:bg-white print:border-slate-300"
                        >
                          <span className="font-medium text-slate-700">
                            {drink.name}
                          </span>
                          <span className="text-indigo-600 font-black text-lg bg-indigo-100 px-3 py-1 rounded-lg print:border print:border-indigo-300">
                            {qty} แก้ว/ชิ้น
                          </span>
                        </div>
                      );
                    })
                  )}
                  {drinkTotalRevenue > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-800">
                        ยอดรายได้เครื่องดื่มรวม:
                      </span>
                      <span className="font-black text-emerald-600 text-xl">
                        ฿{drinkTotalRevenue.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Top Consumers */}
              <div className="print:break-inside-avoid">
                <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  🏆 สรุปการดื่มรายบุคคล (Top Consumers)
                </h4>
                <div className="space-y-3">
                  {userDrinkStats.length === 0 ? (
                    <p className="text-slate-400 text-sm py-4 bg-slate-50 rounded-xl text-center print:bg-white print:border print:border-slate-300">
                      ยังไม่มีข้อมูลการแลก
                    </p>
                  ) : (
                    userDrinkStats.slice(0, 5).map((u, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex items-start gap-3 print:shadow-none print:border-slate-300"
                      >
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-400 shrink-0 print:border print:border-slate-300">
                          #{idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="font-bold text-slate-800 break-words whitespace-normal leading-tight text-sm"
                            title={u.name}
                          >
                            {u.name}
                            <span className="block text-xs text-slate-400 font-normal mt-0.5">
                              โต๊ะ {u.tableId} • ที่นั่ง {u.seatIds.join(", ")}
                            </span>
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Object.entries(u.details).map(([dId, qty]) => {
                              const dName =
                                localConfig.drinks?.find(
                                  (x: any) => x.id === dId,
                                )?.name || "Unknown";
                              return (
                                <span
                                  key={dId}
                                  className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md break-words max-w-full print:border print:border-slate-300"
                                >
                                  {dName}: {qty}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-slate-400 mb-1">รวม</p>
                          <p className="font-black text-primary text-xl leading-none">
                            {u.total}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Survey Report Section */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mt-6 print:break-inside-avoid print:shadow-none print:border-slate-300 relative">
            <h3 className="font-bold text-lg mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-500" />{" "}
                ผลประเมินความพึงพอใจ (Satisfaction Survey)
              </div>
              {surveys && surveys.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSurveyClearConfirm(true)}
                  className="self-start sm:self-auto px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer print:hidden shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" /> ล้างแบบสอบถามทั้งหมด ({surveys.length})
                </button>
              )}
            </h3>

            {showSurveyClearConfirm && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-up">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 mb-4">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-black text-slate-800 mb-2 font-sans">
                    ล้างข้อมูลแบบสอบถามทั้งหมด?
                  </h4>
                  <p className="text-slate-500 text-sm mb-6 leading-relaxed font-sans">
                    คุณต้องการลบผลประเมินความพึงพอใจและข้อเสนอแนะทั้งหมดจำนวน <span className="font-bold text-rose-600 font-sans">{surveys?.length} รายการ</span> ใช่หรือไม่? การดำเนินการนี้จะลบข้อมูลออกจากระบบอย่างถาวรเพื่อเตรียมพร้อมสำหรับงานกิจกรรมใหม่
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={isClearingSurveys}
                      onClick={() => setShowSurveyClearConfirm(false)}
                      className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all active:scale-95 disabled:opacity-50 font-sans"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      disabled={isClearingSurveys}
                      onClick={handleClearAllSurveys}
                      className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm shadow-md shadow-rose-200 transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50 font-sans"
                    >
                      {isClearingSurveys ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          กำลังลบ...
                        </>
                      ) : (
                        "ยืนยันลบข้อมูล"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {!surveys || surveys.length === 0 ? (
              <p className="text-slate-400 text-sm py-4 bg-slate-50 rounded-xl text-center print:bg-white print:border print:border-slate-300">
                ยังไม่มีข้อมูลการประเมิน
              </p>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {SURVEY_TOPICS.map((topic) => {
                    const scores = surveys
                      .map((s) => s.ratings[topic.id])
                      .filter((v) => v != null);
                    const count = scores.length;
                    const avg = count
                      ? scores.reduce((a, b) => a + b, 0) / count
                      : 0;
                    // 1: ปรับปรุง, 2: พอใจ, 3: ชื่นชอบ
                    // percentage mapping just for visual progress bar: 1 -> 33%, 2 -> 66%, 3 -> 100%
                    const percent = (avg / 3) * 100;

                    let color = "bg-rose-500";
                    if (avg >= 2.5) color = "bg-emerald-500";
                    else if (avg >= 1.5) color = "bg-amber-500";

                    return (
                      <div
                        key={topic.id}
                        className="p-4 bg-slate-50 rounded-xl border border-slate-100 print:bg-white print:border-slate-300"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-slate-800 flex items-center gap-2">
                            {topic.label}
                          </span>
                          <span className="font-black text-slate-800 text-xl">
                            {avg.toFixed(1)}{" "}
                            <span className="text-sm font-medium text-slate-400">
                              / 3.0
                            </span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2.5 mb-1 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full ${color}`}
                            style={{
                              width: `${Math.max(0, Math.min(100, percent))}%`,
                            }}
                          ></div>
                        </div>
                        <p className="text-[10px] text-slate-500 text-right">
                          จากผู้ประเมิน {count} ท่าน
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 mb-4">
                    💬 ข้อเสนอแนะเพิ่มเติม (Recent Feedback)
                  </h4>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 print:max-h-none print:overflow-visible">
                    {surveys.filter((s) => s.comment?.trim()).length === 0 ? (
                      <p className="text-slate-400 text-sm italic">
                        ไม่มีข้อเสนอแนะ
                      </p>
                    ) : (
                      surveys
                        .filter((s) => s.comment?.trim())
                        .slice(-10)
                        .reverse()
                        .map((s) => (
                          <div
                            key={s.id}
                            className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm"
                          >
                            <p className="text-slate-700 italic">
                              "{s.comment}"
                            </p>
                            <p className="text-[10px] text-slate-400 mt-2 text-right">
                              จากบัตร #{s.ticketId}{" "}
                              {s.seatId ? `(Seat ${s.seatId})` : ""}
                            </p>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Settings Section */}
          <div className="print:hidden bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mt-6">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Settings className="w-5 h-5 text-slate-500" /> ตั้งค่าระบบ &
              ธีมหน้างาน (Theme Settings)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> แบนเนอร์งาน (KV Banner)
                </h4>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-slate-700">
                      ลิงก์รูปภาพ (Image URL)
                    </label>
                    {(localConfig.bannerUrl || "").includes(
                      "drive.google.com/file/d",
                    ) && (
                      <button
                        onClick={() => {
                          const match = localConfig.bannerUrl.match(
                            /\/file\/d\/([a-zA-Z0-9_-]+)/,
                          );
                          if (match && match[1]) {
                            setConfig({
                              ...config,
                              bannerUrl: `https://lh3.googleusercontent.com/d/${match[1]}`,
                            });
                          }
                        }}
                        className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded-md font-medium transition-colors flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> แปลงลิงก์ Google Drive
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={localConfig.bannerUrl}
                    onChange={(e) =>
                      handleUpdateLocalConfig({ bannerUrl: e.target.value })
                    }
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                    placeholder="https://..."
                  />
                  <p className="mt-2 text-xs font-medium text-slate-500 bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                    💡{" "}
                    <span className="font-semibold text-blue-700">
                      คำแนะนำสำหรับทีมออกแบบ:
                    </span>{" "}
                    ขนาดแบนเนอร์ที่เหมาะสมคือ{" "}
                    <strong className="text-blue-800">1200 x 400 พิกเซล</strong>{" "}
                    (อัตราส่วน 3:1)
                  </p>
                </div>
                {localConfig.bannerUrl && (
                  <div className="rounded-xl overflow-hidden shadow-sm border border-slate-100 h-32 bg-slate-50 relative">
                    <img
                      src={localConfig.bannerUrl}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      alt="Preview KV"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent flex items-end p-4">
                      <p className="text-white font-bold text-sm">Preview</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="hideEventNameOnBanner"
                    checked={localConfig.hideEventNameOnBanner || false}
                    onChange={(e) =>
                      handleUpdateLocalConfig({
                        hideEventNameOnBanner: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                  />
                  <label
                    htmlFor="hideEventNameOnBanner"
                    className="text-sm text-slate-700 cursor-pointer"
                  >
                    ซ่อนชื่อบนแบนเนอร์ (ใช้เมื่อรูปแบนเนอร์มีชื่ออยู่แล้ว)
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" /> รูปแบบผังการจัดโต๊ะ (Layout
                  Style)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: "banquet", name: "Banquet Style" },
                    { id: "cabaret", name: "Cabaret Style" },
                    { id: "u-shape", name: "U-Shape Style" },
                    { id: "theatre", name: "Theatre Style" },
                    { id: "classroom", name: "Classroom Style" },
                    { id: "boardroom", name: "Boardroom Style" },
                    { id: "chevron", name: "Chevron Style" },
                    { id: "circle-of-chairs", name: "Circle of Chairs" },
                  ].map((layout) => (
                    <button
                      key={layout.id}
                      onClick={async () => {
                        handleUpdateLocalConfig({ layoutStyle: layout.id });
                        try {
                          await setConfig({ ...localConfig, layoutStyle: layout.id });
                        } catch (e) {
                          console.error("Error saving layoutStyle:", e);
                        }
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${localConfig.layoutStyle === layout.id ? "border-primary bg-primary/5 text-primary" : "border-slate-200 hover:border-slate-300 text-slate-600 bg-slate-50"}`}
                    >
                      <LayoutIcon
                        type={layout.id}
                        color={
                          localConfig.layoutStyle === layout.id
                            ? localConfig.themeColor
                            : "#cbd5e1"
                        }
                      />
                      <span className="font-bold text-[13px] text-center mt-2">
                        {layout.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Palette className="w-4 h-4" /> ปรับแต่งสี & ชื่อ (Branding)
                </h4>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    ชื่อกิจกรรม (Event Name)
                  </label>
                  <input
                    type="text"
                    value={localConfig.eventName}
                    onChange={(e) =>
                      handleUpdateLocalConfig({ eventName: e.target.value })
                    }
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      วันที่จัดกิจกรรม (Event Date)
                    </label>
                    <input
                      type="date"
                      value={localConfig.eventDate || ""}
                      onChange={(e) =>
                        handleUpdateLocalConfig({ eventDate: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      เวลา (Event Time)
                    </label>
                    <input
                      type="time"
                      value={localConfig.eventTime || ""}
                      onChange={(e) =>
                        handleUpdateLocalConfig({ eventTime: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Event Venue Location Picker */}
                <div className="bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <label className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-primary shrink-0" />
                        ระบุพิกัดสถานที่จัดงาน (Location)
                      </label>
                      <p className="text-xs text-slate-500 mt-0.5">
                        ใช้ตรวจสอบว่าผู้เข้าร่วมอยู่ในรัศมีสถานที่จัดงานก่อนทำแบบประเมิน
                      </p>
                    </div>
                    {(() => {
                      const latNum = parseFloat(localConfig.eventLat || "");
                      const lngNum = parseFloat(localConfig.eventLng || "");
                      const hasValidLoc = isValidCoordinates(latNum, lngNum);
                      const radiusKm = Number(localConfig.eventRadiusKm) > 0 ? Number(localConfig.eventRadiusKm) : 2;
                      return hasValidLoc ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold whitespace-nowrap">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>เปิดเช็คระยะ {radiusKm} กม.</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-[11px] font-bold whitespace-nowrap">
                          ไม่จำกัดระยะทาง
                        </span>
                      );
                    })()}
                  </div>

                  {/* Method 1: Search Venue Name */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      วิธีที่ 1: ค้นหาจากชื่อสถานที่จัดงาน
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={locationSearchQuery}
                          onChange={(e) => setLocationSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSearchVenueLocation();
                            }
                          }}
                          placeholder="พิมพ์ชื่อสถานที่ เช่น ไบเทค บางนา, เซ็นทรัลเวิลด์, อิมแพ็ค..."
                          className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs sm:text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={isSearchingLocation}
                        onClick={handleSearchVenueLocation}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {isSearchingLocation ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Search className="w-3.5 h-3.5" />
                        )}
                        <span>ค้นหา</span>
                      </button>
                    </div>

                    {locationSearchResults.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-xl shadow-md divide-y divide-slate-100 max-h-52 overflow-y-auto">
                        {locationSearchResults.map((place) => (
                          <button
                            key={place.placeId + place.lat}
                            type="button"
                            onClick={() => {
                              const shortName = place.displayName.split(",")[0]?.trim() || place.displayName;
                              handleUpdateLocalConfig({
                                eventLat: place.lat.toFixed(6),
                                eventLng: place.lng.toFixed(6),
                                eventLocationName: shortName,
                              });
                              setLocationSearchResults([]);
                              setShowMapPreview(true);
                              showToast({
                                type: "success",
                                title: "เลือกสถานที่จัดงานแล้ว",
                                message: `${shortName} (${place.lat.toFixed(5)}, ${place.lng.toFixed(5)})`,
                              });
                            }}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition flex items-start gap-2.5 cursor-pointer"
                          >
                            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">
                                {place.displayName}
                              </p>
                              <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                                {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Method 2: Paste Google Maps Link or Coords */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      วิธีที่ 2: วางลิงก์ Google Maps หรือพิกัด (เช่น 13.7563, 100.5018)
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={locationMapInput}
                          onChange={(e) => setLocationMapInput(e.target.value)}
                          onPaste={(e) => {
                            const pasted = e.clipboardData?.getData("text");
                            if (pasted && parseCoordinatesFromText(pasted)) {
                              e.preventDefault();
                              handleParseMapLinkOrCoords(pasted);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleParseMapLinkOrCoords();
                            }
                          }}
                          placeholder="https://maps.app.goo.gl/... หรือ https://www.google.com/maps/..."
                          className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs sm:text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={isResolvingMapInput}
                        onClick={() => handleParseMapLinkOrCoords()}
                        className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                      >
                        {isResolvingMapInput ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Compass className="w-3.5 h-3.5 text-primary" />
                        )}
                        <span>ดึงพิกัด</span>
                      </button>
                    </div>
                  </div>

                  {/* Method 3 + Manual Coordinates + Radius */}
                  <div className="pt-2 border-t border-slate-200/70 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          ชื่อสถานที่จัดงาน (แสดงให้แอดมินจำง่าย)
                        </label>
                        <input
                          type="text"
                          value={localConfig.eventLocationName || ""}
                          onChange={(e) =>
                            handleUpdateLocalConfig({ eventLocationName: e.target.value })
                          }
                          placeholder="เช่น ศูนย์การประชุมแห่งชาติสิริกิติ์"
                          className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-xs sm:text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          รัศมีที่อนุญาต
                        </label>
                        <select
                          value={Number(localConfig.eventRadiusKm) > 0 ? Number(localConfig.eventRadiusKm) : 2}
                          onChange={(e) =>
                            handleUpdateLocalConfig({ eventRadiusKm: Number(e.target.value) })
                          }
                          className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-xs sm:text-sm font-bold text-slate-700"
                        >
                          <option value={0.5}>0.5 กม. (ในอาคาร)</option>
                          <option value={1}>1 กม.</option>
                          <option value={2}>2 กม. (แนะนำ)</option>
                          <option value={5}>5 กม.</option>
                          <option value={10}>10 กม.</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          ละติจูด (Latitude)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={localConfig.eventLat || ""}
                          onChange={(e) =>
                            handleUpdateLocalConfig({ eventLat: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-sm tabular-nums"
                          placeholder="Ex. 13.7563"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          ลองจิจูด (Longitude)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={localConfig.eventLng || ""}
                          onChange={(e) =>
                            handleUpdateLocalConfig({ eventLng: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-primary text-sm tabular-nums"
                          placeholder="Ex. 100.5018"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={isFetchingCurrentLocation}
                        onClick={handleFetchCurrentLocation}
                        className="text-xs bg-white border border-slate-200 hover:border-slate-300 px-3 py-2 rounded-xl font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
                      >
                        {isFetchingCurrentLocation ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        ) : (
                          <Crosshair className="w-3.5 h-3.5 text-primary" />
                        )}
                        <span>
                          {isFetchingCurrentLocation ? "กำลังระบุตำแหน่ง..." : "วิธีที่ 3: ดึงตำแหน่งปัจจุบันของฉัน"}
                        </span>
                      </button>

                      {(() => {
                        const latNum = parseFloat(localConfig.eventLat || "");
                        const lngNum = parseFloat(localConfig.eventLng || "");
                        if (!isValidCoordinates(latNum, lngNum)) return null;
                        return (
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setShowMapPreview((v) => !v)}
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{showMapPreview ? "ซ่อนแผนที่" : "ดูแผนที่"}</span>
                            </button>
                            <a
                              href={`https://www.google.com/maps?q=${latNum},${lngNum}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-primary font-bold flex items-center gap-1 transition whitespace-nowrap"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>เปิดใน Google Maps</span>
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateLocalConfig({
                                  eventLat: "",
                                  eventLng: "",
                                  eventLocationName: "",
                                })
                              }
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold transition cursor-pointer whitespace-nowrap"
                            >
                              ล้างพิกัด
                            </button>
                          </div>
                        );
                      })()}
                    </div>

                    {(() => {
                      const latNum = parseFloat(localConfig.eventLat || "");
                      const lngNum = parseFloat(localConfig.eventLng || "");
                      if (!showMapPreview || !isValidCoordinates(latNum, lngNum)) return null;
                      return (
                        <div className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-inner">
                          <iframe
                            title="Event Location Map Preview"
                            src={buildOpenStreetMapEmbedUrl(latNum, lngNum)}
                            className="w-full h-44 border-0"
                            loading="lazy"
                          />
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Professional Brand Theme System (Live CSS Preview Scope) */}
                {(() => {
                  const previewPrimary = normalizeHexColor(localConfig.themeColor, "#e11d48");
                  const previewSecondary = localConfig.enableSecondaryColor
                    ? normalizeHexColor(localConfig.secondaryColor, "#3b82f6")
                    : previewPrimary;
                  const previewAccent = localConfig.enableAccentColor
                    ? normalizeHexColor(localConfig.accentColor, "#10b981")
                    : previewPrimary;
                  const primaryContrast = getContrastFeedback(previewPrimary);

                  return (
                    <div
                      style={
                        {
                          "--theme-primary": previewPrimary,
                          "--theme-secondary": previewSecondary,
                          "--theme-accent": previewAccent,
                        } as React.CSSProperties
                      }
                      className="bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <label className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                            <Palette className="w-4 h-4 text-primary shrink-0" />
                            ระบบธีมสีแบรนด์ (Brand Theme System)
                          </label>
                          <p className="text-xs text-slate-500 mt-0.5">
                            เลือกชุดธีมสำเร็จรูปหรือกำหนดรหัสสี Hex เอง พร้อมแสดงผลจริงทันทีทั่วทั้งระบบ
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetThemeColors}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>รีเซ็ตธีมเริ่มต้น</span>
                        </button>
                      </div>

                      {/* Curated Theme Presets */}
                      <div>
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          ชุดธีมสีแนะนำ (เลือกใช้ได้ใน 1 คลิก)
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {THEME_PRESETS.map((preset) => {
                            const isSelected =
                              previewPrimary.toLowerCase() === preset.primary.toLowerCase() &&
                              (!localConfig.enableSecondaryColor ||
                                normalizeHexColor(localConfig.secondaryColor).toLowerCase() ===
                                  preset.secondary.toLowerCase()) &&
                              (!localConfig.enableAccentColor ||
                                normalizeHexColor(localConfig.accentColor).toLowerCase() ===
                                  preset.accent.toLowerCase());
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() =>
                                  handleUpdateLocalConfig({
                                    themeColor: preset.primary,
                                    secondaryColor: preset.secondary,
                                    accentColor: preset.accent,
                                    enableSecondaryColor: true,
                                    enableAccentColor: true,
                                  })
                                }
                                className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-white border-primary ring-2 ring-primary/15 shadow-sm"
                                    : "bg-white border-slate-200 hover:border-slate-300"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1.5 mb-1">
                                  <div className="flex items-center gap-1">
                                    <span
                                      className="w-3.5 h-3.5 rounded-full border border-black/10"
                                      style={{ backgroundColor: preset.primary }}
                                    />
                                    <span
                                      className="w-3.5 h-3.5 rounded-full border border-black/10"
                                      style={{ backgroundColor: preset.secondary }}
                                    />
                                    <span
                                      className="w-3.5 h-3.5 rounded-full border border-black/10"
                                      style={{ backgroundColor: preset.accent }}
                                    />
                                  </div>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                                </div>
                                <p className="text-xs font-extrabold text-slate-800 truncate">
                                  {preset.name}
                                </p>
                                <p className="text-[10px] text-slate-500 truncate">
                                  {preset.subtitle}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Primary Brand Color */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="text-xs font-extrabold text-slate-800">
                            สีธีมหลัก (Primary Brand Color)
                          </label>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400">Preview:</span>
                            <div
                              className="w-6 h-6 rounded-md bg-primary shadow-sm border border-black/10"
                              title="สีหลัก (Primary)"
                            />
                            <div
                              className="w-6 h-6 rounded-md bg-primary-hover shadow-sm border border-black/10"
                              title="สีเมื่อชี้เมาส์ (Hover)"
                            />
                            <div
                              className="w-6 h-6 rounded-md bg-primary-light border border-slate-200 shadow-sm"
                              title="สีพื้นหลังอ่อน (Light)"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={previewPrimary}
                            onChange={(e) =>
                              handleUpdateLocalConfig({ themeColor: e.target.value })
                            }
                            className="w-12 h-10 rounded-lg cursor-pointer shrink-0 bg-transparent border border-slate-200 p-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={primaryHexInput}
                                maxLength={7}
                                onChange={(e) => {
                                  const nextVal = e.target.value.toUpperCase();
                                  setPrimaryHexInput(nextVal);
                                  if (isValidHexColor(nextVal)) {
                                    handleUpdateLocalConfig({ themeColor: nextVal.toLowerCase() });
                                  }
                                }}
                                onBlur={() => {
                                  setPrimaryHexInput(previewPrimary.toUpperCase());
                                }}
                                className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-800 uppercase focus:outline-none focus:border-primary"
                                placeholder="#E11D48"
                              />
                              <span className="text-[11px] text-slate-500 truncate">
                                ใช้กับปุ่มหลัก แถบเมนู active และโลโก้
                              </span>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg ${
                            primaryContrast.level === "low"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-50 text-slate-600 border border-slate-100"
                          }`}
                        >
                          {primaryContrast.level === "low" ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                          <span>{primaryContrast.label}</span>
                        </div>
                      </div>

                      {/* Secondary Color */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <label className="text-xs font-extrabold text-slate-800 block">
                              สีธีมรอง (Secondary Color)
                            </label>
                            <span className="text-[11px] text-slate-500">
                              ใช้กับขั้นตอนการจอง การอัปโหลด และส่วนประกอบเสริม
                            </span>
                          </div>
                          <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
                            <span className="text-xs font-bold text-slate-600">เปิดใช้งาน</span>
                            <input
                              type="checkbox"
                              checked={!!localConfig.enableSecondaryColor}
                              onChange={(e) =>
                                handleUpdateLocalConfig({
                                  enableSecondaryColor: e.target.checked,
                                })
                              }
                              className="rounded text-primary h-4 w-4 accent-primary cursor-pointer"
                            />
                          </label>
                        </div>
                        {localConfig.enableSecondaryColor && (
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-2.5">
                              <input
                                type="color"
                                value={normalizeHexColor(localConfig.secondaryColor, "#3b82f6")}
                                onChange={(e) =>
                                  handleUpdateLocalConfig({ secondaryColor: e.target.value })
                                }
                                className="w-10 h-9 rounded-lg cursor-pointer shrink-0 bg-transparent border border-slate-200 p-0.5"
                              />
                              <input
                                type="text"
                                value={secondaryHexInput}
                                maxLength={7}
                                onChange={(e) => {
                                  const nextVal = e.target.value.toUpperCase();
                                  setSecondaryHexInput(nextVal);
                                  if (isValidHexColor(nextVal)) {
                                    handleUpdateLocalConfig({
                                      secondaryColor: nextVal.toLowerCase(),
                                    });
                                  }
                                }}
                                onBlur={() =>
                                  setSecondaryHexInput(
                                    normalizeHexColor(
                                      localConfig.secondaryColor,
                                      "#3b82f6"
                                    ).toUpperCase()
                                  )
                                }
                                className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-800 uppercase focus:outline-none focus:border-primary"
                                placeholder="#3B82F6"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded bg-secondary border border-black/10" />
                              <div className="w-5 h-5 rounded bg-secondary-hover border border-black/10" />
                              <div className="w-5 h-5 rounded bg-secondary-light border border-slate-200" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Accent Color */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <label className="text-xs font-extrabold text-slate-800 block">
                              สีพิเศษ (Accent Color)
                            </label>
                            <span className="text-[11px] text-slate-500">
                              ใช้เน้นปุ่มยืนยันการชำระเงิน ยอดรวม และจุดดึงดูดสายตา
                            </span>
                          </div>
                          <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
                            <span className="text-xs font-bold text-slate-600">เปิดใช้งาน</span>
                            <input
                              type="checkbox"
                              checked={!!localConfig.enableAccentColor}
                              onChange={(e) =>
                                handleUpdateLocalConfig({
                                  enableAccentColor: e.target.checked,
                                })
                              }
                              className="rounded text-primary h-4 w-4 accent-primary cursor-pointer"
                            />
                          </label>
                        </div>
                        {localConfig.enableAccentColor && (
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-2.5">
                              <input
                                type="color"
                                value={normalizeHexColor(localConfig.accentColor, "#10b981")}
                                onChange={(e) =>
                                  handleUpdateLocalConfig({ accentColor: e.target.value })
                                }
                                className="w-10 h-9 rounded-lg cursor-pointer shrink-0 bg-transparent border border-slate-200 p-0.5"
                              />
                              <input
                                type="text"
                                value={accentHexInput}
                                maxLength={7}
                                onChange={(e) => {
                                  const nextVal = e.target.value.toUpperCase();
                                  setAccentHexInput(nextVal);
                                  if (isValidHexColor(nextVal)) {
                                    handleUpdateLocalConfig({
                                      accentColor: nextVal.toLowerCase(),
                                    });
                                  }
                                }}
                                onBlur={() =>
                                  setAccentHexInput(
                                    normalizeHexColor(
                                      localConfig.accentColor,
                                      "#10b981"
                                    ).toUpperCase()
                                  )
                                }
                                className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-800 uppercase focus:outline-none focus:border-primary"
                                placeholder="#10B981"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded bg-accent border border-black/10" />
                              <div className="w-5 h-5 rounded bg-accent-hover border border-black/10" />
                              <div className="w-5 h-5 rounded bg-accent-light border border-slate-200" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Live Interactive Component Preview */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            ตัวอย่างการแสดงผลหน้างานจริง
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {hasChanges ? "กำลังพรีวิวค่าใหม่" : "ตรงกับค่าที่บันทึก"}
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                          <div className="bg-white px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-sm bg-primary shrink-0" />
                              <span className="text-xs font-extrabold text-slate-800 truncate">
                                {localConfig.eventName || "EventTicketingPro"}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-primary border-b-2 border-primary pb-0.5 shrink-0">
                              จองที่นั่ง
                            </span>
                          </div>
                          <div className="p-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-bold shadow-sm">
                                ปุ่มหลัก (Primary)
                              </span>
                              <span className="px-2.5 py-1.5 rounded-lg bg-secondary-light text-secondary border border-secondary/30 text-[11px] font-bold">
                                ป้ายข้อมูลรอง (Secondary)
                              </span>
                            </div>
                            <span className="px-3 py-1.5 rounded-lg bg-accent text-white text-[11px] font-bold shadow-sm tabular-nums">
                              ชำระเงิน ฿3,500 (Accent)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Save / Discard Bar inside Branding Card */}
                      {hasChanges && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                          <span className="text-xs font-bold text-amber-700">
                            มีการปรับปรุงข้อมูลงานหรือธีมสีที่ยังไม่บันทึก
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleResetConfig}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold transition cursor-pointer whitespace-nowrap"
                            >
                              ยกเลิก
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveConfig}
                              className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>บันทึกธีม &amp; ข้อมูลงาน</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Drinks Management */}
            <div className="mt-8 pt-8 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                  🍹 จัดการเมนูเครื่องดื่ม (Drinks Menu)
                </h4>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                  <span className="text-sm font-bold text-slate-700">
                    เหมาร้าน (ฟรีทุกรายการ):
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={!!localConfig.isWholeStoreFree}
                      onChange={(e) =>
                        handleUpdateLocalConfig({
                          isWholeStoreFree: e.target.checked,
                        })
                      }
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>
              <div className="space-y-3">
                {localConfig.drinks?.map((drink: any, idx: number) => (
                  <div
                    key={drink.id}
                    className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm space-y-4"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="text"
                        value={drink.name}
                        onChange={(e) => {
                          const newDrinks = [...localConfig.drinks];
                          newDrinks[idx].name = e.target.value;
                          handleUpdateLocalConfig({ drinks: newDrinks });
                        }}
                        className="flex-1 min-w-[150px] px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                        placeholder="ชื่อเครื่องดื่ม"
                      />
                      <div className="relative w-28">
                        <span className="absolute left-3 top-2 text-slate-400 font-medium font-sans text-sm">
                          ฿
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={drink.price || 0}
                          onChange={(e) => {
                            const newDrinks = [...localConfig.drinks];
                            newDrinks[idx].price =
                              parseInt(e.target.value) || 0;
                            handleUpdateLocalConfig({ drinks: newDrinks });
                          }}
                          className="w-full pl-6 pr-2 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                          placeholder="ราคา"
                        />
                      </div>
                      <select
                        value={drink.color}
                        onChange={(e) => {
                          const newDrinks = [...localConfig.drinks];
                          newDrinks[idx].color = e.target.value;
                          handleUpdateLocalConfig({ drinks: newDrinks });
                        }}
                        className="px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                      >
                        <option value="blue">Blue (น้ำเงิน)</option>
                        <option value="amber">Amber (ส้ม/เหลือง)</option>
                        <option value="emerald">Emerald (เขียว)</option>
                        <option value="rose">Rose (แดง/ชมพู)</option>
                        <option value="purple">Purple (ม่วง)</option>
                      </select>
                      <button
                        onClick={() => {
                          const newDrinks = localConfig.drinks.filter(
                            (_: any, i: number) => i !== idx,
                          );
                          handleUpdateLocalConfig({ drinks: newDrinks });
                        }}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                      >
                        ลบ
                      </button>
                    </div>

                    {/* Promotions */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200/60">
                      {/* แถมฟรี */}
                      <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                        <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                          โปรโมชั่นแถมฟรี
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-slate-600">ซื้อ</span>
                          <input
                            type="number"
                            min="0"
                            value={drink.buyQty || ""}
                            placeholder="0"
                            onChange={(e) => {
                              const newDrinks = [...localConfig.drinks];
                              newDrinks[idx].buyQty =
                                parseInt(e.target.value) || 0;
                              handleUpdateLocalConfig({ drinks: newDrinks });
                            }}
                            className="w-12 px-2 py-1 text-sm rounded-md border border-slate-200 text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white"
                          />
                          <span className="text-sm text-slate-600">แถม</span>
                          <input
                            type="number"
                            min="0"
                            value={drink.freeQty || ""}
                            placeholder="0"
                            onChange={(e) => {
                              const newDrinks = [...localConfig.drinks];
                              newDrinks[idx].freeQty =
                                parseInt(e.target.value) || 0;
                              handleUpdateLocalConfig({ drinks: newDrinks });
                            }}
                            className="w-12 px-2 py-1 text-sm rounded-md border border-slate-200 text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white"
                          />
                        </div>
                      </div>

                      {/* ส่วนลด % */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                          ส่วนลดเพิ่ม (%)
                        </span>
                        <div className="relative w-full max-w-[90px]">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={drink.discountPercent || ""}
                            placeholder="0"
                            onChange={(e) => {
                              const newDrinks = [...localConfig.drinks];
                              newDrinks[idx].discountPercent =
                                parseInt(e.target.value) || 0;
                              handleUpdateLocalConfig({ drinks: newDrinks });
                            }}
                            className="w-full pr-6 pl-3 py-1.5 text-sm rounded-md border border-slate-200 outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white"
                          />
                          <span className="absolute right-2 top-1.5 text-slate-400 text-xs font-bold">
                            %
                          </span>
                        </div>
                      </div>

                      {/* Service Charge */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                          Service Charge
                        </span>
                        <div className="relative w-full max-w-[90px]">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={drink.serviceChargePercent || ""}
                            placeholder="0"
                            onChange={(e) => {
                              const newDrinks = [...localConfig.drinks];
                              newDrinks[idx].serviceChargePercent =
                                parseInt(e.target.value) || 0;
                              handleUpdateLocalConfig({ drinks: newDrinks });
                            }}
                            className="w-full pr-6 pl-3 py-1.5 text-sm rounded-md border border-slate-200 outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white"
                          />
                          <span className="absolute right-2 top-1.5 text-slate-400 text-xs font-bold">
                            %
                          </span>
                        </div>
                      </div>

                      {/* สินค้าฟรี */}
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                          สินค้าแจกฟรี (0฿)
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer mt-1">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={!!drink.isFree}
                            onChange={(e) => {
                              const newDrinks = [...localConfig.drinks];
                              newDrinks[idx].isFree = e.target.checked;
                              handleUpdateLocalConfig({ drinks: newDrinks });
                            }}
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    </div>

                    {/* Welcome Drink Configuration */}
                    <div className="bg-white/80 p-3.5 rounded-lg border border-slate-250/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold tracking-wide text-indigo-700 uppercase flex items-center gap-1.5">
                            🍹 ตั้งค่าสิทธิ์ Welcome Drink
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">มอบสิทธิ์รับเครื่องดื่มแก้วนี้เป็นสิทธิพิเศษฟรีประจำโซนหรือรายโต๊ะ</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={!!drink.isWelcomeDrink}
                            onChange={(e) => {
                              const newDrinks = [...localConfig.drinks];
                              newDrinks[idx].isWelcomeDrink = e.target.checked;
                              if (e.target.checked) {
                                newDrinks[idx].welcomeZones = newDrinks[idx].welcomeZones || [];
                                newDrinks[idx].welcomeTables = newDrinks[idx].welcomeTables || [];
                              }
                              handleUpdateLocalConfig({ drinks: newDrinks });
                            }}
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      {drink.isWelcomeDrink && (
                        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          {/* Zone Selection */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-600 block text-xs">โซนที่ได้รับสิทธิ์ (Zone Selection):</span>
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newDrinks = [...localConfig.drinks];
                                    newDrinks[idx].welcomeZones = activeZonesList.map((z: any) => z.id);
                                    handleUpdateLocalConfig({ drinks: newDrinks });
                                  }}
                                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-all active:scale-95 cursor-pointer"
                                >
                                  เลือกทุกโซน
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newDrinks = [...localConfig.drinks];
                                    newDrinks[idx].welcomeZones = [];
                                    handleUpdateLocalConfig({ drinks: newDrinks });
                                  }}
                                  className="text-[10px] text-slate-500 hover:text-slate-700 font-bold bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-all active:scale-95 cursor-pointer"
                                >
                                  ล้างทั้งหมด
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {activeZonesList.map((zone: any) => {
                                const isChecked = Array.isArray(drink.welcomeZones) && drink.welcomeZones.includes(zone.id);
                                return (
                                  <label key={zone.id} className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 px-2 py-1 rounded-lg cursor-pointer transition-colors border border-slate-200 font-medium">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const newDrinks = [...localConfig.drinks];
                                        const welcomeZones = Array.isArray(newDrinks[idx].welcomeZones) ? [...newDrinks[idx].welcomeZones] : [];
                                        if (e.target.checked) {
                                          if (!welcomeZones.includes(zone.id)) welcomeZones.push(zone.id);
                                        } else {
                                          const itemIdx = welcomeZones.indexOf(zone.id);
                                          if (itemIdx > -1) welcomeZones.splice(itemIdx, 1);
                                        }
                                        newDrinks[idx].welcomeZones = welcomeZones;
                                        handleUpdateLocalConfig({ drinks: newDrinks });
                                      }}
                                      className="rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span>{zone.name || zone.id}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          {/* Table Selection */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-600 block text-xs">โต๊ะที่ได้รับสิทธิ์ (Table Selection):</span>
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newDrinks = [...localConfig.drinks];
                                    newDrinks[idx].welcomeTables = tables.map((t: any) => t.id);
                                    handleUpdateLocalConfig({ drinks: newDrinks });
                                  }}
                                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-all active:scale-95 cursor-pointer"
                                >
                                  เลือกทุกโต๊ะ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newDrinks = [...localConfig.drinks];
                                    newDrinks[idx].welcomeTables = [];
                                    handleUpdateLocalConfig({ drinks: newDrinks });
                                  }}
                                  className="text-[10px] text-slate-500 hover:text-slate-700 font-bold bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-all active:scale-95 cursor-pointer"
                                >
                                  ล้างทั้งหมด
                                </button>
                              </div>
                            </div>
                            <div className="max-h-28 overflow-y-auto border border-slate-200/60 rounded-lg p-2 bg-slate-50/50 flex flex-wrap gap-1.5">
                              {tables.map((table: any) => {
                                const isChecked = Array.isArray(drink.welcomeTables) && drink.welcomeTables.includes(table.id);
                                return (
                                  <label key={table.id} className="flex items-center gap-1 bg-white hover:bg-indigo-50 px-2 py-1 rounded-md cursor-pointer transition-all border border-slate-200/80 hover:border-indigo-200">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const newDrinks = [...localConfig.drinks];
                                        const welcomeTables = Array.isArray(newDrinks[idx].welcomeTables) ? [...newDrinks[idx].welcomeTables] : [];
                                        if (e.target.checked) {
                                          if (!welcomeTables.includes(table.id)) welcomeTables.push(table.id);
                                        } else {
                                          const itemIdx = welcomeTables.indexOf(table.id);
                                          if (itemIdx > -1) welcomeTables.splice(itemIdx, 1);
                                        }
                                        newDrinks[idx].welcomeTables = welcomeTables;
                                        handleUpdateLocalConfig({ drinks: newDrinks });
                                      }}
                                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                    />
                                    <span className="font-mono text-[10px] font-bold text-slate-700">{table.id}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newDrinks = [
                      ...(localConfig.drinks || []),
                      {
                        id: Date.now().toString(),
                        name: "เครื่องดื่มใหม่",
                        color: "blue",
                      },
                    ];
                    handleUpdateLocalConfig({ drinks: newDrinks });
                  }}
                  className="text-primary font-medium text-sm hover:underline px-2"
                >
                  + เพิ่มเมนูเครื่องดื่ม
                </button>
              </div>
            </div>

            {/* Zones and Pricing Management */}
            <div className="mt-8 pt-8 border-t border-slate-100 print:hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                  🎟️ จัดการโซนและราคา (Zones & Pricing)
                </h4>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                    <span className="text-sm font-bold text-slate-700">
                      เหมาบัตร (ฟรีทุกโซน):
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={!!localConfig.isTicketFree}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            isTicketFree: e.target.checked,
                          })
                        }
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                    <span className="text-sm font-bold text-amber-700">
                      โหมดจำลองยอด (Mock Data):
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={isMockMode}
                        disabled={isTogglingMock}
                        onChange={handleToggleMockMode}
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                  {!editingZones ? (
                    <button
                      onClick={() => setEditingZones(true)}
                      className="text-primary hover:underline text-sm font-medium flex items-center gap-1"
                    >
                      <Edit2 className="w-4 h-4" /> แก้ไขโซน
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          const tablesWithReservations = getTablesToBeDeletedWithReservations(
                            tables,
                            zoneForm,
                            priceForm,
                          );

                          const proceedSave = async () => {
                            setEditingZones(false);
                            const updatedConfig = {
                              ...localConfig,
                              zones: priceForm,
                              zoneCounts: zoneForm,
                            };
                            handleUpdateLocalConfig({
                              zones: priceForm,
                              zoneCounts: zoneForm,
                            });

                            // Force save config so tables and config match immediately
                            await setConfig(updatedConfig);
                            setHasChanges(false);

                            if (setTables) {
                              setIsSaving(true);
                              const nextTables = updateTablesIncrementally(
                                tables,
                                zoneForm,
                                priceForm,
                              );
                              await setTables(nextTables);
                              setIsSaving(false);
                            }
                          };

                          if (tablesWithReservations.length > 0) {
                            const tableNames = tablesWithReservations.map((t) => t.id).join(", ");
                            showConfirm({
                              title: "ยืนยันการลบโต๊ะที่มีการจอง?",
                              message: `คำเตือน: โต๊ะที่จะถูกลบ (${tableNames}) มีที่นั่งที่มีการจองอยู่แล้ว หากดำเนินการต่อ ระบบจะลบข้อมูลโต๊ะและประวัติการจองของโต๊ะเหล่านี้ทั้งหมดทันที ยืนยันที่จะลบออกจากระบบใช่หรือไม่?`,
                              confirmText: "ใช่, ยืนยันลบโต๊ะที่มีการจอง",
                              colorType: "rose",
                              onConfirm: proceedSave,
                            });
                          } else {
                            await proceedSave();
                          }
                        }}
                        className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all transform active:scale-95"
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {isSaving
                          ? "กำลังบันทึก..."
                          : "บันทึกสเปค (ไม่รีเซ็ตโต๊ะ)"}
                      </button>
                      <button
                        onClick={async () => {
                          showConfirm({
                            title: "ล้างข้อมูลประวัติการจองทั้งหมด?",
                            message: "คำเตือน: การดำเนินการนี้จะลบตั๋วเข้าร่วมงาน ประวัติการเช็คอิน การสุ่มรางวัล (Lucky Draw) และผลสำรวจในระบบทั้งหมด แต่จะยังคงรักษารายชื่อและการจัดวางของโต๊ะทุกตัวตามที่ถูกสร้างไว้ในแต่ละโซนโดยไม่มีการลบหรือลดจำนวนโต๊ะลง ดำเนินการนี้แล้วไม่สามารถกู้คืนได้ คุณต้องการทำรายการต่อหรือไม่?",
                            confirmText: "ใช่, ยืนยันล้างการจอง",
                            colorType: "rose",
                            onConfirm: async () => {
                              setEditingZones(false);
                              const updatedConfig = {
                                ...localConfig,
                                zones: priceForm,
                                zoneCounts: zoneForm,
                              };
                              handleUpdateLocalConfig({
                                zones: priceForm,
                                zoneCounts: zoneForm,
                              });

                              // Force save config so tables and config match immediately
                              await setConfig(updatedConfig);
                              setHasChanges(false);

                              if (setTables) {
                                setIsSaving(true);

                                try {
                                  // 1. Delete all ticket records
                                  const deleteTicketPromises = tickets.map((t) =>
                                    deleteDoc(doc(db, "tickets", t.id)),
                                  );

                                  // 2. Clear surveys and lucky draw collections to prevent orphan records
                                  const surveysSnap = await getDocs(collection(db, "surveys"));
                                  const deleteSurveyPromises: Promise<void>[] = [];
                                  surveysSnap.forEach((d) => {
                                    deleteSurveyPromises.push(deleteDoc(doc(db, "surveys", d.id)));
                                  });

                                  const luckyDrawSnap = await getDocs(collection(db, "luckyDraw"));
                                  const deleteLuckyDrawPromises: Promise<void>[] = [];
                                  luckyDrawSnap.forEach((d) => {
                                    deleteLuckyDrawPromises.push(deleteDoc(doc(db, "luckyDraw", d.id)));
                                  });

                                  await Promise.all([
                                    ...deleteTicketPromises,
                                    ...deleteSurveyPromises,
                                    ...deleteLuckyDrawPromises,
                                  ]);

                                  // 3. Keep current table objects but set all of their seats to 'available'
                                  const cleanTables = tables.map((t) => ({
                                    ...t,
                                    seats: t.seats.map((s) => ({
                                      id: s.id,
                                      status: "available" as const,
                                    })),
                                  }));

                                  await executeChunkedBatch(
                                    cleanTables.map((t) => ({
                                      type: "set" as const,
                                      collectionName: "tables",
                                      id: t.id,
                                      data: t,
                                    }))
                                  );

                                  await setTables(cleanTables);

                                  // Log staff action
                                  await logStaffAction(
                                    "CLEAR_RESERVATIONS",
                                    "Cleared all seat reservations and associated tickets/surveys while keeping existing table counts intact"
                                  );

                                  showToast({
                                    type: 'success',
                                    title: 'ล้างข้อมูลการจองเรียบร้อยแล้ว',
                                    message: 'ล้างข้อมูลการจองแต่ละที่นั่งเสร็จสิ้น โดยรักษารายชื่อและจำนวนโต๊ะตามระบบเดิม',
                                  });
                                } catch (err) {
                                  console.error(err);
                                  const friendly = getFriendlyFirestoreError(err);
                                  showToast({
                                    type: 'error',
                                    title: 'เกิดข้อผิดพลาดในการล้างข้อมูลการจอง',
                                    message: friendly.message,
                                    details: friendly.details,
                                  });
                                }

                                setIsSaving(false);
                              }
                            }
                          });
                        }}
                        className="bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all transform active:scale-95"
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        {isSaving
                          ? "กำลังบันทึก..."
                          : "บันทึกและล้างข้อมูลการจองทั้งหมด (คงจำนวนโต๊ะเดิม)"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {Object.keys(editingZones ? priceForm : activeZones)
                  .sort((a, b) => {
                    const dataObj = editingZones ? priceForm : activeZones;
                    return (
                      (dataObj[a]?.layoutOrder || 0) -
                      (dataObj[b]?.layoutOrder || 0)
                    );
                  })
                  .map((zone) => {
                    const zCount = zoneForm[zone] || 0;
                    return (
                      <div
                        key={zone}
                        className="flex flex-col bg-slate-50 rounded-xl border border-slate-200 shadow-[0_2px_4px_rgba(0,0,0,0.02)] relative overflow-hidden"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center p-4">
                          <div className="sm:col-span-3">
                            {editingZones ? (
                              <input
                                type="text"
                                value={priceForm[zone]?.name || ""}
                                onChange={(e) =>
                                  setPriceForm({
                                    ...priceForm,
                                    [zone]: {
                                      ...priceForm[zone],
                                      name: e.target.value,
                                    },
                                  })
                                }
                                className="w-full px-2 py-1 rounded-md text-xs font-bold border border-slate-200"
                              />
                            ) : (
                              <span
                                className="inline-block px-3 py-1 rounded-full text-xs font-bold border"
                                style={getZoneStyle(activeZones[zone]?.color)}
                              >
                                {activeZones[zone]?.name}
                              </span>
                            )}
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">
                              จำนวนโต๊ะ
                            </label>
                            <input
                              type="number"
                              min="0"
                              disabled={!editingZones}
                              value={
                                editingZones
                                  ? zCount
                                  : localConfig.zoneCounts?.[zone] || 0
                              }
                              onChange={(e) =>
                                setZoneForm({
                                  ...zoneForm,
                                  [zone]: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-full px-2 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none disabled:bg-slate-100 disabled:text-slate-500"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">
                              ที่นั่ง/โต๊ะ
                            </label>
                            <input
                              type="number"
                              min="1"
                              disabled={!editingZones}
                              value={
                                editingZones
                                  ? priceForm[zone]?.seatsPerTable || 10
                                  : activeZones[zone]?.seatsPerTable || 10
                              }
                              onChange={(e) =>
                                setPriceForm({
                                  ...priceForm,
                                  [zone]: {
                                    ...priceForm[zone],
                                    seatsPerTable:
                                      parseInt(e.target.value) || 10,
                                  },
                                })
                              }
                              className="w-full px-2 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none disabled:bg-slate-100 disabled:text-slate-500"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">
                              ราคา/ที่นั่ง
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-2 text-slate-400 font-medium font-sans text-sm">
                                ฿
                              </span>
                              <input
                                type="number"
                                min="0"
                                disabled={!editingZones}
                                value={
                                  editingZones
                                    ? priceForm[zone]?.pricePerSeat
                                    : activeZones[zone]?.pricePerSeat || 0
                                }
                                onChange={(e) =>
                                  setPriceForm({
                                    ...priceForm,
                                    [zone]: {
                                      ...priceForm[zone],
                                      pricePerSeat:
                                        parseInt(e.target.value) || 0,
                                    },
                                  })
                                }
                                className="w-full pl-6 pr-2 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none disabled:bg-slate-100 disabled:text-slate-500"
                              />
                            </div>
                          </div>
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">
                              สีตั๋ว
                            </label>
                            <input
                              type="color"
                              disabled={!editingZones}
                              value={
                                editingZones
                                  ? priceForm[zone]?.color || "#e11d48"
                                  : activeZones[zone]?.color || "#e11d48"
                              }
                              onChange={(e) =>
                                setPriceForm({
                                  ...priceForm,
                                  [zone]: {
                                    ...priceForm[zone],
                                    color: e.target.value,
                                  },
                                })
                              }
                              className="w-full h-[38px] rounded cursor-pointer border border-slate-200 disabled:opacity-50 appearance-none bg-white p-0"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">
                              โควตา Welcome Drink/ที่นั่ง
                            </label>
                            <input
                              type="number"
                              min="0"
                              disabled={!editingZones}
                              value={
                                editingZones
                                  ? (priceForm[zone]?.welcomeDrinkQuota !== undefined ? priceForm[zone]?.welcomeDrinkQuota : (zone === "VIP" || zone === "A" ? 2 : 1))
                                  : (activeZones[zone]?.welcomeDrinkQuota !== undefined ? activeZones[zone]?.welcomeDrinkQuota : (zone === "VIP" || zone === "A" ? 2 : 1))
                              }
                              onChange={(e) =>
                                setPriceForm({
                                  ...priceForm,
                                  [zone]: {
                                    ...priceForm[zone],
                                    welcomeDrinkQuota:
                                      parseInt(e.target.value) || 0,
                                  },
                                })
                              }
                              className="w-full px-2 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none disabled:bg-slate-100 disabled:text-slate-500"
                            />
                          </div>
                          {editingZones && (
                            <div className="sm:col-span-2 text-right">
                              <button
                                onClick={() => {
                                  const newPriceForm = { ...priceForm };
                                  delete newPriceForm[zone];
                                  setPriceForm(newPriceForm);
                                  const newZoneForm = { ...zoneForm };
                                  delete newZoneForm[zone];
                                  setZoneForm(newZoneForm);
                                }}
                                className="text-rose-500 hover:text-white hover:bg-rose-500 p-2 text-xs font-bold w-full h-[46px] mt-[18px] flex items-center justify-center bg-rose-50 rounded-xl transition-colors"
                              >
                                ลบ
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="px-4 py-3 bg-slate-100/50 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm font-medium">
                          <span className="text-slate-500">
                            รวมที่นั่งโซนนี้:{" "}
                            <strong className="text-slate-800">
                              {editingZones
                                ? zCount *
                                  (priceForm[zone]?.seatsPerTable || 10)
                                : (localConfig.zoneCounts?.[zone] || 0) *
                                  (activeZones[zone]?.seatsPerTable || 10)}
                            </strong>{" "}
                            ที่นั่ง
                          </span>
                          <span className="text-slate-500">
                            รายได้ประเมิน:{" "}
                            <strong className="text-emerald-600">
                              ฿
                              {(editingZones
                                ? zCount *
                                  (priceForm[zone]?.seatsPerTable || 10) *
                                  (priceForm[zone]?.pricePerSeat || 0)
                                : (localConfig.zoneCounts?.[zone] || 0) *
                                  (activeZones[zone]?.seatsPerTable || 10) *
                                  (activeZones[zone]?.pricePerSeat || 0)
                              ).toLocaleString()}
                            </strong>
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-white px-5 pt-5 pb-6 border-t border-slate-100">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">
                              1. ธนาคาร
                            </label>
                            <select
                              disabled={!editingZones}
                              value={
                                editingZones
                                  ? priceForm[zone]?.bankName
                                  : activeZones[zone]?.bankName || ""
                              }
                              onChange={(e) =>
                                setPriceForm({
                                  ...priceForm,
                                  [zone]: {
                                    ...priceForm[zone],
                                    bankName: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-2 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none disabled:bg-slate-50 disabled:text-slate-500"
                            >
                              <option value="">-- เลือก --</option>
                              <option value="KBANK">กสิกรไทย</option>
                              <option value="SCB">ไทยพาณิชย์</option>
                              <option value="BBL">กรุงเทพ</option>
                              <option value="KTB">กรุงไทย</option>
                              <option value="BAY">กรุงศรีฯ</option>
                              <option value="TTB">ทีทีบี</option>
                              <option value="GSB">ออมสิน</option>
                              <option value="PROMPTPAY">พร้อมเพย์</option>
                              <option value="OTHER">อื่นๆ</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">
                              2. เลขบัญชี / เบอร์พร้อมเพย์
                            </label>
                            <input
                              type="text"
                              disabled={!editingZones}
                              value={
                                editingZones
                                  ? priceForm[zone]?.bankAccount
                                  : activeZones[zone]?.bankAccount || ""
                              }
                              onChange={(e) =>
                                setPriceForm({
                                  ...priceForm,
                                  [zone]: {
                                    ...priceForm[zone],
                                    bankAccount: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-2 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none disabled:bg-slate-50 disabled:text-slate-500"
                              placeholder="012-3..."
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">
                              3. ชื่อบัญชี
                            </label>
                            <input
                              type="text"
                              disabled={!editingZones}
                              value={
                                editingZones
                                  ? priceForm[zone]?.bankAccountName
                                  : activeZones[zone]?.bankAccountName || ""
                              }
                              onChange={(e) =>
                                setPriceForm({
                                  ...priceForm,
                                  [zone]: {
                                    ...priceForm[zone],
                                    bankAccountName: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-2 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none disabled:bg-slate-50 disabled:text-slate-500"
                              placeholder="นายใจกล้า..."
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 px-5 pt-6 pb-5 border-t border-slate-200">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">
                              ลำดับทิศทางเวที (เลข 1 = ติดหน้าเวที)
                            </label>
                            <input
                              type="number"
                              disabled={!editingZones}
                              value={
                                editingZones
                                  ? priceForm[zone]?.layoutOrder || 0
                                  : activeZones[zone]?.layoutOrder || 0
                              }
                              onChange={(e) =>
                                setPriceForm({
                                  ...priceForm,
                                  [zone]: {
                                    ...priceForm[zone],
                                    layoutOrder: parseInt(e.target.value) || 0,
                                  },
                                })
                              }
                              className="w-full px-2 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none disabled:bg-slate-50 disabled:text-slate-500"
                              placeholder="เช่น 1, 2, 3"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">
                              ตำแหน่ง (ปีกซ้าย/ขวา/กลาง)
                            </label>
                            <select
                              disabled={!editingZones}
                              value={
                                editingZones
                                  ? priceForm[zone]?.layoutPosition || "center"
                                  : activeZones[zone]?.layoutPosition ||
                                    "center"
                              }
                              onChange={(e) =>
                                setPriceForm({
                                  ...priceForm,
                                  [zone]: {
                                    ...priceForm[zone],
                                    layoutPosition: e.target.value as any,
                                  },
                                })
                              }
                              className="w-full px-2 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none disabled:bg-slate-50 disabled:text-slate-500"
                            >
                              <option value="center">ตรงกลาง (Center)</option>
                              <option value="left_wing">
                                ซ้ายเวที (Left Wing)
                              </option>
                              <option value="right_wing">
                                ขวาเวที (Right Wing)
                              </option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {editingZones && (
                  <div className="flex justify-between items-center bg-amber-50 text-amber-800 p-3 rounded-lg text-xs border border-amber-200">
                    <div className="flex items-start gap-2">
                      <RefreshCw className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>
                        <strong>ข้อควรระวัง:</strong>{" "}
                        การบันทึกและสร้างผังโต๊ะใหม่จะทำการลบข้อมูลการจองจำลองปัจจุบันทั้งหมด
                        (ผังจะถูกรีเซ็ตใหม่เพื่อให้จำนวนโต๊ะตรงกับที่คุณตั้งค่า)
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const newZoneId = `ZONE_${Object.keys(priceForm).length + 1}`;
                        setPriceForm({
                          ...priceForm,
                          [newZoneId]: {
                            id: newZoneId,
                            name: "New Zone",
                            pricePerSeat: 0,
                            bgColorClass: "bg-slate-100",
                            textClass: "text-slate-700",
                            ringClass: "ring-slate-500",
                            borderClass: "border-slate-500",
                            bankAccount: "",
                            bankName: "",
                            bankAccountName: "",
                            color: "#64748b",
                            layoutOrder: Object.keys(priceForm).length + 1,
                            layoutPosition: "center",
                          },
                        });
                        setZoneForm({
                          ...zoneForm,
                          [newZoneId]: 10,
                        });
                      }}
                      className="shrink-0 bg-white border border-amber-300 text-amber-800 px-3 py-1.5 rounded-lg font-bold hover:bg-amber-100 transition"
                    >
                      + เพิ่มโซน
                    </button>
                  </div>
                )}

                {/* Total Summary for Zones & Pricing */}
                <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                  <div>
                    <h5 className="font-bold text-emerald-800 text-base">
                      สรุปรายการสเปคโซนทั้งหมด (Total Projection)
                    </h5>
                    <p className="text-xs text-emerald-600 mt-1">
                      ยอดรวมที่สามารถขายได้ทั้งหมดตามการตั้งค่าโซน
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <div className="text-[10px] font-bold text-emerald-600 mb-0.5 uppercase tracking-wide">
                        ยอดที่นั่งรวม (Total Seats)
                      </div>
                      <div className="text-xl font-black text-emerald-700">
                        {Object.keys(editingZones ? priceForm : activeZones)
                          .reduce((acc, z) => {
                            const zCount = zoneForm[z] || 0;
                            return (
                              acc +
                              (editingZones
                                ? zCount * (priceForm[z]?.seatsPerTable || 10)
                                : (localConfig.zoneCounts?.[z] || 0) *
                                  (activeZones[z]?.seatsPerTable || 10))
                            );
                          }, 0)
                          .toLocaleString()}{" "}
                        ที่นั่ง
                      </div>
                    </div>
                    <div className="w-px h-10 bg-emerald-200/50"></div>
                    <div>
                      <div className="text-[10px] font-bold text-emerald-600 mb-0.5 uppercase tracking-wide">
                        ยอดรายได้รวมประเมิน (Expected Revenue)
                      </div>
                      <div className="text-2xl font-black text-emerald-900">
                        ฿
                        {Object.keys(editingZones ? priceForm : activeZones)
                          .reduce((acc, z) => {
                            const zCount = zoneForm[z] || 0;
                            return (
                              acc +
                              (editingZones
                                ? zCount *
                                  (priceForm[z]?.seatsPerTable || 10) *
                                  (priceForm[z]?.pricePerSeat || 0)
                                : (localConfig.zoneCounts?.[z] || 0) *
                                  (activeZones[z]?.seatsPerTable || 10) *
                                  (activeZones[z]?.pricePerSeat || 0))
                            );
                          }, 0)
                          .toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Email Template Settings Section */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mt-6 print:hidden">
            <h3 className="font-bold text-xl mb-6 flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" /> ตกแต่งเทมเพลตอีเมล
              (Email Template Settings)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-end mb-1">
                    <label className="block text-sm font-bold text-slate-700">
                      หัวข้ออีเมล (Subject)
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleTranslateTemplate("english", "subject")
                        }
                        disabled={isTranslating}
                        className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-md font-bold transition-colors disabled:opacity-50"
                      >
                        {isTranslating ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Languages className="w-3 h-3" />
                        )}
                        EN
                      </button>
                      <button
                        onClick={() =>
                          handleTranslateTemplate("bilingual", "subject")
                        }
                        disabled={isTranslating}
                        className="flex items-center gap-1 text-[10px] bg-violet-50 text-violet-600 hover:bg-violet-100 border border-violet-200 px-2 py-1 rounded-md font-bold transition-colors disabled:opacity-50"
                      >
                        {isTranslating ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Wand2 className="w-3 h-3" />
                        )}
                        TH/EN
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={localConfig.emailTemplateSubject || ""}
                    onChange={(e) =>
                      handleUpdateLocalConfig({
                        emailTemplateSubject: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 placeholder:text-slate-400 focus:outline-none focus:ring-2 ring-primary/20"
                    placeholder="Ex. Your Tickets for {{eventName}}"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs text-slate-500 font-bold self-center mr-1">
                      แทรกตัวแปร:
                    </span>
                    <button
                      onClick={() =>
                        handleUpdateLocalConfig({
                          emailTemplateSubject: `${localConfig.emailTemplateSubject || ""}{{eventName}}`,
                        })
                      }
                      className="text-[10px] bg-slate-100 border border-slate-200 hover:bg-slate-200 px-2 py-1 rounded-md text-slate-600 font-mono transition-colors"
                    >
                      {"{{eventName}}"}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-1">
                    <label className="block text-sm font-bold text-slate-700">
                      ข้อความในอีเมล (Body Text)
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTranslateTemplate("english")}
                        disabled={isTranslating}
                        className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-md font-bold transition-colors disabled:opacity-50"
                      >
                        {isTranslating ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Languages className="w-3 h-3" />
                        )}
                        แปลเป็นภาษาอังกฤษ (EN)
                      </button>
                      <button
                        onClick={() => handleTranslateTemplate("bilingual")}
                        disabled={isTranslating}
                        className="flex items-center gap-1 text-[10px] bg-violet-50 text-violet-600 hover:bg-violet-100 border border-violet-200 px-2 py-1 rounded-md font-bold transition-colors disabled:opacity-50"
                      >
                        {isTranslating ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Wand2 className="w-3 h-3" />
                        )}
                        AI ช่วยทำแบบ 2 ภาษา (TH/EN)
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={6}
                    value={localConfig.emailTemplateBody || ""}
                    onChange={(e) =>
                      handleUpdateLocalConfig({
                        emailTemplateBody: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 placeholder:text-slate-400 focus:outline-none focus:ring-2 ring-primary/20"
                    placeholder="Ex. Hi {{userName}}, Payment successful! \n\n{{ticketDetails}}"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs text-slate-500 font-bold self-center mr-1">
                      แทรกตัวแปร:
                    </span>
                    <button
                      onClick={() =>
                        handleUpdateLocalConfig({
                          emailTemplateBody: `${localConfig.emailTemplateBody || ""}{{userName}}`,
                        })
                      }
                      className="text-[10px] bg-slate-100 border border-slate-200 hover:bg-slate-200 px-2 py-1 rounded-md text-slate-600 font-mono transition-colors"
                    >
                      {"{{userName}}"}
                    </button>
                    <button
                      onClick={() =>
                        handleUpdateLocalConfig({
                          emailTemplateBody: `${localConfig.emailTemplateBody || ""}{{eventName}}`,
                        })
                      }
                      className="text-[10px] bg-slate-100 border border-slate-200 hover:bg-slate-200 px-2 py-1 rounded-md text-slate-600 font-mono transition-colors"
                    >
                      {"{{eventName}}"}
                    </button>
                    <button
                      onClick={() =>
                        handleUpdateLocalConfig({
                          emailTemplateBody: `${localConfig.emailTemplateBody || ""}{{ticketDetails}}`,
                        })
                      }
                      className="text-[10px] bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:border-primary/30 text-primary font-bold px-2 py-1 rounded-md font-mono transition-colors"
                    >
                      {"{{ticketDetails}}"}
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                    ลิงก์วิดีโอ YouTube (Youtube Link) <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">New</span>
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    แทรกหน้าปกวิดีโอ YouTube ในอีเมล เมื่อคลิกจะเปิดวิดีโออัตโนมัติในหน้าต่างใหม่ (ถูกระเบียบ RESEND_API / GMAIL_SMTP)
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={localConfig.emailYoutubeLink || ""}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            emailYoutubeLink: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 placeholder:text-slate-400 focus:outline-none focus:ring-2 ring-primary/20"
                        placeholder="Ex. https://www.youtube.com/watch?v=..."
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                        </svg>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveYoutubeLink}
                      className="px-5 py-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all text-sm shadow-md shadow-red-600/10 shrink-0"
                    >
                      <Save className="w-4 h-4" /> บันทึกลิงก์ (Save)
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mt-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={!!localConfig.emailIncludeSurveyButton}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            emailIncludeSurveyButton: e.target.checked,
                          })
                        }
                      />
                      <div
                        className={`block w-10 h-6 rounded-full transition-colors ${localConfig.emailIncludeSurveyButton ? "bg-primary" : "bg-slate-300"}`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${localConfig.emailIncludeSurveyButton ? "translate-x-4" : ""}`}
                      ></div>
                    </div>
                    <div>
                      <div className="font-bold text-slate-700 text-sm">
                        แทรกปุ่ม "ทำแบบประเมิน" ไปในอีเมล
                      </div>
                      <div className="text-xs text-slate-500">
                        แนบลิงก์ให้ลูกค้ากดทำแบบสำรวจความพึงพอใจได้จากอีเมลทันที
                      </div>
                    </div>
                  </label>

                  {localConfig.emailIncludeSurveyButton && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <div className="mb-4">
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                          ข้อความบนปุ่มแบบประเมิน
                        </label>
                        <textarea
                          value={
                            localConfig.emailSurveyButtonText ||
                            "ทำแบบประเมินความพึงพอใจ"
                          }
                          onChange={(e) =>
                            handleUpdateLocalConfig({
                              emailSurveyButtonText: e.target.value,
                            })
                          }
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                          rows={2}
                        />
                        <div className="text-xs text-slate-500 mt-1">
                          สามารถปรับแต่งข้อความและอีโมจิได้ (กด Enter
                          เพื่อขึ้นบรรทัดใหม่)
                        </div>
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                          ขนาดตัวอักษรบนปุ่ม (px)
                        </label>
                        <input
                          type="number"
                          value={localConfig.emailSurveyButtonFontSize || 22}
                          onChange={(e) =>
                            handleUpdateLocalConfig({
                              emailSurveyButtonFontSize: Number(e.target.value),
                            })
                          }
                          className="w-full sm:w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                          min={12}
                          max={48}
                        />
                      </div>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={!!localConfig.surveyTestMode}
                            onChange={(e) =>
                              handleUpdateLocalConfig({
                                surveyTestMode: e.target.checked,
                              })
                            }
                          />
                          <div
                            className={`block w-10 h-6 rounded-full transition-colors ${localConfig.surveyTestMode ? "bg-amber-500" : "bg-slate-300"}`}
                          ></div>
                          <div
                            className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${localConfig.surveyTestMode ? "translate-x-4" : ""}`}
                          ></div>
                        </div>
                        <div>
                          <div className="font-bold text-slate-700 text-sm text-amber-600">
                            ทดสอบการเข้าทำแบบประเมิน (Survey Preview Mode)
                          </div>
                          <div className="text-xs text-slate-500">
                            เปิดโหมดทดสอบเพื่อสามารถข้ามการจำกัด วัน/เวลา และ
                            ระยะทางสถานที่ เพื่อลองเข้าแบบประเมินสำหรับแก้ไข
                          </div>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  ธีมอีเมล (Email Theme)
                </label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {["default", "minimal", "festive", "luxury", "neon"].map(
                    (t) => (
                      <button
                        key={t}
                        onClick={() =>
                          handleUpdateLocalConfig({
                            emailTheme: t as EmailTheme,
                          })
                        }
                        className={`p-2 rounded-xl border-2 text-sm font-bold capitalize transition-all ${
                          (localConfig.emailTheme || "default") === t
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-slate-200 text-slate-500 hover:border-slate-300"
                        }`}
                      >
                        {t}
                      </button>
                    ),
                  )}
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col h-[500px]">
                  <div className="text-sm text-slate-500 mb-3 font-bold flex justify-between items-center">
                    ตัวอย่างแบบคร่าวๆ (Live Preview)
                    <span className="text-xs font-normal bg-white px-2 py-1 rounded-md border border-slate-200">
                      Subject:{" "}
                      {(
                        localConfig.emailTemplateSubject ||
                        "Your Tickets for {{eventName}}"
                      ).replace(
                        /{{eventName}}/g,
                        localConfig.eventName || "EventTicket",
                      )}
                    </span>
                  </div>
                  <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
                    <iframe
                      title="email-preview"
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      srcDoc={getEmailHtml(
                        (localConfig.emailTheme || "default") as EmailTheme,
                        localConfig.eventName || "EventTicket",
                        (
                          localConfig.emailTemplateBody ||
                          "Hi {{userName}},\n\nPayment successful! Your tickets are confirmed.\n\n{{ticketDetails}}"
                        )
                          .replace(/{{userName}}/g, "John Doe")
                          .replace(
                            /{{eventName}}/g,
                            localConfig.eventName || "EventTicket",
                          )
                          .replace(
                            /{{ticketDetails}}/g,
                            "Table: T001, Seat: 1 - Zone: VIP\nTable: T001, Seat: 2 - Zone: VIP",
                          ),
                        {
                          themeColor: localConfig.themeColor || "#2563eb",
                          secondaryColor: localConfig.enableSecondaryColor
                            ? localConfig.secondaryColor
                            : localConfig.themeColor,
                          accentColor: localConfig.enableAccentColor
                            ? localConfig.accentColor
                            : localConfig.themeColor,
                          includeSurveyButton:
                            localConfig.emailIncludeSurveyButton,
                          surveyButtonText: localConfig.emailSurveyButtonText,
                          surveyButtonFontSize:
                            localConfig.emailSurveyButtonFontSize,
                          surveyLink: "#",
                          eventDate: localConfig.eventDate,
                          eventTime: localConfig.eventTime,
                          youtubeLink: localConfig.emailYoutubeLink,
                        },
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ตั้งค่ารายงานสรุปงาน (Client Dashboard Visibility) */}
            <div className="mt-10 pt-8 border-t border-slate-100">
              <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2 mb-2 font-sans">
                <LayoutGrid className="w-5 h-5 text-indigo-500" /> ตั้งค่าความปลอดภ้ยการแสดงผลรายงานหน้าสรุปงาน (Client Dashboard Visibility)
              </h4>
              <p className="text-slate-500 text-sm mb-6 max-w-3xl leading-relaxed">
                เลือกหัวข้อรายงานเรียลไทม์หลังบ้านทั้งหมดที่อนุญาตให้ส่งข้อมูลออกไปแสดงผลที่หน้า <strong className="text-slate-800">รายงานสรุปงาน (Client Dashboard Overview - Read-only)</strong> เพื่อให้บุคคลภายนอกหรือผู้สนับสนุนได้รับชมร่วมกัน
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. ยอดขายที่นั่ง */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Users className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="font-bold text-slate-700 text-sm">ยอดจำหน่ายที่นั่งสะสม</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      แสดงยอดจำหน่ายที่นั่งเทียบความจุงานทั้งหมด (Seats Sold) ในหน้าสรุปงาน
                    </p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer self-start">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={localConfig.clientShowOverviewSales !== false}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            clientShowOverviewSales: e.target.checked,
                          })
                        }
                      />
                      <div
                        className={`block w-10 h-6 rounded-full transition-colors ${
                          localConfig.clientShowOverviewSales !== false ? "bg-indigo-600" : "bg-slate-300"
                        }`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          localConfig.clientShowOverviewSales !== false ? "translate-x-4" : ""
                        }`}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                      {localConfig.clientShowOverviewSales !== false ? "เปิดแสดงผล" : "ปิดการแสดงผล"}
                    </span>
                  </label>
                </div>

                {/* 2. ยอดเช็คอิน */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <span className="text-emerald-600 font-bold text-sm">✓</span>
                      </div>
                      <span className="font-bold text-slate-700 text-sm">ยอดเช็คอิน ณ วันงาน</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      แสดงสถิติเช็คอินผู้จองที่ยืนยันมาแล้ว ณ จุดประตูงาน (Check-Ins)
                    </p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer self-start">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={localConfig.clientShowCheckIn !== false}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            clientShowCheckIn: e.target.checked,
                          })
                        }
                      />
                      <div
                        className={`block w-10 h-6 rounded-full transition-colors ${
                          localConfig.clientShowCheckIn !== false ? "bg-indigo-600" : "bg-slate-300"
                        }`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          localConfig.clientShowCheckIn !== false ? "translate-x-4" : ""
                        }`}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                      {localConfig.clientShowCheckIn !== false ? "เปิดแสดงผล" : "ปิดการแสดงผล"}
                    </span>
                  </label>
                </div>

                {/* 3. ยอดรวมเครื่องดื่ม */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                        <GlassWater className="w-4 h-4 text-amber-600" />
                      </div>
                      <span className="font-bold text-slate-700 text-sm">สรุปเครื่องดื่มและแชมเปี้ยน</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      แสดงประวัติการแจกเครื่องดื่มพร้อมทั้งอันดับท็อปผู้เบิกแจกรายคน (Top Consumers)
                    </p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer self-start">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={localConfig.clientShowDrinksReport !== false}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            clientShowDrinksReport: e.target.checked,
                          })
                        }
                      />
                      <div
                        className={`block w-10 h-6 rounded-full transition-colors ${
                          localConfig.clientShowDrinksReport !== false ? "bg-indigo-600" : "bg-slate-300"
                        }`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          localConfig.clientShowDrinksReport !== false ? "translate-x-4" : ""
                        }`}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                      {localConfig.clientShowDrinksReport !== false ? "เปิดแสดงผล" : "ปิดการแสดงผล"}
                    </span>
                  </label>
                </div>

                {/* 4. สรุปความพึงพอใจประเมิน */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                        <BarChart3 className="w-4 h-4 text-purple-600" />
                      </div>
                      <span className="font-bold text-slate-700 text-sm">ผลประเมินความพึงพอใจและข้อเสนอแนะ</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      แสดงผลประเมินเรตติ้งรายข้อ และประวัติความเห็นล่าสุด 10 รายการ
                    </p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer self-start">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={localConfig.clientShowSurveyReport !== false}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            clientShowSurveyReport: e.target.checked,
                          })
                        }
                      />
                      <div
                        className={`block w-10 h-6 rounded-full transition-colors ${
                          localConfig.clientShowSurveyReport !== false ? "bg-indigo-600" : "bg-slate-300"
                        }`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          localConfig.clientShowSurveyReport !== false ? "translate-x-4" : ""
                        }`}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                      {localConfig.clientShowSurveyReport !== false ? "เปิดแสดงผล" : "ปิดการแสดงผล"}
                    </span>
                  </label>
                </div>

                {/* 5. ยอดรายได้ */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <Banknote className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="font-bold text-slate-700 text-sm">ยอดเงินสะสมรายได้รวม (Revenue)</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      แสดงการประเมินยอดทรัพย์สินจำหน่ายบัตรทั้งหมดโดยระบบตรงหน้าเพจภายนอก
                    </p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer self-start">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={!!localConfig.clientShowOverviewRevenue}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            clientShowOverviewRevenue: e.target.checked,
                          })
                        }
                      />
                      <div
                        className={`block w-10 h-6 rounded-full transition-colors ${
                          localConfig.clientShowOverviewRevenue ? "bg-indigo-600" : "bg-slate-300"
                        }`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          localConfig.clientShowOverviewRevenue ? "translate-x-4" : ""
                        }`}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                      {localConfig.clientShowOverviewRevenue ? "เปิดแสดงผล" : "ปิดการแสดงผล"}
                    </span>
                  </label>
                </div>

                {/* 6. มูลค่าบัตรสปอนเซอร์ */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
                        <Gift className="w-4 h-4 text-rose-600" />
                      </div>
                      <span className="font-bold text-slate-700 text-sm">มูลค่าบัตรสปอนเซอร์ (Comped)</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      อนุญาตให้แสดงยอดรวมมูลค่าตั๋วสนับสนุน (Sponsor/Guest) ที่ออกโดยแอดมิน
                    </p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer self-start">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={!!localConfig.clientShowOverviewSponsor}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            clientShowOverviewSponsor: e.target.checked,
                          })
                        }
                      />
                      <div
                        className={`block w-10 h-6 rounded-full transition-colors ${
                          localConfig.clientShowOverviewSponsor ? "bg-indigo-600" : "bg-slate-300"
                        }`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          localConfig.clientShowOverviewSponsor ? "translate-x-4" : ""
                        }`}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                      {localConfig.clientShowOverviewSponsor ? "เปิดแสดงผล" : "ปิดการแสดงผล"}
                    </span>
                  </label>
                </div>

                {/* 7. จำนวนโต๊ะทั้งหมด */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                        <MapIcon className="w-4 h-4 text-purple-600" />
                      </div>
                      <span className="font-bold text-slate-700 text-sm">สถิติจำนวนโต๊ะในงาน (Tables)</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      แสดงจำนวนรวมโต๊ะทั้งหมดที่มีการจัดตั้งค่าในระบบผังที่นั่ง
                    </p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer self-start">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={!!localConfig.clientShowOverviewTables}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            clientShowOverviewTables: e.target.checked,
                          })
                        }
                      />
                      <div
                        className={`block w-10 h-6 rounded-full transition-colors ${
                          localConfig.clientShowOverviewTables ? "bg-indigo-600" : "bg-slate-300"
                        }`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          localConfig.clientShowOverviewTables ? "translate-x-4" : ""
                        }`}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                      {localConfig.clientShowOverviewTables ? "เปิดแสดงผล" : "ปิดการแสดงผล"}
                    </span>
                  </label>
                </div>

                {/* 8. รายการขายล่าสุด */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                        <span className="text-orange-600 font-bold text-sm">⌛</span>
                      </div>
                      <span className="font-bold text-slate-700 text-sm">ประวัติรายการจองล่าสุด (Latest Sales)</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      ส่งข้อมูลรายการตั๋วที่มีการจำหน่ายยืนยันรายการล่าสุดไปแสดงบนสรุปงาน
                    </p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer self-start">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={!!localConfig.clientShowLatestSales}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            clientShowLatestSales: e.target.checked,
                          })
                        }
                      />
                      <div
                        className={`block w-10 h-6 rounded-full transition-colors ${
                          localConfig.clientShowLatestSales ? "bg-indigo-600" : "bg-slate-300"
                        }`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          localConfig.clientShowLatestSales ? "translate-x-4" : ""
                        }`}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                      {localConfig.clientShowLatestSales ? "เปิดแสดงผล" : "ปิดการแสดงผล"}
                    </span>
                  </label>
                </div>

                {/* 9. สรุปยอดแยกบัญชีธนาคาร */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
                        <span className="text-teal-600 font-bold text-sm">🏦</span>
                      </div>
                      <span className="font-bold text-slate-700 text-sm">สรุปยอดโอนแยกธนาคาร (Bank Accounts)</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      อนุญาตให้นำตารางแจกแจงรายรับผ่านพอร์ตบัญชีธนาคารแต่ละโซนแสดงที่หน้าสรุปงาน
                    </p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer self-start">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={!!localConfig.clientShowBankSummary}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            clientShowBankSummary: e.target.checked,
                          })
                        }
                      />
                      <div
                        className={`block w-10 h-6 rounded-full transition-colors ${
                          localConfig.clientShowBankSummary ? "bg-indigo-600" : "bg-slate-300"
                        }`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          localConfig.clientShowBankSummary ? "translate-x-4" : ""
                        }`}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                      {localConfig.clientShowBankSummary ? "เปิดแสดงผล" : "ปิดการแสดงผล"}
                    </span>
                  </label>
                </div>

                {/* 10. สรุปรายการรับของที่ระลึก */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <span className="text-indigo-600 font-bold text-sm font-sans">🎁</span>
                      </div>
                      <span className="font-bold text-slate-700 text-sm font-sans font-sans">สรุปรายการรับของที่ระลึก (Prize / Souvenir Claims)</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed font-sans font-sans">
                      อนุญาตให้นำสรุปจำนวนยอดการสแกนแจกของที่ระลึกของฝ่ายหน้างานแสดงที่หน้าสรุปงาน (Summary Report)
                    </p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer self-start">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={localConfig.clientShowPrizeClaims !== false}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            clientShowPrizeClaims: e.target.checked,
                          })
                        }
                      />
                      <div
                        className={`block w-10 h-6 rounded-full transition-colors ${
                          localConfig.clientShowPrizeClaims !== false ? "bg-indigo-600" : "bg-slate-300"
                        }`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          localConfig.clientShowPrizeClaims !== false ? "translate-x-4" : ""
                        }`}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600 font-sans">
                      {localConfig.clientShowPrizeClaims !== false ? "เปิดแสดงผล" : "ปิดการแสดงผล"}
                    </span>
                  </label>
                </div>

                {/* 11. บัญชีสรุปการเงินของบูธควิซ/อาหาร/เครื่องดื่ม */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <Store className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="font-bold text-slate-700 text-sm font-sans">บัญชีสรุปการเงินของบูธควิซ/อาหาร (Booth Financials)</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed font-sans">
                      แสดงผลรวมยอดค่าใช้จ่ายและรายรับรายบูธของร้านค้าเพื่อตรวจสอบประเมินความคุ้มค่างานสรุปในหน้า Client Dashboard
                    </p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer self-start">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={!!localConfig.clientShowBoothFinancials}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            clientShowBoothFinancials: e.target.checked,
                          })
                        }
                      />
                      <div
                        className={`block w-10 h-6 rounded-full transition-colors ${
                          localConfig.clientShowBoothFinancials ? "bg-indigo-600" : "bg-slate-300"
                        }`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          localConfig.clientShowBoothFinancials ? "translate-x-4" : ""
                        }`}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600 font-sans">
                      {localConfig.clientShowBoothFinancials ? "เปิดแสดงผล" : "ปิดการแสดงผล"}
                    </span>
                  </label>
                </div>

                {/* 12. สถิติผู้ร่วมกิจกรรมและการสแกนบูธ */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-indigo-600" />
                      </div>
                      <span className="font-bold text-slate-700 text-sm font-sans">ประวัติกิจกรรมและการสแกนบูธ (Booth Scanner Activity)</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed font-sans">
                      แสดงข้อมูลสถิติจำนวนครั้งที่ผู้ร่วมงานสแกนคิวอาร์ทำกิจกรรมตามบูธต่าง ๆ และประวัติสแกนดิบล่าสุด
                    </p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer self-start">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={!!localConfig.clientShowBoothActivity}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            clientShowBoothActivity: e.target.checked,
                          })
                        }
                      />
                      <div
                        className={`block w-10 h-6 rounded-full transition-colors ${
                          localConfig.clientShowBoothActivity ? "bg-indigo-600" : "bg-slate-300"
                        }`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          localConfig.clientShowBoothActivity ? "translate-x-4" : ""
                        }`}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600 font-sans">
                      {localConfig.clientShowBoothActivity ? "เปิดแสดงผล" : "ปิดการแสดงผล"}
                    </span>
                  </label>
                </div>

                {/* 13. บล็อกการกดเลือกที่นั่งได้เอง */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <Lock className="w-4 h-4 text-indigo-600" />
                      </div>
                      <span className="font-bold text-slate-700 text-sm font-sans">บล็อกการกดเลือกที่นั่งเอง (Block Manual Selection)</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed font-sans">
                      เมื่อเปิดใช้งาน ผู้ใช้ทั่วไปจะไม่สามารถคลิกจองโต๊ะหรือเลือกที่นั่งได้เองตามใจชอบ จะต้องระบุจำนวนที่นั่งเพื่อค้นหาและเลือกจัดสรรอัตโนมัติเท่านั้น
                    </p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer self-start">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={!!localConfig.blockManualSeatSelection}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            blockManualSeatSelection: e.target.checked,
                          })
                        }
                      />
                      <div
                        className={`block w-10 h-6 rounded-full transition-colors ${
                          localConfig.blockManualSeatSelection ? "bg-indigo-600" : "bg-slate-300"
                        }`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          localConfig.blockManualSeatSelection ? "translate-x-4" : ""
                        }`}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600 font-sans">
                      {localConfig.blockManualSeatSelection ? "เปิดใช้งานบล็อก" : "ปิดการบล็อก (เลือกอิสระ)"}
                    </span>
                  </label>
                </div>

                {/* 14. ระบบจับเวลาล็อคที่นั่งชั่วคราว */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
                        <Timer className="w-4 h-4 text-rose-600" />
                      </div>
                      <span className="font-bold text-slate-700 text-sm font-sans">จับเวลาล็อคที่นั่งชั่วคราว (Hold Timer)</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed font-sans">
                      ตั้งเวลาสำหรับการล็อคที่นั่งชั่วคราวในขั้นตอนการชำระเงิน (เป็นนาที) เพื่อป้องกันการจองที่นั่งค้างไว้โดยไม่มีการจ่ายเงิน
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      className="w-20 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none text-center"
                      value={localConfig.temporaryHoldMinutes ?? 5}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(60, parseInt(e.target.value) || 5));
                        handleUpdateLocalConfig({ temporaryHoldMinutes: val });
                      }}
                    />
                    <span className="text-xs font-bold text-slate-600 font-sans font-medium">นาที (Minutes)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ตั้งค่าความยินยอมข้อมูลส่วนบุคคล (PDPA / Consent Form Settings) */}
            <div className="mt-10 pt-8 border-t border-slate-100">
              <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2 mb-2 font-sans">
                <ShieldCheck className="w-5 h-5 text-emerald-500" /> ตั้งค่าความยินยอมข้อมูลส่วนบุคคล (PDPA & Consent Form Settings)
              </h4>
              <p className="text-slate-500 text-sm mb-6 max-w-3xl leading-relaxed">
                กำหนดข้อความและเปิด/ปิดฟังก์ชันติ๊กกล่องข้อตกลงและยินยอมด้านข้อมูลส่วนบุคคล (PDPA Consent Checkbox) ในหน้ากรอกข้อมูลผู้จองก่อนไปชำระเงิน
              </p>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-6">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200/60 pb-4">
                  <div>
                    <span className="font-bold text-slate-700 text-sm block font-sans">เปิดใช้งานฟังก์ชันยินยอม (Enable PDPA Consent)</span>
                    <span className="text-xs text-slate-500">บังคับให้ผู้ใช้ต้องติ๊กยินยอมนโยบายก่อนเข้าสู่หน้าชำระเงิน</span>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={localConfig.consentEnabled !== false}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            consentEnabled: e.target.checked,
                          })
                        }
                      />
                      <div
                        className={`block w-10 h-6 rounded-full transition-colors ${
                          localConfig.consentEnabled !== false ? "bg-emerald-600" : "bg-slate-300"
                        }`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          localConfig.consentEnabled !== false ? "translate-x-4" : ""
                        }`}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                      {localConfig.consentEnabled !== false ? "เปิดแสดงผล" : "ปิดการแสดงผล"}
                    </span>
                  </label>
                </div>

                {localConfig.consentEnabled !== false && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 font-sans">
                        ชื่อบริษัท/ผู้ให้บริการ (Company Name)
                      </label>
                      <input
                        type="text"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ring-primary/20"
                        placeholder="เช่น บริษัท ใจกล้า ดิจิตอล จำกัด"
                        value={localConfig.consentCompanyName || ""}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            consentCompanyName: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 font-sans">
                        ประเภทข้อมูลส่วนบุคคล (Personal Data Types)
                      </label>
                      <input
                        type="text"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ring-primary/20"
                        placeholder="เช่น ชื่อ-นามสกุล, เบอร์โทรศัพท์, อีเมล, รูปภาพ"
                        value={localConfig.consentDataTypes || ""}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            consentDataTypes: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 font-sans">
                        วัตถุประสงค์ (Purpose)
                      </label>
                      <input
                        type="text"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ring-primary/20"
                        placeholder="เช่น ดำเนินกิจกรรม"
                        value={localConfig.consentPurpose || ""}
                        onChange={(e) =>
                          handleUpdateLocalConfig({
                            consentPurpose: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                {localConfig.consentEnabled !== false && (
                  <div className="pt-4 border-t border-slate-200/60">
                    <span className="text-xs font-bold text-slate-500 block mb-2 font-sans uppercase tracking-wider">ตัวอย่างประโยคความยินยอม (Preview Consent Clause):</span>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed font-sans shadow-inner flex flex-wrap gap-y-1">
                      <span className="inline-block whitespace-nowrap">ข้าพเจ้าตกลงและยินยอมให้</span>{" "}
                      <strong className="text-slate-800 inline-flex flex-wrap">
                        {(() => {
                          const name = localConfig.consentCompanyName || 'บริษัท ใจกล้า ดิจิตอล จำกัด';
                          const parts = name.split(/([ \u00a0]+)/);
                          return parts.map((part: string, idx: number) => {
                            if (/^[ \u00a0]+$/.test(part)) {
                              return (
                                <span key={idx} className="inline-block whitespace-pre">
                                  {part}
                                </span>
                              );
                            }
                            return (
                              <span key={idx} className="inline-block whitespace-nowrap">
                                {part}
                              </span>
                            );
                          });
                        })()}
                      </strong>{" "}
                      <span className="inline-block whitespace-nowrap">เก็บรวบรวม</span>{" "}
                      <span className="inline-block whitespace-nowrap">ใช้</span>{" "}
                      <span className="inline-block whitespace-nowrap">และเปิดเผยข้อมูลส่วนบุคคล</span>
                      <span className="inline-block whitespace-nowrap">ของข้าพเจ้า</span>{" "}
                      <span className="inline-block whitespace-nowrap">ได้แก่</span>{" "}
                      <span className="font-medium text-slate-800 inline-flex flex-wrap">
                        <span className="inline-block whitespace-nowrap">[</span>
                        {(localConfig.consentDataTypes || 'ชื่อ-นามสกุล, เบอร์โทรศัพท์, อีเมล, รูปภาพ').split(/,\s*/).map((item: string, idx: number, arr: string[]) => (
                          <span key={idx} className="inline-block whitespace-nowrap">
                            {item}
                            {idx < arr.length - 1 ? ",\u0020" : ""}
                          </span>
                        ))}
                        <span className="inline-block whitespace-nowrap">]</span>
                      </span>{" "}
                      <span className="inline-block whitespace-nowrap">เพื่อวัตถุประสงค์ในการ</span>
                      <span className="font-medium text-slate-800 inline-block whitespace-nowrap">
                        {localConfig.consentPurpose || 'ดำเนินกิจกรรม'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Save Config Control Bar */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-4">
              {hasChanges && (
                <span className="text-sm font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl animate-pulse font-sans">
                  ⚠️ มีการแก้ไขการตั้งค่าที่ยังไม่ได้บันทึก (You have unsaved changes)
                </span>
              )}
              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleResetConfig}
                  className="flex-1 sm:flex-initial px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-sm active:scale-95"
                >
                  ยกเลิกการแก้ไข
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="flex-1 sm:flex-initial px-6 py-3 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl shadow-md shadow-primary/20 transition-all text-sm flex items-center justify-center gap-2 active:scale-95"
                >
                  <Save className="w-4 h-4" /> บันทึกการตั้งค่าทั้งหมด
                </button>
              </div>
            </div>
          </div>

          {/* System Reset Section */}
          <div className="print:hidden bg-slate-100 rounded-3xl shadow-sm border border-slate-200 p-6 mt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-1">
                  <RefreshCw className="w-5 h-5 text-rose-500" /> คืนค่าเริ่มต้น
                  (Reset to Default)
                </h3>
                <p className="text-sm text-slate-500">
                  ลบข้อมูลการตั้งค่า โต๊ะ และสถิติทั้งหมด
                  เพื่อเริ่มระบบใหม่ด้วยค่าเริ่มต้นจำลอง
                </p>
              </div>
              <button
                onClick={() => {
                  showConfirm({
                    title: "คืนค่าเริ่มต้นระบบทั้งหมด?",
                    message: "คุณแน่ใจหรือไม่ว่าต้องการคืนค่าเริ่มต้นทั้งหมด? ข้อมูลการจองและการตั้งค่าปัจจุบันจะถูกลบทิ้งอย่างถาวร",
                    confirmText: "ใช่, ยืนยันรีเซ็ตระบบ",
                    colorType: "rose",
                    onConfirm: () => {
                      if (onResetApp) onResetApp();
                    }
                  });
                }}
                className="shrink-0 bg-white border border-rose-200 text-rose-600 px-6 py-3 rounded-xl font-bold hover:bg-rose-50 transition drop-shadow-sm flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> รีเซ็ตระบบ
              </button>
            </div>
          </div>
        </>
      ) : activeTab === "users" ? (
        <UserManagementView />
      ) : activeTab === "logs" ? (
        <StaffLogsView />
      ) : activeTab === "emails" ? (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-xl flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              อีเมลรอการแก้ไข/ส่งใหม่ (Failed & Pending Emails)
            </h3>
          </div>
          <p className="text-slate-500 mb-6 text-sm">
            ระบบนี้ไว้ตรวจสอบอีเมลที่มีปัญหาชำระเงินไม่สำเร็จ
            หรืออีเมลที่สถานะส่งตกหล่น/ไปไม่ถึงลูกค้า
            ทีมงานสามารถกดแก้ไขข้อความและส่งใหม่ได้จากที่นี่
          </p>

          {!pendingEmails || pendingEmails.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center">
              <Mail className="w-12 h-12 text-slate-200 mb-4" />
              <p className="text-slate-500 font-medium text-lg">
                ไม่มีอีเมลตกค้างหรือรอส่งในระบบ
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingEmails.map((email, idx) => (
                <div
                  key={email.id}
                  className="border border-slate-200 rounded-2xl p-5 hover:shadow-md transition"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div>
                      <p className="text-sm font-bold text-primary bg-primary/10 inline-block px-3 py-1 rounded-full mb-2">
                        ถึง: {email.to.join(", ")}
                      </p>
                      <h4 className="font-bold text-lg text-slate-800 border-b border-slate-100 pb-2 mb-2">
                        เรื่อง: {email.subject}
                      </h4>
                    </div>
                    {email.status === "sent" ? (
                      <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold text-sm">
                        ส่งแล้ว (Sent)
                      </span>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const newText = prompt(
                              "แก้ไขข้อความอีเมล:",
                              email.text,
                            );
                            if (newText !== null && setPendingEmails) {
                              setPendingEmails((prev: PendingEmail[]) =>
                                prev.map((e) =>
                                  e.id === email.id
                                    ? { ...e, text: newText }
                                    : e,
                                ),
                              );
                            }
                          }}
                          className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2 rounded-xl font-bold transition flex items-center gap-2"
                        >
                          <Edit2 className="w-4 h-4" /> แก้ไข (Edit)
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch("/api/send-email", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(email),
                              });
                              if (res.ok) {
                                const data = await res.json();
                                showToast({
                                  type: 'success',
                                  title: 'ส่งอีเมลสำเร็จ',
                                  message: `ส่งอีเมลผ่าน ${data.provider} เรียบร้อยแล้ว`,
                                });
                                if (setPendingEmails) {
                                  setPendingEmails((prev: PendingEmail[]) =>
                                    prev.map((e) =>
                                      e.id === email.id
                                        ? { ...e, status: "sent" }
                                        : e,
                                    ),
                                  );
                                }
                              } else {
                                const data = await res.json();
                                showToast({
                                  type: 'error',
                                  title: 'ส่งอีเมลไม่สำเร็จ',
                                  message: data.error || 'Unknown Error',
                                });
                              }
                            } catch (e: any) {
                              showToast({
                                type: 'error',
                                title: 'ส่งอีเมลไม่สำเร็จ',
                                message: e.message,
                              });
                            }
                          }}
                          className="bg-primary text-white hover:bg-rose-700 px-4 py-2 rounded-xl font-bold transition flex items-center gap-2"
                        >
                          <Mail className="w-4 h-4" /> ส่ง (Send Now)
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-700 whitespace-pre-wrap max-h-40 overflow-y-auto mb-4 border border-slate-100">
                    {email.text}
                  </div>
                  {email.attachments && email.attachments.length > 0 && (
                    <div className="border-t border-slate-100 pt-4">
                      <p className="font-bold text-sm text-slate-500 mb-2">
                        ไฟล์แนบ / QR Codes ({email.attachments.length} ไฟล์):
                      </p>
                      <div className="flex gap-4 overflow-x-auto pb-2">
                        {email.attachments.map((att, i) => (
                          <div
                            key={i}
                            className="flex flex-col items-center gap-2 bg-white border border-slate-200 p-2 rounded-xl min-w-[120px]"
                          >
                            <img
                              src={`data:image/png;base64,${att.content}`}
                              alt={att.filename}
                              className="w-20 h-20 object-cover rounded-lg"
                            />
                            <span
                              className="text-[10px] text-slate-400 truncate w-24 text-center"
                              title={att.filename}
                            >
                              {att.filename}
                            </span>
                            <a
                              href={`data:image/png;base64,${att.content}`}
                              download={att.filename}
                              className="text-xs font-bold text-primary hover:underline"
                            >
                              ดาวน์โหลด
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === "notifications" ? (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <h3 className="font-bold text-xl flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              ตั้งค่าการแจ้งเตือน LINE / SMS
            </h3>
          </div>

          <p className="text-sm text-slate-500 mb-4">
            กำหนดค่าการแจ้งเตือน ส่งข้อความหาลูกค้าเมื่อทำรายการชำระเงินสำเร็จ
            และแจ้งเตือนทีมงานเมื่อมีการอนุมัติหรือปฏิเสธ
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4 border border-slate-200 p-5 rounded-2xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-primary"
                  checked={!!localConfig.lineNotifyEnabled}
                  onChange={(e) =>
                    handleUpdateLocalConfig({
                      lineNotifyEnabled: e.target.checked,
                    })
                  }
                />
                <span className="font-bold">
                  เปิดใช้งาน LINE Messaging API (รับแจ้งเตือน)
                </span>
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Channel ID"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  value={localConfig.lineChannelId || ""}
                  onChange={(e) =>
                    handleUpdateLocalConfig({ lineChannelId: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="Channel Secret"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  value={localConfig.lineChannelSecret || ""}
                  onChange={(e) =>
                    handleUpdateLocalConfig({
                      lineChannelSecret: e.target.value,
                    })
                  }
                />
                <input
                  type="text"
                  placeholder="Admin User ID (ถ้ามี, เว้นว่างเพื่อ Broadcast)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  value={localConfig.lineAdminUserId || ""}
                  onChange={(e) =>
                    handleUpdateLocalConfig({ lineAdminUserId: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="LINE OA Link (ลิงก์เพิ่มเพื่อน LINE OA) เช่น https://lin.me/ti/p/..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  value={localConfig.lineGroupLink || ""}
                  onChange={(e) =>
                    handleUpdateLocalConfig({ lineGroupLink: e.target.value })
                  }
                />
                <div className="text-xs text-slate-500 mt-1">
                  ลิงก์สำหรับให้ลูกค้ากดเพิ่มเพื่อน หรือ ทักแชท LINE OA เพื่อส่งสลิป
                </div>

                <div className="bg-slate-100 p-4 rounded-xl mt-4 space-y-4">
                  <div className="text-sm font-bold text-slate-800">
                    💡 วิธีหา Group ID สำหรับให้บอทส่งข้อความเข้ากลุ่ม:
                  </div>
                  <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                    <p>
                      เนื่องจากลิงก์ระบบทดสอบนี้มีการป้องกันความปลอดภัย ทำให้เซิร์ฟเวอร์ LINE ไม่สามารถยิง Webhook ทะลุเข้ามาได้ จึงต้องใช้วิธีดักจับแบบชั่วคราวดังนี้:
                    </p>
                    <ol className="list-decimal list-inside space-y-1.5 ml-1">
                      <li>เปิดแท็บใหม่ไปที่เว็บ <a href="https://webhook.site/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-bold">webhook.site</a></li>
                      <li>เว็บจะสร้าง URL ชั่วคราวให้ (Your unique URL) ให้ <strong className="text-slate-800">Copy</strong> ลิงก์นั้นมา</li>
                      <li>นำไปใส่ช่อง <strong className="text-slate-800">Webhook URL</strong> ในหน้า LINE Developers แล้วกด Save (และเปิดสวิตช์ Use webhook)</li>
                      <li>เปิดแอป LINE ในมือถือ แล้ว <strong className="text-slate-800">พิมพ์ข้อความอะไรก็ได้ 1 ครั้ง</strong> เข้าไปในกลุ่มที่มีบอทอยู่</li>
                      <li>กลับไปที่เว็บ webhook.site (จะเห็นข้อมูลเด้งเข้ามาทางซ้ายมือ) ให้มองหาคำว่า <code className="bg-white px-1.5 py-0.5 rounded text-rose-600 border border-slate-200">"groupId": "C..."</code></li>
                      <li>ก๊อปปี้รหัสที่ขึ้นต้นด้วย <strong className="text-slate-800">C</strong> นั้นมาใส่ในช่อง <strong>Admin User ID</strong> ด้านบนได้เลย!</li>
                    </ol>
                    <div className="mt-3 p-2 bg-rose-50 border border-rose-100 rounded text-rose-700">
                      <strong>⚠️ ข้อควรระวัง:</strong> หากคุณ <u>เตะบอทออกจากกลุ่มแล้วดึงเข้ามาใหม่</u> Group ID ของกลุ่มนั้นจะ <strong>เปลี่ยนไปทันที</strong>! คุณต้องทำตามขั้นตอนดักจับใหม่เพื่อเอา Group ID อันใหม่ล่าสุดมาใส่แทน ไม่อย่างนั้นระบบจะแจ้งว่า <code>Failed to send messages</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 border border-slate-200 p-5 rounded-2xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-primary"
                  checked={!!localConfig.linePushEnabled}
                  onChange={(e) =>
                    handleUpdateLocalConfig({
                      linePushEnabled: e.target.checked,
                    })
                  }
                />
                <span className="font-bold">
                  เปิดใช้งาน LINE OA ข้อความลูกค้า
                </span>
              </label>
              <div>
                <input
                  type="text"
                  placeholder="LINE_CHANNEL_ACCESS_TOKEN"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  value={localConfig.linePushToken || ""}
                  onChange={(e) =>
                    handleUpdateLocalConfig({ linePushToken: e.target.value })
                  }
                />
                <div className="text-xs text-slate-500 mt-1">
                  ปล่อยว่างไว้หากตั้งค่าผ่าน .env
                </div>
              </div>
            </div>

            <div className="space-y-4 border border-slate-200 p-5 rounded-2xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-primary"
                  checked={!!localConfig.smsEnabled}
                  onChange={(e) =>
                    handleUpdateLocalConfig({ smsEnabled: e.target.checked })
                  }
                />
                <span className="font-bold">
                  เปิดใช้งาน SMS Twilio (มีค่าบริการ)
                </span>
              </label>
              <div className="text-xs text-slate-500">
                จำเป็นต้องกำหนด TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
                TWILIO_FROM_NUMBER ใน (.env)
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl p-5 space-y-4 mt-6">
            <h4 className="font-bold border-b border-slate-100 pb-2">
              ข้อความแจ้งเตือน (ส่งหาลูกค้า)
            </h4>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  ข้อความอนุมัติ (Success):
                </label>
                <textarea
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/20 outline-none"
                  rows={2}
                  value={
                    localConfig.notificationCustomerSuccess ||
                    "ชำระเงินเรียบร้อย ตรวจสอบอีเมลของคุณ"
                  }
                  onChange={(e) =>
                    handleUpdateLocalConfig({
                      notificationCustomerSuccess: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  ข้อความปฏิเสธ (Failed):
                </label>
                <textarea
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/20 outline-none"
                  rows={2}
                  value={
                    localConfig.notificationCustomerFailed ||
                    "ชำระเงินไม่เรียบร้อย ติดต่อเจ้าหน้าที่"
                  }
                  onChange={(e) =>
                    handleUpdateLocalConfig({
                      notificationCustomerFailed: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-4 border border-slate-200 p-5 rounded-2xl md:col-span-2">
              <div className="font-bold text-slate-800">
                ข้อความแจ้งเตือน (ส่งหาลูกค้า)
              </div>
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ข้อความอนุมัติ (Success):</label>
                  <textarea
                    rows={2}
                    placeholder="ชำระเงินเรียบร้อย ตรวจสอบอีเมลของคุณ"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                    value={localConfig.lineSlipApproveMsg || ""}
                    onChange={(e) =>
                      handleUpdateLocalConfig({ lineSlipApproveMsg: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ข้อความปฏิเสธ (Failed):</label>
                  <textarea
                    rows={2}
                    placeholder="ชำระเงินไม่เรียบร้อย ติดต่อเจ้าหน้าที่"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                    value={localConfig.lineSlipRejectMsg || ""}
                    onChange={(e) =>
                      handleUpdateLocalConfig({ lineSlipRejectMsg: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 border border-slate-200 p-5 rounded-2xl md:col-span-2">
              <div className="font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-500" />
                ตั้งค่า AI Model (Gemini) สำหรับตรวจสลิป
              </div>
              <p className="text-sm text-slate-500 mb-4">
                ตั้งค่าโมเดลที่ใช้สำหรับตรวจสลิป เพื่อป้องกันปัญหาโมเดลตกรุ่นในอนาคต (ค่าเริ่มต้นคือ gemini-3.5-flash และรุ่นสำรองคือ gemini-2.5-flash)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">รุ่นหลัก (Primary Model):</label>
                  <input
                    type="text"
                    placeholder="gemini-3.5-flash"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={localConfig.geminiPrimaryModel || ""}
                    onChange={(e) =>
                      handleUpdateLocalConfig({ geminiPrimaryModel: e.target.value })
                    }
                  />
                  <div className="text-xs text-slate-500 mt-1">โมเดลเริ่มต้นที่ใช้ประมวลผล (เช่น gemini-3.5-flash)</div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">รุ่นสำรอง (Fallback Model):</label>
                  <input
                    type="text"
                    placeholder="gemini-2.5-flash"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={localConfig.geminiFallbackModel || ""}
                    onChange={(e) =>
                      handleUpdateLocalConfig({ geminiFallbackModel: e.target.value })
                    }
                  />
                  <div className="text-xs text-slate-500 mt-1">ใช้เมื่อรุ่นหลักเกิดปัญหา เช่น โควต้าเต็ม หรือตกรุ่น</div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center md:col-span-2">
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  console.log("Test LINE Messaging API clicked");
                  try {
                    const { sendNotification } =
                      await import("../utils/notify");
                    if (localConfig.lineNotifyEnabled) {
                      console.log("Sending with:", {
                        channelId: localConfig.lineChannelId,
                        channelSecret: localConfig.lineChannelSecret,
                        targetUserId: localConfig.lineAdminUserId,
                      });
                      const res = await sendNotification("line_messaging_api", {
                        message:
                          "ทดสอบส่งข้อความไปยัง LINE Messaging API สำเร็จ",
                        channelId: localConfig.lineChannelId,
                        channelSecret: localConfig.lineChannelSecret,
                        targetUserId: localConfig.lineAdminUserId,
                      });
                      if (res === null) {
                        showToast({
                          type: 'warning',
                          title: 'การตั้งค่า LINE ไม่สมบูรณ์',
                          message: 'กรุณาตรวจสอบ Channel ID หรือ Channel Secret',
                        });
                      } else {
                        showToast({
                          type: 'success',
                          title: 'ส่งทดสอบ LINE Messaging API สำเร็จ',
                        });
                      }
                    } else {
                      showToast({
                        type: 'warning',
                        title: 'ยังไม่ได้เปิดใช้งาน LINE Messaging API',
                        message: 'โปรดเปิดใช้งาน LINE Messaging API (รับแจ้งเตือน) ก่อนทำการทดสอบ',
                      });
                    }
                  } catch (err: any) {
                    console.error(err);
                    showToast({
                      type: 'error',
                      title: 'ทดสอบส่ง LINE ไม่สำเร็จ',
                      message: err.message,
                    });
                  }
                }}
                className="px-4 py-2 bg-[#00B900] text-white rounded-lg font-bold hover:opacity-90 w-full sm:w-auto"
              >
                ทดสอบส่ง LINE Messaging API
              </button>

              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="flex-1 sm:flex-initial px-6 py-3 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl shadow-md shadow-primary/20 transition-all text-sm flex items-center justify-center gap-2 active:scale-95"
                >
                  <Save className="w-4 h-4" /> บันทึกการตั้งค่า
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "slips" ? (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <h3 className="font-bold text-xl flex items-center gap-2">
              <Banknote className="w-5 h-5 text-primary" />
              จัดการสลิปโอนเงิน (Slip Management)
            </h3>
            <div className="flex items-center gap-4">
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold">
                พบสลิปทั้งหมด {tickets.filter((t) => t.slipUrl).length} รายการ
              </span>
              <button
                onClick={handleDownloadAllSlips}
                disabled={
                  isDownloading || tickets.filter((t) => t.slipUrl).length === 0
                }
                className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-700 transition disabled:opacity-50"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isDownloading ? "กำลังดาวน์โหลด..." : "ดาวน์โหลดทั้งหมด (ZIP)"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Object.keys(activeZones)
              .sort(
                (a, b) =>
                  (activeZones[a]?.layoutOrder || 0) -
                  (activeZones[b]?.layoutOrder || 0),
              )
              .map((zone) => {
                const zoneTickets = tickets.filter((t) => {
                  const tTable = tables.find((x) => x.id === t.tableId);
                  return tTable?.zoneId === zone;
                });
                const slipsCount = zoneTickets.filter((t) => t.slipUrl).length;

                return (
                  <div
                    key={zone}
                    className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                        style={getZoneStyle(
                          activeZones[zone as ZoneType]?.color,
                        )}
                      >
                        {activeZones[zone as ZoneType]?.name}
                      </span>
                      <span className="text-xl font-black text-slate-800">
                        {slipsCount}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                      ราคา {activeZones[zone as ZoneType]?.pricePerSeat} /
                      ที่นั่ง
                    </p>
                  </div>
                );
              })}
          </div>

          {tickets.filter((t) => t.slipUrl).length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ImageIcon className="w-8 h-8 text-slate-400" />
              </div>
              <p className="font-bold text-slate-600">
                ยังไม่มีรายการชำระเงินที่แนบสลิป
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left text-sm whitespace-nowrap print:whitespace-normal">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="py-3 px-4 rounded-l-xl">บัตร/ผู้ซื้อ</th>
                    <th className="py-3 px-4">โซน/ราคา</th>
                    <th className="py-3 px-4">สเตตัส</th>
                    <th className="py-3 px-4">ภาพสลิป</th>
                    <th className="py-3 px-4 text-right rounded-r-xl">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets
                    .filter((t) => t.slipUrl)
                    .map((t: any) => {
                      const tableInfo = tables.find(
                        (tb) => tb.id === t.tableId,
                      );
                      const zoneInfo = tableInfo
                        ? activeZones[tableInfo.zoneId as ZoneType]
                        : null;
                      const targetPrice = zoneInfo ? zoneInfo.pricePerSeat : 0;
                      const isSlipVerified =
                        t.status === "slip_verified" || t.status === "paid";
                      return (
                        <tr
                          key={t.id}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800">
                              {t.userName}
                            </div>
                            <div className="text-xs text-slate-500">{t.id}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border mr-2"
                              style={
                                zoneInfo
                                  ? getZoneStyle(zoneInfo.color)
                                  : {
                                      backgroundColor: "#f1f5f9",
                                      color: "#64748b",
                                    }
                              }
                            >
                              {zoneInfo?.name || "N/A"}
                            </span>
                            <span className="font-medium">
                              ฿{(t.totalAmount || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {isSlipVerified ? (
                              <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full text-xs font-bold w-max inline-block">
                                ชำระแล้ว
                              </span>
                            ) : (
                              <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-max">
                                <Loader2 className="w-3 h-3 animate-spin" />{" "}
                                รอยืนยัน
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <a
                              href={t.slipUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative group block w-14 h-14 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 hover:border-primary transition-colors"
                            >
                              <img
                                src={t.slipUrl}
                                alt="slip"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xs text-white font-bold">
                                  ขยาย
                                </span>
                              </div>
                            </a>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                showConfirm({
                                  title: "ลบข้อมูลสลิปใบนี้หรือไม่?",
                                  message: "คุณต้องการลบข้อมูลสลิปใบนี้ออกจากระบบและลบไฟล์รูปภาพสลิปถาวรใช่หรือไม่?",
                                  confirmText: "ใช่, ยืนยันลบสลิป",
                                  colorType: "rose",
                                  onConfirm: async () => {
                                    try {
                                      if (t.slipUrl) {
                                        try {
                                          const fileRef = ref(storage, t.slipUrl);
                                          await deleteObject(fileRef);
                                        } catch (e) {
                                          console.warn(
                                            "Storage item delete failed or not found",
                                            e,
                                          );
                                        }
                                      }

                                      if (setMyTickets) {
                                        await setMyTickets([
                                          {
                                            ...t,
                                            slipUrl: "",
                                            status: "pending",
                                          },
                                        ]);
                                      }
                                    } catch (err) {
                                      console.error("Remove slip error", err);
                                    }
                                  }
                                });
                              }}
                              className="w-max ml-auto px-3 py-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors flex items-center gap-1 text-xs font-bold"
                              title="ลบสลิปออก"
                            >
                              <Trash2 className="w-3 h-3" /> ลบสลิป
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === "booths" ? (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div className="min-w-0">
              <h3 className="font-bold text-xl flex items-center gap-2 text-slate-800 font-sans tracking-tight">
                <Store className="w-6 h-6 text-rose-500 shrink-0" />
                <span>บริหารจัดการบูธกิจกรรม & รายงานสรุป (Booth Management & Financials)</span>
              </h3>
              <p className="text-slate-500 text-xs mt-1">
                สร้างแก้ไขซุ้มบูธกิจกรรม กำหนดเลขพร้อมเพย์ผู้ขาย ตรวจสอบพฤติกรรมผู้ร่วมงาน และคำนวณแบ่งปันสัดส่วนรายได้สุทธิระบบ GP
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mt-2 font-sans">
                {isBoothSettingsDirty ? (
                  <span className="text-amber-600 font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    มีการแก้ไขอัตรา GP เป็น <span className="font-mono tabular-nums">{bGpPercent}%</span> (ยังไม่บันทึกลงฐานข้อมูล · ค่าที่บันทึกล่าสุด <span className="font-mono tabular-nums">{savedBoothGpPercent}%</span>)
                  </span>
                ) : (
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      อัตรา GP ที่บันทึกไว้: <strong className="text-slate-700 font-mono tabular-nums">{savedBoothGpPercent}%</strong>
                      {config?.boothSettingsUpdatedAt && (
                        <>
                          <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
                          <span>
                            บันทึกล่าสุด {new Date(config.boothSettingsUpdatedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto xl:justify-end shrink-0">
              {isBoothSettingsDirty && (
                <button
                  type="button"
                  onClick={handleRevertBoothDraft}
                  disabled={isBoothSettingsSaving}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0"
                  title={`ย้อนกลับไปใช้ค่าที่บันทึกล่าสุด (${savedBoothGpPercent}%)`}
                >
                  คืนค่าล่าสุด ({savedBoothGpPercent}%)
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveBoothSettings}
                disabled={isBoothSettingsSaving || !isBoothSettingsDirty}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap shrink-0 shadow-sm active:scale-95 ${
                  isBoothSettingsDirty
                    ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200"
                    : "bg-slate-100 text-slate-500 cursor-default shadow-none"
                } disabled:opacity-60`}
              >
                {isBoothSettingsSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : isBoothSettingsDirty ? (
                  <Save className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span>
                  {isBoothSettingsSaving
                    ? "กำลังบันทึก..."
                    : isBoothSettingsDirty
                    ? "บันทึกการตั้งค่าล่าสุด"
                    : "บันทึกแล้ว"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleResetBoothSettings}
                disabled={isBoothSettingsSaving || isBoothSettingsAtDefault}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-45 disabled:cursor-not-allowed text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap shrink-0 active:scale-95"
                title={`รีเซ็ตอัตราส่วนแบ่ง GP กลับเป็นค่าเริ่มต้น (${DEFAULT_BOOTH_GP_PERCENT}%)`}
              >
                <RotateCcw className="w-4 h-4 text-slate-500 shrink-0" />
                <span>รีเซ็ตค่าเริ่มต้น</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={booths.length === 0}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition whitespace-nowrap shrink-0 active:scale-95"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>รายงานแบ่งยอดขาย (Export CSV)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Hand: Registration Form */}
            <div className="lg:col-span-1 bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h4 className="font-bold text-base text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-rose-500" />
                {bFormId ? "แก้ไขข้อมูลบูธกิจกรรม" : "สมัครเพิ่มบูธกิจกรรมใหม่"}
              </h4>
              <form onSubmit={handleSaveBooth} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-600">ชื่อบูธกิจกรรม *</label>
                  <input
                    type="text"
                    required
                    value={bFormName}
                    onChange={(e) => setBFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs text-slate-800 font-medium font-sans"
                    placeholder="เช่น ซุ้มสาวน้อยตกน้ำ หรรษา"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-600">ชื่อผู้ดูแล / เจ้าของร้าน *</label>
                  <input
                    type="text"
                    required
                    value={bFormOwner}
                    onChange={(e) => setBFormOwner(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs text-slate-800 font-medium font-sans"
                    placeholder="เช่น เจ๊เกียว ขนมบ้าบิ่น"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-600">เลขพร้อมเพย์สำหรับชำระเงิน (PromptPay ID)</label>
                  <input
                    type="text"
                    value={bFormPromptPayId}
                    onChange={(e) => setBFormPromptPayId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 font-mono rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs text-slate-800"
                    placeholder="เช่น 0891234567"
                  />
                  <p className="text-[10px] text-slate-400">เบอร์โทรศัพท์ (10 หลัก) หรือเลขบัตรประชาชน (13 หลัก)</p>
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-600">ชื่อบัญชีพร้อมเพย์ (เช่น นาย สมจิต แสนรัก)</label>
                  <input
                    type="text"
                    value={bFormPromptPayName}
                    onChange={(e) => setBFormPromptPayName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs text-slate-800 font-medium font-sans"
                    placeholder="เช่น นาย สมจิต แสนรัก"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-600">รายละเอียดของพรีเมียม / รางวัลหรือกิจกรรม</label>
                  <textarea
                    rows={2}
                    value={bFormDesc}
                    onChange={(e) => setBFormDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs text-slate-800 font-medium font-sans"
                    placeholder="กรอกสิทธิประโยชน์ หรือบริการประจำบูธ..."
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  {bFormId && (
                    <button
                      type="button"
                      onClick={() => {
                        setBFormId("");
                        setBFormName("");
                        setBFormOwner("");
                        setBFormPromptPayId("");
                        setBFormPromptPayName("");
                        setBFormDesc("");
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-xs flex-1 text-center"
                    >
                      ยกเลิกแก้ไข
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={bFormIsSaving}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-lg transition text-xs flex-1 flex items-center justify-center gap-1"
                  >
                    {bFormIsSaving ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    {bFormId ? "อัปเดตข้อมูล" : "สร้างบูธกิจกรรม"}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Hand: Booth Directory List */}
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4 animate-in fade-in">
              <h4 className="font-bold text-base text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-slate-500" />
                ทะเบียนรายชื่อบูธกิจกรรมในงานระบบปัจจุบัน ({booths.length} บูธ)
              </h4>
              <div className="overflow-x-auto">
                {booths.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                    <Store className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400 text-xs font-bold font-sans">ยังไม่ได้รับการจัดตั้งบูธกิจกรรมใด ๆ ในระบบ</p>
                    <p className="text-slate-400 text-[10px] mt-1 font-sans">ใช้ฟอร์มการรับสมัครด้านซ้ายเพื่อสร้างบูธและผูกสิทธิ์สตาฟประจำทันที</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[11px] font-sans">
                        <th className="py-2.5 px-3">ชื่อบูธกิจกรรม / เจ้าของ</th>
                        <th className="py-2.5 px-3">พร้อมเพย์ปลายทาง</th>
                        <th className="py-2.5 px-3">รายละเอียดซุ้ม</th>
                        <th className="py-2.5 px-3 text-center">จัดการสิทธิ์</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-sans">
                      {booths.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50 transition-colors text-slate-700">
                          <td className="py-3 px-3">
                            <span className="font-black text-slate-800 text-sm block">🎪 {b.name}</span>
                            <span className="text-slate-400 text-[10px] font-bold block mt-0.5">👤 ผู้ดูแล: {b.ownerName}</span>
                          </td>
                          <td className="py-3 px-3">
                            {b.promptpayId ? (
                              <>
                                <span className="font-mono text-[11px] font-bold text-slate-800 flex items-center gap-1">
                                  <Landmark className="w-3.5 h-3.5 text-primary" /> {b.promptpayId}
                                </span>
                                {b.promptpayName && <span className="text-emerald-600 font-bold text-[9px] block mt-0.5">({b.promptpayName})</span>}
                              </>
                            ) : (
                              <span className="text-slate-400 text-[10px] italic">ไม่ได้เชื่อมต่อ QR พร้อมเพย์</span>
                            )}
                          </td>
                          <td className="py-3 px-3 max-w-[140px] truncate">
                            <span className="text-slate-500 text-[11px] leading-snug">{b.description || "-"}</span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex justify-center items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setBFormId(b.id);
                                  setBFormName(b.name);
                                  setBFormOwner(b.ownerName);
                                  setBFormPromptPayId(b.promptpayId || "");
                                  setBFormPromptPayName(b.promptpayName || "");
                                  setBFormDesc(b.description || "");
                                }}
                                className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg hover:text-slate-900 transition flex items-center gap-1 text-[11px] font-bold"
                                title="แก้ไขข้อมูล"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> แก้ไข
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBooth(b.id, b.name)}
                                className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg hover:text-rose-700 transition flex items-center gap-1 text-[11px] font-bold"
                                title="ลบบูธนี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> ลบ
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Analytics Block */}
            <div className="lg:col-span-1 bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h4 className="font-bold text-base text-slate-800 border-b border-slate-100 pb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-emerald-500" />
                  สรุปรายรับระบบแบ่งผลประโยชน์
                </span>
              </h4>
              
              {/* Dynamic Fee percent adjustment */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-3 font-sans">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-bold text-slate-700">คำนวณส่วนแบ่ง GP ส่วนกลาง:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={50}
                      step={1}
                      value={bGpPercent}
                      onChange={(e) => updateBoothGpPercent(Number(e.target.value))}
                      aria-label="อัตราส่วนแบ่ง GP (%)"
                      className="w-16 px-2 py-1 text-right bg-white border border-slate-200 rounded-lg font-black text-xs font-mono tabular-nums text-emerald-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                    <span className="font-mono font-bold text-slate-500">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={bGpPercent}
                  onChange={(e) => updateBoothGpPercent(Number(e.target.value))}
                  className="w-full accent-rose-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-bold font-mono tabular-nums">
                  <span>0% (ไม่มี GP)</span>
                  <span>ค่าเริ่มต้น {DEFAULT_BOOTH_GP_PERCENT}%</span>
                  <span>50% สูงสุด</span>
                </div>

                {/* Quick presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[0, 5, 10, 15, 20, 30].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => updateBoothGpPercent(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono tabular-nums transition whitespace-nowrap ${
                        bGpPercent === preset
                          ? "bg-slate-800 text-white"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>

                {/* Inline Save & Reset Controls */}
                <div className="pt-2.5 border-t border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                      ค่าที่บันทึกไว้ในระบบ:{" "}
                      <strong className="text-slate-700 font-mono tabular-nums">{savedBoothGpPercent}%</strong>
                    </span>
                    {isBoothSettingsDirty && (
                      <span className="text-amber-600 font-bold">ยังไม่บันทึก</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSaveBoothSettings}
                      disabled={isBoothSettingsSaving || !isBoothSettingsDirty}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                        isBoothSettingsDirty
                          ? "bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-500 cursor-default"
                      } disabled:opacity-60`}
                    >
                      {isBoothSettingsSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      ) : isBoothSettingsDirty ? (
                        <Save className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      )}
                      <span>
                        {isBoothSettingsSaving
                          ? "กำลังบันทึก..."
                          : isBoothSettingsDirty
                          ? `บันทึกค่าล่าสุด (${bGpPercent}%)`
                          : "บันทึกค่าล่าสุดแล้ว"}
                      </span>
                    </button>

                    {isBoothSettingsDirty && (
                      <button
                        type="button"
                        onClick={handleRevertBoothDraft}
                        disabled={isBoothSettingsSaving}
                        className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold transition whitespace-nowrap"
                      >
                        คืนค่า ({savedBoothGpPercent}%)
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleResetBoothSettings}
                      disabled={isBoothSettingsSaving || isBoothSettingsAtDefault}
                      className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-45 disabled:cursor-not-allowed text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition whitespace-nowrap"
                      title={`รีเซ็ตกลับเป็นค่าเริ่มต้น ${DEFAULT_BOOTH_GP_PERCENT}%`}
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>รีเซ็ต ({DEFAULT_BOOTH_GP_PERCENT}%)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Stat figures cards */}
              {(() => {
                const totalScans = boothScanLogs.length;
                const totalGrossSales = boothScanLogs.reduce((sum, log) => sum + (Number(log.salesAmount) || 0), 0);
                const systemGpValue = (totalGrossSales * bGpPercent) / 100;
                const netStorePayout = totalGrossSales - systemGpValue;

                return (
                  <div className="space-y-3 font-sans">
                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">สถิติการเช็คอินเล่นกิจกรรมรวม</p>
                        <p className="font-black text-xl text-slate-800 font-mono mt-0.5">{totalScans.toLocaleString()} <span className="text-xs text-slate-400 font-bold">ครั้ง</span></p>
                      </div>
                      <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-100">
                        <History className="w-5 h-5 text-indigo-500 shrink-0" />
                      </div>
                    </div>

                    <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase">ยอดจำหน่ายรวมสะสม (Gross)</p>
                        <p className="font-black text-xl text-emerald-800 font-mono mt-0.5">฿{totalGrossSales.toLocaleString()}</p>
                      </div>
                      <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-100">
                        <Banknote className="w-5 h-5 text-emerald-500 shrink-0" />
                      </div>
                    </div>

                    <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-2xl flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-amber-600 uppercase">ส่วนแบ่งหักเข้าระบบ (GP Share)</p>
                        <p className="font-black text-xl text-amber-800 font-mono mt-0.5">฿{systemGpValue.toLocaleString()}</p>
                      </div>
                      <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-100">
                        <Palette className="w-5 h-5 text-amber-500 shrink-0" />
                      </div>
                    </div>

                    <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-rose-600 uppercase">สุทธิโอนเข้าเจ้าของร้านค้า</p>
                        <p className="font-black text-xl text-rose-800 font-mono mt-0.5">฿{netStorePayout.toLocaleString()}</p>
                      </div>
                      <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-100">
                        <Store className="w-5 h-5 text-rose-500 shrink-0" />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Middle and right: Revenue breakdown split Table & Scan Logs */}
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-6">
              {/* Tab/Split inside reports */}
              <div>
                <h4 className="font-bold text-base text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5 font-sans">
                  <BarChart3 className="w-4 h-4 text-rose-500" />
                  รายงานยอดสุทธิแยกตามแต่ละบูธกิจกรรม
                </h4>
                
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[11px] font-sans">
                        <th className="py-2.5 px-3">ชื่อบูธกิจกรรม</th>
                        <th className="py-2.5 px-3 text-center">สแกนร่วมสนุก</th>
                        <th className="py-2.5 px-3 text-right">ยอดขายรวม</th>
                        <th className="py-2.5 px-3 text-right"> GP แอดมิน</th>
                        <th className="py-2.5 px-3 text-right">ยอดโอนสุทธิร้าน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-sans">
                      {booths.map((b) => {
                        const logs = boothScanLogs.filter((log: any) => log.boothId === b.id);
                        const totalScans = logs.length;
                        const commerce = logs.filter((log: any) => log.salesAmount > 0);
                        const totalSales = commerce.reduce((sum, log) => sum + (Number(log.salesAmount) || 0), 0);
                        const gpFee = (totalSales * bGpPercent) / 100;
                        const netPay = totalSales - gpFee;

                        return (
                          <tr key={b.id} className="hover:bg-slate-50 text-slate-700">
                            <td className="py-3 px-3 font-bold text-slate-800">
                              🎪 {b.name} <span className="text-[10px] text-slate-400 font-medium font-sans">({b.ownerName})</span>
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-600">
                              {totalScans} ครั้ง
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                              ฿{totalSales.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-amber-600 font-bold">
                              ฿{gpFee.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-emerald-600 font-black">
                              ฿{netPay.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* LOGS LIST WITH SEARCH PANEL */}
              <div className="border-t border-slate-100 pt-6 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5 font-sans">
                    <History className="w-4 h-4 text-slate-400" />
                    ประวัติสตาฟบันทึกผู้ร่วมงานเข้าบูธแบบเรียลไทม์
                  </h4>
                  {/* Search box & filter */}
                  <div className="flex gap-2 w-full md:w-auto font-sans">
                    <input
                      type="text"
                      placeholder="ค้นด้วยชื่อผู้ร่วมงาน..."
                      value={bLogSearch}
                      onChange={(e) => setBLogSearch(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 w-full md:w-44 font-medium"
                    />
                    <select
                      value={bLogFilterBooth}
                      onChange={(e) => setBLogFilterBooth(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 font-bold text-slate-700"
                    >
                      <option value="">ทุกซุ้มซอยบูธ</option>
                      {booths.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Scans table */}
                <div className="overflow-x-auto max-h-72 overflow-y-auto border border-slate-100 rounded-2xl">
                  {(() => {
                    const filteredLogs = boothScanLogs.filter((log: any) => {
                      const matchesSearch = !bLogSearch || (log.userName && log.userName.toLowerCase().includes(bLogSearch.toLowerCase())) || (log.ticketId && log.ticketId.includes(bLogSearch));
                      const matchesBooth = !bLogFilterBooth || log.boothId === bLogFilterBooth;
                      return matchesSearch && matchesBooth;
                    });

                    if (filteredLogs.length === 0) {
                      return (
                        <p className="text-slate-400 text-xs text-center py-8 bg-slate-50 font-sans">ไม่มีข้อมูลล็อกบันทึกผู้ร่วมบูธตรงกับเงื่อนไขค้นหา</p>
                      );
                    }

                    return (
                      <table className="w-full text-left text-[11px] border-collapse bg-white">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider font-sans">
                          <tr>
                            <th className="py-2 px-3">ผู้ร่วมงาน (Attendee)</th>
                            <th className="py-2 px-3">โต๊ะ/เก้าอี้</th>
                            <th className="py-2 px-3">ซุ้มบูธที่เข้าร่วมสนุก</th>
                            <th className="py-2 px-3 text-right">ยอดเงินสินค้า/บริการ</th>
                            <th className="py-2 px-3">รายละเอียด (สตาฟโน้ต)</th>
                            <th className="py-2 px-3">เวลาที่สแกน</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600 font-sans">
                          {filteredLogs.map((log: any, index: number) => {
                            const b = booths.find((x: any) => x.id === log.boothId);
                            return (
                              <tr key={log.id || index} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-2.5 px-3 font-extrabold text-slate-800">
                                  👤 {log.userName || "ไม่ระบุชื่อ"}
                                  <span className="block text-[8px] text-slate-400 font-mono mt-0.5">บัตร: {log.ticketId}</span>
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-600">
                                  โต๊ะ: {log.tableId || "N/A"} • ที่นั่ง: {log.seatId || "all"}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-slate-800">
                                  🎪 {b ? b.name : "Unknown Booth"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-700 font-extrabold">
                                  {log.salesAmount > 0 ? `฿${log.salesAmount.toLocaleString()}` : "-"}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 italic max-w-[120px] truncate">
                                  {log.notes || "-"}
                                </td>
                                <td className="py-2.5 px-3 text-slate-400 font-bold">
                                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('th-TH') : "N/A"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "move_seats" ? (
        <MoveSeatsTab
          tables={tables}
          setTables={setTables}
          tickets={tickets}
          setMyTickets={setMyTickets}
          localConfig={localConfig}
          activeZones={activeZones}
          setPendingEmails={setPendingEmails}
          onNotify={showToast}
        />
      ) : null}

      {/* Sponsor Modal */}
      {showSponsorModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
          >
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-rose-500" />
              ออกบัตรสปอนเซอร์ (Sponsor Ticket)
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ชื่อผู้รับสปอนเซอร์
                </label>
                <input
                  type="text"
                  value={sponsorForm.name}
                  onChange={(e) =>
                    setSponsorForm({ ...sponsorForm, name: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="เช่น บริษัท ABC, พี่โต"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  อีเมลผู้รับสปอนเซอร์ (สำหรับส่ง QR Code)
                </label>
                <input
                  type="email"
                  value={sponsorForm.email}
                  onChange={(e) =>
                    setSponsorForm({ ...sponsorForm, email: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="email@example.com"
                />
              </div>

              <div className="flex gap-4 flex-col">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    จำนวนที่นั่ง (ระบุตัวเลข หรือกดเพิ่มลด)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setSponsorForm((prev) => ({
                          ...prev,
                          qtyStr: Math.max(
                            1,
                            (parseInt(prev.qtyStr) || 0) - 1,
                          ).toString(),
                        }))
                      }
                      className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      placeholder="จำนวนที่นั่ง..."
                      value={sponsorForm.qtyStr}
                      onChange={(e) => {
                        setSponsorForm({
                          ...sponsorForm,
                          qtyStr: e.target.value,
                        });
                        setSelectedAllocation(null);
                      }}
                      className={`flex-1 px-4 py-3 text-center rounded-xl border focus:outline-none focus:ring-2 focus:ring-rose-500 transition-colors ${sponsorForm.qtyStr ? "border-rose-300 text-slate-800 font-bold" : "border-slate-200 text-slate-400"}`}
                    />
                    <button
                      onClick={() =>
                        setSponsorForm((prev) => ({
                          ...prev,
                          qtyStr: ((parseInt(prev.qtyStr) || 0) + 1).toString(),
                        }))
                      }
                      className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {sponsorQty > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      เลือกโซน / โต๊ะที่จัดสรรได้
                    </label>
                    <select
                      value={
                        selectedAllocation
                          ? JSON.stringify(selectedAllocation)
                          : ""
                      }
                      onChange={(e) =>
                        setSelectedAllocation(
                          e.target.value ? JSON.parse(e.target.value) : null,
                        )
                      }
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="">-- เลือกระบบจัดสรร หรือ โต๊ะ --</option>

                      {allocationOptions.length > 0 &&
                        Object.keys(activeZones)
                          .sort(
                            (a, b) =>
                              (activeZones[a]?.layoutOrder || 0) -
                              (activeZones[b]?.layoutOrder || 0),
                          )
                          .map((zone) => {
                            const opt = allocationOptions.find(
                              (o) => o.zoneId === zone,
                            );
                            return opt ? (
                              <optgroup
                                key={`auto-${zone}`}
                                label={`✨ แนะนำโซน: ${activeZones[zone]?.name} / จัดสรร ${opt.plan.length} โต๊ะ`}
                              >
                                <option value={JSON.stringify(opt.plan)}>
                                  โควต้าโซน: {activeZones[zone]?.name}{" "}
                                  (จัดสรรอัตโนมัติ)
                                </option>
                              </optgroup>
                            ) : null;
                          })}

                      {sponsorQty <= 10 && specificTableOptions.length > 0 && (
                        <optgroup label="📌 เลือกเจาะจงรายโต๊ะ">
                          {specificTableOptions.map((opt, idx) => (
                            <option
                              key={`spec-${idx}`}
                              value={JSON.stringify(opt.plan)}
                            >
                              โต๊ะ {opt.plan[0].tableId} - โซน:{" "}
                              {activeZones[opt.zoneId]?.name} (ว่าง{" "}
                              {
                                tables
                                  .find((t) => t.id === opt.plan[0].tableId)
                                  ?.seats.filter(
                                    (s) => s.status === "available",
                                  ).length
                              }{" "}
                              ที่)
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {selectedAllocation && selectedAllocation.length > 1 && (
                      <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <strong>แผนการจัดสรร: </strong>
                        {selectedAllocation
                          .map(
                            (p: any) =>
                              `โต๊ะ ${p.tableId} (${p.seatIds.length} ที่)`,
                          )
                          .join(" + ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  setShowSponsorModal(false);
                  setSponsorForm({ name: "", qtyStr: "" });
                  setSelectedAllocation(null);
                }}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={async () => {
                  try {
                    console.log("Confirm sponsor click:", {
                      sponsorForm,
                      selectedAllocation,
                      hasSetTickets: !!setMyTickets,
                      hasSetTables: !!setTables,
                    });
                    if (!sponsorForm.name || !selectedAllocation) {
                      console.warn(
                        "Returning early due to missing name or allocation",
                      );
                      return;
                    }
                    if (!setMyTickets || !setTables) {
                      console.warn("Missing setter limits");
                      showToast({
                        type: 'error',
                        title: 'ไม่สามารถบันทึกข้อมูลได้',
                        message: 'Missing state mutators',
                      });
                      return;
                    }

                    const allocArray = Array.isArray(selectedAllocation)
                      ? selectedAllocation
                      : [selectedAllocation];

                    const newTickets: TicketPayload[] = allocArray.map(
                      (alloc: any) => {
                        const table = tables.find(
                          (t) => t.id === alloc.tableId,
                        );
                        const price =
                          activeZones[table?.zoneId as string]?.pricePerSeat ||
                          0;
                        const ticketCompValue = alloc.seatIds
                          ? alloc.seatIds.length * price
                          : 0;

                        return {
                          id: Math.random()
                            .toString(36)
                            .substr(2, 9)
                            .toUpperCase(),
                          userName: sponsorForm.name,
                          phone: "-",
                          email: sponsorForm.email || "-",
                          tableId: alloc.tableId,
                          seatIds: alloc.seatIds || [],
                          totalAmount: 0,
                          paymentMethod: "sponsor",
                          status: "paid",
                          qrCodeUrl:
                            "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" +
                            Math.random().toString(36).substring(7),
                          drinksRedeemed: 0,
                          drinkHistory: {},
                          isSponsor: true,
                          sponsorValue: ticketCompValue,
                        };
                      },
                    );

                    setMyTickets((prev: any) => [
                      ...newTickets,
                      ...(prev || []),
                    ]);

                    setTables((prev: any) =>
                      (prev || []).map((t: any) => {
                        const alloc = allocArray.find(
                          (a: any) => a.tableId === t.id,
                        );
                        const matchingTicket = newTickets.find(
                          (tk) => tk.tableId === t.id,
                        );
                        if (alloc) {
                          return {
                            ...t,
                            seats: t.seats.map((s: any) => {
                              if ((alloc.seatIds || []).includes(s.id)) {
                                const { lockedUntil, lockedBySession, ...rest } = s;
                                return {
                                  ...rest,
                                  status: "paid",
                                  ...(matchingTicket ? { ticketId: matchingTicket.id } : {}),
                                };
                              }
                              return s;
                            }),
                          };
                        }
                        return t;
                      }),
                    );

                    setShowSponsorModal(false);
                    setSponsorForm({ name: "", email: "", qtyStr: "" });
                    setSelectedAllocation(null);

                    if (sponsorForm.email) {
                      try {
                        const attachments: {
                          filename: string;
                          content: string;
                        }[] = [];
                        const summaryTextLines: string[] = [];
                        let summaryHtml = "";

                        for (const tkt of newTickets) {
                          const table = tables.find(
                            (t) => t.id === tkt.tableId,
                          );
                          const zoneName = table
                            ? activeZones[table.zoneId as ZoneType]?.name
                            : "";
                          const zoneColor = table
                            ? activeZones[table.zoneId as ZoneType]?.color
                            : undefined;

                          for (const seatId of tkt.seatIds) {
                            const doc = await generateTicketPDF({
                              ticketId: tkt.id,
                              tableId: tkt.tableId,
                              seatId,
                              seatIds: tkt.seatIds,
                              userName: sponsorForm.name,
                              zoneName,
                              zonePrice: 0, // Comped
                              eventName: localConfig.eventName,
                              zoneColor,
                            });

                            const dataUrl = doc.output("datauristring");
                            const base64Content = dataUrl.split(",")[1];
                            const filename = `QR_Table_${tkt.tableId}_Seat_${seatId}.pdf`;
                            attachments.push({
                              filename,
                              content: base64Content,
                            });

                            summaryTextLines.push(
                              `Table: ${tkt.tableId}, Seat: ${seatId} - Zone: ${zoneName}`,
                            );
                            summaryHtml += `<div style="margin-bottom: 10px;">
                              <p><strong>Table: ${tkt.tableId}, Seat: ${seatId}</strong> - Zone: ${zoneName}</p>
                            </div>`;
                          }
                        }

                        const summaryText = summaryTextLines.join("\n");

                        // Apply Templates
                        const rawSubject =
                          localConfig.emailTemplateSubject ||
                          "Your Tickets for {{eventName}}";
                        const rawBody =
                          localConfig.emailTemplateBody ||
                          "Hi {{userName}},\n\nPayment successful! Your tickets are confirmed.\n\n{{ticketDetails}}\n\nPlease check the attached QR codes and present them at the entrance.";

                        const replaceVars = (str: string) => {
                          return str
                            .replace(
                              /{{eventName}}/g,
                              localConfig.eventName || "EventTicketingPro",
                            )
                            .replace(/{{userName}}/g, sponsorForm.name)
                            .replace(/{{ticketDetails}}/g, summaryText);
                        };

                        const subjectText = replaceVars(rawSubject);
                        const bodyText = replaceVars(rawBody);

                        const baseUrl = window.location.origin;

                        // Use only the first seat for the survey link for the primary email button
                        const defaultTicket = newTickets[0];
                        const defaultSeatId = defaultTicket.seatIds[0];
                        const surveyLink = `${baseUrl}/?view=survey&ticketId=${defaultTicket.id}&name=${encodeURIComponent(sponsorForm.name)}&table=${defaultTicket.tableId}&seats=${defaultTicket.seatIds.join(",")}&seatId=${defaultSeatId}`;

                        const bodyHtml = getEmailHtml(
                          localConfig.emailTheme || "default",
                          localConfig.eventName || "EventTicket",
                          bodyText,
                          {
                            themeColor: localConfig.themeColor || "#2563eb",
                            secondaryColor: localConfig.enableSecondaryColor
                              ? localConfig.secondaryColor
                              : localConfig.themeColor,
                            accentColor: localConfig.enableAccentColor
                              ? localConfig.accentColor
                              : localConfig.themeColor,
                            includeSurveyButton:
                              localConfig.emailIncludeSurveyButton,
                            surveyButtonText: localConfig.emailSurveyButtonText,
                            surveyButtonFontSize:
                              localConfig.emailSurveyButtonFontSize,
                            surveyLink: surveyLink,
                            eventDate: localConfig.eventDate,
                            eventTime: localConfig.eventTime,
                            youtubeLink: localConfig.emailYoutubeLink,
                          },
                        );

                        const pendingData: PendingEmail = {
                          id: Math.random().toString(36).substr(2, 9),
                          to: [sponsorForm.email],
                          subject: `[Sponsor] ${subjectText}`,
                          text: bodyText,
                          html: bodyHtml,
                          attachments,
                          status: "pending",
                          createdAt: Date.now(),
                          eventName: localConfig.eventName,
                        };

                        try {
                          const res = await fetch("/api/send-email", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(pendingData),
                          });

                          if (res.ok) {
                            showToast({
                              type: 'success',
                              title: 'ออกบัตรสปอนเซอร์สำเร็จ',
                              message: 'ออกบัตรและส่งอีเมลอัตโนมัติให้ผู้สนับสนุนเรียบร้อยแล้ว',
                            });
                          } else {
                            const errData = await res.json();
                            throw new Error(
                              errData.error || "Send response not ok",
                            );
                          }
                        } catch (sendErr: any) {
                          console.error(
                            "Draft email auto-send error:",
                            sendErr,
                          );
                          if (setPendingEmails)
                            setPendingEmails((prev: PendingEmail[]) => [
                              pendingData,
                              ...(prev || []),
                            ]);
                          showToast({
                            type: 'warning',
                            title: 'ออกบัตรสปอนเซอร์สำเร็จ แต่อีเมลส่งไม่สำเร็จ',
                            message: 'ระบบบันทึกอีเมลไว้ในเมนู "ติดตามอีเมล" เพื่อส่งซ้ำภายหลังแล้ว',
                            details: sendErr.message,
                          });
                        }
                      } catch (e: any) {
                        console.error("Draft email error:", e);
                        showToast({
                          type: 'warning',
                          title: 'ออกบัตรสำเร็จ แต่จัดเตรียมอีเมลไม่สำเร็จ',
                          message: e.message,
                        });
                      }
                    } else {
                      showToast({
                        type: 'success',
                        title: 'ออกบัตรสปอนเซอร์สำเร็จ!',
                      });
                    }
                  } catch (err: any) {
                    console.error("Sponsor ticket error:", err);
                    const friendly = getFriendlyFirestoreError(err);
                    showToast({
                      type: 'error',
                      title: 'เกิดข้อผิดพลาดระหว่างการออกบัตรสปอนเซอร์',
                      message: friendly.message,
                      details: friendly.details,
                    });
                  }
                }}
                disabled={
                  !sponsorForm.name ||
                  !sponsorForm.email ||
                  !/^\S+@\S+\.\S+$/.test(sponsorForm.email) ||
                  !selectedAllocation
                }
                className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition disabled:opacity-50 disabled:grayscale"
              >
                ยืนยันการตั้งบัตร
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </div>

      {/* 🧾 SECTION: PRINT-ONLY EXQUISITE A4 OFFICIAL REPORT DOCUMENT */}
      <div className="hidden print:block bg-white text-slate-800 font-sans p-6 min-h-screen">
        {/* Style tag to enforce solid print formatting */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body {
              background-color: white !important;
              color: #1e293b !important;
              font-family: 'Inter', system-ui, sans-serif !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              font-size: 11px !important;
            }
            @page {
              size: A4 portrait;
              margin: 12mm 15mm 12mm 15mm;
            }
            .page-break {
              page-break-before: always;
            }
          }
        ` }} />

        {/* Header Block */}
        <div className="border-b-2 border-slate-900 pb-4 mb-5 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-black rounded tracking-wider uppercase font-sans">
                OFFICIAL SYSTEM REPORT
              </span>
              <span className="text-slate-400 text-[10px] font-mono font-bold">
                ID #{Math.sin(tables.length + tickets.length + (surveys?.length || 0)).toString(36).substring(3, 9).toUpperCase()}
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1 font-sans">
              {reportTitle}
            </h1>
            <p className="text-xs text-slate-500 font-medium font-sans">
              ออกเอกสารและสรุปผลโดย EventTicketingPro Analytics Hub (Realtime DB Sync)
            </p>
          </div>
          <div className="text-right font-mono text-[9px] text-slate-400">
            <div>วันที่ประมวลผล: {new Date().toLocaleDateString("th-TH")}</div>
            <div>เวลาดึงข้อมูล: {new Date().toLocaleTimeString("th-TH")}</div>
            <div className="font-bold text-slate-700 font-sans">ฝ่าย: คอนโทรลเลอร์แอดมิน</div>
          </div>
        </div>

        {/* Event Meta Grid */}
        <div className="grid grid-cols-4 bg-slate-50 rounded-xl p-3 gap-3 mb-5 border border-slate-100 text-xs font-sans">
          <div className="text-center border-r border-slate-200">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">
              ชื่อกิจกรรม
            </span>
            <span className="text-xs font-black text-slate-800 line-clamp-1">
              {localConfig.eventName}
            </span>
          </div>
          <div className="text-center border-r border-slate-200">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">
              ที่นั่งความจุจริง
            </span>
            <span className="text-xs font-black text-slate-800">
              {totalSeats} ที่นั่ง ({tables.length} โต๊ะ)
            </span>
          </div>
          <div className="text-center border-r border-slate-200">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">
              รูปแบบผังที่นั่ง
            </span>
            <span className="text-xs font-black text-slate-800 capitalize">
              {localConfig.layoutStyle === "banquet" ? "โต๊ะจีน (Banquet)" : localConfig.layoutStyle === "classroom" ? "ชั้นเรียน (Classroom)" : localConfig.layoutStyle === "chevron" ? "เฉลียง (Chevron)" : localConfig.layoutStyle}
            </span>
          </div>
          <div className="text-center">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">
              สถานะสิทธิ์รายงาน
            </span>
            <span className="text-xs font-black text-emerald-600 block uppercase font-mono">
              VERIFIED / AD-HOC
            </span>
          </div>
        </div>

        {/* Dynamic print contents */}
        {reportType === "summary" && (
          <div className="space-y-5">
            {/* Bento metrics */}
            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1 mb-2.5 font-sans">
                ตัวชี้วัดประสิทธิภาพหลัก (Key KPI Summary)
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="border border-slate-200 rounded-lg p-2.5 bg-white font-sans">
                  <span className="text-[10px] font-bold text-slate-400 block">ยอดขายที่นั่ง (Seats Sold)</span>
                  <span className="text-base font-black text-slate-800 mt-0.5 block">
                    {paidSeatsCount} / {totalSeats}
                  </span>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-slate-900 h-full rounded-full" style={{ width: `${Math.min(100, Math.round((paidSeatsCount / (totalSeats || 1)) * 100))}%` }}></div>
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 mt-1 block text-right font-sans">{Math.round((paidSeatsCount / (totalSeats || 1)) * 100)}% Occupancy</span>
                </div>

                <div className="border border-slate-200 rounded-lg p-2.5 bg-white font-sans">
                  <span className="text-[10px] font-bold text-slate-400 block font-sans">เงินรวมหมุนเงินสด (Hard Revenue)</span>
                  <span className="text-base font-black text-slate-800 mt-0.5 block font-mono">
                    ฿{displayRevenue.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-3 font-sans">เฉลี่ยต่อที่นั่ง: ฿{paidSeatsCount ? Math.round(displayRevenue / paidSeatsCount).toLocaleString() : 0}</span>
                </div>

                <div className="border border-slate-200 rounded-lg p-2.5 bg-white font-sans">
                  <span className="text-[10px] font-bold text-slate-400 block font-sans">มูลค่าอัดฉีดสปอนเซอร์ (Comp Value)</span>
                  <span className="text-base font-black text-rose-600 mt-0.5 block font-mono">
                    ฿{totalSponsorValue.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-3 font-sans">จำนวนบัตรแจกฟรีกดมือ: {tickets.filter(t => t.isSponsor).reduce((sum, t) => sum + t.seatIds.length, 0)} ที่นั่ง</span>
                </div>
              </div>
            </div>

            {/* Zone Table */}
            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1 mb-2 font-sans">
                วิเคราะห์ความหนาแน่นและยอดขายแยกตามรายโซน (Zone Density Breakdowns)
              </h2>
              <table className="w-full text-left font-sans border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[9px] uppercase font-bold font-sans">
                    <th className="p-2 pl-3 rounded-l">รหัสโซน (Zone)</th>
                    <th className="p-2 text-right">ราคาต่อที่นั่ง</th>
                    <th className="p-2 text-center">โต๊ะติดตั้ง</th>
                    <th className="p-2 text-center">ความจุที่นั่ง</th>
                    <th className="p-2 text-center">ขายแล้ว / จอง</th>
                    <th className="p-2 text-right font-sans">รายได้โซน</th>
                    <th className="p-2 text-center rounded-r pr-3">อัตราจองโซน %</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] divide-y divide-slate-100">
                  {zoneStats.map((z) => {
                    const occupancyPercent = Math.round((z.soldSeats / (z.totalSeats || 1)) * 100);
                    return (
                      <tr key={z.id} className="hover:bg-slate-50/20">
                        <td className="p-2 pl-3 font-bold text-slate-800 font-sans">{z.name}</td>
                        <td className="p-2 text-right font-mono">฿{z.pricePerSeat.toLocaleString()}</td>
                        <td className="p-2 text-center font-bold">{z.tablesCount}</td>
                        <td className="p-2 text-center text-slate-500">{z.totalSeats}</td>
                        <td className="p-2 text-center font-black">
                          {z.soldSeats} {z.sponsorsCount > 0 && <span className="text-rose-500 font-bold text-[8px] font-sans">(Comp: {z.sponsorsCount})</span>}
                        </td>
                        <td className="p-2 text-right font-black font-mono">฿{z.revenue.toLocaleString()}</td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black ${occupancyPercent >= 75 ? "bg-emerald-50 text-emerald-700" : occupancyPercent >= 30 ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500"}`}>
                            {occupancyPercent}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Satisfaction Summary */}
            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1 mb-2 font-sans">
                คะแนนประเมินเฉลี่ยจากผู้ลงประชามติ (Satisfaction Scores Summary)
              </h2>
              <table className="w-full text-left font-sans border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[9px] uppercase font-bold font-sans">
                    <th className="p-2 pl-3 rounded-l">หัวข้อตรวจสอบการประเมิน (Evaluation Criteria)</th>
                    <th className="p-2 text-center font-sans">จำนวนผู้ตอบแบบประเมิน</th>
                    <th className="p-2 text-center font-sans">คะแนนเฉลี่ยที่ได้ (เต็ม 3)</th>
                    <th className="p-2 text-center rounded-r pr-3 font-sans">เกณฑ์สรุปเชิงสถิติ</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] divide-y divide-slate-100 font-sans">
                  {SURVEY_TOPICS.map((topic) => {
                    const scores = surveys ? surveys.map((s) => s.ratings[topic.id]).filter((v) => v != null) : [];
                    const count = scores.length;
                    const avg = count ? scores.reduce((a, b) => a + b, 0) / count : 0;
                    let remark = "ต้องการแก้ไข";
                    let remarkStyle = "text-rose-600 bg-rose-50";
                    if (avg >= 2.5) {
                      remark = "ยอดเยี่ยมดีเยี่ยม";
                      remarkStyle = "text-emerald-700 bg-emerald-50";
                    } else if (avg >= 1.8) {
                      remark = "สอดคล้องเกณฑ์ปานกลาง";
                      remarkStyle = "text-amber-700 bg-amber-50";
                    }
                    return (
                      <tr key={topic.id} className="hover:bg-slate-50/20">
                        <td className="p-2 pl-3 font-semibold text-slate-800">{topic.label}</td>
                        <td className="p-2 text-center">{count} รายการ</td>
                        <td className="p-2 text-center font-black text-rose-600 font-mono">{avg ? avg.toFixed(2) : "0.00"} / 3.00</td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black ${remarkStyle}`}>
                            {remark}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportType === "attendees" && (
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1 mb-2 font-sans">
              สมุดทะเบียนรายชื่อผู้มีสิทธิ์จองที่นั่งและสถานะไฟแนนซ์ (Official Seating Ledger)
            </h2>
            <table className="w-full text-left font-sans border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[9px] uppercase font-bold font-sans">
                  <th className="p-2 pl-3 rounded-l">No.</th>
                  <th className="p-2">รหัสตั๋ว</th>
                  <th className="p-2">ชื่อผู้ลงทะเบียน</th>
                  <th className="p-2 text-sans">เบอร์ติดต่อ / อีเมลคีย์</th>
                  <th className="p-2 text-center font-sans">พิกัดที่นั่ง</th>
                  <th className="p-2 text-right font-sans">ยอดเงินรับจริง</th>
                  <th className="p-2 text-center font-sans">สถานะ</th>
                  <th className="p-2 text-center rounded-r pr-3 font-sans">ยอดเช็คอิน</th>
                </tr>
              </thead>
              <tbody className="text-[9px] divide-y divide-slate-100">
                {sortedTickets.map((t, idx) => {
                  const checkInText = t.checkedInSeats?.length
                    ? `${t.checkedInSeats.length} / ${t.seatIds.length}`
                    : "0 / " + t.seatIds.length;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/20">
                      <td className="p-2 pl-3 text-slate-400 font-mono font-bold">{idx + 1}</td>
                      <td className="p-2 font-mono font-bold text-slate-800 uppercase">{t.id.slice(0, 8)}</td>
                      <td className="p-2 font-semibold text-slate-800 font-sans">
                        {t.userName} {t.isSponsor && <span className="bg-rose-500 text-white text-[7px] font-black px-1 rounded ml-1 font-sans">SPONSOR</span>}
                      </td>
                      <td className="p-2 text-slate-500 font-sans">
                        {t.phone} • {t.email}
                      </td>
                      <td className="p-2 text-center font-bold font-sans">
                        โต๊ะ {t.tableId} (ที่นั่ง: {t.seatIds.join(", ")})
                      </td>
                      <td className="p-2 text-right font-black font-mono">
                        {t.isSponsor ? (
                          <span className="text-rose-500">Comp (฿{(t.sponsorValue || 0).toLocaleString()})</span>
                        ) : (
                          <span>฿{t.totalAmount.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${t.status === "paid" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                          {t.status === "paid" ? "PAID" : "PENDING"}
                        </span>
                      </td>
                      <td className="p-2 text-center font-black text-rose-600">
                        {t.checkedInSeats && t.checkedInSeats.length > 0 ? (
                          <span className="text-emerald-700">✓ {checkInText}</span>
                        ) : (
                          <span>0/{t.seatIds.length}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {tickets.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 font-sans font-bold">
                      ไม่พบประวัติข้อมูลผู้ลงทะเบียนในขณะนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {reportType === "survey" && (
          <div className="space-y-4">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1 mb-2 font-sans">
              กระดานข้อเสนอแนะตัวอักษรดิบจากแบบสอบถาม (User Feedback Stream)
            </h2>
            <table className="w-full text-left font-sans border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[9px] uppercase font-bold font-sans">
                  <th className="p-2 pl-3 rounded-l">วันเวลาประเมิน</th>
                  <th className="p-2">ผู้ส่งข้อคำติชม</th>
                  <th className="p-2 text-center">พิกัดที่นั่ง</th>
                  <th className="p-2 text-center">คะแนนเฉลี่ย</th>
                  <th className="p-2 rounded-r pr-3">เนื้อหาข้อเสนอแนะตัวจริง</th>
                </tr>
              </thead>
              <tbody className="text-[9.5px] divide-y divide-slate-100">
                {processedSurveys
                  .filter((s) => s.comment?.trim())
                  .map((s, idx) => (
                    <tr key={s.id || idx} className="hover:bg-slate-50/20">
                      <td className="p-2 pl-3 font-mono text-slate-400">
                        {new Date(s.timestamp).toLocaleDateString("th-TH")}<br />
                        {new Date(s.timestamp).toLocaleTimeString("th-TH")}
                      </td>
                      <td className="p-2 font-bold text-slate-800 font-sans">{s.guestName}</td>
                      <td className="p-2 text-center text-slate-500 font-semibold font-sans">{s.tableSeatInfo}</td>
                      <td className="p-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black ${s.avgRating >= 2.5 ? "bg-emerald-50 text-emerald-700" : s.avgRating >= 1.8 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                          {s.avgRating.toFixed(2)} / 3.00
                        </span>
                      </td>
                      <td className="p-2 italic text-slate-800 font-bold bg-amber-50/10 font-sans max-w-sm whitespace-pre-wrap break-all leading-normal">
                        "{s.comment}"
                      </td>
                    </tr>
                  ))}
                {processedSurveys.filter((s) => s.comment?.trim()).length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 font-sans font-bold">
                      ยังไม่มีลูกค้าส่งความคิดเห็นตัวอักษรเข้ามาในฐานข้อมูลตอนนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {reportType === "labels" && labelType === "seats" && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1 mb-2 font-sans">
              พิมพ์สติกเกอร์เก้าอี้ประจำตั๋ว (Seat Labels to Cut/Sticker) - {labelFilterZone === "ALL" ? "ทุกโซน" : `โซน ${labelFilterZone}`}
            </h2>
            <div className={`grid gap-4 ${
              labelColumns === 2 ? "grid-cols-2" : labelColumns === 4 ? "grid-cols-4" : "grid-cols-3"
            }`}>
              {(() => {
                const seatLabels: any[] = [];
                tables.forEach(table => {
                  if (labelFilterZone !== "ALL" && table.zoneId !== labelFilterZone) return;
                  const zoneObj = activeZonesList.find((z: any) => z.id === table.zoneId);
                  const zoneName = zoneObj?.name || table.zoneId;
                  
                  table.seats.forEach(seat => {
                    const matchedTicket = tickets.find(t => 
                      t.tableId === table.id && 
                      t.seatIds.includes(seat.id) && 
                      (t.status === "paid" || t.status === "slip_verified")
                    );
                    seatLabels.push({
                      tableId: table.id,
                      seatId: seat.id,
                      zoneId: table.zoneId,
                      zoneName,
                      buyerName: matchedTicket?.userName || "",
                      status: seat.status,
                      price: zoneObj?.pricePerSeat || 0
                    });
                  });
                });

                if (seatLabels.length === 0) {
                  return (
                    <div className="col-span-full text-center py-10 text-xs font-bold text-slate-400">
                      ไม่พบเก้าอี้ที่ตรงตามเงื่อนไขตัวกรองโซน
                    </div>
                  );
                }

                return seatLabels.map((lbl, idx) => (
                  <div 
                    key={idx} 
                    className="border-2 border-dashed border-slate-400 rounded-xl p-4 bg-white relative overflow-hidden flex flex-col justify-between h-32 text-left"
                    style={{ pageBreakInside: "avoid" }}
                  >
                    <div 
                      className="absolute top-0 left-0 right-0 h-1.5"
                      style={{ 
                        backgroundColor: activeZonesList.find((z: any) => z.id === lbl.zoneId)?.color || "#6366f1" 
                      }}
                    />
                    <div className="flex justify-between items-start pt-1">
                      <span className="text-[9px] font-black tracking-wider text-slate-500 uppercase">
                        โซน {lbl.zoneName}
                      </span>
                      <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                        ฿{lbl.price.toLocaleString()}
                      </span>
                    </div>
                    <div className="my-2 text-center">
                      <div className="text-sm font-black text-slate-800 tracking-tight">
                        โต๊ะ <span className="text-rose-600 text-base">{lbl.tableId}</span> - เก้าอี้ <span className="text-indigo-600 text-base font-black">#{lbl.seatId}</span>
                      </div>
                    </div>
                    <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center">
                      <span className="text-[9px] text-slate-600 font-bold truncate max-w-[70%]">
                        {includeGuestName && lbl.buyerName ? `👤 ${lbl.buyerName}` : "👤 ผู้ถือตั๋ว"}
                      </span>
                      <span className={`text-[8px] font-black px-1.5 py-0.2 rounded uppercase border ${
                        lbl.buyerName ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-slate-100 text-slate-400 border-slate-200"
                      }`}>
                        {lbl.buyerName ? "จองแล้ว" : "ว่าง"}
                      </span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {reportType === "labels" && labelType === "tables" && (
          <div className="space-y-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1 mb-2 font-sans">
              พิมพ์ป้ายตั้งโต๊ะพร้อมแผนผังที่นั่ง (Table Tent Signages) - {labelFilterZone === "ALL" ? "ทุกโซน" : `โซน ${labelFilterZone}`}
            </h2>
            <div className="grid grid-cols-2 gap-6">
              {(() => {
                const matchingTables = tables.filter(t => labelFilterZone === "ALL" || t.zoneId === labelFilterZone);

                if (matchingTables.length === 0) {
                  return (
                    <div className="text-center py-10 text-xs font-bold text-slate-400 col-span-full">
                      ไม่พบโต๊ะที่ตรงตามเงื่อนไขตัวกรองโซน
                    </div>
                  );
                }

                return matchingTables.map((table) => {
                  const zoneObj = activeZonesList.find((z: any) => z.id === table.zoneId);
                  const zoneName = zoneObj?.name || table.zoneId;
                  const zoneColor = zoneObj?.color || "#6366f1";
                  const seatsCount = table.seats.length;

                  return (
                    <div 
                      key={table.id} 
                      className="border-2 border-dashed border-slate-400 rounded-3xl p-6 bg-white relative overflow-hidden flex flex-col justify-between min-h-[220px]"
                      style={{ pageBreakInside: "avoid" }}
                    >
                      <div className="absolute top-2 left-2 text-[8px] text-slate-300 font-bold tracking-widest uppercase">
                        [พับครึ่งสำหรับตั้งโต๊ะ / Fold Here for Table Tent]
                      </div>
                      
                      <div className="text-left space-y-3 z-10 pt-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-wider text-white" style={{ backgroundColor: zoneColor }}>
                              ZONE {zoneName}
                            </span>
                            <h2 className="text-2xl font-black text-slate-950 mt-1 tracking-tight">
                              โต๊ะ {table.id}
                            </h2>
                          </div>
                          
                          <div className="relative w-20 h-20 border border-slate-150 bg-slate-50/50 rounded-full flex items-center justify-center shrink-0">
                            <div className="w-9 h-9 bg-white border rounded-full flex flex-col items-center justify-center shadow-sm" style={{ borderColor: zoneColor }}>
                              <span className="text-[8px] font-black text-slate-800">{table.id}</span>
                            </div>

                            {table.seats.map((seat, sIdx) => {
                              const angle = (sIdx * 360) / seatsCount;
                              const radius = 26;
                              const x = Math.sin((angle * Math.PI) / 180) * radius;
                              const y = -Math.cos((angle * Math.PI) / 180) * radius;
                              
                              const isPaid = seat.status === "paid";
                              return (
                                <div 
                                  key={seat.id}
                                  className="absolute w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold border"
                                  style={{
                                    transform: `translate(${x}px, ${y}px)`,
                                    backgroundColor: isPaid ? zoneColor : "#ffffff",
                                    color: isPaid ? "#ffffff" : "#64748b",
                                    borderColor: isPaid ? zoneColor : "#cbd5e1"
                                  }}
                                >
                                  {seat.id}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">รายชื่อผู้จองประจำโต๊ะ (Seats breakdown)</span>
                          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                            {table.seats.map(seat => {
                              const matchedTicket = tickets.find(t => 
                                t.tableId === table.id && 
                                t.seatIds.includes(seat.id) && 
                                (t.status === "paid" || t.status === "slip_verified")
                              );
                              return (
                                <div key={seat.id} className="flex items-center gap-1.5 border border-slate-100 bg-slate-50/30 p-1 rounded">
                                  <span className="font-bold text-indigo-600 font-mono">#{seat.id}</span>
                                  <span className="truncate max-w-[100px] font-semibold text-slate-800">
                                    {includeGuestName && matchedTicket ? matchedTicket.userName : seat.status === "paid" ? "จองแล้ว" : "ว่าง"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-150 pt-2 text-[9px] text-slate-400 font-medium text-center">
                        {localConfig.eventName || "Event Ticketing Pro Showcase"}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {reportType === "labels" && labelType === "all" && (
          <div className="space-y-10">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1 mb-2 font-sans print:hidden">
              พิมพ์ป้ายนำทางโซน (Zone Directional Signs) - จัด 1 ป้ายต่อหนึ่งหน้ากระดาษ A4 เสมอ
            </h2>
            {(() => {
              const filteredSigns = directionSigns.filter(sign => {
                if (labelFilterZone === "ALL") return true;
                return sign.zoneId === labelFilterZone;
              });

              if (filteredSigns.length === 0) {
                return (
                  <div className="text-center py-12 text-slate-400 font-bold text-xs">
                    ไม่มีข้อมูลป้ายนำทางที่สร้างไว้สำหรับโซนที่เลือก
                  </div>
                );
              }

              // Group counts to assign sub-indices (e.g. SG-A-1, SG-A-2)
              const zoneCounts: Record<string, number> = {};

              return filteredSigns.map((sign) => {
                const zone = activeZonesList.find((z: any) => z.id === sign.zoneId);
                if (!zone) return null;

                // Track the index of this sign within its zone
                zoneCounts[sign.zoneId] = (zoneCounts[sign.zoneId] || 0) + 1;
                const signIndex = zoneCounts[sign.zoneId];

                const signTables = tables.filter(t => sign.tableIds.includes(t.id));
                const sortedTableIds = signTables.map(t => t.id).sort();

                let tablesDisplayText = "";
                if (sign.customRangeText && sign.customRangeText.trim() !== "") {
                  tablesDisplayText = sign.customRangeText.trim();
                } else if (sortedTableIds.length > 0) {
                  const isConsecutive = sortedTableIds.every((id, i) => {
                    if (i === 0) return true;
                    const prevNum = parseInt(sortedTableIds[i-1].replace(/\D/g, ''));
                    const currNum = parseInt(id.replace(/\D/g, ''));
                    return currNum === prevNum + 1;
                  });
                  if (isConsecutive && sortedTableIds.length > 1) {
                    tablesDisplayText = `กลุ่มโต๊ะหมายเลข ${sortedTableIds[0]} ถึง ${sortedTableIds[sortedTableIds.length - 1]} (${sortedTableIds.length} โต๊ะ)`;
                  } else {
                    tablesDisplayText = `กลุ่มโต๊ะหมายเลข ${sortedTableIds.join(", ")} (${sortedTableIds.length} โต๊ะ)`;
                  }
                } else {
                  tablesDisplayText = "ไม่มีโต๊ะที่กำหนดประจำป้ายนี้";
                }

                return (
                  <div 
                    key={sign.id} 
                    className="border-8 border-double border-slate-900 rounded-[36px] p-12 bg-white flex flex-col items-center justify-between text-center min-h-[500px] page-break"
                    style={{ pageBreakBefore: "always" }}
                  >
                    <div className="w-full flex justify-between items-center border-b-2 border-slate-200 pb-4 mb-8">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400 tracking-widest uppercase">
                          OFFICIAL EVENT DIRECTIONAL SIGN
                        </span>
                        <span className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-100 px-3 py-0.5 rounded-full uppercase tracking-wider">
                          รหัสป้าย: SG-{zone.id}-{signIndex}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200">
                        {localConfig.eventName || "Event Ticketing Pro"}
                      </span>
                    </div>

                    <div className="my-6 flex justify-center items-center">
                      <RenderCustomArrow 
                        direction={sign.arrowDir} 
                        className="w-36 h-36 transition-all duration-300" 
                        style={{ color: zone.color }} 
                      />
                    </div>

                    <div className="space-y-4">
                      <h2 className="text-4xl font-black text-slate-950 tracking-tight">
                        โซน {zone.name} (ZONE {zone.id})
                      </h2>
                      {sign.note && (
                        <p className="text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full inline-block max-w-md mx-auto">
                          📍 จุดติดตั้ง: {sign.note}
                        </p>
                      )}
                      <p className="text-xl font-bold text-slate-700">
                        {signTables.length > 0 || (sign.customRangeText && sign.customRangeText.trim() !== "")
                          ? (sign.customRangeText && sign.customRangeText.trim() !== "")
                            ? `กรุณาเดินทางไปที่กลุ่มโต๊ะ ${tablesDisplayText}`
                            : `กรุณาเดินทางไปที่ ${tablesDisplayText}`
                          : "ไม่มีโต๊ะที่นั่งจัดสรรในป้ายนี้"}
                      </p>
                      <p className="text-sm text-slate-400 font-medium max-w-md mx-auto leading-relaxed">
                        กรุณาเปิดบัตรผ่านแอปพลิเคชันและแสดงตั๋วรหัส QR-Code แก่เจ้าหน้าที่สตาฟ ณ จุดทางเข้าประตูเพื่อแสกนเช็คอินที่นั่ง
                      </p>
                    </div>

                    <div className="w-full border-t border-slate-200 pt-6 mt-12 flex justify-between items-center text-xs text-slate-400 font-bold font-sans">
                      <div className="flex flex-col items-start text-left gap-1">
                        <span>จำนวนเก้าอี้ติดตั้งในป้ายนี้: {signTables.reduce((acc, t) => acc + t.seats.length, 0)} ที่นั่ง</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md mt-1">
                          รหัสอ้างอิงตำแหน่งป้ายนี้: <strong className="text-rose-600 font-black">SG-{zone.id}-{signIndex}</strong>
                        </span>
                      </div>
                      {(() => {
                        const zoneQuota = zone.welcomeDrinkQuota !== undefined ? zone.welcomeDrinkQuota : (zone.id === 'VIP' || zone.id === 'A' ? 2 : 1);
                        const welcomeDrinksForZone = (localConfig.drinks || []).filter((d: any) => d.isWelcomeDrink && Array.isArray(d.welcomeZones) && d.welcomeZones.includes(zone.id));
                        const welcomeDrinksText = welcomeDrinksForZone.map((d: any) => d.name).join(", ");
                        const drinksPrivilegeText = welcomeDrinksForZone.length > 0 ? `${welcomeDrinksText} (${zoneQuota} แก้ว)` : `ทั่วไป (${zoneQuota} แก้ว)`;
                        return (
                          <span className="text-right text-indigo-700">
                            🍹 เครื่องดื่มต้อนรับที่ได้รับสิทธิ์: <strong className="font-extrabold">{drinksPrivilegeText}</strong>
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Footer Signature */}
        <div className="mt-10 pt-5 border-t border-slate-200 grid grid-cols-2 text-slate-400 text-[8px] font-sans">
          <div>
            <span className="font-bold block text-slate-600 mb-0.5">
              การรักษาความปลอดภัยของรายงาน (Security Analytics Audit)
            </span>
            <span>
              รายงานนี้ดึงโดยระบบคอมพิวเตอร์แบบอัตโนมัติ สถิติและความถูกต้องได้รับการประกันโดย EventTicketingPro Database Sync 
            </span>
          </div>
          <div className="text-right">
            <span className="font-bold block text-slate-600 mb-0.5">
              การลงมติเห็นชอบ (Controller Authority)
            </span>
            <span>
              ลงชื่อผู้รายงาน:  ................................................................  ผู้ดูแลฝ่ายสนับสนุนข้อมูล
            </span>
          </div>
        </div>
      </div>

      {/* 🎛️ SECTION: REPORT CENTER MODAL (PREVIEW & CONTROL) */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md flex items-center justify-center p-4 z-50 print:hidden overflow-hidden">
          <div className="bg-slate-50 rounded-3xl max-w-6xl w-full h-[90vh] flex flex-col md:flex-row shadow-2xl border border-slate-200 overflow-hidden animate-in scale-in-95 duration-150">
            
            {/* Left Controller Panel */}
            <div className="w-full md:w-[360px] bg-white border-b md:border-b-0 md:border-r border-slate-200 p-6 flex flex-col justify-between font-sans">
              <div className="space-y-6">
                
                {/* Header */}
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shadow-sm shrink-0">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-black text-slate-800 text-base leading-tight">ศูนย์ออกรายงานผล</h2>
                    <p className="text-xs text-slate-500 font-medium">Realtime Intelligent Reporter</p>
                  </div>
                </div>

                {/* Navigation selections */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                    เลือกรูปแบบรายงาน (Report Style)
                  </span>
                  
                  <button
                    onClick={() => setReportType("summary")}
                    className={`w-full p-3.5 rounded-xl text-left font-bold transition-all flex items-center gap-3 text-xs ${reportType === "summary" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100 text-slate-700"}`}
                  >
                    <BarChart3 className="w-4 h-4 shrink-0" />
                    <div>
                      <div>ภาพรวม & สรุปผู้บริหาร</div>
                      <div className={`text-[9px] font-normal leading-none mt-0.5 ${reportType === "summary" ? "text-slate-300" : "text-slate-400"}`}>
                        สรุปประสิทธิภาพ, ความจุ และยอดขายแบ่งตามโซน
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setReportType("attendees")}
                    className={`w-full p-3.5 rounded-xl text-left font-bold transition-all flex items-center gap-3 text-xs ${reportType === "attendees" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100 text-slate-700"}`}
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    <div>
                      <div>ทะเบียนรายชื่อผู้ลงทะเบียน (Ledger)</div>
                      <div className={`text-[9px] font-normal leading-none mt-0.5 ${reportType === "attendees" ? "text-slate-300" : "text-slate-400"}`}>
                        รายการผู้ลงทะเบียนตั๋ว, หมายเลขโต๊ะสถิติตัวจริง
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setReportType("survey")}
                    className={`w-full p-3.5 rounded-xl text-left font-bold transition-all flex items-center gap-3 text-xs ${reportType === "survey" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100 text-slate-700"}`}
                  >
                    <Activity className="w-4 h-4 shrink-0" />
                    <div>
                      <div>วิเคราะห์แบบประเมิน & ข้อเสนอแนะ</div>
                      <div className={`text-[9px] font-normal leading-none mt-0.5 ${reportType === "survey" ? "text-slate-300" : "text-slate-400"}`}>
                        สถิติความคิดเห็น, ความคุ้มค่า, รีวิวดิบของลูกค้า
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setReportType("labels")}
                    className={`w-full p-3.5 rounded-xl text-left font-bold transition-all flex items-center gap-3 text-xs ${reportType === "labels" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100 text-slate-700"}`}
                  >
                    <Tags className="w-4 h-4 shrink-0" />
                    <div>
                      <div>พิมพ์ป้ายบอกทาง & ลาเบลที่นั่ง</div>
                      <div className={`text-[9px] font-normal leading-none mt-0.5 ${reportType === "labels" ? "text-slate-300" : "text-slate-400"}`}>
                        สร้างสติกเกอร์เก้าอี้, ป้ายตั้งโต๊ะ, หรือป้ายบอกทางโซน
                      </div>
                    </div>
                  </button>
                </div>

                {/* Edit document Title */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    แก้ไขชื่อหัวกระดาษรายงาน
                  </label>
                  <input
                    type="text"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    placeholder="พิมพ์แต่งหัวข้อรายงานตรงนี้..."
                    className="w-full text-xs font-bold border border-slate-200 outline-none rounded-xl p-3 bg-slate-50 hover:bg-slate-50 focus:bg-white focus:border-slate-800 transition-all"
                  />
                </div>

                {reportType === "labels" && (
                  <div className="space-y-3 pt-3 border-t border-slate-100 overflow-y-auto max-h-[35vh] pr-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                      ตั้งค่าพิมพ์ลาเบล (Label Settings)
                    </span>

                    {/* 1. Label Type Selection */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">ประเภทป้ายที่จะพิมพ์ (Label Style)</label>
                      <div className="grid grid-cols-1 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setLabelType("seats")}
                          className={`p-2 rounded-lg text-left text-xs font-bold transition-all border ${labelType === "seats" ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"}`}
                        >
                          🪑 สติกเกอร์เก้าอี้ (Seat Stickers)
                        </button>
                        <button
                          type="button"
                          onClick={() => setLabelType("tables")}
                          className={`p-2 rounded-lg text-left text-xs font-bold transition-all border ${labelType === "tables" ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"}`}
                        >
                          🍽️ ป้ายตั้งโต๊ะ / แผนผัง (Table Tents)
                        </button>
                        <button
                          type="button"
                          onClick={() => setLabelType("all")}
                          className={`p-2 rounded-lg text-left text-xs font-bold transition-all border ${labelType === "all" ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"}`}
                        >
                          🗺️ ป้ายบอกทางโซน (Zone Direction Signs)
                        </button>
                      </div>
                    </div>

                    {/* 2. Zone Filter */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">เลือกพิมพ์ตามโซน (Filter Zone)</label>
                      <select
                        value={labelFilterZone}
                        onChange={(e) => setLabelFilterZone(e.target.value)}
                        className="w-full text-xs font-bold border border-slate-200 outline-none rounded-xl p-2 bg-slate-50 focus:bg-white"
                      >
                        <option value="ALL">ทุกโซน (All Zones)</option>
                        {activeZonesList.map((z: any) => (
                          <option key={z.id} value={z.id}>
                            โซน {z.name} (฿{z.pricePerSeat})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Conditional controls based on type */}
                    {labelType === "seats" && (
                      <>
                        <div className="flex items-center justify-between py-1">
                          <label className="text-[10px] font-bold text-slate-500">พิมพ์ชื่อผู้จองตั๋ว (Show Guest Name)</label>
                          <input
                            type="checkbox"
                            checked={includeGuestName}
                            onChange={(e) => setIncludeGuestName(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">คอลัมน์การแสดงผล (Grid Columns)</label>
                          <div className="grid grid-cols-3 gap-1">
                            {[2, 3, 4].map((cols) => (
                              <button
                                key={cols}
                                type="button"
                                onClick={() => setLabelColumns(cols)}
                                className={`py-1 rounded font-mono text-xs font-bold border ${labelColumns === cols ? "bg-slate-900 text-white border-slate-950" : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"}`}
                              >
                                {cols} แถว
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {labelType === "tables" && (
                      <div className="flex items-center justify-between py-1">
                        <label className="text-[10px] font-bold text-slate-500">พิมพ์ชื่อผู้จองในป้ายโต๊ะ (Show Seat Guests)</label>
                        <input
                          type="checkbox"
                          checked={includeGuestName}
                          onChange={(e) => setIncludeGuestName(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        />
                      </div>
                    )}

                    {labelType === "all" && (
                      <div className="space-y-4 border-t border-slate-100 pt-3">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            จัดการป้ายนำทาง ({directionSigns.length} ป้าย)
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const firstZone = activeZonesList[0];
                              if (!firstZone) return;
                              const zoneTables = tables.filter(t => t.zoneId === firstZone.id);
                              const newSign = {
                                id: `sign-${firstZone.id}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                                zoneId: firstZone.id,
                                arrowDir: "⬆",
                                tableIds: zoneTables.map(t => t.id).sort(),
                                note: `ทางเข้าโซน ${firstZone.name} (ป้ายเพิ่มเติม)`,
                              };
                              setDirectionSigns([...directionSigns, newSign]);
                              setEditingSignId(newSign.id);
                            }}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-100 flex items-center gap-0.5 transition-all"
                          >
                            <Plus className="w-3 h-3" /> เพิ่มป้ายใหม่
                          </button>
                        </div>

                        {/* Validation Indicator */}
                        <div className="text-[10px] rounded-xl border font-sans">
                          {(() => {
                            const duplicates: string[] = [];
                            const seen = new Set<string>();
                            directionSigns.forEach(sign => {
                              sign.tableIds.forEach((id: string) => {
                                if (seen.has(id)) {
                                  duplicates.push(id);
                                }
                                seen.add(id);
                              });
                            });

                            const missing: string[] = [];
                            const activeZoneIds = activeZonesList.map((z: any) => z.id);
                            const allActiveTables = tables.filter(t => activeZoneIds.includes(t.zoneId));
                            allActiveTables.forEach(t => {
                              const covered = directionSigns.some(sign => sign.tableIds.includes(t.id));
                              if (!covered) {
                                missing.push(t.id);
                              }
                            });

                            if (duplicates.length === 0 && missing.length === 0) {
                              return (
                                <div className="flex items-start gap-1.5 text-emerald-700 bg-emerald-50 border-emerald-200 p-2 rounded-xl">
                                  <span className="text-xs shrink-0">✅</span>
                                  <div>
                                    <p className="font-extrabold leading-tight">ข้อมูลป้ายสมบูรณ์และถูกต้อง</p>
                                    <p className="text-[8px] text-emerald-600 font-medium mt-0.5">ครอบคลุมทุกโต๊ะและไม่มีการนำทางซ้ำซ้อน</p>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div className="flex items-start gap-1.5 text-amber-700 bg-amber-50 border-amber-200 p-2 rounded-xl">
                                <span className="text-xs shrink-0">⚠️</span>
                                <div className="space-y-1">
                                  <p className="font-extrabold leading-tight">พบข้อสังเกตเรื่องความเชื่อมโยงข้อมูล</p>
                                  {duplicates.length > 0 && (
                                    <p className="text-[8px] text-amber-600 font-medium leading-normal">
                                      • <strong>มีโต๊ะซ้ำซ้อน:</strong> {duplicates.join(", ")}
                                    </p>
                                  )}
                                  {missing.length > 0 && (
                                    <p className="text-[8px] text-amber-600 font-medium leading-normal">
                                      • <strong>มีโต๊ะตกหล่น (ไม่มีป้ายชี้ไป):</strong> {missing.join(", ")}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Scrollable Sign List */}
                        <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                          {directionSigns.map((sign, idx) => {
                            const zone = activeZonesList.find((z: any) => z.id === sign.zoneId);
                            const isEditing = editingSignId === sign.id;
                            const signTables = tables.filter(t => sign.tableIds.includes(t.id));
                            const sortedTableIds = signTables.map(t => t.id).sort();

                            return (
                              <div
                                key={sign.id}
                                className={`border rounded-xl p-2.5 transition-all ${isEditing ? "border-slate-400 bg-slate-50/50" : "border-slate-200 hover:border-slate-300 bg-white"}`}
                              >
                                <div className="flex justify-between items-center gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: zone?.color || "#6366f1" }}
                                    />
                                    <div className="text-left">
                                      <p className="text-xs font-bold text-slate-800 leading-none">
                                        ป้าย {idx + 1}: โซน {zone?.name || sign.zoneId}
                                      </p>
                                      <p className="text-[9px] text-slate-400 mt-0.5 max-w-[120px] truncate">
                                        {sign.note || "ไม่มีรายละเอียดติดตั้ง"}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-xs font-bold text-slate-500 bg-slate-100 w-5.5 h-5.5 flex items-center justify-center rounded-lg border border-slate-200 font-mono">
                                      {sign.arrowDir}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setEditingSignId(isEditing ? null : sign.id)}
                                      className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 bg-white transition-all"
                                      title="แก้ไขป้าย"
                                    >
                                      <Edit2 className="w-2.5 h-2.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDirectionSigns(directionSigns.filter(s => s.id !== sign.id));
                                        if (editingSignId === sign.id) setEditingSignId(null);
                                      }}
                                      disabled={directionSigns.length <= 1}
                                      className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-slate-200 bg-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="ลบป้าย"
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Selected Tables Summary */}
                                {sign.customRangeText && sign.customRangeText.trim() !== "" && (
                                  <div className="mt-1 flex items-center gap-1 text-[8px] text-emerald-600 font-extrabold overflow-hidden">
                                    <span className="shrink-0">📝 ข้อความที่แสดง:</span>
                                    <span className="font-black truncate underline decoration-emerald-200">{sign.customRangeText}</span>
                                  </div>
                                )}
                                <div className="mt-1 flex items-center gap-1 text-[8px] text-slate-400 font-bold overflow-hidden">
                                  <span className="shrink-0">โต๊ะที่นำทาง ({sortedTableIds.length}):</span>
                                  {sortedTableIds.length === 0 ? (
                                    <span className="text-rose-500 font-bold shrink-0">⚠️ ไม่มีโต๊ะ</span>
                                  ) : (
                                    <span className="text-indigo-600 font-mono font-bold truncate">
                                      {sortedTableIds.join(", ")}
                                    </span>
                                  )}
                                </div>

                                {/* Inline Editor Form */}
                                {isEditing && (
                                  <div className="mt-2 border-t border-slate-200 pt-2 space-y-1.5 text-left animate-in fade-in duration-100">
                                    {/* Zone Dropdown */}
                                    <div className="space-y-0.5">
                                      <label className="text-[8px] font-bold text-slate-500">โซนประจำป้าย</label>
                                      <select
                                        value={sign.zoneId}
                                        onChange={(e) => {
                                          const nextZoneId = e.target.value;
                                          setDirectionSigns(directionSigns.map(s => {
                                            if (s.id === sign.id) {
                                              const zoneTables = tables.filter(t => t.zoneId === nextZoneId);
                                              return {
                                                ...s,
                                                zoneId: nextZoneId,
                                                tableIds: zoneTables.map(t => t.id).sort(),
                                                note: `ทางเข้าโซน ${activeZonesList.find((z: any) => z.id === nextZoneId)?.name || ""}`
                                              };
                                            }
                                            return s;
                                          }));
                                        }}
                                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-1 bg-white outline-none focus:border-slate-400"
                                      >
                                        {activeZonesList.map((z: any) => (
                                          <option key={z.id} value={z.id}>
                                            โซน {z.name} (ZONE {z.id})
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Arrow Dropdown */}
                                    <div className="space-y-0.5">
                                      <label className="text-[8px] font-bold text-slate-500">ทิศทางลูกศร</label>
                                      <select
                                        value={sign.arrowDir}
                                        onChange={(e) => {
                                          const nextArrowDir = e.target.value;
                                          setDirectionSigns(directionSigns.map(s => s.id === sign.id ? { ...s, arrowDir: nextArrowDir } : s));
                                        }}
                                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-1 bg-white outline-none focus:border-slate-400"
                                      >
                                        <option value="⬆">⬆ ตรงไป (Straight)</option>
                                        <option value="⬇">⬇ ถอยหลัง/ลงล่าง</option>
                                        <option value="⬅">⬅ เลี้ยวซ้าย (Left)</option>
                                        <option value="➡">➡ เลี้ยวขวา (Right)</option>
                                        <option value="↖">↖ เฉียงซ้ายบน</option>
                                        <option value="↗">↗ เฉียงขวาบน</option>
                                        <option value="↙">↙ เฉียงซ้ายล่าง</option>
                                        <option value="↘">↘ เฉียงขวาล่าง</option>
                                      </select>
                                    </div>

                                    {/* Note Input */}
                                    <div className="space-y-0.5">
                                      <label className="text-[8px] font-bold text-slate-500">สถานที่ติดตั้ง / รายละเอียดป้าย</label>
                                      <input
                                        type="text"
                                        value={sign.note || ""}
                                        onChange={(e) => {
                                          const nextNote = e.target.value;
                                          setDirectionSigns(directionSigns.map(s => s.id === sign.id ? { ...s, note: nextNote } : s));
                                        }}
                                        placeholder="เช่น ทางเข้าหลัก, เสาต้นที่ 2"
                                        className="w-full text-xs font-semibold border border-slate-200 rounded-lg p-1 bg-white outline-none focus:border-slate-400"
                                      />
                                    </div>

                                    {/* Custom Table Range Input */}
                                    <div className="space-y-0.5 bg-indigo-50/30 p-2 rounded-xl border border-indigo-100">
                                      <div className="flex justify-between items-center">
                                        <label className="text-[8px] font-black text-indigo-700">ช่วงโต๊ะที่แสดงบนป้ายแบบกำหนดเอง</label>
                                        <span className="text-[7px] text-slate-400 font-bold">เช่น T003 - T004</span>
                                      </div>
                                      <input
                                        type="text"
                                        value={sign.customRangeText || ""}
                                        onChange={(e) => {
                                          const nextCustomRange = e.target.value;
                                          setDirectionSigns(directionSigns.map(s => s.id === sign.id ? { ...s, customRangeText: nextCustomRange } : s));
                                        }}
                                        placeholder="เว้นว่างไว้เพื่อคำนวณอัตโนมัติ"
                                        className="w-full text-xs font-bold border border-slate-200 rounded-lg p-1 bg-white outline-none focus:border-slate-400 focus:ring-1 focus:ring-indigo-500"
                                      />
                                      <p className="text-[7px] text-slate-400 font-medium leading-normal mt-0.5">
                                        * ใช้สำหรับพิมพ์ทับข้อความบอกทาง เช่น ใส่ <strong>T003 - T004</strong> แล้วเอาโต๊ะ T005 ไปแยกใส่ป้ายถัดไป เพื่อไม่ให้ป้ายยาวเกินไป
                                      </p>
                                    </div>

                                    {/* Table Select Checkboxes */}
                                    <div className="space-y-1">
                                      <div className="flex justify-between items-center">
                                        <label className="text-[8px] font-bold text-slate-500">เลือกโต๊ะปลายทางที่ต้องการให้ชี้ไป</label>
                                        <div className="flex gap-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const zoneTables = tables.filter(t => t.zoneId === sign.zoneId);
                                              setDirectionSigns(directionSigns.map(s => s.id === sign.id ? { ...s, tableIds: zoneTables.map(t => t.id) } : s));
                                            }}
                                            className="text-[7px] font-bold text-indigo-600 hover:underline"
                                          >
                                            เลือกทั้งหมด
                                          </button>
                                          <span className="text-[7px] text-slate-300">|</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setDirectionSigns(directionSigns.map(s => s.id === sign.id ? { ...s, tableIds: [] } : s));
                                            }}
                                            className="text-[7px] font-bold text-slate-500 hover:underline"
                                          >
                                            ล้างทั้งหมด
                                          </button>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-3 gap-1 p-1.5 bg-slate-100 rounded-lg max-h-[80px] overflow-y-auto border border-slate-200">
                                        {tables
                                          .filter(t => t.zoneId === sign.zoneId)
                                          .map((table) => {
                                            const isChecked = sign.tableIds.includes(table.id);
                                            return (
                                              <label
                                                key={table.id}
                                                className={`flex items-center gap-1 p-0.5 rounded text-[8px] font-bold cursor-pointer transition-all ${isChecked ? "bg-white text-indigo-600 shadow-xs border border-indigo-50" : "text-slate-500 hover:bg-slate-200"}`}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={(e) => {
                                                    const nextTableIds = e.target.checked
                                                      ? [...sign.tableIds, table.id].sort()
                                                      : sign.tableIds.filter(id => id !== table.id);
                                                    setDirectionSigns(directionSigns.map(s => s.id === sign.id ? { ...s, tableIds: nextTableIds } : s));
                                                  }}
                                                  className="w-2.5 h-2.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0"
                                                />
                                                {table.id}
                                              </label>
                                            );
                                          })}
                                      </div>
                                    </div>

                                    {/* Close Button */}
                                    <button
                                      type="button"
                                      onClick={() => setEditingSignId(null)}
                                      className="w-full py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-[9px] transition-all"
                                    >
                                      ตกลง
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-6 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all active:scale-95 text-center"
                >
                  ย้อนกลับ (Close)
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  พิมพ์รายงาน PDF
                </button>
              </div>

            </div>

            {/* Right WYSIWYG Document Viewer (Desktop Styled Page Box) */}
            <div className="flex-1 bg-slate-700/60 p-6 md:p-8 overflow-y-auto flex justify-center items-start border-l border-slate-200 select-none">
              
              {/* Paper Box mimicking A4 Sheet */}
              <div className="bg-white w-[794px] min-h-[1123px] shadow-2xl p-10 relative rounded-lg text-slate-800 scale-90 md:scale-100 origin-top shrink-0 flex flex-col justify-between font-sans">
                
                <div>
                  {/* Mock print header */}
                  <div className="border-b-2 border-slate-900 pb-4 mb-5 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-black rounded tracking-wider uppercase">
                          OFFICIAL REPORT PREVIEW
                        </span>
                        <span className="text-slate-400 text-[10px] font-mono font-bold">
                          PREVIEW ID #{Math.sin(tables.length + tickets.length + (surveys?.length || 0)).toString(36).substring(3, 9).toUpperCase()}
                        </span>
                      </div>
                      <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1 font-sans">
                        {reportTitle || "รายงานและสรุปข้อมูลสถิติของกิจกรรม"}
                      </h1>
                      <p className="text-[10px] text-slate-400 font-medium font-sans">
                        ออกเอกสารวิเคราะห์ข้อมูลแบบบูรณาการผ่าน EventTicketingPro Intelligence Console 
                      </p>
                    </div>
                    <div className="text-right font-mono text-[9px] text-slate-400 select-none">
                      <div>วันที่ประมวลผล: {new Date().toLocaleDateString("th-TH")}</div>
                      <div>เวลาดึงข้อมูล: {new Date().toLocaleTimeString("th-TH")}</div>
                      <div className="font-bold text-slate-700">พิมพ์ผ่านเครื่อง: แอดมิน</div>
                    </div>
                  </div>

                  {/* System metadata */}
                  <div className="grid grid-cols-4 bg-slate-50 rounded-xl p-3 gap-3 mb-5 border border-slate-100 text-xs">
                    <div className="text-center border-r border-slate-200">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">
                        ชื่อกิจกรรม
                      </span>
                      <span className="text-xs font-black text-slate-800 line-clamp-1">
                        {localConfig.eventName}
                      </span>
                    </div>
                    <div className="text-center border-r border-slate-200">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">
                        ความจุรวมทั้งพัง
                      </span>
                      <span className="text-xs font-black text-slate-800 font-mono">
                        {totalSeats} ที่นั่ง ({tables.length} โต๊ะ)
                      </span>
                    </div>
                    <div className="text-center border-r border-slate-200">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">
                        รูปแบบระบบผผัง
                      </span>
                      <span className="text-xs font-black text-slate-800 capitalize">
                        {localConfig.layoutStyle === "banquet" ? "โต๊ะจีน (Banquet)" : localConfig.layoutStyle === "classroom" ? "ชั้นเรียน (Classroom)" : localConfig.layoutStyle === "chevron" ? "เฉลียง (Chevron)" : localConfig.layoutStyle}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">
                        ความปลอดภัย
                      </span>
                      <span className="text-xs font-black text-emerald-600 block uppercase">
                        REALTIME SECURE
                      </span>
                    </div>
                  </div>

                  {/* Dynamic sections in WYSIWYG Mockup previews */}
                  {reportType === "summary" && (
                    <div className="space-y-5 text-sm">
                      {/* Bento kpis */}
                      <div>
                        <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1 mb-2.5">
                          สรุปตัวชี้วัดความจุสะสมและยอดจอง (Summary KPIs)
                        </h2>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div className="border border-slate-100 rounded-lg p-2.5 bg-slate-50/50">
                            <span className="text-[9px] font-bold text-slate-400 block">ยอดขายที่นั่ง (Seats Sold)</span>
                            <span className="text-base font-black text-slate-800 mt-0.5 block">{paidSeatsCount} / {totalSeats}</span>
                            <span className="text-[9px] text-slate-500 font-semibold">{Math.round((paidSeatsCount / (totalSeats || 1)) * 100)}% อัตราจองสะสม</span>
                          </div>
                          <div className="border border-slate-100 rounded-lg p-2.5 bg-slate-50/50">
                            <span className="text-[9px] font-bold text-slate-400 block">รายได้เงินสดรับจริงทั้งหมด</span>
                            <span className="text-base font-black text-slate-800 mt-0.5 block">฿{displayRevenue.toLocaleString()}</span>
                            <span className="text-[9px] text-slate-400 block">เฉลี่ย ฿{paidSeatsCount ? Math.round(displayRevenue / paidSeatsCount).toLocaleString() : 0} ต่อที่นั่ง</span>
                          </div>
                          <div className="border border-slate-100 rounded-lg p-2.5 bg-slate-50/50">
                            <span className="text-[9px] font-bold text-slate-400 block">สปอนเซอร์และ Comp Ticket</span>
                            <span className="text-base font-black text-rose-600 mt-0.5 block font-mono">฿{totalSponsorValue.toLocaleString()}</span>
                            <span className="text-[9px] text-slate-400 block font-semibold">ออกบัตรแจกฟรีรวม: {tickets.filter(t => t.isSponsor).reduce((sum, t) => sum + t.seatIds.length, 0)} ที่นั่ง</span>
                          </div>
                        </div>
                      </div>

                      {/* Zones table preview */}
                      <div>
                        <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1 mb-2">
                          ความหนาแน่นและยอดรายได้แยกตามโซน (Zonal Summary Ledger)
                        </h2>
                        <table className="w-full text-left font-sans text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-600 text-[9px] uppercase font-bold text-left border-b border-slate-200">
                              <th className="p-1.5 font-bold">ชื่อโซน</th>
                              <th className="p-1.5 text-right font-bold">ราคาตั๋ว</th>
                              <th className="p-1.5 text-center font-bold">โต๊ะจอง</th>
                              <th className="p-1.5 text-center font-bold">ความจุ</th>
                              <th className="p-1.5 text-center font-bold">ที่นั่งขายแล้ว</th>
                              <th className="p-1.5 text-right font-bold">ยอดเงินโซน</th>
                              <th className="p-1.5 text-center font-bold">อัตราความหนา %</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-[11px]">
                            {zoneStats.map((z) => {
                              const percent = Math.round((z.soldSeats / (z.totalSeats || 1)) * 100);
                              return (
                                <tr key={z.id}>
                                  <td className="p-1.5 font-semibold text-slate-800">{z.name}</td>
                                  <td className="p-1.5 text-right font-mono">฿{z.pricePerSeat.toLocaleString()}</td>
                                  <td className="p-1.5 text-center font-bold">{z.tablesCount}</td>
                                  <td className="p-1.5 text-center text-slate-400">{z.totalSeats}</td>
                                  <td className="p-1.5 text-center font-black">
                                    {z.soldSeats} {z.sponsorsCount > 0 && <span className="text-rose-500 text-[9px] font-bold">(Comp: {z.sponsorsCount})</span>}
                                  </td>
                                  <td className="p-1.5 text-right font-black">฿{z.revenue.toLocaleString()}</td>
                                  <td className="p-1.5 text-center">
                                    <span className={`px-1 rounded text-[9px] font-black ${percent >= 75 ? "text-emerald-700 bg-emerald-50" : percent >= 30 ? "text-amber-700 bg-amber-50" : "text-slate-500 bg-slate-50"}`}>
                                      {percent}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Evaluations scores */}
                      <div>
                        <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1 mb-2">
                          วิเคราะห์เฉลี่ยแบบสอบถาม (Satisfaction Indicator Metrics)
                        </h2>
                        <table className="w-full text-left font-sans text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-600 text-[9px] uppercase font-bold text-left border-b border-slate-200">
                              <th className="p-1.5 font-bold">หัวข้อตรวจสอบกระบวนการ</th>
                              <th className="p-1.5 text-center font-bold">ยอดผู้ตอบประเมิน</th>
                              <th className="p-1.5 text-center font-bold">คะแนนเฉลี่ยประเมิน</th>
                              <th className="p-1.5 text-center font-bold">สถานะผลลัพธ์</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-[11px]">
                            {SURVEY_TOPICS.map((topic) => {
                              const scores = surveys ? surveys.map((s) => s.ratings[topic.id]).filter((v) => v != null) : [];
                              const count = scores.length;
                              const avg = count ? scores.reduce((a, b) => a + b, 0) / count : 0;
                              let statusLabel = "ต้องการดัดแปลง";
                              let clrStyle = "text-rose-600 bg-rose-50";
                              if (avg >= 2.5) {
                                statusLabel = "ดีเลิศโดดเด่น";
                                clrStyle = "text-emerald-700 bg-emerald-50";
                              } else if (avg >= 1.8) {
                                statusLabel = "ผ่านระดับดี";
                                clrStyle = "text-amber-700 bg-amber-50";
                              }
                              return (
                                <tr key={topic.id}>
                                  <td className="p-1.5 font-semibold text-slate-800">{topic.label}</td>
                                  <td className="p-1.5 text-center">{count} คน</td>
                                  <td className="p-1.5 text-center font-black text-rose-600 font-mono">{avg ? avg.toFixed(2) : "0.00"} / 3.00</td>
                                  <td className="p-1.5 text-center">
                                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${clrStyle}`}>
                                      {statusLabel}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {reportType === "attendees" && (
                    <div className="text-xs">
                      <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1 mb-2">
                        ทะเบียนผู้ลงทะเบียนบัตรทั้งหมด (Registration ledger list preview)
                      </h2>
                      <table className="w-full text-left font-sans border-collapse hover:bg-slate-50/10">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 text-[9px] uppercase font-bold text-left border-b border-slate-200">
                            <th className="p-1.5">No.</th>
                            <th className="p-1.5">รหัสตั๋ว</th>
                            <th className="p-1.5">ชื่อลูกค้าผู้จอง</th>
                            <th className="p-1.5">เบอร์โทรและช่องทางติดต่อ</th>
                            <th className="p-1.5 text-center">ผังที่นั่ง</th>
                            <th className="p-1.5 text-right font-bold">ยอดรับสุทธิ</th>
                            <th className="p-1.5 text-center">สถานะ</th>
                            <th className="p-1.5 text-center">เช็คอิน</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[10px]">
                          {sortedTickets.slice(0, 15).map((t, index) => {
                            const checkInText = t.checkedInSeats?.length
                              ? `${t.checkedInSeats.length} / ${t.seatIds.length}`
                              : "0 / " + t.seatIds.length;
                            return (
                              <tr key={t.id}>
                                <td className="p-1.5 text-slate-400 font-bold font-mono">{index + 1}</td>
                                <td className="p-1.5 font-mono text-slate-800 uppercase font-bold">{t.id.slice(0, 8)}</td>
                                <td className="p-1.5 text-slate-800 font-semibold">{t.userName}</td>
                                <td className="p-1.5 text-slate-500">{t.phone}</td>
                                <td className="p-1.5 text-center font-bold">โต๊ะ {t.tableId} ({t.seatIds.join(", ")})</td>
                                <td className="p-1.5 text-right font-black font-mono">฿{t.totalAmount.toLocaleString()}</td>
                                <td className="p-1.5 text-center">
                                  <span className={`px-1 rounded text-[8px] font-black uppercase ${t.status === "paid" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                                    {t.status === "paid" ? "PAID" : "PENDING"}
                                  </span>
                                </td>
                                <td className="p-1.5 text-center font-semibold text-rose-600">
                                  {t.checkedInSeats && t.checkedInSeats.length > 0 ? (
                                    <span className="text-emerald-700">✓ {checkInText}</span>
                                  ) : (
                                    <span>{checkInText}</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {tickets.length > 15 && (
                            <tr>
                              <td colSpan={8} className="p-3 text-center text-[10px] text-slate-400 italic bg-slate-50 font-sans font-bold">
                                --- แสดงพรีวิวรายชื่อจำลอง 15 แถวแรกเท่านั้น (ของจริงเอกสาร PDF จะดึงพิมพ์ออกสถิติครบทั้งหมด {tickets.length} แถว) ---
                              </td>
                            </tr>
                          )}
                          {tickets.length === 0 && (
                            <tr>
                              <td colSpan={8} className="p-6 text-center text-slate-400 font-sans font-black">
                                ไม่มีผู้จองใด ๆ ในระบบ ณ ปัจจุบัน
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {reportType === "survey" && (
                    <div className="space-y-4 text-xs">
                      <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1 mb-2">
                        กระดานข้อเสนอแนะตัวจริงจากผู้ประเมินผลความพึงพอใจโครงการ (All Feedback Stream comments)
                      </h2>
                      <table className="w-full text-left font-sans border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 text-[9px] uppercase font-bold text-left border-b border-slate-200">
                            <th className="p-1.5">วันและเวลาจารึก</th>
                            <th className="p-1.5">ชื่อผู้ประเมิน</th>
                            <th className="p-1.5 text-center">พิกัดที่นั่ง</th>
                            <th className="p-1.5 text-center">เฉลี่ยดาว</th>
                            <th className="p-1.5 cursor-default">ข้อเสนอแนะเพิ่มเติมตัวอักษรจริง</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          {processedSurveys
                            .filter((s) => s.comment?.trim())
                            .slice(0, 10)
                            .map((s, idx) => (
                              <tr key={s.id || idx}>
                                <td className="p-1.5 text-slate-400 font-mono text-[10px]">
                                  {new Date(s.timestamp).toLocaleDateString("th-TH")}<br />{new Date(s.timestamp).toLocaleTimeString("th-TH")}
                                </td>
                                <td className="p-1.5 font-bold text-slate-800">{s.guestName}</td>
                                <td className="p-1.5 text-center text-slate-400 font-bold">{s.tableSeatInfo}</td>
                                <td className="p-1.5 text-center">
                                  <span className={`px-1.5 py-0.2 rounded text-[8px] font-black ${s.avgRating >= 2.5 ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>
                                    {s.avgRating.toFixed(2)} / 3.00
                                  </span>
                                </td>
                                <td className="p-1.5 italic font-bold text-slate-800 font-sans leading-relaxed max-w-xs break-all">
                                  "{s.comment}"
                                </td>
                              </tr>
                            ))}
                          {processedSurveys.filter((s) => s.comment?.trim()).length > 10 && (
                            <tr>
                              <td colSpan={5} className="p-3 text-center text-[10px] text-slate-400 italic bg-slate-50 font-sans font-bold">
                                --- แสดงพรีวิวสัญญลักษณ์ข้อคิดเห็นชุดแรก 10 รายการเพื่อการจัดขนาดกล่องพรีวิว (ชุดจริงจะปรู๊ฟหน้าเวิร์กพริ๊นท์ครบทั้งหมด) ---
                              </td>
                            </tr>
                          )}
                          {processedSurveys.filter((s) => s.comment?.trim()).length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-6 text-center text-slate-400 font-sans font-black">
                                ไม่มีผู้ประเมินพิมพ์ข้อมูลเสนอแนะเพิ่มเติมในขณะนี้
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {reportType === "labels" && labelType === "seats" && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <h3 className="text-sm font-black text-slate-800">
                          🪑 สติกเกอร์เก้าอี้ (Seat Stickers) - {labelFilterZone === "ALL" ? "ทุกโซน" : `โซน ${labelFilterZone}`}
                        </h3>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                          พรีวิวสูงสุด 24 ดวง (พิมพ์จริงจะแสดงครบทั้งหมด)
                        </span>
                      </div>
                      <div className={`grid gap-3 ${
                        labelColumns === 2 ? "grid-cols-2" : labelColumns === 4 ? "grid-cols-4" : "grid-cols-3"
                      }`}>
                        {(() => {
                          const seatLabels: any[] = [];
                          tables.forEach(table => {
                            if (labelFilterZone !== "ALL" && table.zoneId !== labelFilterZone) return;
                            const zoneObj = activeZonesList.find((z: any) => z.id === table.zoneId);
                            const zoneName = zoneObj?.name || table.zoneId;
                            
                            table.seats.forEach(seat => {
                              const matchedTicket = tickets.find(t => 
                                t.tableId === table.id && 
                                t.seatIds.includes(seat.id) && 
                                (t.status === "paid" || t.status === "slip_verified")
                              );
                              seatLabels.push({
                                tableId: table.id,
                                seatId: seat.id,
                                zoneId: table.zoneId,
                                zoneName,
                                buyerName: matchedTicket?.userName || "",
                                status: seat.status,
                                price: zoneObj?.pricePerSeat || 0
                              });
                            });
                          });

                          if (seatLabels.length === 0) {
                            return (
                              <div className="col-span-full text-center py-8 text-xs font-bold text-slate-400">
                                ไม่พบเก้าอี้ที่ตรงตามเงื่อนไขตัวกรองโซน
                              </div>
                            );
                          }

                          const previewLabels = seatLabels.slice(0, 24);

                          return (
                            <>
                              {previewLabels.map((lbl, idx) => (
                                <div 
                                  key={idx} 
                                  className="border-2 border-dashed border-slate-300 rounded-xl p-3 bg-white hover:bg-slate-50 relative overflow-hidden transition-all flex flex-col justify-between h-28 text-left"
                                >
                                  <div 
                                    className="absolute top-0 left-0 right-0 h-1"
                                    style={{ 
                                      backgroundColor: activeZonesList.find((z: any) => z.id === lbl.zoneId)?.color || "#6366f1" 
                                    }}
                                  />
                                  <div className="flex justify-between items-start pt-0.5">
                                    <span className="text-[8px] font-black tracking-wider text-slate-400 uppercase">
                                      โซน {lbl.zoneName}
                                    </span>
                                    <span className="text-[8px] font-mono font-bold text-slate-400 bg-slate-100 px-1 rounded">
                                      ฿{lbl.price.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="my-1 text-center">
                                    <div className="text-[11px] font-black text-slate-800 tracking-tight">
                                      โต๊ะ <span className="text-rose-600 text-xs">{lbl.tableId}</span> - เก้าอี้ <span className="text-indigo-600 text-xs font-black">#{lbl.seatId}</span>
                                    </div>
                                  </div>
                                  <div className="border-t border-slate-100 pt-1 flex justify-between items-center">
                                    <span className="text-[8px] text-slate-500 font-bold truncate max-w-[65%]">
                                      {includeGuestName && lbl.buyerName ? `👤 ${lbl.buyerName}` : "👤 ผู้ถือตั๋ว"}
                                    </span>
                                    <span className={`text-[7px] font-black px-1 rounded uppercase ${
                                      lbl.buyerName ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-400"
                                    }`}>
                                      {lbl.buyerName ? "จองแล้ว" : "ว่าง"}
                                    </span>
                                  </div>
                                </div>
                              ))}
                              {seatLabels.length > 24 && (
                                <div className="col-span-full border border-slate-200 bg-slate-50 text-slate-500 font-medium text-[9px] text-center p-1.5 rounded-lg italic">
                                  --- แสดงพรีวิวหน้าจอสูงสุด 24 ดวงสติกเกอร์ (ในการพิมพ์ PDF หรือพิมพ์กระดาษจริงจะพิมพ์ออกมาครบทุกเก้าอี้ทั้งสิ้น {seatLabels.length} ดวง) ---
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {reportType === "labels" && labelType === "tables" && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <h3 className="text-sm font-black text-slate-800">
                          🍽️ ป้ายตั้งโต๊ะพร้อมแผนผังที่นั่ง (Table Tents & Layout) - {labelFilterZone === "ALL" ? "ทุกโซน" : `โซน ${labelFilterZone}`}
                        </h3>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                          พรีวิวสูงสุด 4 โต๊ะ (พิมพ์จริงจะแสดงครบทั้งหมด)
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {(() => {
                          const matchingTables = tables.filter(t => labelFilterZone === "ALL" || t.zoneId === labelFilterZone);

                          if (matchingTables.length === 0) {
                            return (
                              <div className="text-center py-8 text-xs font-bold text-slate-400">
                                ไม่พบโต๊ะที่ตรงตามเงื่อนไขตัวกรองโซน
                              </div>
                            );
                          }

                          const previewTables = matchingTables.slice(0, 4);

                          return (
                            <>
                              {previewTables.map((table) => {
                                const zoneObj = activeZonesList.find((z: any) => z.id === table.zoneId);
                                const zoneName = zoneObj?.name || table.zoneId;
                                const zoneColor = zoneObj?.color || "#6366f1";
                                const seatsCount = table.seats.length;

                                return (
                                  <div 
                                    key={table.id} 
                                    className="border-2 border-dashed border-slate-300 rounded-2xl p-4 bg-white relative overflow-hidden flex flex-col sm:flex-row gap-4 items-center justify-between"
                                  >
                                    <div className="absolute top-2 left-2 text-[8px] text-slate-300 font-bold tracking-widest uppercase">
                                      [พับครึ่งสำหรับตั้งโต๊ะ / Fold Here for Table Tent]
                                    </div>
                                    
                                    <div className="flex-1 w-full text-left space-y-2 z-10 pt-2">
                                      <div>
                                        <span className="px-2 py-0.5 rounded text-[9px] font-black tracking-wider text-white" style={{ backgroundColor: zoneColor }}>
                                          ZONE {zoneName}
                                        </span>
                                        <h2 className="text-xl font-black text-slate-900 mt-1 tracking-tight">
                                          โต๊ะ {table.id}
                                        </h2>
                                        <p className="text-[10px] text-slate-400 font-medium">
                                          {localConfig.eventName || "Event Ticketing Pro Showcase"}
                                        </p>
                                      </div>

                                      <div className="space-y-1">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">รายชื่อผู้จองตั๋ว (Guests assigned)</span>
                                        <div className="grid grid-cols-2 gap-1 text-[9px]">
                                          {table.seats.map(seat => {
                                            const matchedTicket = tickets.find(t => 
                                              t.tableId === table.id && 
                                              t.seatIds.includes(seat.id) && 
                                              (t.status === "paid" || t.status === "slip_verified")
                                            );
                                            return (
                                              <div key={seat.id} className="flex items-center gap-1 border border-slate-50 bg-slate-50/50 p-1 rounded">
                                                <span className="font-bold text-indigo-600 font-mono">#{seat.id}</span>
                                                <span className="truncate max-w-[70px] font-semibold text-slate-700">
                                                  {includeGuestName && matchedTicket ? matchedTicket.userName : seat.status === "paid" ? "จองแล้ว" : "ว่าง"}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex-1 flex flex-col items-center justify-center space-y-1 z-10">
                                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                                        ผังจำลองเก้าอี้ประจำโต๊ะ
                                      </span>
                                      
                                      <div className="relative w-28 h-28 border border-slate-100 bg-slate-50/30 rounded-full flex items-center justify-center">
                                        <div className="w-12 h-12 bg-white border rounded-full flex flex-col items-center justify-center shadow-sm" style={{ borderColor: zoneColor }}>
                                          <span className="text-[10px] font-black text-slate-800">{table.id}</span>
                                        </div>

                                        {table.seats.map((seat, sIdx) => {
                                          const angle = (sIdx * 360) / seatsCount;
                                          const radius = 38;
                                          const x = Math.sin((angle * Math.PI) / 180) * radius;
                                          const y = -Math.cos((angle * Math.PI) / 180) * radius;
                                          
                                          const isPaid = seat.status === "paid";
                                          return (
                                            <div 
                                              key={seat.id}
                                              className="absolute w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border transition-all"
                                              style={{
                                                transform: `translate(${x}px, ${y}px)`,
                                                backgroundColor: isPaid ? zoneColor : "#ffffff",
                                                color: isPaid ? "#ffffff" : "#64748b",
                                                borderColor: isPaid ? zoneColor : "#cbd5e1"
                                              }}
                                            >
                                              {seat.id}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {matchingTables.length > 4 && (
                                <div className="border border-slate-200 bg-slate-50 text-slate-500 font-medium text-[9px] text-center p-1.5 rounded-lg italic">
                                  --- แสดงพรีวิวหน้าจอสูงสุด 4 ผังโต๊ะ (ในการพิมพ์ PDF หรือพิมพ์กระดาษจริงจะพิมพ์ออกมาครบทุกโต๊ะทั้งสิ้น {matchingTables.length} โต๊ะ) ---
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {reportType === "labels" && labelType === "all" && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <h3 className="text-sm font-black text-slate-800">
                          🗺️ ป้ายนำทางและป้ายบอกทางประจำโซน (Zone Direction Signs)
                        </h3>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                          จัดหน้าละ 1 ป้ายสำหรับการพิมพ์ (A4 Page Block)
                        </span>
                      </div>
                      <div className="space-y-4">
                        {(() => {
                          const filteredSigns = directionSigns.filter(sign => {
                            if (labelFilterZone === "ALL") return true;
                            return sign.zoneId === labelFilterZone;
                          });

                          if (filteredSigns.length === 0) {
                            return (
                              <div className="text-center py-12 text-slate-400 font-bold text-xs">
                                ไม่มีข้อมูลป้ายนำทางที่สร้างไว้สำหรับโซนที่เลือก
                              </div>
                            );
                          }

                          // Group counts for indexes
                          const zoneCounts: Record<string, number> = {};

                          return (
                            <>
                              {filteredSigns.map((sign) => {
                                const zone = activeZonesList.find((z: any) => z.id === sign.zoneId);
                                if (!zone) return null;

                                zoneCounts[sign.zoneId] = (zoneCounts[sign.zoneId] || 0) + 1;
                                const signIndex = zoneCounts[sign.zoneId];

                                const signTables = tables.filter(t => sign.tableIds.includes(t.id));
                                const sortedTableIds = signTables.map(t => t.id).sort();

                                let tablesDisplayText = "";
                                if (sign.customRangeText && sign.customRangeText.trim() !== "") {
                                  tablesDisplayText = sign.customRangeText.trim();
                                } else if (sortedTableIds.length > 0) {
                                  const isConsecutive = sortedTableIds.every((id, i) => {
                                    if (i === 0) return true;
                                    const prevNum = parseInt(sortedTableIds[i-1].replace(/\D/g, ''));
                                    const currNum = parseInt(id.replace(/\D/g, ''));
                                    return currNum === prevNum + 1;
                                  });
                                  if (isConsecutive && sortedTableIds.length > 1) {
                                    tablesDisplayText = `หมายเลข ${sortedTableIds[0]} ถึง ${sortedTableIds[sortedTableIds.length - 1]} (${sortedTableIds.length} โต๊ะ)`;
                                  } else {
                                    tablesDisplayText = `หมายเลข ${sortedTableIds.join(", ")} (${sortedTableIds.length} โต๊ะ)`;
                                  }
                                } else {
                                  tablesDisplayText = "ไม่มีโต๊ะที่กำหนดประจำป้ายนี้";
                                }

                                return (
                                  <div 
                                    key={sign.id} 
                                    className="border-2 border-dashed border-slate-400 rounded-3xl p-6 bg-white flex flex-col items-center justify-between text-center min-h-[250px]"
                                  >
                                    <div className="w-full flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[8px] font-black text-slate-400 tracking-widest uppercase">
                                          OFFICIAL EVENT DIRECTIONAL SIGN
                                        </span>
                                        <span className="text-[8px] font-black text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                          รหัสป้าย: SG-{zone.id}-{signIndex}
                                        </span>
                                      </div>
                                      <span className="text-[8px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                        {localConfig.eventName || "Event Ticketing Pro"}
                                      </span>
                                    </div>

                                    <div className="my-2 flex justify-center items-center">
                                      <div className="animate-bounce">
                                        <RenderCustomArrow 
                                          direction={sign.arrowDir} 
                                          className="w-16 h-16 transition-all duration-300" 
                                          style={{ color: zone.color }} 
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <h2 className="text-lg font-black text-slate-900 tracking-tight">
                                        โซน {zone.name} (ZONE {zone.id})
                                      </h2>
                                      {sign.note && (
                                        <p className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full inline-block">
                                          📍 จุดติดตั้ง: {sign.note}
                                        </p>
                                      )}
                                      <p className="text-xs font-bold text-slate-600">
                                        {signTables.length > 0 || (sign.customRangeText && sign.customRangeText.trim() !== "")
                                          ? (sign.customRangeText && sign.customRangeText.trim() !== "")
                                            ? `ทางไป: กลุ่มโต๊ะหมายเลข ${tablesDisplayText}`
                                            : `ทางไป: กลุ่มโต๊ะ${tablesDisplayText}`
                                          : "ไม่มีโต๊ะที่นั่งจัดสรรในป้ายนี้"}
                                      </p>
                                      <p className="text-[9px] text-slate-400 font-medium">
                                        กรุณาแสดงตั๋ว QR-Code แก่พนักงานเพื่อแสกนเช็คอินก่อนเข้าที่นั่งประจำตั๋ว
                                      </p>
                                    </div>

                                    <div className="w-full border-t border-slate-100 pt-3 mt-4 flex justify-between items-center text-[8px] text-slate-400 font-bold font-sans">
                                      <div className="flex flex-col items-start text-left gap-1">
                                        <span>ที่นั่งทั้งหมด: {signTables.reduce((acc, t) => acc + t.seats.length, 0)} ที่นั่ง</span>
                                        <span className="text-[8px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md mt-1">
                                          รหัสอ้างอิงตำแหน่งป้ายนี้: <strong className="text-rose-600 font-black text-[10px]">SG-{zone.id}-{signIndex}</strong>
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 border border-emerald-100 rounded-lg p-1 bg-emerald-50/40 max-w-[170px] select-none text-right">
                                        <div className="text-right flex flex-col justify-center">
                                          <span className="text-[7px] text-slate-500 font-bold leading-tight block">
                                            หากหลงทาง/ไม่พบโต๊ะ ติดต่อเจ้าหน้าที่
                                          </span>
                                          <span className="text-[8px] text-emerald-600 font-black leading-tight block">
                                            {(() => {
                                              const lineLink = localConfig.lineGroupLink || "https://line.me/R/ti/p/@792zqqbw";
                                              if (lineLink.includes("@792zqqbw") || lineLink.includes("digitecteam")) {
                                                return "LINE: @792zqqbw (digitecteam)";
                                              }
                                              const match = lineLink.match(/@[a-zA-Z0-9_-]+/);
                                              if (match) return `LINE: ${match[0]}`;
                                              const lastPart = lineLink.split('/').filter(Boolean).pop() || "digitecteam";
                                              return `LINE: ${lastPart.startsWith('@') ? lastPart : `@${lastPart}`}`;
                                            })()}
                                          </span>
                                        </div>
                                        <img 
                                          src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(localConfig.lineGroupLink || "https://line.me/R/ti/p/@792zqqbw")}`} 
                                          alt="LINE OA QR Code" 
                                          className="w-9 h-9 object-contain rounded bg-white border border-emerald-100 p-0.5 shrink-0 shadow-sm"
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Simulated doc footer signature */}
                <div className="mt-8 pt-4 border-t border-slate-100 grid grid-cols-2 text-slate-400 text-[8px] select-none font-sans">
                  <div>
                    <span className="font-bold block text-slate-500 mb-0.5">การรับประกันคุณภาพสถิตินี้</span>
                    <span>เชื่อมต่อโดยตรงกับระบบการปรู๊ฟฐานรายงานสำนิกงาน EventTicketingPro Admin Suite เอกสารไม่รับรู้นอกวงทางการสอบสวนส่วนบุคคล</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold block text-slate-500 mb-0.5">ฝ่ายรับประกันความเสถียรข้อมูล</span>
                    <span>ลงชื่อ: ................................................................ ตัวแทนผู้พิมพ์</span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {customConfirm && customConfirm.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-scale-up">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
              customConfirm.colorType === 'rose' ? 'bg-rose-50 text-rose-600' :
              customConfirm.colorType === 'amber' ? 'bg-amber-50 text-amber-600' :
              customConfirm.colorType === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
              'bg-slate-50 text-slate-600'
            }`}>
              {customConfirm.colorType === 'rose' ? (
                <ShieldAlert className="w-6 h-6" />
              ) : (
                <span className="text-xl font-bold font-sans">?</span>
              )}
            </div>
            <h4 className="text-lg font-bold text-slate-800 mb-2 font-sans">
              {customConfirm.title}
            </h4>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed font-sans">
              {customConfirm.message}
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                disabled={isConfirmProcessing}
                onClick={() => setCustomConfirm(null)}
                className="sm:flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-bold rounded-xl text-sm transition-all active:scale-95 font-sans whitespace-nowrap"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isConfirmProcessing}
                onClick={async () => {
                  setIsConfirmProcessing(true);
                  try {
                    await customConfirm.onConfirm();
                  } catch (e) {
                    console.error("Error in onConfirm:", e);
                  } finally {
                    setIsConfirmProcessing(false);
                    setCustomConfirm(null);
                  }
                }}
                className={`sm:flex-1 px-5 py-3 text-white font-bold rounded-xl text-sm shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-2 font-sans whitespace-nowrap ${
                  customConfirm.colorType === 'rose' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' :
                  customConfirm.colorType === 'amber' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' :
                  customConfirm.colorType === 'indigo' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' :
                  'bg-slate-700 hover:bg-slate-800 shadow-slate-200'
                }`}
              >
                {isConfirmProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>กำลังดำเนินการ...</span>
                  </>
                ) : (
                  customConfirm.confirmText
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customize Admin Menu Bar Order Modal */}
      {showTabOrderModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9998]">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/60">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 leading-snug">
                    ปรับแต่งลำดับเมนูบาร์แอดมิน
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    ลากวางที่แถบเมนู หรือใช้ปุ่มลูกศร ขึ้น / ลง เพื่อเรียงลำดับแท็บที่ใช้งานบ่อยให้อยู่ด้านหน้า
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSavingTabOrder}
                onClick={() => setShowTabOrderModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition shrink-0 disabled:opacity-50"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Preview Bar */}
            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  ตัวอย่างการแสดงผลเมนูบาร์จริง
                </span>
                {isDraftTabsDirty ? (
                  <span className="text-[11px] font-bold text-amber-600">
                    มีการปรับลำดับใหม่ (รอการบันทึก)
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400">
                    ตรงกับลำดับที่ใช้งานอยู่
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {draftTabsOrder.map((tabId, idx) => {
                  const meta = ADMIN_TABS_BY_ID[tabId];
                  if (!meta) return null;
                  const isCurrentTab = activeTab === tabId;
                  return (
                    <div
                      key={tabId}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold whitespace-nowrap shrink-0 transition-all ${
                        isCurrentTab
                          ? "bg-rose-50 border-rose-200 text-rose-700"
                          : "bg-white border-slate-200 text-slate-600"
                      }`}
                    >
                      <span className="text-[10px] font-extrabold text-slate-400 tabular-nums">
                        {idx + 1}.
                      </span>
                      {meta.renderIcon("w-3 h-3 shrink-0")}
                      <span>{meta.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reorderable List */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-2.5 flex-1">
              {draftTabsOrder.map((tabId, index) => {
                const meta = ADMIN_TABS_BY_ID[tabId];
                if (!meta) return null;
                const isDragged = draggedTabId === tabId;
                const isDropTarget = dragOverTabId === tabId && draggedTabId !== tabId;
                const isFirst = index === 0;
                const isLast = index === draftTabsOrder.length - 1;
                const isCurrentActive = activeTab === tabId;

                return (
                  <div
                    key={tabId}
                    draggable={!isSavingTabOrder}
                    onDragStart={(e) => {
                      setDraggedTabId(tabId);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", tabId);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverTabId !== tabId) {
                        setDragOverTabId(tabId);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverTabId === tabId) {
                        setDragOverTabId(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDraftTabDrop(tabId);
                    }}
                    onDragEnd={() => {
                      setDraggedTabId(null);
                      setDragOverTabId(null);
                    }}
                    className={`flex items-center justify-between gap-3 p-3 sm:px-4 sm:py-3 rounded-2xl border transition-all select-none ${
                      isDragged
                        ? "opacity-45 border-dashed border-slate-300 bg-slate-50"
                        : isDropTarget
                        ? "border-primary bg-rose-50/50 ring-2 ring-primary/20 shadow-sm"
                        : isCurrentActive
                        ? "border-rose-200 bg-rose-50/25 hover:border-rose-300"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0"
                        title="ลากเพื่อเปลี่ยนลำดับ"
                      >
                        <GripVertical className="w-4 h-4" />
                      </span>

                      <span className="w-7 h-7 rounded-xl bg-slate-100 text-slate-600 text-xs font-black flex items-center justify-center shrink-0 tabular-nums">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isCurrentActive
                            ? "bg-rose-100 text-rose-600"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {meta.renderIcon("w-4 h-4")}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold text-slate-800 truncate">
                            {meta.label}
                          </span>
                          {isCurrentActive && (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-100/80 px-2 py-0.5 rounded-md whitespace-nowrap">
                              หน้าปัจจุบัน
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {meta.description}
                        </p>
                      </div>
                    </div>

                    {/* Precision Nudge Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={isFirst || isSavingTabOrder}
                        onClick={() => pinDraftTabToTop(index)}
                        className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                        title="ย้ายไปลำดับแรกสุด"
                        aria-label={`ย้าย ${meta.label} ไปลำดับแรกสุด`}
                      >
                        <ChevronsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isFirst || isSavingTabOrder}
                        onClick={() => moveDraftTab(index, -1)}
                        className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                        title="เลื่อนขึ้น"
                        aria-label={`เลื่อน ${meta.label} ขึ้น`}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast || isSavingTabOrder}
                        onClick={() => moveDraftTab(index, 1)}
                        className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                        title="เลื่อนลง"
                        aria-label={`เลื่อน ${meta.label} ลง`}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isDraftTabsAtDefault || isSavingTabOrder}
                  onClick={handleResetDraftTabsOrder}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>รีเซ็ตค่าเริ่มต้น</span>
                </button>
                {isDraftTabsDirty && !isSavedTabsAtDefault && (
                  <button
                    type="button"
                    disabled={isSavingTabOrder}
                    onClick={handleRevertDraftTabsOrder}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold transition whitespace-nowrap cursor-pointer disabled:opacity-40"
                  >
                    คืนค่าที่บันทึกล่าสุด
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 sm:justify-end">
                <button
                  type="button"
                  disabled={isSavingTabOrder}
                  onClick={() => setShowTabOrderModal(false)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-200/70 hover:bg-slate-200 text-slate-700 text-xs font-bold transition whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isSavingTabOrder}
                  onClick={handleSaveTabsOrder}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-primary hover:bg-rose-700 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-70 disabled:cursor-wait"
                >
                  {isSavingTabOrder ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 shrink-0" />
                      <span>บันทึกลำดับเมนู</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Professional In-App Toast Notification Stack */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-3 max-w-md w-[calc(100vw-2rem)] pointer-events-none">
          {toasts.map((toast) => {
            const isExpanded = Boolean(expandedToastDetails[toast.id]);
            const palette =
              toast.type === 'success'
                ? 'bg-white border-emerald-200 text-slate-800'
                : toast.type === 'error'
                ? 'bg-white border-rose-200 text-slate-800'
                : toast.type === 'warning'
                ? 'bg-white border-amber-200 text-slate-800'
                : 'bg-white border-indigo-200 text-slate-800';
            const iconBox =
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-600'
                : toast.type === 'error'
                ? 'bg-rose-50 text-rose-600'
                : toast.type === 'warning'
                ? 'bg-amber-50 text-amber-600'
                : 'bg-indigo-50 text-indigo-600';

            return (
              <div
                key={toast.id}
                className={`pointer-events-auto rounded-2xl border shadow-xl p-4 flex items-start gap-3 animate-scale-up font-sans ${palette}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${iconBox}`}>
                  {toast.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : toast.type === 'error' ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : toast.type === 'warning' ? (
                    <ShieldAlert className="w-5 h-5" />
                  ) : (
                    <Info className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-900 leading-snug">{toast.title}</p>
                  {toast.message && (
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{toast.message}</p>
                  )}
                  {toast.details && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedToastDetails((prev) => ({
                            ...prev,
                            [toast.id]: !prev[toast.id],
                          }))
                        }
                        className="text-[11px] font-bold text-slate-400 hover:text-slate-600 underline"
                      >
                        {isExpanded ? 'ซ่อนรายละเอียดเชิงเทคนิค' : 'ดูรายละเอียดเชิงเทคนิค'}
                      </button>
                      {isExpanded && (
                        <pre className="mt-1.5 p-2 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-600 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                          {toast.details}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition shrink-0"
                  aria-label="Close notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, title, value, bgColor }: any) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center ${bgColor}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <p className="text-2xl font-black text-slate-800">{value}</p>
      </div>
    </div>
  );
}

interface MoveSeatsTabProps {
  tables: Table[];
  setTables: any;
  tickets: TicketPayload[];
  setMyTickets: any;
  localConfig: any;
  activeZones: any;
  setPendingEmails?: any;
  onNotify?: (opts: {
    type?: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
    details?: string;
  }) => void;
}

function MoveSeatsTab({
  tables,
  setTables,
  tickets,
  setMyTickets,
  localConfig,
  activeZones,
  setPendingEmails,
  onNotify,
}: MoveSeatsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<TicketPayload | null>(null);
  const [targetZoneId, setTargetZoneId] = useState<string>("");
  const [targetTableId, setTargetTableId] = useState<string>("");
  const [chosenSeats, setChosenSeats] = useState<number[]>([]);
  const [sendEmail, setSendEmail] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const matchingTickets = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return tickets.filter(t => 
      (t.userName && t.userName.toLowerCase().includes(q)) ||
      (t.email && t.email.toLowerCase().includes(q)) ||
      (t.phone && t.phone.toLowerCase().includes(q)) ||
      (t.id && t.id.toLowerCase().includes(q))
    );
  }, [tickets, searchQuery]);

  useEffect(() => {
    if (selectedTicket) {
      setTargetTableId(selectedTicket.tableId);
      const tbl = tables.find(t => t.id === selectedTicket.tableId);
      if (tbl) {
        setTargetZoneId(tbl.zoneId);
      }
      setChosenSeats(selectedTicket.seatIds || []);
    } else {
      setTargetZoneId("");
      setTargetTableId("");
      setChosenSeats([]);
    }
  }, [selectedTicket, tables]);

  const zoneTables = useMemo(() => {
    if (!targetZoneId) return [];
    return tables.filter(t => t.zoneId === targetZoneId).sort((a, b) => a.id.localeCompare(b.id));
  }, [tables, targetZoneId]);

  useEffect(() => {
    if (zoneTables.length > 0) {
      const exists = zoneTables.some(t => t.id === targetTableId);
      if (!exists) {
        setTargetTableId(zoneTables[0].id);
        setChosenSeats([]);
      }
    }
  }, [zoneTables, targetZoneId]);

  const targetTable = useMemo(() => {
    return tables.find(t => t.id === targetTableId) || null;
  }, [tables, targetTableId]);

  const handleToggleSeat = (seatId: number) => {
    if (!selectedTicket) return;
    const requiredSeatsCount = selectedTicket.seatIds.length;

    if (chosenSeats.includes(seatId)) {
      setChosenSeats(prev => prev.filter(id => id !== seatId));
    } else {
      if (chosenSeats.length >= requiredSeatsCount) {
        if (requiredSeatsCount === 1) {
          setChosenSeats([seatId]);
        } else {
          onNotify?.({
            type: 'warning',
            title: 'เลือกที่นั่งเกินจำนวนที่กำหนด',
            message: `ตั๋วใบนี้จองไว้ทั้งหมด ${requiredSeatsCount} ที่นั่ง คุณสามารถเลือกได้ไม่เกินจำนวนที่นั่งเดิม`,
          });
        }
      } else {
        setChosenSeats(prev => [...prev, seatId].sort((a, b) => a - b));
      }
    }
  };

  const handleConfirmMove = async () => {
    if (!selectedTicket || !targetTable) return;
    const requiredSeatsCount = selectedTicket.seatIds.length;

    if (chosenSeats.length !== requiredSeatsCount) {
      onNotify?.({
        type: 'warning',
        title: 'กรุณาเลือกที่นั่งให้ครบจำนวน',
        message: `ต้องเลือกทั้งหมด ${requiredSeatsCount} ที่นั่ง (ปัจจุบันเลือกแล้ว ${chosenSeats.length} ที่นั่ง)`,
      });
      return;
    }

    setIsProcessing(true);
    try {
      const oldTableId = selectedTicket.tableId;
      const oldSeats = selectedTicket.seatIds;
      const isSameTable = oldTableId === targetTableId;

      if (isSameTable) {
        const updatedSeats = targetTable.seats.map(seat => {
          if (chosenSeats.includes(seat.id)) {
            return { ...seat, status: "paid" as const, ticketId: selectedTicket.id };
          }
          if (seat.ticketId === selectedTicket.id) {
            const { ticketId, ...rest } = seat;
            return { ...rest, status: "available" as const };
          }
          return seat;
        });

        await setDoc(doc(db, "tables", targetTableId), sanitizeForFirestore({
          ...targetTable,
          seats: updatedSeats
        }), { merge: true });

      } else {
        const oldTableObj = tables.find(t => t.id === oldTableId);
        if (oldTableObj) {
          const updatedOldSeats = oldTableObj.seats.map(seat => {
            if (seat.ticketId === selectedTicket.id || oldSeats.includes(seat.id)) {
              const { ticketId, ...rest } = seat;
              return { ...rest, status: "available" as const };
            }
            return seat;
          });
          await setDoc(doc(db, "tables", oldTableId), sanitizeForFirestore({
            ...oldTableObj,
            seats: updatedOldSeats
          }), { merge: true });
        }

        const updatedNewSeats = targetTable.seats.map(seat => {
          if (chosenSeats.includes(seat.id)) {
            return { ...seat, status: "paid" as const, ticketId: selectedTicket.id };
          }
          return seat;
        });
        await setDoc(doc(db, "tables", targetTableId), sanitizeForFirestore({
          ...targetTable,
          seats: updatedNewSeats
        }), { merge: true });
      }

      const updatedTicket = {
        ...selectedTicket,
        tableId: targetTableId,
        seatIds: chosenSeats
      };
      await setDoc(doc(db, "tickets", selectedTicket.id), sanitizeForFirestore(updatedTicket), { merge: true });

      await logStaffAction(
        "MOVE_SEATS",
        `ย้ายที่นั่งลูกค้า ${selectedTicket.userName} (${selectedTicket.id}) จากโต๊ะ ${oldTableId} ที่นั่ง [${oldSeats.join(", ")}] ไปยัง โต๊ะ ${targetTableId} ที่นั่ง [${chosenSeats.join(", ")}]`,
        selectedTicket.id
      );

      if (sendEmail && selectedTicket.email) {
        try {
          const zone = activeZones[targetTable.zoneId as ZoneType];
          const zoneName = zone?.name || targetTable.zoneId;
          const zoneColor = zone?.color;
          const zonePrice = zone?.pricePerSeat || 0;
          
          const attachments: any[] = [];
          const summaryTextLines: string[] = [];
          
          for (const seatId of chosenSeats) {
            const pdfDoc = await generateTicketPDF({
              ticketId: selectedTicket.id,
              tableId: targetTableId,
              seatId,
              seatIds: chosenSeats,
              userName: selectedTicket.userName,
              zoneName,
              zonePrice,
              eventName: localConfig.eventName,
              zoneColor,
            });

            const dataUrl = pdfDoc.output("datauristring");
            const base64Content = dataUrl.split(",")[1];
            attachments.push({
              filename: `Updated_Ticket_Table_${targetTableId}_Seat_${seatId}.pdf`,
              content: base64Content,
            });

            summaryTextLines.push(`โต๊ะ: ${targetTableId}, ที่นั่ง: ${seatId} - โซน: ${zoneName}`);
          }

          const summaryText = summaryTextLines.join("\n");
          
          const rawSubject = localConfig.emailTemplateSubject || "Your Updated Tickets for {{eventName}}";
          const rawBody = localConfig.emailTemplateBody || "Hi {{userName}},\n\nYour seat change request was processed successfully! Here are your updated ticket details:\n\n{{ticketDetails}}\n\nPlease check the attached QR codes and present them at the entrance.";

          const replaceVars = (str: string) => {
            return str
              .replace(/{{eventName}}/g, localConfig.eventName || "EventTicketingPro")
              .replace(/{{userName}}/g, selectedTicket.userName)
              .replace(/{{ticketDetails}}/g, summaryText);
          };

          const subjectText = replaceVars(rawSubject);
          const bodyText = replaceVars(rawBody);
          const baseUrl = window.location.origin;
          
          const defaultSeatId = chosenSeats[0];
          const surveyLink = `${baseUrl}/?view=survey&ticketId=${selectedTicket.id}&name=${encodeURIComponent(selectedTicket.userName)}&table=${targetTableId}&seats=${chosenSeats.join(",")}&seatId=${defaultSeatId}`;

          const bodyHtml = getEmailHtml(
            localConfig.emailTheme || "default",
            localConfig.eventName || "EventTicket",
            bodyText,
            {
              themeColor: localConfig.themeColor || "#2563eb",
              secondaryColor: localConfig.enableSecondaryColor ? localConfig.secondaryColor : localConfig.themeColor,
              accentColor: localConfig.enableAccentColor ? localConfig.accentColor : localConfig.themeColor,
              includeSurveyButton: localConfig.emailIncludeSurveyButton,
              surveyButtonText: localConfig.emailSurveyButtonText,
              surveyButtonFontSize: localConfig.emailSurveyButtonFontSize,
              surveyLink: surveyLink,
              eventDate: localConfig.eventDate,
              eventTime: localConfig.eventTime,
              youtubeLink: localConfig.emailYoutubeLink,
            }
          );

          const pendingData: PendingEmail = {
            id: Math.random().toString(36).substr(2, 9),
            to: [selectedTicket.email],
            subject: `[UPDATED] ${subjectText}`,
            text: bodyText,
            html: bodyHtml,
            attachments,
            status: "pending",
            createdAt: Date.now(),
            eventName: localConfig.eventName,
          };

          const res = await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pendingData),
          });

          if (res.ok) {
            onNotify?.({
              type: 'success',
              title: 'ย้ายที่นั่งสำเร็จ',
              message: 'ย้ายที่นั่งและส่งอีเมลยืนยันใหม่ให้ลูกค้าเรียบร้อยแล้ว',
            });
          } else {
            const errData = await res.json();
            console.error("Failed to auto-send email:", errData);
            if (setPendingEmails) {
              setPendingEmails((prev: PendingEmail[]) => [pendingData, ...(prev || [])]);
            }
            onNotify?.({
              type: 'warning',
              title: 'ย้ายที่นั่งสำเร็จ แต่อีเมลส่งไม่สำเร็จ',
              message: 'บันทึกไว้ในเมนู "ติดตามอีเมล" เพื่อส่งซ้ำภายหลังเรียบร้อยแล้ว',
            });
          }

        } catch (mailErr: any) {
          console.error("Mail error:", mailErr);
          onNotify?.({
            type: 'warning',
            title: 'ย้ายที่นั่งสำเร็จ แต่อีเมลส่งไม่สำเร็จ',
            message: mailErr.message,
          });
        }
      } else {
        onNotify?.({
          type: 'success',
          title: 'ย้ายที่นั่งเรียบร้อยแล้ว',
        });
      }

      setSelectedTicket(null);
    } catch (err: any) {
      console.error(err);
      const friendly = getFriendlyFirestoreError(err);
      onNotify?.({
        type: 'error',
        title: 'เกิดข้อผิดพลาดในการย้ายที่นั่ง',
        message: friendly.message,
        details: friendly.details,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-bold text-xl flex items-center gap-2 text-slate-800 font-sans tracking-tight">
            <MapIcon className="w-6 h-6 text-indigo-600" />
            ระบบบริการย้ายที่นั่งลูกค้า (Seat Assignment & Relocation Portal)
          </h3>
          <p className="text-slate-500 text-xs mt-1">
            ค้นหาบัตรลูกค้าด้วย ชื่อ-นามสกุล, อีเมล, เบอร์โทรศัพท์ หรือรหัสบัตร เพื่อปรับเปลี่ยนตำแหน่งที่นั่งภายหลังการซื้อบัตร (เฉพาะแอดมินเท่านั้น)
          </p>
        </div>
      </div>

      {!selectedTicket ? (
        <div className="space-y-4">
          <div className="flex gap-2 max-w-lg">
            <input
              type="text"
              placeholder="พิมพ์ชื่อ, อีเมล, เบอร์โทร หรือ รหัสตั๋ว..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {searchQuery.trim() !== "" ? (
            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-slate-50/50">
              <div className="p-4 bg-slate-100/50 border-b border-slate-100 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">
                  พบข้อมูลที่ตรงกันทั้งหมด {matchingTickets.length} รายการ
                </span>
              </div>
              
              {matchingTickets.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {matchingTickets.map((t) => (
                    <div key={t.id} className="p-4 bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 font-sans text-sm">{t.userName}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">{t.id}</span>
                          {t.isSponsor && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">Sponsor</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-sans">
                          อีเมล: {t.email || "-"} | โทร: {t.phone || "-"}
                        </div>
                        <div className="text-xs text-indigo-600 font-bold font-sans">
                          ที่นั่งปัจจุบัน: โต๊ะ {t.tableId || "-"}, เลขที่นั่ง [{t.seatIds?.join(", ")}] ({t.seatIds?.length} ที่นั่ง)
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedTicket(t)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm shadow-indigo-100 hover:shadow-indigo-200 flex items-center gap-1.5"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        ย้ายที่นั่ง / ปรับปรุง (Move Seat)
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 font-sans text-sm">
                  ไม่พบข้อมูลลูกค้าที่ค้นหา ลองเปลี่ยนคำค้นหาอีกครั้ง
                </div>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-slate-200 rounded-3xl p-8 text-center text-slate-400 font-sans text-sm">
              กรุณากรอกข้อมูลในช่องค้นหาเพื่อสืบค้นบัตรลูกค้า
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-black tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                ข้อมูลลูกค้าที่เลือก
              </span>
              <h4 className="font-extrabold text-lg text-slate-800 font-sans mt-1">{selectedTicket.userName}</h4>
              <p className="text-xs text-slate-500 font-sans">
                ตั๋ว ID: <span className="font-mono">{selectedTicket.id}</span> | อีเมล: {selectedTicket.email || "-"} | โทร: {selectedTicket.phone || "-"}
              </p>
              <div className="text-sm font-black text-rose-600 bg-rose-50/50 border border-rose-100 px-3 py-1.5 rounded-xl inline-block mt-1">
                ตำแหน่งเดิม: โต๊ะ {selectedTicket.tableId}, เลขที่นั่ง [{selectedTicket.seatIds?.join(", ")}] ({selectedTicket.seatIds?.length} ที่นั่ง)
              </div>
            </div>
            <button
              onClick={() => setSelectedTicket(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
            >
              ย้อนกลับหน้าค้นหา (Go Back)
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-sm">
                <span className="text-xs font-black text-slate-400 block uppercase">
                  ขั้นตอนที่ 1: เลือกโซนและโต๊ะปลายทาง
                </span>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">โซนที่นั่ง (Zone)</label>
                    <select
                      value={targetZoneId}
                      onChange={(e) => setTargetZoneId(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">-- เลือกโซน --</option>
                      {Object.keys(activeZones).map((zoneKey) => (
                        <option key={zoneKey} value={zoneKey}>
                          {activeZones[zoneKey]?.name || zoneKey} ({zoneKey})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">โต๊ะที่นั่ง (Table)</label>
                    <select
                      value={targetTableId}
                      onChange={(e) => setTargetTableId(e.target.value)}
                      disabled={!targetZoneId}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                    >
                      {zoneTables.map((tbl) => {
                        const originalSeatsAssignedHereCount = tbl.seats.filter(s => s.ticketId === selectedTicket.id).length;
                        const availableSeats = tbl.seats.filter(s => s.status === "available").length + originalSeatsAssignedHereCount;
                        const totalSeats = tbl.seats.length;
                        return (
                          <option key={tbl.id} value={tbl.id}>
                            โต๊ะ {tbl.id} ({availableSeats}/{totalSeats} ที่ว่าง) {tbl.id === selectedTicket.tableId ? " [โต๊ะเดิม]" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-2">
                <h5 className="text-xs font-bold text-indigo-700">ข้อกำหนดการเลือกที่นั่ง</h5>
                <ul className="text-[11px] text-indigo-600/80 space-y-1 list-disc list-inside font-sans">
                  <li>คุณต้องเลือกที่นั่งจำนวน <strong>{selectedTicket.seatIds.length} ที่นั่ง</strong></li>
                  <li>หากเป็นโต๊ะเดิม ระบบจะคืนสิทธิ์ที่นั่งเดิมของคุณเพื่อให้สามารถเปลี่ยนภายในโต๊ะเดียวกันได้</li>
                  <li>เมื่อกดบันทึก ระบบจะคืนค่าที่นั่งเดิมให้เป็นที่ว่างทันที และจองที่นั่งใหม่ให้อย่างสมบูรณ์</li>
                </ul>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <span className="text-xs font-black text-slate-400 block uppercase">
                    ขั้นตอนที่ 2: เลือกตำแหน่งที่นั่งบนโต๊ะ {targetTableId || "-"}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    เลือกแล้ว <span className="font-black text-indigo-600">{chosenSeats.length}</span> / <span className="font-black text-indigo-600">{selectedTicket.seatIds.length}</span> ที่นั่ง
                  </span>
                </div>

                {targetTable ? (
                  <div className="space-y-6">
                    <div className="flex flex-col items-center bg-slate-50 rounded-2xl p-6 border border-slate-100">
                      <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center border-4 border-white shadow-md text-slate-500 font-bold text-sm mb-8 relative">
                        <span className="text-xs uppercase tracking-wider text-slate-400 absolute -top-5">เวทีฝั่งนี้</span>
                        โต๊ะ {targetTable.id}
                      </div>

                      <div className="grid grid-cols-5 gap-3 w-full max-w-sm">
                        {targetTable.seats.map((seat) => {
                          const isOriginalSeat = selectedTicket.tableId === targetTable.id && selectedTicket.seatIds.includes(seat.id);
                          const isOccupiedByOthers = seat.status === "paid" && seat.ticketId !== selectedTicket.id;
                          const isChosen = chosenSeats.includes(seat.id);

                          let seatBtnClass = "h-11 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center border shadow-sm ";
                          let seatText = `ที่นั่ง ${seat.id}`;
                          let isDisable = false;

                          if (isOccupiedByOthers) {
                            seatBtnClass += "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed";
                            isDisable = true;
                            seatText = `${seat.id} (เต็ม)`;
                          } else if (isChosen) {
                            seatBtnClass += "bg-indigo-600 border-indigo-700 text-white font-black scale-105 shadow-md shadow-indigo-100";
                          } else if (isOriginalSeat) {
                            seatBtnClass += "bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-700";
                            seatText = `${seat.id} (เดิม)`;
                          } else {
                            seatBtnClass += "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 hover:scale-105";
                          }

                          return (
                            <button
                              key={seat.id}
                              type="button"
                              disabled={isDisable}
                              onClick={() => handleToggleSeat(seat.id)}
                              className={seatBtnClass}
                              title={isDisable ? "ที่นั่งถูกจองแล้วโดยผู้อื่น" : ""}
                            >
                              <span className="text-[10px] opacity-75">#</span>
                              <span className="text-xs font-extrabold">{seatText}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex gap-4 mt-6 text-[10px] font-bold text-slate-400">
                        <div className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-300 inline-block" />
                          <span>ว่าง</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded bg-slate-100 border border-slate-300 inline-block" />
                          <span>ไม่ว่าง</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded bg-indigo-600 inline-block" />
                          <span>เลือกอยู่</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded bg-amber-50 border border-amber-300 inline-block" />
                          <span>ที่นั่งเดิม</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 flex flex-col md:flex-row justify-between items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
                        <input
                          type="checkbox"
                          checked={sendEmail}
                          onChange={(e) => setSendEmail(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        />
                        ส่งอีเมลแจ้งตำแหน่งตั๋วปรับปรุงใหม่ให้ลูกค้า (Send notification email)
                      </label>

                      <button
                        type="button"
                        disabled={isProcessing || chosenSeats.length !== selectedTicket.seatIds.length}
                        onClick={handleConfirmMove}
                        className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-2xl text-sm font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 hover:shadow-indigo-200"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            กำลังบันทึกข้อมูล...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            ยืนยันการย้ายที่นั่งลูกค้า (Save & Relocate)
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 font-sans text-sm">
                    กรุณาเลือกโต๊ะปลายทางที่ต้องการตรวจสอบตำแหน่งที่นั่ง
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
