/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { generateInitialTables, ZONES } from './data';
import { generateTicketImage, generateTicketPDF } from './utils/ticketGenerator';
import { getEmailHtml } from './utils/emailTemplates';
import { Table, TicketPayload, ZoneType, PendingEmail, EventBooth, BoothScanLog } from './types';
import { LayoutDashboard, Map as MapIcon, QrCode, Ticket as TicketIcon, ScanLine, Search, ChevronRight, CheckCircle2, User, Gift, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onSnapshot, doc, collection, addDoc, getDocs, deleteDoc, setDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './lib/firebase';
import { logStaffAction } from './lib/logger';
import { addTicket, updateTicket, updateTable, deleteTable, addSurvey, addLuckyDrawWinner, updateLuckyDrawWinner, updateConfig } from './lib/firebaseCollections';


import { ConfigContext, translations } from './ConfigContext';
import { Globe } from 'lucide-react';
import FloorPlanView from './components/FloorPlanView';
import CheckoutView from './components/CheckoutView';
import SuccessView from './components/SuccessView';
import MyTicketsView from './components/MyTicketsView';
import StaffPortalView from './components/StaffPortalView';
import AdminDashboardView from './components/AdminDashboardView';
import ClientDashboardView from './components/ClientDashboardView';
import LuckyDrawView from './components/LuckyDrawView';
import SurveyView from './components/SurveyView';
import SurveyCountdownPopup from './components/SurveyCountdownPopup';
import AuthView from './components/AuthView';

type ViewMode = 'MAP' | 'CHECKOUT' | 'SUCCESS' | 'TICKETS' | 'STAFF' | 'ADMIN' | 'LUCKY_DRAW' | 'SURVEY' | 'CLIENT';

const DEFAULT_CONFIG = {
  themeColor: '#e11d48',
  enableSecondaryColor: false,
  secondaryColor: '#3b82f6',
  enableAccentColor: false,
  accentColor: '#10b981',
  bannerUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&h=400&q=80',
  hideEventNameOnBanner: false,
  eventName: 'EventTicketingPro',
  isWholeStoreFree: false,
  isTicketFree: false,
  layoutStyle: 'banquet',
  drinks: [
    { id: '1', name: 'เบียร์ (1)', price: 150, color: 'blue' },
    { id: '2', name: 'เหล้าปั่น (1)', price: 250, color: 'amber' }
  ],
  zones: null, // will be merged
  zoneCounts: {
    VIP: 20,
    GOLD: 40,
    REGULAR: 40
  },
  emailTemplateSubject: 'Your Tickets for {{eventName}}',
  emailTemplateBody: 'Hi {{userName}},\n\nPayment successful! Your tickets are confirmed.\n\n{{ticketDetails}}\n\nPlease check the attached QR codes and present them at the entrance. Enjoy the event!',
  emailYoutubeLink: '',
  emailTheme: 'default',
  emailIncludeSurveyButton: true,
  emailSurveyButtonText: 'ทำแบบประเมินความพึงพอใจ',
  emailSurveyButtonFontSize: 22,
  lineNotifyEnabled: false,
  linePushEnabled: false,
  smsEnabled: false,
  notificationCustomerSuccess: 'ชำระเงินเรียบร้อย ตรวจสอบอีเมลของคุณ',
  notificationCustomerFailed: 'ชำระเงินไม่เรียบร้อย ติดต่อเจ้าหน้าที่',
  blockManualSeatSelection: false,
  temporaryHoldMinutes: 5,
  consentEnabled: true,
  consentCompanyName: 'บริษัท ใจกล้า ดิจิตอล จำกัด',
  consentDataTypes: 'ชื่อ-นามสกุล, เบอร์โทรศัพท์, อีเมล, รูปภาพ',
  consentPurpose: 'ดำเนินกิจกรรม'
};

export default function App() {
  const [tables, setTables] = useState<Table[]>([]);
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      if (viewParam && ['MAP', 'CHECKOUT', 'SUCCESS', 'TICKETS', 'STAFF', 'ADMIN', 'CLIENT', 'LUCKY_DRAW', 'SURVEY'].includes(viewParam.toUpperCase())) {
        return viewParam.toUpperCase() as ViewMode;
      }
      const saved = sessionStorage.getItem('currentView');
      if (saved && ['MAP', 'CHECKOUT', 'SUCCESS', 'TICKETS', 'STAFF', 'ADMIN', 'CLIENT', 'LUCKY_DRAW', 'SURVEY'].includes(saved.toUpperCase())) {
        return saved.toUpperCase() as ViewMode;
      }
    }
    return 'MAP';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('currentView', view);
      const url = new URL(window.location.href);
      if (url.searchParams.get('view') !== view) {
        url.searchParams.set('view', view);
        window.history.replaceState({}, '', url);
      }
    }
  }, [view]);
  const [cart, setCart] = useState<{tableId: string; seatIds: number[]}[]>([]);
  const [myTickets, setMyTickets] = useState<TicketPayload[]>([]);
  const [pendingEmails, setPendingEmails] = useState<PendingEmail[]>([]);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [luckyDrawWinners, setLuckyDrawWinners] = useState<{ticketId: string; seatId?: number; claimed: boolean}[]>([]);
  const [showSurveyCountdown, setShowSurveyCountdown] = useState(false);
  const [booths, setBooths] = useState<EventBooth[]>([]);
  const [boothScanLogs, setBoothScanLogs] = useState<BoothScanLog[]>([]);
  const [activeTicketForSurvey, setActiveTicketForSurvey] = useState<{ticket: TicketPayload, seatId?: number} | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ticketId = params.get('ticketId');
      if (ticketId) {
        return {
          ticket: {
            id: ticketId,
            userName: params.get('name') || 'Guest',
            tableId: params.get('table') || '-',
            seatIds: params.get('seats') ? params.get('seats')!.split(',').map(Number) : [],
            phone: '',
            email: '',
            totalAmount: 0,
            paymentMethod: 'CASH',
            status: 'paid',
            qrCodeUrl: '',
            drinksRedeemed: 0
          },
          seatId: params.get('seatId') && !isNaN(Number(params.get('seatId'))) ? Number(params.get('seatId')) : undefined
        };
      }
    }
    return null;
  });
  const [surveySourceView, setSurveySourceView] = useState<ViewMode>('TICKETS');
  const [language, setLanguage] = useState<'th'|'en'>('th');

  const t = (text: string) => language === 'en' ? translations.en[text] || text : text;
  
  const [config, setConfig] = useState<any>({ ...DEFAULT_CONFIG, zones: ZONES });

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'config', 'main'), (docSnap) => {
      if (docSnap.exists()) {
        const data = { ...DEFAULT_CONFIG, ...docSnap.data() };
        if (!data.zones) data.zones = ZONES;
        Object.keys(data.zones).forEach(key => {
          const defaultZone = ZONES[key as keyof typeof ZONES];
          if (defaultZone) data.zones[key] = { ...defaultZone, ...data.zones[key] };
        });
        setConfig(data);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/main');
    });

    const unsubTables = onSnapshot(collection(db, 'tables'), (snapshot) => {
      const tb: Table[] = [];
      const now = Date.now();
      const tablesToClean: Table[] = [];

      snapshot.forEach(docSnap => {
        const table = docSnap.data() as Table;
        let tableChanged = false;
        
        const cleanSeats = table.seats.map(s => {
          const seatWithLock = s as any;
          if (seatWithLock.status === 'locked' && seatWithLock.lockedUntil && seatWithLock.lockedUntil < now) {
            tableChanged = true;
            const { lockedUntil, lockedBySession, ...rest } = seatWithLock;
            return {
              ...rest,
              status: 'available' as const
            };
          }
          return s;
        });

        if (tableChanged) {
          const updatedTable = { ...table, seats: cleanSeats };
          tb.push(updatedTable);
          tablesToClean.push(updatedTable);
        } else {
          tb.push(table);
        }
      });

      if (tb.length > 0) {
        setTables(tb.sort((a, b) => a.id.localeCompare(b.id)));
      }

      // Silently release expired locked seats in Firestore in the background
      if (tablesToClean.length > 0) {
        tablesToClean.forEach(t => {
          updateTable(t).catch(err => console.error("Error auto-releasing expired seat:", err));
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'tables');
    });

    const unsubTickets = onSnapshot(collection(db, 'tickets'), (snapshot) => {
      const tkts: TicketPayload[] = [];
      snapshot.forEach(doc => tkts.push(doc.data() as TicketPayload));
      setMyTickets(tkts);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'tickets');
    });

    const unsubSurveys = onSnapshot(collection(db, 'surveys'), (snapshot) => {
      const sv: any[] = [];
      snapshot.forEach(doc => sv.push(doc.data()));
      setSurveys(sv);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'surveys');
    });

    const unsubLucky = onSnapshot(collection(db, 'luckyDraw'), (snapshot) => {
      const ld: any[] = [];
      snapshot.forEach(doc => ld.push(doc.data()));
      setLuckyDrawWinners(ld);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'luckyDraw');
    });

    const unsubBooths = onSnapshot(collection(db, 'booths'), (snapshot) => {
      const b: EventBooth[] = [];
      snapshot.forEach(doc => b.push(doc.data() as EventBooth));
      setBooths(b);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'booths');
    });

    const unsubBoothScanLogs = onSnapshot(collection(db, 'boothScanLogs'), (snapshot) => {
      const bsl: BoothScanLog[] = [];
      snapshot.forEach(doc => bsl.push(doc.data() as BoothScanLog));
      setBoothScanLogs(bsl);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'boothScanLogs');
    });

    return () => {
      unsubConfig();
      unsubTables();
      unsubTickets();
      unsubSurveys();
      unsubLucky();
      unsubBooths();
      unsubBoothScanLogs();
    };
  }, []);

  useEffect(() => {
    if (view === 'SURVEY' && activeTicketForSurvey && !config.surveyTestMode) {
      if (config.eventDate) {
        let timeStr = config.eventTime || '00:00';
        if (timeStr.length === 5) timeStr += ':00';
        const targetTime = new Date(`${config.eventDate}T${timeStr}`).getTime();
        const now = new Date().getTime();
        if (now < targetTime) {
          setShowSurveyCountdown(true);
          setView('MAP'); // redirect back
          return;
        }
      }

      // Check if the seat is checked in
      const realTicket = myTickets.find(t => t.id === activeTicketForSurvey.ticket.id);
      
      let isCheckedIn = false;
      if (realTicket) {
        // Check specific seat ID
        if (realTicket.checkedInSeats && activeTicketForSurvey.seatId !== undefined) {
          isCheckedIn = realTicket.checkedInSeats.map(String).includes(String(activeTicketForSurvey.seatId));
        }
        // Fallback for group checkin or older tickets
        if (!isCheckedIn && realTicket.checkInTime) {
          isCheckedIn = true;
        }
      } else {
        // If ticket not found in local mock DB (e.g. testing across devices),
        // we'll allow it to proceed for prototyping purposes, or they'd be blocked forever.
        isCheckedIn = true; 
      }
      
      // Still enforce check-in strictly ONLY if we have the ticket locally and it's definitely not checked in.
      if (realTicket && !isCheckedIn) {
        alert(t('หมายเลขที่นั่งนี้ยังไม่ได้ทำการเช็คอิน ไม่สามารถทำแบบประเมินได้'));
        setView('MAP');
        return;
      }
    }
  }, [view, activeTicketForSurvey, config, myTickets]);

  const handleResetApp = async () => {
    try {
      // 1. Wipe out tables
      const tablesSnap = await getDocs(collection(db, 'tables'));
      const deleteTablePromises: Promise<void>[] = [];
      tablesSnap.forEach((d) => {
        deleteTablePromises.push(deleteDoc(doc(db, 'tables', d.id)));
      });

      // 2. Wipe out tickets
      const ticketsSnap = await getDocs(collection(db, 'tickets'));
      const deleteTicketPromises: Promise<void>[] = [];
      ticketsSnap.forEach((d) => {
        deleteTicketPromises.push(deleteDoc(doc(db, 'tickets', d.id)));
      });

      // 3. Wipe out surveys
      const surveysSnap = await getDocs(collection(db, 'surveys'));
      const deleteSurveyPromises: Promise<void>[] = [];
      surveysSnap.forEach((d) => {
        deleteSurveyPromises.push(deleteDoc(doc(db, 'surveys', d.id)));
      });

      // 4. Wipe out luckyDraw
      const luckyDrawSnap = await getDocs(collection(db, 'luckyDraw'));
      const deleteLuckyDrawPromises: Promise<void>[] = [];
      luckyDrawSnap.forEach((d) => {
        deleteLuckyDrawPromises.push(deleteDoc(doc(db, 'luckyDraw', d.id)));
      });

      // 5. Wipe out staff_logs
      const logsSnap = await getDocs(collection(db, 'staff_logs'));
      const deleteLogsPromises: Promise<void>[] = [];
      logsSnap.forEach((d) => {
        deleteLogsPromises.push(deleteDoc(doc(db, 'staff_logs', d.id)));
      });

      // Execute all deletions first
      await Promise.all([
        ...deleteTablePromises,
        ...deleteTicketPromises,
        ...deleteSurveyPromises,
        ...deleteLuckyDrawPromises,
        ...deleteLogsPromises
      ]);

      // 6. Reset config to default
      await updateConfig({ ...DEFAULT_CONFIG, zones: ZONES });

      // 7. Regenerate initial tables with mockData = true (simulated defaults)
      const initialTables = generateInitialTables(DEFAULT_CONFIG.zoneCounts, ZONES, true);
      const saveTablePromises = initialTables.map(t => setDoc(doc(db, 'tables', t.id), t));
      await Promise.all(saveTablePromises);

      // Log the reset action
      await logStaffAction('SYSTEM_RESET', 'Fully reset system settings, tables, and statistics to defaults');

      // Reset local cart
      setCart([]);
      
      // Navigate back to the client/map view
      setView('MAP');

      alert("รีเซ็ตระบบทั้งหมดเป็นค่าเริ่มต้นจำลองสำเร็จแล้ว! (System reset complete!)");
    } catch (error: any) {
      console.error("Error resetting system:", error);
      alert("เกิดข้อผิดพลาดในการรีเซ็ตระบบ: " + error.message);
    }
  };

  const [sessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      let id = localStorage.getItem('booking_session_id');
      if (!id) {
        id = 'sess_' + Math.random().toString(36).substring(2, 11);
        localStorage.setItem('booking_session_id', id);
      }
      return id;
    }
    return 'sess_temp';
  });

  const handleProceedToCheckout = async () => {
    if (cart.length === 0) return;

    const now = Date.now();
    const staleSeats: string[] = [];

    cart.forEach(c => {
      const table = tables.find(t => t.id === c.tableId);
      if (table) {
        c.seatIds.forEach(sid => {
          const seat = table.seats.find(s => s.id === sid);
          if (!seat || seat.status !== 'available') {
            staleSeats.push(`โต๊ะ ${c.tableId} ที่นั่ง ${sid}`);
          }
        });
      }
    });

    if (staleSeats.length > 0) {
      alert("ขออภัย! มีบางที่นั่งที่คุณเลือกถูกผู้ใช้อื่นจองหรือล็อคไปก่อนแล้ว:\n" + staleSeats.join(", ") + "\nระบบจะนำที่นั่งเหล่านั้นออกจากรถเข็นของคุณ");
      setCart(prev => {
        return prev.map(c => {
          const table = tables.find(t => t.id === c.tableId);
          if (!table) return c;
          return {
            ...c,
            seatIds: c.seatIds.filter(sid => {
              const seat = table.seats.find(s => s.id === sid);
              return seat && seat.status === 'available';
            })
          };
        }).filter(c => c.seatIds.length > 0);
      });
      return;
    }

    const holdDurationMs = (config.temporaryHoldMinutes || 5) * 60 * 1000;
    const expiryTime = now + holdDurationMs;

    try {
      const updatedTables = tables.map(t => {
        const cartItem = cart.find(c => c.tableId === t.id);
        if (cartItem) {
          return {
            ...t,
            seats: t.seats.map(s => {
              if (cartItem.seatIds.includes(s.id)) {
                return {
                  ...s,
                  status: 'locked' as const,
                  lockedUntil: expiryTime,
                  lockedBySession: sessionId
                };
              }
              return s;
            })
          };
        }
        return t;
      });

      const affectedTables = updatedTables.filter(t => cart.some(c => c.tableId === t.id));
      await Promise.all(affectedTables.map(t => updateTable(t)));

      sessionStorage.setItem('hold_expiry_time', expiryTime.toString());
      setView('CHECKOUT');
    } catch (err) {
      console.error("Failed to lock seats:", err);
      alert("ไม่สามารถล็อคที่นั่งชั่วคราวได้ กรุณาลองใหม่อีกครั้ง");
    }
  };

  const handleReleaseSeats = async () => {
    if (cart.length === 0) return;

    try {
      const updatedTables = tables.map(t => {
        const cartItem = cart.find(c => c.tableId === t.id);
        if (cartItem) {
          return {
            ...t,
            seats: t.seats.map(s => {
              const seatWithLock = s as any;
              if (cartItem.seatIds.includes(s.id) && seatWithLock.lockedBySession === sessionId) {
                const { lockedUntil, lockedBySession, ...rest } = seatWithLock;
                return {
                  ...rest,
                  status: 'available' as const
                };
              }
              return s;
            })
          };
        }
        return t;
      });

      const affectedTables = updatedTables.filter(t => cart.some(c => c.tableId === t.id));
      await Promise.all(affectedTables.map(t => updateTable(t)));
      sessionStorage.removeItem('hold_expiry_time');
    } catch (err) {
      console.error("Failed to release seats:", err);
    }
  };

  const handleSeatToggle = (tableId: string, seatId: number) => {
    setCart(prev => {
      const existingTableIdx = prev.findIndex(c => c.tableId === tableId);
      if (existingTableIdx >= 0) {
        let newSeatIds = [...prev[existingTableIdx].seatIds];
        if (newSeatIds.includes(seatId)) {
          newSeatIds = newSeatIds.filter(id => id !== seatId);
        } else {
          newSeatIds.push(seatId);
        }
        
        const newCart = [...prev];
        if (newSeatIds.length === 0) {
          newCart.splice(existingTableIdx, 1);
        } else {
          newCart[existingTableIdx] = { ...newCart[existingTableIdx], seatIds: newSeatIds };
        }
        return newCart;
      } else {
        return [...prev, { tableId, seatIds: [seatId] }];
      }
    });
  };

  const handleSetSeats = (tableId: string, seatIds: number[]) => {
    setCart(prev => {
      const filtered = prev.filter(c => c.tableId !== tableId);
      if (seatIds.length === 0) return filtered;
      return [...filtered, { tableId, seatIds }];
    });
  };

  const handleBookWholeTable = (tableId: string, availableSeats: number[]) => {
    setCart(prev => {
      const filtered = prev.filter(c => c.tableId !== tableId);
      return [...filtered, { tableId, seatIds: availableSeats }];
    });
  };

  // Calculate totals
  const cartTotals = cart.reduce((acc, curr) => {
    const table = tables.find(t => t.id === curr.tableId);
    if (table) {
      acc.seats += curr.seatIds.length;
      const activeZones = config.zones || ZONES;
      const zonePrice = config.isTicketFree ? 0 : (activeZones[table.zoneId as ZoneType]?.pricePerSeat || 0);
      acc.price += curr.seatIds.length * zonePrice;
    }
    return acc;
  }, { seats: 0, price: 0 });

  const handleRedeemDrinks = async (ticketId: string, drinks: Record<string, number>, seatId?: number) => {
    const t = myTickets.find(x => x.id === ticketId);
    if (!t) return;
    const existingHistory = t.drinkHistory || {};
    const newHistory = { ...existingHistory };
    const existingHistoryBySeat = t.drinkHistoryBySeat || {};
    const newHistoryBySeat = { ...existingHistoryBySeat };
    
    let newCount = t.drinksRedeemed || 0;
    
    if (seatId) {
      const seatHistory = { ...(newHistoryBySeat[seatId] || {}) };
      Object.entries(drinks).forEach(([dId, qty]) => {
        seatHistory[dId] = (seatHistory[dId] || 0) + qty;
      });
      newHistoryBySeat[seatId] = seatHistory;
    }

    let detailList: string[] = [];
    Object.entries(drinks).forEach(([dId, qty]) => {
      newHistory[dId] = (newHistory[dId] || 0) + qty;
      newCount += qty;
      const drinkName = config.drinkMenu?.find((d: any) => d.id === dId)?.name || dId;
      detailList.push(`${drinkName}x${qty}`);
    });

    await updateTicket(ticketId, { 
      drinksRedeemed: newCount, 
      drinkHistory: newHistory,
      drinkHistoryBySeat: newHistoryBySeat 
    });
    
    await logStaffAction('REDEEM_DRINKS', `Redeemed drinks: ${detailList.join(', ')} for Ticket ${ticketId}${seatId ? ` Seat ${seatId}` : ''}`, ticketId, { drinks, totalQty: newCount - (t.drinksRedeemed || 0) });
  };

  return (
    <ConfigContext.Provider value={{ config, setConfig: async (newConfig: any) => {
      // Allow passing a function like useState updater
      const nextConfig = typeof newConfig === 'function' ? newConfig(config) : newConfig;
      await updateConfig(nextConfig);
    }, language, setLanguage, t }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 10mm; }
          html, body, #root {
            background: white !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Reset dark mode components and fix alignments for printing */
          * {
             box-shadow: none !important;
          }
          .bg-slate-900, .bg-slate-800, .bg-slate-50, .bg-slate-100 {
             background-color: transparent !important;
             color: black !important;
          }
          .text-white {
             color: black !important;
          }
          .border, .border-slate-200, .border-slate-100, .border-slate-800 {
             border-color: #e2e8f0 !important;
          }
          .print\\:hidden { display: none !important; }
          .print\\:break-inside-avoid { break-inside: avoid !important; }
        }
      `}} />
      <div 
        style={{
          '--theme-primary': config.themeColor,
          '--theme-secondary': config.enableSecondaryColor ? config.secondaryColor : config.themeColor,
          '--theme-accent': config.enableAccentColor ? config.accentColor : config.themeColor
        } as React.CSSProperties} 
        className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24 md:pb-0 print:bg-white print:pb-0 print:min-h-0 print:h-auto print:overflow-visible"
      >
        
        {/* Top Navbar */}
      {view !== 'LUCKY_DRAW' && (
      <nav className="print:hidden bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <TicketIcon className="w-8 h-8 text-primary shrink-0" />
              <span className="font-bold text-sm xs:text-base sm:text-xl tracking-tight text-slate-800 leading-tight">
                {config.eventName || 'EventTicketingPro'}
              </span>
            </div>
            
            <div className="hidden md:flex items-center space-x-1">
              <NavBtn icon={<MapIcon/>} label={t('จองที่นั่ง')} active={view==='MAP' || view==='CHECKOUT'} onClick={()=>setView('MAP')} />
              <NavBtn icon={<QrCode/>} label={t('บัตรของฉัน')} active={view==='TICKETS'} onClick={()=>setView('TICKETS')} />
              <div className="w-px h-6 bg-slate-300 mx-2" />
              <NavBtn icon={<ScanLine/>} label={t('จนท. หน้างาน')} active={view==='STAFF'} onClick={()=>setView('STAFF')} />
              <NavBtn icon={<LayoutDashboard/>} label={t('แดชบอร์ด')} active={view==='ADMIN'} onClick={()=>setView('ADMIN')} />
              <NavBtn icon={<BarChart3/>} label={t('รายงานลูกค้า')} active={view==='CLIENT'} onClick={()=>setView('CLIENT')} />
              
              <button 
                onClick={() => setLanguage(language === 'th' ? 'en' : 'th')}
                className="ml-2 flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors"
              >
                <Globe className="w-4 h-4" />
                {language === 'th' ? 'EN' : 'TH'}
              </button>
            </div>
          </div>
        </div>
      </nav>
      )}

      <main className={`max-w-7xl mx-auto px-4 py-8 print:max-w-none print:w-full print:px-0 print:py-0 print:overflow-visible print:h-auto ${view === 'LUCKY_DRAW' ? 'h-0 overflow-hidden py-0' : ''}`}>
        {view === 'MAP' && (
          <div className="animate-in fade-in flex flex-col gap-6">
            {config.bannerUrl && (
              <div className="w-full h-48 md:h-[400px] rounded-3xl overflow-hidden shadow-sm border border-slate-200 shrink-0 relative group">
                <img src={config.bannerUrl} alt="Event KV Banner" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                {!config.hideEventNameOnBanner && (
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent flex items-end p-8">
                    <h1 className="text-white text-3xl md:text-5xl font-black drop-shadow-md">{config.eventName}</h1>
                  </div>
                )}
              </div>
            )}
            <FloorPlanView 
              tables={tables} 
              cart={cart} 
              onSeatToggle={handleSeatToggle}
              onSetSeats={handleSetSeats}
              onBookWholeTable={handleBookWholeTable}
              cartTotals={cartTotals}
              onCheckout={handleProceedToCheckout}
            />
          </div>
        )}
        {view === 'CHECKOUT' && (
          <CheckoutView 
            cart={cart}
            cartTotals={cartTotals}
            tables={tables}
            onBack={async () => {
              await handleReleaseSeats();
              setView('MAP');
            }}
            holdExpiryTime={Number(sessionStorage.getItem('hold_expiry_time') || (Date.now() + (config.temporaryHoldMinutes || 5) * 60 * 1000))}
            onHoldExpired={async () => {
              await handleReleaseSeats();
              setCart([]);
              setView('MAP');
            }}
            onComplete={async (tickets: TicketPayload[]) => {
              // Firebase add tickets
              for (const tkt of tickets) {
                await addTicket(tkt);
              }
              setCart([]);
              
              // update table status in Firebase
              for (const t of tables) {
                const purchasedTickets = tickets.filter(tkt => tkt.tableId === t.id);
                if (purchasedTickets.length > 0) {
                  const boughtSeats = purchasedTickets.flatMap(tkt => tkt.seatIds);
                  const newTable = {
                    ...t,
                    seats: t.seats.map(s => boughtSeats.includes(s.id) ? { ...s, status: 'paid' as any } : s)
                  };
                  await updateTable(newTable);
                }
              }
              
              setView('SUCCESS');

              // Send email automatically
              const mainTicket = tickets[0];
              if (mainTicket && mainTicket.email) {
                try {
                  const attachments: {filename: string, content: string}[] = [];
                  const summaryTextLines: string[] = [];
                  let summaryHtml = '';

                  const activeZones = config.zones || ZONES;

                  for (const tkt of tickets) {
                    const table = tables.find(t => t.id === tkt.tableId);
                    const zoneName = table ? activeZones[table.zoneId].name : '';
                    const zonePrice = config.isTicketFree ? 0 : (table ? activeZones[table.zoneId].pricePerSeat : 0);
                    const zoneColor = table ? activeZones[table.zoneId].color : undefined;

                    for (const seatId of tkt.seatIds) {
                      const doc = await generateTicketPDF({
                        ticketId: tkt.id,
                        tableId: tkt.tableId,
                        seatId,
                        seatIds: tkt.seatIds,
                        userName: tkt.userName,
                        zoneName,
                        zonePrice,
                        eventName: config.eventName,
                        zoneColor
                      });
                      
                      const dataUrl = doc.output('datauristring');
                      const base64Content = dataUrl.split(',')[1];
                      const filename = `QR_Table_${tkt.tableId}_Seat_${seatId}.pdf`;
                      attachments.push({ filename, content: base64Content });
                      
                      summaryTextLines.push(`Table: ${tkt.tableId}, Seat: ${seatId} - Zone: ${zoneName}`);
                      summaryHtml += `<div style="margin-bottom: 10px;">
                        <p><strong>Table: ${tkt.tableId}, Seat: ${seatId}</strong> - Zone: ${zoneName}</p>
                      </div>`;
                    }
                  }

                  const summaryText = summaryTextLines.join('\n');
                  
                  // Apply Templates
                  const rawSubject = config.emailTemplateSubject || 'Your Tickets for {{eventName}}';
                  const rawBody = config.emailTemplateBody || 'Hi {{userName}},\n\nPayment successful! Your tickets are confirmed.\n\n{{ticketDetails}}\n\nPlease check the attached QR codes and present them at the entrance.';
                  
                  const replaceVars = (str: string) => {
                    return str
                      .replace(/{{eventName}}/g, config.eventName || 'EventTicketingPro')
                      .replace(/{{userName}}/g, mainTicket.userName)
                      .replace(/{{ticketDetails}}/g, summaryText);
                  };

                  const subjectText = replaceVars(rawSubject);
                  const bodyText = replaceVars(rawBody);
                  const baseUrl = window.location.origin;
                  
                  // Use only the first seat for the survey link for the primary email button
                  // to keep the email clean. The user can also use the survey button inside the PDF tickets.
                  const defaultSeatId = mainTicket.seatIds[0];
                  const surveyLink = `${baseUrl}/?view=survey&ticketId=${mainTicket.id}&name=${encodeURIComponent(mainTicket.userName)}&table=${mainTicket.tableId}&seats=${mainTicket.seatIds.join(',')}&seatId=${defaultSeatId}`;

                  const bodyHtml = getEmailHtml(config.emailTheme || 'default', config.eventName || 'EventTicket', bodyText, {
                    themeColor: config.themeColor || '#2563eb',
                    secondaryColor: config.enableSecondaryColor ? config.secondaryColor : config.themeColor,
                    accentColor: config.enableAccentColor ? config.accentColor : config.themeColor,
                    includeSurveyButton: config.emailIncludeSurveyButton,
                    surveyButtonText: config.emailSurveyButtonText,
                    surveyButtonFontSize: config.emailSurveyButtonFontSize,
                    surveyLink: surveyLink,
                    eventDate: config.eventDate,
                    eventTime: config.eventTime,
                    youtubeLink: config.emailYoutubeLink
                  });

                  const pendingData: PendingEmail = {
                    id: Math.random().toString(36).substr(2, 9),
                    to: [mainTicket.email],
                    subject: subjectText,
                    text: bodyText,
                    html: bodyHtml,
                    attachments,
                    status: 'pending',
                    createdAt: Date.now(),
                    eventName: config.eventName
                  };
                  
                  try {
                    // Try sending immediately
                    const res = await fetch('/api/send-email', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(pendingData)
                    });
                    
                    if (!res.ok) {
                      let errData;
                      try {
                        errData = await res.json();
                      } catch (e) {
                        const errText = await res.text();
                        throw new Error(`Send failed (${res.status}): ${errText.substring(0, 100)}`);
                      }
                      throw new Error(errData?.error || 'Send failed');
                    }
                  } catch (sendErr: any) {
                    console.error("Failed to auto-send email, putting in pending:", sendErr);
                    setPendingEmails(prev => [pendingData, ...prev]);
                    // Show a warning alert about email failure
                    setTimeout(() => alert('ออกบัตรสำเร็จ แต่อีเมลส่งไม่สำเร็จ: ' + sendErr.message), 1000);
                  }
                  
                } catch (e) {
                  console.error("Failed to generate draft email:", e);
                }
              }

              // Also trigger LINE/SMS notifications if enabled
              try {
                 const { sendNotification } = await import('./utils/notify');
                 const successMsg = config.notificationCustomerSuccess || 'ชำระเงินเรียบร้อย ตรวจสอบอีเมลของคุณ';
                 const subjectText = config.eventName ? `[${config.eventName}] ${successMsg}` : successMsg;
                 
                 if (config.lineNotifyEnabled) {
                    await sendNotification('line_messaging_api', { 
                       message: `New Payment Successful: ${mainTicket.userName} - ${tickets.length} seats`,
                       channelId: config.lineChannelId,
                       channelSecret: config.lineChannelSecret,
                       targetUserId: config.lineAdminUserId
                    }).catch(console.error);
                 }
                 if (config.smsEnabled && mainTicket.phone) {
                    await sendNotification('sms_twilio', { phone: mainTicket.phone, message: subjectText }).catch(console.error);
                 }
                 // LINE Push requires userId which we don't have natively at checkout unless we implement LINE Login.
                 // So we skip it here, but it's available via API if needed.
              } catch(e) {
                 console.error("Failed to send LINE/SMS:", e);
              }
            }}
          />
        )}
        {view === 'SUCCESS' && (
          <SuccessView onGoToTickets={() => setView('TICKETS')} />
        )}
        {view === 'TICKETS' && (
          <MyTicketsView 
            tickets={myTickets} 
            tables={tables} 
            surveys={surveys}
            onCheckIn={async (ticket, seatId) => {
               const updated = { ...ticket };
               if (!updated.checkInTime) {
                   updated.checkInTime = new Date().toISOString();
               }
               if (seatId !== undefined) {
                  updated.checkedInSeats = [...(updated.checkedInSeats || [])];
                  if (!updated.checkedInSeats.includes(seatId)) {
                      updated.checkedInSeats.push(seatId);
                  }
               }
               await updateTicket(ticket.id, updated);
            }}
            onCheckInGroup={async (ticket) => {
               const updated = { ...ticket };
               if (!updated.checkInTime) {
                   updated.checkInTime = new Date().toISOString();
               }
               updated.checkedInSeats = [...ticket.seatIds];
               await updateTicket(ticket.id, updated);
            }}
            onTakeSurvey={(ticket, seatId) => {
              // Bypass restrictions if in Test Mode
              if (config.surveyTestMode) {
                setSurveySourceView('TICKETS');
                setActiveTicketForSurvey({ticket, seatId});
                setView('SURVEY');
                return;
              }

              // 1. Check Date and Time
              if (config.eventDate) {
                let timeStr = config.eventTime || '00:00';
                if (timeStr.length === 5) timeStr += ':00';
                const targetTime = new Date(`${config.eventDate}T${timeStr}`).getTime();
                const now = new Date().getTime();
                if (now < targetTime) {
                  setShowSurveyCountdown(true);
                  return;
                }
              }
              
              // 2. Check Location
              if (config.eventLat && config.eventLng) {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const lat1 = position.coords.latitude;
                      const lon1 = position.coords.longitude;
                      const lat2 = parseFloat(config.eventLat);
                      const lon2 = parseFloat(config.eventLng);
                      
                      const R = 6371e3; // metres
                      const p1 = lat1 * Math.PI/180;
                      const p2 = lat2 * Math.PI/180;
                      const dp = (lat2-lat1) * Math.PI/180;
                      const dl = (lon2-lon1) * Math.PI/180;

                      const a = Math.sin(dp/2) * Math.sin(dp/2) +
                                Math.cos(p1) * Math.cos(p2) *
                                Math.sin(dl/2) * Math.sin(dl/2);
                      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                      const d = R * c;

                      if (d > 2000) { // 2km radius
                        alert(t('คุณไม่ได้อยู่ในสถานที่จัดกิจกรรม (ระยะเกิน 2 กม.)'));
                        return;
                      }

                      setSurveySourceView('TICKETS');
                      setActiveTicketForSurvey({ticket, seatId});
                      setView('SURVEY');
                    },
                    (error) => {
                      alert(t('ไม่สามารถระบุตำแหน่งของคุณได้ กรุณาเปิด GPS'));
                    }
                  );
                  return; // Don't proceed yet, wait for geolocation callback
                } else {
                  alert(t('เบราว์เซอร์ของคุณไม่รองรับการตรวจสอบสถานที่'));
                  return;
                }
              }

              setSurveySourceView('TICKETS');
              setActiveTicketForSurvey({ticket, seatId});
              setView('SURVEY');
            }}
          />
        )}
        {view === 'STAFF' && (
          <AuthView requiredRole="staff">
            <StaffPortalView 
               tickets={myTickets} 
               tables={tables} 
               surveys={surveys}
               luckyDrawWinners={luckyDrawWinners}
               booths={booths}
               boothScanLogs={boothScanLogs}
               onClaimPrize={async (ticketId, seatId, rawQRData) => {
                 await updateLuckyDrawWinner(`${ticketId}_${seatId || 'all'}`, { 
                   claimed: true,
                   claimedAt: new Date().toISOString(),
                   scannedQR: rawQRData || '',
                   claimedBy: auth.currentUser?.email || 'สตาฟหน้างาน'
                 });
                 await logStaffAction('CLAIM_PRIZE', `Claimed Lucky Draw Prize for Ticket ${ticketId} Seat ${seatId || 'all'}. Scanned QR: ${rawQRData || 'N/A'}`, ticketId);
               }}
               onScan={async (tid, seatId) => {
                  const ticket = myTickets.find(t => t.id === tid);
                  if (ticket) {
                     const updated = { ...ticket };
                     let actionMsg = `Checked in Ticket ${tid} [${ticket.userName}]`;
                     if (!updated.checkInTime) {
                         updated.checkInTime = new Date().toISOString();
                     }
                     if (seatId !== undefined) {
                        updated.checkedInSeats = [...(updated.checkedInSeats || [])];
                        if (!updated.checkedInSeats.includes(seatId)) {
                            updated.checkedInSeats.push(seatId);
                        }
                        actionMsg += ` Seat ${seatId}`;
                     } else {
                        actionMsg += ` (All Seats)`;
                     }
                     await updateTicket(ticket.id, updated);
                     await logStaffAction('CHECK_IN', actionMsg, tid);
                  }
               }} 
               onCheckInGroup={async (ticket) => {
                  const updated = { ...ticket };
                  if (!updated.checkInTime) {
                      updated.checkInTime = new Date().toISOString();
                  }
                  updated.checkedInSeats = [...ticket.seatIds];
                  await updateTicket(ticket.id, updated);
                  await logStaffAction('CHECK_IN_GROUP', `Checked in group Ticket ${ticket.id} [${ticket.userName}] (${ticket.seatIds.length} seats)`, ticket.id);
               }}
               onRedeemDrinks={handleRedeemDrinks} 
               onRequestHelp={async (message) => {
                 try {
                   await addDoc(collection(db, 'help_requests'), {
                     message,
                     status: 'pending',
                     staffUid: auth.currentUser?.uid || 'Unknown UID',
                     staffEmail: auth.currentUser?.email || 'Unknown Email',
                     timestamp: new Date().toISOString()
                   });
                   
                   // Send LINE notification
                   if (config.lineNotifyEnabled && config.lineChannelId && config.lineChannelSecret) {
                      const { sendNotification } = await import('./utils/notify');
                      await sendNotification('line_messaging_api', {
                         message: `🚨 [Help Request]\nStaff: ${auth.currentUser?.email || 'Unknown'}\nMessage: ${message}`,
                         channelId: config.lineChannelId,
                         channelSecret: config.lineChannelSecret,
                         targetUserId: config.lineAdminUserId || ''
                      }).catch(e => console.error("LINE Notify Help failed", e));
                   }

                   alert('ส่งคำขอความช่วยเหลือไปยังแอดมินแล้ว (Help request sent to admin)');
                 } catch (e) {
                   console.error(e);
                   alert('เกิดข้อผิดพลาดในการส่งคำขอความช่วยเหลือ');
                 }
               }}
               onTakeSurvey={(ticket, seatId) => {
                 setSurveySourceView('STAFF');
                 setActiveTicketForSurvey({ticket, seatId});
                 setView('SURVEY');
               }}
            />
          </AuthView>
        )}
        {view === 'ADMIN' && (
          <AuthView requiredRole="admin">
            <AdminDashboardView 
              tables={tables} 
              setTables={async (action: any) => {
                const nextTables = typeof action === 'function' ? action(tables) : action;
                
                // Track IDs in new tables
                const nextIds = new Set(nextTables.map((t: Table) => t.id));
                const prevMap = new Map(tables.map((t: Table) => [t.id, t]));
                
                // Delete tables that are no longer present
                const deletePromises = [];
                for (const t of tables) {
                  if (!nextIds.has(t.id)) {
                    deletePromises.push(deleteTable(t.id));
                  }
                }
                
                // Add or update only changed/new tables
                const updatePromises = [];
                for (const t of nextTables) {
                  const prev = prevMap.get(t.id);
                  if (!prev || JSON.stringify(prev) !== JSON.stringify(t)) {
                    updatePromises.push(updateTable(t));
                  }
                }
                
                await Promise.all([...deletePromises, ...updatePromises]);
              }} 
              tickets={myTickets} 
              setMyTickets={async (action: any) => {
                const nextTickets = typeof action === 'function' ? action(myTickets) : action;
                const existingMap = new Map(myTickets.map(x => [x.id, x]));
                const writePromises = nextTickets.map((t: TicketPayload) => {
                  const existing = existingMap.get(t.id);
                  if (existing) {
                    if (JSON.stringify(existing) !== JSON.stringify(t)) {
                      return updateTicket(t.id, t);
                    }
                    return Promise.resolve();
                  } else {
                    return addTicket(t);
                  }
                });
                await Promise.all(writePromises);
              }} 
              surveys={surveys} 
              pendingEmails={pendingEmails} 
              setPendingEmails={setPendingEmails} 
              onOpenLuckyDraw={() => setView('LUCKY_DRAW')} 
              onResetApp={handleResetApp} 
              booths={booths}
              boothScanLogs={boothScanLogs}
            />
          </AuthView>
        )}
        {view === 'CLIENT' && (
          <AuthView requiredRole="user">
            <ClientDashboardView 
              tables={tables}
              tickets={myTickets}
              surveys={surveys}
              luckyDrawWinners={luckyDrawWinners}
              booths={booths}
              boothScanLogs={boothScanLogs}
            />
          </AuthView>
        )}
        {view === 'LUCKY_DRAW' && (
          <LuckyDrawView tickets={myTickets} surveys={surveys} luckyDrawWinners={luckyDrawWinners} setLuckyDrawWinners={setLuckyDrawWinners} onClose={() => setView('ADMIN')} />
        )}
        {view === 'SURVEY' && activeTicketForSurvey && activeTicketForSurvey.seatId !== undefined && (
          <SurveyView 
            activeTicket={activeTicketForSurvey as {ticket: TicketPayload, seatId: number}}
            onSubmit={async (data) => {
              await addSurvey(data);
              await logStaffAction('SUBMIT_SURVEY', `Submitted survey for Ticket ${activeTicketForSurvey.ticket.id} Seat ${activeTicketForSurvey.seatId}`, activeTicketForSurvey.ticket.id);
            }}
            onBack={() => { setView(surveySourceView); setActiveTicketForSurvey(null); }}
          />
        )}
      </main>

      {showSurveyCountdown && (
        <SurveyCountdownPopup
          onClose={() => setShowSurveyCountdown(false)}
          eventDate={config.eventDate!}
          eventTime={config.eventTime}
          themeColor={config.themeColor || '#2563eb'}
          buttonText={config.emailSurveyButtonText}
          buttonFontSize={config.emailSurveyButtonFontSize}
        />
      )}

      {/* Mobile Nav */}
      {view !== 'LUCKY_DRAW' && (
      <div className="print:hidden md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-50 pb-safe">
        <MobileNavBtn icon={<MapIcon/>} label="จองที่นั่ง" active={view==='MAP'} onClick={()=>setView('MAP')}/>
        <MobileNavBtn icon={<QrCode/>} label="บัตรฉัน" active={view==='TICKETS'} onClick={()=>setView('TICKETS')}/>
        <MobileNavBtn icon={<ScanLine/>} label="เจ้าหน้าที่" active={view==='STAFF'} onClick={()=>setView('STAFF')}/>
        <MobileNavBtn icon={<LayoutDashboard/>} label="หลังบ้าน" active={view==='ADMIN'} onClick={()=>setView('ADMIN')}/>
        <MobileNavBtn icon={<BarChart3/>} label="ลูกค้า" active={view==='CLIENT'} onClick={()=>setView('CLIENT')}/>
      </div>
      )}
    </div>
    </ConfigContext.Provider>
  );
}

function NavBtn({icon, label, active, onClick}: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors min-w-0 ${active ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
    >
      {React.cloneElement(icon, { className: "w-4 h-4 shrink-0" })}
      <span className="truncate">{label}</span>
    </button>
  );
}

function MobileNavBtn({icon, label, active, onClick}: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-2 w-full flex-1 min-w-0 ${active ? 'text-primary' : 'text-slate-500'}`}
    >
      {React.cloneElement(icon, { className: "w-5 h-5 shrink-0" })}
      <span className="text-[10px] font-medium leading-tight text-center text-balance break-words line-clamp-2 w-full px-1">{label}</span>
    </button>
  );
}

