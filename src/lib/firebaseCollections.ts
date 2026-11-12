/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Table, TicketPayload, ZoneType, PendingEmail, SurveyPayload } from '../types';

export const collections = {
  config: collection(db, 'config'),
  tables: collection(db, 'tables'),
  tickets: collection(db, 'tickets'),
  surveys: collection(db, 'surveys'),
  luckyDraw: collection(db, 'luckyDraw')
};

// Config
export const updateConfig = async (configData: any) => {
  const docRef = doc(db, 'config', 'main');
  await setDoc(docRef, configData, { merge: true });
};

// Tickets
export const addTicket = async (ticket: TicketPayload) => {
  const docRef = doc(db, 'tickets', ticket.id);
  await setDoc(docRef, ticket);
};

export const updateTicket = async (ticketId: string, data: Partial<TicketPayload>) => {
  const docRef = doc(db, 'tickets', ticketId);
  await updateDoc(docRef, data);
};

// Tables
export const updateTable = async (table: Table) => {
  const docRef = doc(db, 'tables', table.id);
  await setDoc(docRef, table);
};

export const deleteTable = async (tableId: string) => {
  const docRef = doc(db, 'tables', tableId);
  await deleteDoc(docRef);
};

// Surveys
export const addSurvey = async (survey: any) => {
  const docRef = doc(db, 'surveys', survey.id);
  await setDoc(docRef, survey);
};

// Lucky Draw
export const addLuckyDrawWinner = async (winner: any) => {
  const docRef = doc(db, 'luckyDraw', `${winner.ticketId}_${winner.seatId || 'all'}`);
  await setDoc(docRef, winner);
};

export const updateLuckyDrawWinner = async (id: string, data: any) => {
  const docRef = doc(db, 'luckyDraw', id);
  await updateDoc(docRef, data);
};
