/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import { ZoneConfig, Table, ZoneType } from './types';

export const getContrastYIQ = (hexcolor: string) => {
  if (!hexcolor) return 'black';
  hexcolor = hexcolor.replace("#", "");
  const r = parseInt(hexcolor.substr(0,2),16);
  const g = parseInt(hexcolor.substr(2,2),16);
  const b = parseInt(hexcolor.substr(4,2),16);
  const yiq = ((r*299)+(g*587)+(b*114))/1000;
  return (yiq >= 128) ? '#0f172a' : '#ffffff';
};

export const getZoneStyle = (color?: string) => {
    if (!color) return {};
    return {
        backgroundColor: color,
        color: getContrastYIQ(color),
        borderColor: color
    };
};

export const ZONES: Record<ZoneType, ZoneConfig> = {
  VIP: {
    id: 'VIP',
    name: 'VIP Zone (หน้าเวที)',
    pricePerSeat: 5000,
    colorClass: 'bg-rose-500 text-white border-rose-600',
    bgColorClass: 'bg-rose-100',
    textClass: 'text-rose-700',
    ringClass: 'ring-rose-500',
    borderClass: 'border-rose-500',
    bankAccount: '0812345678',
    bankName: 'KBANK',
    bankAccountName: 'ชื่อบัญชี VIP',
    seatsPerTable: 10,
    color: '#e11d48',
    layoutOrder: 1,
    layoutPosition: 'center',
  },
  GOLD: {
    id: 'GOLD',
    name: 'Gold Zone (ตรงกลาง)',
    pricePerSeat: 3000,
    colorClass: 'bg-amber-400 text-amber-950 border-amber-500',
    bgColorClass: 'bg-amber-100',
    textClass: 'text-amber-800',
    ringClass: 'ring-amber-400',
    borderClass: 'border-amber-400',
    bankAccount: '0898765432',
    bankName: 'KBANK',
    bankAccountName: 'ชื่อบัญชี ทั่วไป',
    seatsPerTable: 10,
    color: '#f59e0b',
    layoutOrder: 2,
    layoutPosition: 'center',
  },
  REGULAR: {
    id: 'REGULAR',
    name: 'Regular Zone (ด้านหลัง)',
    pricePerSeat: 1500,
    colorClass: 'bg-emerald-500 text-white border-emerald-600',
    bgColorClass: 'bg-emerald-100',
    textClass: 'text-emerald-700',
    ringClass: 'ring-emerald-500',
    borderClass: 'border-emerald-500',
    bankAccount: '0898765432',
    bankName: 'KBANK',
    bankAccountName: 'ชื่อบัญชี ทั่วไป',
    seatsPerTable: 10,
    color: '#10b981',
    layoutOrder: 3,
    layoutPosition: 'center',
  },
};

export const generateInitialTables = (counts?: Record<ZoneType, number>, zonesConfig?: Record<ZoneType, ZoneConfig>, mockData: boolean = false): Table[] => {
  const tables: Table[] = [];
  
  const zoneCounts = counts || { VIP: 20, GOLD: 40, REGULAR: 40 };
  const currentZones = zonesConfig || ZONES;
  const zonesList = Object.keys(zoneCounts);
  
  let i = 1;
  for (const zone of zonesList) {
    const countForZone = zoneCounts[zone] || 0;
    const seatsPerTable = currentZones[zone]?.seatsPerTable || 10;
    
    for (let c = 0; c < countForZone; c++) {
      const tableId = `T${i.toString().padStart(3, '0')}`;
      const zoneId = zone;
      
      const seats = Array.from({ length: seatsPerTable }).map((_, idx) => {
          const rand = Math.random();
          let status: 'available' | 'locked' | 'paid' = 'available';
          
          if (mockData) {
            if (i < 5) status = 'paid';
            else if (i === 6 && idx < 5) status = 'paid';
            else if (rand > 0.9) status = 'paid';
          }
          
          return {
              id: idx + 1,
              status,
          };
      });

      tables.push({
        id: tableId,
        zoneId,
        seats,
      });
      i++;
    }
  }
  
  return tables;
};
