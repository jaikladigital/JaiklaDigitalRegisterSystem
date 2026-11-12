/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
export type ZoneType = string;

export interface ZoneConfig {
  id: ZoneType;
  name: string;
  pricePerSeat: number;
  colorClass: string;
  bgColorClass: string;
  textClass?: string;
  ringClass?: string;
  borderClass?: string;
  bankAccount: string;
  bankName?: string;
  bankAccountName?: string;
  seatsPerTable?: number;
  color?: string; // Hex color for the ticket QR border/header
  layoutOrder?: number; // Sorting order (1 is closest to stage)
  layoutPosition?: 'center' | 'left_wing' | 'right_wing';
}

export interface Seat {
  id: number; // 1-10
  status: 'available' | 'locked' | 'paid';
  ticketId?: string;
  lockedUntil?: number;
  lockedBySession?: string;
}

export interface Table {
  id: string; // T01 - T100
  zoneId: ZoneType;
  seats: Seat[];
}

export interface SurveyPayload {
  id: string;
  ticketId: string;
  seatId?: number;
  ratings: Record<string, number>; // topicId -> rating (1, 2, 3)
  comment?: string;
  timestamp: number;
}

export interface PendingEmail {
  id: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  attachments: { filename: string; content: string }[];
  status: 'pending' | 'sent';
  createdAt: number;
  eventName?: string;
}

export interface TicketPayload {
  id: string;
  userName: string;
  phone: string;
  email: string;
  tableId: string;
  seatIds: number[];
  totalAmount: number;
  paymentMethod: string;
  status: 'pending' | 'slip_verified' | 'paid';
  slipUrl?: string;
  qrCodeUrl: string;
  checkInTime?: string;
  checkedInSeats?: number[];
  drinksRedeemed: number;
  drinkHistory?: Record<string, number>;
  drinkHistoryBySeat?: Record<number, Record<string, number>>;
  isSponsor?: boolean;
  sponsorValue?: number;
  isMock?: boolean;
}

export interface EventBooth {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  promptpayId: string;
  promptpayName: string;
  description?: string;
  rentFee: number;
  commissionRate: number;
  createdAt: string;
}

export interface BoothScanLog {
  id: string;
  boothId: string;
  boothName: string;
  ticketId: string;
  seatId?: number;
  userName: string;
  phone: string;
  timestamp: string;
  salesAmount: number;
  notes?: string;
}
