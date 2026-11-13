/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Seat, Table, TicketPayload } from '../types';

export const collections = {
  config: collection(db, 'config'),
  tables: collection(db, 'tables'),
  tickets: collection(db, 'tickets'),
  surveys: collection(db, 'surveys'),
  luckyDraw: collection(db, 'luckyDraw'),
};

/**
 * Recursively strips `undefined` values from objects/arrays so Firestore
 * never throws `Unsupported field value: undefined`.
 */
export function sanitizeForFirestore<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (
    value instanceof Date ||
    value instanceof Timestamp ||
    typeof value !== 'object'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(value as Record<string, any>)) {
    if (val !== undefined) {
      result[key] = sanitizeForFirestore(val);
    }
  }
  return result as T;
}

/**
 * Returns a clean `available` seat object without optional lock/ticket fields.
 */
export function cleanSeatToAvailable(seat: Seat): Seat {
  return {
    id: seat.id,
    status: 'available',
  };
}

/**
 * Translates raw Firebase/network errors into clear, professional Thai messages.
 */
export function getFriendlyFirestoreError(err: unknown): {
  message: string;
  details: string;
} {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes('permission-denied') || lower.includes('insufficient permissions')) {
    return {
      message: 'บัญชีของคุณไม่มีสิทธิ์ดำเนินการนี้ กรุณาตรวจสอบสิทธิ์ผู้ดูแลระบบหรือเข้าสู่ระบบใหม่',
      details: raw,
    };
  }
  if (lower.includes('unsupported field value: undefined') || lower.includes('invalid data')) {
    return {
      message: 'พบข้อมูลบางฟิลด์ไม่สมบูรณ์ ระบบไม่สามารถบันทึกรูปแบบข้อมูลดังกล่าวลงฐานข้อมูลได้',
      details: raw,
    };
  }
  if (lower.includes('quota exceeded') || lower.includes('resource-exhausted')) {
    return {
      message: 'โควตาการใช้งานฐานข้อมูลประจำวันเต็มชั่วคราว กรุณารอสักครู่แล้วลองใหม่อีกครั้ง',
      details: raw,
    };
  }
  if (lower.includes('offline') || lower.includes('network') || lower.includes('unavailable')) {
    return {
      message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่',
      details: raw,
    };
  }
  return {
    message: 'ไม่สามารถดำเนินการบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
    details: raw,
  };
}

type BatchOp =
  | { type: 'set'; collectionName: string; id: string; data: any; merge?: boolean }
  | { type: 'delete'; collectionName: string; id: string };

/**
 * Executes Firestore write operations atomically in chunks of 400 (well under Firestore's 500 limit).
 */
export async function executeChunkedBatch(ops: BatchOp[]): Promise<void> {
  if (ops.length === 0) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      const ref = doc(db, op.collectionName, op.id);
      if (op.type === 'delete') {
        batch.delete(ref);
      } else {
        const sanitized = sanitizeForFirestore(op.data);
        if (op.merge) {
          batch.set(ref, sanitized, { merge: true });
        } else {
          batch.set(ref, sanitized);
        }
      }
    }
    await batch.commit();
  }
}

/**
 * Deletes the specified tickets and resets all associated seats (matched either by
 * `seat.ticketId` OR by `ticket.tableId` + `ticket.seatIds`) back to `available`.
 * Only writes tables that actually changed.
 */
export async function clearTicketsAndReleaseSeats(
  ticketsToDelete: TicketPayload[],
  tables: Table[]
): Promise<{ deletedCount: number; releasedSeatsCount: number; updatedTablesCount: number }> {
  const targetTicketIds = new Set(ticketsToDelete.map((t) => t.id));
  const targetSeatsByTable = new Map<string, Set<number>>();

  for (const ticket of ticketsToDelete) {
    if (!ticket.tableId) continue;
    if (!targetSeatsByTable.has(ticket.tableId)) {
      targetSeatsByTable.set(ticket.tableId, new Set<number>());
    }
    const seatSet = targetSeatsByTable.get(ticket.tableId)!;
    (ticket.seatIds || []).forEach((sId) => seatSet.add(sId));
  }

  const ops: BatchOp[] = [];
  let releasedSeatsCount = 0;
  let updatedTablesCount = 0;

  for (const ticket of ticketsToDelete) {
    ops.push({
      type: 'delete',
      collectionName: 'tickets',
      id: ticket.id,
    });
  }

  for (const table of tables) {
    const seatIdsForTable = targetSeatsByTable.get(table.id);
    let tableModified = false;

    const nextSeats = table.seats.map((s) => {
      const matchedByTicketId = Boolean(s.ticketId && targetTicketIds.has(s.ticketId));
      const matchedByTableSeat = Boolean(seatIdsForTable && seatIdsForTable.has(s.id));

      if (matchedByTicketId || matchedByTableSeat) {
        tableModified = true;
        releasedSeatsCount += 1;
        return cleanSeatToAvailable(s);
      }
      return s;
    });

    if (tableModified) {
      updatedTablesCount += 1;
      ops.push({
        type: 'set',
        collectionName: 'tables',
        id: table.id,
        data: {
          ...table,
          seats: nextSeats,
        },
      });
    }
  }

  try {
    await executeChunkedBatch(ops);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'tickets/tables');
    throw err;
  }

  return {
    deletedCount: ticketsToDelete.length,
    releasedSeatsCount,
    updatedTablesCount,
  };
}

// Config
export const updateConfig = async (configData: any) => {
  const docRef = doc(db, 'config', 'main');
  try {
    await setDoc(docRef, sanitizeForFirestore(configData), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'config/main');
    throw err;
  }
};

// Tickets
export const addTicket = async (ticket: TicketPayload) => {
  const docRef = doc(db, 'tickets', ticket.id);
  try {
    await setDoc(docRef, sanitizeForFirestore(ticket));
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `tickets/${ticket.id}`);
    throw err;
  }
};

export const updateTicket = async (ticketId: string, data: Partial<TicketPayload>) => {
  const docRef = doc(db, 'tickets', ticketId);
  try {
    await updateDoc(docRef, sanitizeForFirestore(data));
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
    throw err;
  }
};

// Tables
export const updateTable = async (table: Table) => {
  const docRef = doc(db, 'tables', table.id);
  try {
    await setDoc(docRef, sanitizeForFirestore(table));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `tables/${table.id}`);
    throw err;
  }
};

export const deleteTable = async (tableId: string) => {
  const docRef = doc(db, 'tables', tableId);
  try {
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `tables/${tableId}`);
    throw err;
  }
};

// Surveys
export const addSurvey = async (survey: any) => {
  const docRef = doc(db, 'surveys', survey.id);
  try {
    await setDoc(docRef, sanitizeForFirestore(survey));
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `surveys/${survey.id}`);
    throw err;
  }
};

// Lucky Draw
export const addLuckyDrawWinner = async (winner: any) => {
  const id = `${winner.ticketId}_${winner.seatId || 'all'}`;
  const docRef = doc(db, 'luckyDraw', id);
  try {
    await setDoc(docRef, sanitizeForFirestore(winner));
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `luckyDraw/${id}`);
    throw err;
  }
};

export const updateLuckyDrawWinner = async (id: string, data: any) => {
  const docRef = doc(db, 'luckyDraw', id);
  try {
    await updateDoc(docRef, sanitizeForFirestore(data));
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `luckyDraw/${id}`);
    throw err;
  }
};
