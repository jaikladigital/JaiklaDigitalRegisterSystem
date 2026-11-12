/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import React, { useState, useContext } from 'react';
import { ScanLine, CheckCircle2, AlertCircle, GlassWater, Camera, X, ClipboardList, Gift, Store, ShoppingCart, UserCheck, ShieldCheck, History, Landmark } from 'lucide-react';
import ThaiQRPayment from './ThaiQRPayment';
import { TicketPayload, ZoneType, EventBooth, BoothScanLog } from '../types';
import { ConfigContext } from '../ConfigContext';
import { Scanner } from '@yudiel/react-qr-scanner';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { 
  getTicketWelcomeDrinksInfo, 
  calculateCartPriceWithWelcomeDrinks,
  calculateDrinkPrice 
} from '../utils/welcomeDrinks';

export default function StaffPortalView({ 
  tickets, 
  tables, 
  surveys = [], 
  luckyDrawWinners = [], 
  booths = [],
  boothScanLogs = [],
  onClaimPrize, 
  onScan, 
  onRedeemDrinks, 
  onTakeSurvey, 
  onCheckInGroup, 
  onRequestHelp 
}: { 
  tickets: TicketPayload[], 
  tables: any[], 
  surveys?: any[], 
  luckyDrawWinners?: {ticketId: string, seatId?: number, claimed: boolean}[], 
  booths?: EventBooth[],
  boothScanLogs?: BoothScanLog[],
  onClaimPrize?: (ticketId: string, seatId?: number, rawQRData?: string) => void, 
  onScan: (id: string, seatId?: number) => void, 
  onRedeemDrinks?: (ticketId: string, drinks: Record<string, number>, seatId?: number) => void, 
  onTakeSurvey?: (t: TicketPayload, seatId?: number) => void, 
  onCheckInGroup?: (t: TicketPayload) => void, 
  onRequestHelp?: (message?: string) => void 
}) {
  const [activeMode, setActiveMode] = useState<'ticket' | 'booth'>('ticket');
  const [selectedBoothId, setSelectedBoothId] = useState<string>('');
  const [boothSalesAmount, setBoothSalesAmount] = useState<string>('');
  const [boothNotes, setBoothNotes] = useState<string>('');
  const [boothScanResult, setBoothScanResult] = useState<{status: 'success' | 'warning' | 'error', message: string} | null>(null);
  const [isBoothCameraActive, setIsBoothCameraActive] = useState(false);

  const [scanResult, setScanResult] = useState<{status: 'success' | 'warning' | 'error', message: string} | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [activeTicket, setActiveTicket] = useState<{ticket: TicketPayload, seatId?: number, rawQRData?: string} | null>(null);
  const [drinkCart, setDrinkCart] = useState<Record<string, number>>({});
  const { config } = useContext(ConfigContext);
  
  const activeZones = config?.zones;

  const processScan = (scannedData: string) => {
    let searchId = scannedData;
    let scannedSeatId: number | undefined;
    let scannedTableId: string | undefined;
    let isJson = false;

    // Try to parse JSON in case the QR code is generated with the new format {ticketId, tableId, seatId}
    try {
      const parsed = JSON.parse(scannedData);
      if (parsed.ticketId) {
        searchId = parsed.ticketId;
        scannedSeatId = parsed.seatId;
        scannedTableId = parsed.tableId;
        isJson = true;
      }
    } catch (e) {
      // Not JSON, fallback to raw string
    }

    const target = tickets.find(t => t.id === searchId);

    // Check if the ticket was moved (table or seat mismatch between scanned QR and actual database)
    if (target && isJson) {
      const dbTableId = target.tableId;
      const dbSeatIds = target.seatIds || [];
      
      let isMismatched = false;
      if (scannedTableId && scannedTableId !== dbTableId) {
        isMismatched = true;
      }
      if (scannedSeatId !== undefined && !dbSeatIds.includes(scannedSeatId)) {
        isMismatched = true;
      }
      
      if (isMismatched) {
        setScanResult({
          status: 'error',
          message: `❌ ตั๋วเก่ายกเลิกแล้ว (ไม่สามารถใช้สแกนได้):\n\nคุณ ${target.userName}\nได้ทำการย้ายที่นั่งไปแล้ว!\n\n📍 ที่นั่งปัจจุบันในระบบ:\nโต๊ะ ${dbTableId} (ที่นั่ง [${dbSeatIds.join(', ')}])\n\nกรุณาใช้ QR Code บัตรใหม่ในการสแกนเช็คอินเพื่อความถูกต้อง`
        });
        setActiveTicket(null);
        setDrinkCart({});
        setIsCameraActive(false);
        return;
      }
    }

    const matchedUser = target || { 
      id: 'DUMMY-TICKET', userName: 'คุณ ทดสอบ ระบบ', tableId: 'VIP-1', seatIds: [1, 2], checkedInSeats: [],
      totalAmount: 10000, paymentMethod: 'CASH', status: 'paid', qrCodeUrl: '', drinksRedeemed: 0, phone: '', email: '' 
    };
    
    const isSeatAlreadyCheckedIn = scannedSeatId ? (matchedUser.checkedInSeats || []).includes(scannedSeatId) : (matchedUser.checkedInSeats?.length === matchedUser.seatIds.length || !!matchedUser.checkInTime);
    
    if (target && onScan && !isSeatAlreadyCheckedIn) {
      onScan(target.id, scannedSeatId);
    }

    let messageStr = isSeatAlreadyCheckedIn
      ? `แจ้งเตือน: หมายเลขนี้ทำการเช็คอินแล้ว!\n\nคุณ ${matchedUser.userName}\n(โต๊ะ ${matchedUser.tableId} ${scannedSeatId ? `ที่นั่ง ${scannedSeatId}` : `จำนวน ${matchedUser.seatIds.length} ที่นั่ง`})\n(เวลาเช็คอิน: ${new Date(target?.checkInTime || Date.now()).toLocaleTimeString('th-TH')})`
      : `เช็คอินสำเร็จ:\n\nคุณ ${matchedUser.userName}\n(โต๊ะ ${matchedUser.tableId} ${scannedSeatId ? `ที่นั่ง ${scannedSeatId}` : `จำนวน ${matchedUser.seatIds.length} ที่นั่ง`})`;

    const wonPrize = luckyDrawWinners.find(w => w.ticketId === matchedUser.id && (w.seatId === scannedSeatId || !scannedSeatId));
    if (wonPrize) {
      if (wonPrize.claimed) {
        messageStr += `\n\n🎁 สถานะรางวัล: รับรางวัลไปแล้ว`;
      } else {
        messageStr += `\n\n🎉 *** ยินดีด้วย! ที่นั่งนี้ได้รับรางวัล ลัคกี้ดรอว์ ***`;
      }
    }

    setScanResult({ 
      status: isSeatAlreadyCheckedIn ? 'warning' : 'success', 
      message: messageStr
    });
    setActiveTicket({ ticket: matchedUser, seatId: scannedSeatId, rawQRData: scannedData });
    setDrinkCart({});
    setShowPayment(false);
    setIsCameraActive(false);
  };

  const simulateScan = () => {
    processScan(JSON.stringify({ ticketId: tickets[0]?.id || 'DUMMY', tableId: tickets[0]?.tableId || 'T1', seatId: tickets[0]?.seatIds[0] || 1 }));
  };

  const processBoothScan = async (scannedData: string) => {
    if (!selectedBoothId) {
      alert("📊 โปรดเลือกบูธกิจกรรมของคุณจากรายการด้านล่างก่อนสแกน");
      return;
    }
    const currentBooth = booths.find(b => b.id === selectedBoothId);
    if (!currentBooth) {
      alert("❌ ไม่พบข้อมูลบูธกิจกรรมที่เลือก");
      return;
    }

    let searchId = scannedData;
    let scannedSeatId: number | undefined;
    let scannedTableId: string | undefined;
    let isJson = false;
    try {
      const parsed = JSON.parse(scannedData);
      if (parsed.ticketId) {
        searchId = parsed.ticketId;
        scannedSeatId = parsed.seatId;
        scannedTableId = parsed.tableId;
        isJson = true;
      }
    } catch (e) {}

    const targetTicket = tickets.find(t => t.id === searchId);
    if (!targetTicket) {
      setBoothScanResult({
        status: "error",
        message: "❌ ไม่พบข้อมูลบัตรผู้ร่วมกิจกรรมนี้ในระบบ กรุณาลองแสกนใหม่อีกครั้ง"
      });
      setIsBoothCameraActive(false);
      return;
    }

    // Check if the ticket was moved (table or seat mismatch between scanned QR and actual database)
    if (isJson) {
      const dbTableId = targetTicket.tableId;
      const dbSeatIds = targetTicket.seatIds || [];
      
      let isMismatched = false;
      if (scannedTableId && scannedTableId !== dbTableId) {
        isMismatched = true;
      }
      if (scannedSeatId !== undefined && !dbSeatIds.includes(scannedSeatId)) {
        isMismatched = true;
      }
      
      if (isMismatched) {
        setBoothScanResult({
          status: 'error',
          message: `❌ บูธกิจกรรม: ตั๋วเก่ายกเลิกแล้ว (ไม่สามารถร่วมกิจกรรมได้):\n\nคุณ ${targetTicket.userName}\nได้ทำการย้ายที่นั่งไปแล้ว!\n\n📍 ที่นั่งปัจจุบัน: โต๊ะ ${dbTableId} (ที่นั่ง [${dbSeatIds.join(', ')}])\n\nกรุณาใช้ QR Code บัตรใหม่ในการร่วมสนุก`
        });
        setIsBoothCameraActive(false);
        return;
      }
    }

    try {
      await addDoc(collection(db, "boothScanLogs"), {
        boothId: currentBooth.id,
        boothName: currentBooth.name,
        ticketId: targetTicket.id,
        seatId: scannedSeatId || null,
        userName: targetTicket.userName,
        phone: targetTicket.phone || "-",
        timestamp: new Date().toISOString(),
        salesAmount: Number(boothSalesAmount) || 0,
        notes: boothNotes || ""
      });

      setBoothScanResult({
        status: "success",
        message: `🎉 บันทึกการเข้าร่วมกิจกรรมของ คุณ ${targetTicket.userName} ที่บูธ ${currentBooth.name} สำเร็จแล้ว!\n💰 ยอดซื้อขาย: ฿${(Number(boothSalesAmount) || 0).toLocaleString()} บาท\n📝 โน้ตย่อ: ${boothNotes || "-"}`
      });

      // Clear transient fields
      setBoothSalesAmount("");
      setBoothNotes("");
      setIsBoothCameraActive(false);
    } catch (err: any) {
      setBoothScanResult({
        status: "error",
        message: `❌ เกิดข้อผิดพลาดในการบันทึก: ${err.message}`
      });
      setIsBoothCameraActive(false);
    }
  };

  const simulateBoothScan = () => {
    if (!selectedBoothId && booths.length > 0) {
      setSelectedBoothId(booths[0].id);
    }
    processBoothScan(JSON.stringify({ ticketId: tickets[0]?.id || "DUMMY", tableId: tickets[0]?.tableId || "T1", seatId: tickets[0]?.seatIds[0] || 1 }));
  };

  const handleConfirmRedeem = () => {
    if (activeTicket && onRedeemDrinks) {
      onRedeemDrinks(activeTicket.ticket.id, drinkCart, activeTicket.seatId);
      setScanResult({ status: 'success', message: `บันทึกรายการสำเร็จ: บริการเครื่องดื่มให้ คุณ ${activeTicket.ticket.userName} เรียบร้อยแล้ว` });
      setActiveTicket(null);
      setDrinkCart({});
      setShowPayment(false);
    }
  };

  const cartCalculation = activeTicket?.ticket
    ? calculateCartPriceWithWelcomeDrinks(drinkCart, activeTicket.ticket, config, tables)
    : null;

  const drinkTotalPrice = cartCalculation ? cartCalculation.totalCost : Object.entries(drinkCart).reduce((sum, [dId, qty]) => {
    const d = config.drinks?.find((x:any)=>x.id === dId);
    return sum + calculateDrinkPrice(d, qty as number, config.isWholeStoreFree);
  }, 0);

  const getZoneForTicket = (ticket: TicketPayload) => {
    const table = tables.find((t: any) => t.id === ticket.tableId);
    if (!table || !activeZones) return null;
    return activeZones[table.zoneId as ZoneType];
  };

  return (
    <div className="max-w-md mx-auto pb-20">
      <div className="bg-slate-900 text-white rounded-t-3xl p-6 text-center relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 to-slate-950">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZzI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom,white,transparent)]" />
        <div className="relative z-10">
          <button 
            type="button"
            onClick={() => {
              const msg = window.prompt('ระบุปัญหาหรือความช่วยเหลือที่ต้องการจากแอดมิน:');
              if (msg !== null && onRequestHelp) {
                onRequestHelp(msg);
              }
            }}
            className="absolute top-0 right-0 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 p-2 rounded-full transition-colors animate-pulse"
            title="ขอความช่วยเหลือจากแอดมิน"
          >
            <AlertCircle className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold mt-2 font-sans tracking-tight">โหมดเจ้าหน้าที่ (Staff Scanner)</h2>
          <p className="text-slate-400 text-sm mt-1">ใช้สแกน QR หน้างาน & กิจกรรมบูธ</p>
        </div>
      </div>
      
      <div className="bg-white rounded-b-3xl shadow-md border-x border-b border-slate-200/80 p-6 flex flex-col items-center relative z-20">
        {/* Tab Switcher between Ticket Validation & Booth Scans */}
        <div className="flex bg-slate-100 p-1 rounded-2xl mb-6 gap-1 w-full border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setActiveMode('ticket')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${activeMode === 'ticket' ? 'bg-white text-slate-800 shadow-md font-extrabold border border-slate-100' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <UserCheck className="w-4 h-4 text-primary shrink-0" />
            ตรวจบัตร/หักจ่ายดื่ม
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('booth')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${activeMode === 'booth' ? 'bg-white text-slate-800 shadow-md font-extrabold border border-slate-100' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Store className="w-4 h-4 text-rose-500 shrink-0" />
            สแกนกิจกรรมบูธ
          </button>
        </div>

        {activeMode === 'ticket' ? (
          <div className="w-full flex flex-col items-center">
            {isCameraActive ? (
              <div className="w-full max-w-[300px] mb-8 flex flex-col items-center">
                <div className="w-full rounded-3xl overflow-hidden shadow-inner border-4 border-slate-300 relative bg-slate-900 aspect-square">
                  <Scanner 
                    onScan={(result) => result && result.length > 0 && processScan(result[0].rawValue)}
                    components={{ audio: false, finder: false }}
                    styles={{ container: { width: '100%', height: '100%' } }}
                  />
                  <div className="absolute inset-0 border-4 border-slate-800/10 pointer-events-none z-10" />
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-primary shadow-[0_0_15px_var(--theme-primary)] opacity-80 animate-pulse z-20" />
                  <button 
                    type="button"
                    onClick={() => setIsCameraActive(false)}
                    className="absolute top-2 right-2 bg-black/50 p-2 rounded-full text-white hover:bg-black/80 z-30 transition-colors"
                    title="ปิดกล้อง"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-4">กำลังสแกนผ่านกล้อง...</p>
              </div>
            ) : (
              <div className="w-64 h-64 rounded-3xl mb-8 relative flex items-center justify-center bg-slate-50 cursor-pointer transition-all hover:bg-white hover:shadow-xl hover:-translate-y-1 shadow-inner group overflow-hidden border border-slate-200" onClick={() => setIsCameraActive(true)}>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:1rem_1rem] [mask-image:radial-gradient(circle_at_center,black_40%,transparent_100%)] opacity-40" />
                
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform duration-500">
                    <Camera className="w-12 h-12 text-primary" />
                  </div>
                  <p className="text-sm font-bold text-slate-700 uppercase tracking-widest text-center px-4">แตะเปิดกล้องเพื่อสแกน QR</p>
                </div>
                <div className="absolute inset-0 border-4 border-primary/10 border-dashed rounded-3xl group-hover:border-primary/30 transition-colors" />
              </div>
            )}

            {!isCameraActive && (
              <button 
                type="button"
                onClick={simulateScan}
                className="text-slate-400 hover:text-slate-600 text-xs font-medium underline underline-offset-4 mb-8 transition-colors"
              >
                จำลองการสแกน (Simulation Demo)
              </button>
            )}

            {scanResult && (
              <div className={`w-full p-4 rounded-xl flex flex-col gap-3 ${scanResult.status === 'success' || scanResult.status === 'warning' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                <div className="flex items-start gap-3">
                  {scanResult.status === 'success' || scanResult.status === 'warning' ? <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" /> : <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-balance">{scanResult.status === 'success' ? 'อนุมัติการเข้างาน' : scanResult.status === 'warning' ? 'หมายเลขนี้ทำการเช็คอินแล้ว' : 'ข้อผิดพลาด'}</p>
                    <p className="text-sm mt-1 whitespace-pre-line break-words leading-relaxed">{scanResult.message}</p>
                  </div>
                </div>

                {activeTicket && (() => {
                  const currentTicket = tickets.find(t => t.id === activeTicket.ticket.id) || activeTicket.ticket;
                  const welcomeInfo = getTicketWelcomeDrinksInfo(currentTicket, config, tables);
                  
                  return (
                    <div className="mt-1 text-left">
                      <div className="bg-white/80 border border-indigo-100/80 rounded-xl p-3 space-y-2 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[11px] text-indigo-950 flex items-center gap-1.5">
                            🍹 ผลตรวจสิทธิ์เครื่องดื่มต้อนรับ (Welcome Drink)
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            welcomeInfo.remainingAllowance > 0 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {welcomeInfo.remainingAllowance > 0 ? `เหลือสิทธิ์ ${welcomeInfo.remainingAllowance} แก้ว` : 'ใช้สิทธิ์ครบแล้ว'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-center py-1 bg-white rounded-lg border border-indigo-50/50">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block leading-none mb-1">สิทธิ์ทั้งหมด</span>
                            <span className="text-xs font-black text-slate-700">{welcomeInfo.totalAllowance} แก้ว</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block leading-none mb-1">รับแล้ว</span>
                            <span className="text-xs font-black text-indigo-700">{welcomeInfo.previousRedeemed} แก้ว</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block leading-none mb-1">คงเหลือ</span>
                            <span className="text-xs font-black text-emerald-600">{welcomeInfo.remainingAllowance} แก้ว</span>
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-600 font-medium">
                          <span className="font-extrabold text-slate-700">เครื่องดื่มต้อนรับที่ได้รับสิทธิ์: </span>
                          {welcomeInfo.matchingDrinks.length > 0 ? (
                            <span className="font-bold text-indigo-700">
                              {welcomeInfo.matchingDrinks.map((d: any) => d.name).join(', ')}
                            </span>
                          ) : (
                            <span className="text-rose-500 font-extrabold">⚠️ ไม่ได้กำหนดสิทธิ์ Welcome Drink ให้กับบัตรในกลุ่มนี้</span>
                          )}
                        </div>

                        {welcomeInfo.previousRedeemed > 0 && (
                          <div className="text-[9px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="font-bold text-slate-700 block mb-1">📋 รายการที่เคยรับไปแล้วสำหรับตั๋วนี้:</span>
                            <div className="space-y-0.5 max-h-20 overflow-y-auto font-sans">
                              {Object.entries(currentTicket.drinkHistory || {}).map(([dId, qty]) => {
                                const isMatching = welcomeInfo.matchingDrinkIds.includes(dId);
                                if (!isMatching || Number(qty) <= 0) return null;
                                const d = config.drinks?.find((x: any) => x.id === dId);
                                return (
                                  <div key={dId} className="flex justify-between text-slate-600">
                                    <span>• {d?.name || dId}</span>
                                    <span className="font-bold">x{qty} แก้ว</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {activeTicket && (() => {
                  const currentTicket = tickets.find(t => t.id === activeTicket.ticket.id) || activeTicket.ticket;
                  const hasSurvey = surveys.some(s => s.ticketId === currentTicket.id && (!activeTicket.seatId || s.seatId === activeTicket.seatId));
                  const wonPrize = luckyDrawWinners.find(w => w.ticketId === currentTicket.id && (w.seatId === activeTicket.seatId || !activeTicket.seatId));
                  const isGroupCheckinAvailable = currentTicket.seatIds.length > 1 && (currentTicket.checkedInSeats?.length || 0) < currentTicket.seatIds.length;
                  
                  return (
                    <div className="flex flex-col gap-2 mt-2">
                     {onCheckInGroup && isGroupCheckinAvailable && (
                        <button 
                          type="button"
                          onClick={() => {
                              onCheckInGroup(currentTicket);
                              setScanResult(prev => prev ? { ...prev, message: prev.message + '\n\n✅ อัปเดต: เช็คอินกลุ่มสำเร็จทั้งหมดเรียบร้อย' } : null);
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                        >
                          <ScanLine className="w-4 h-4" /> 
                          ทำรายการเช็คอินกลุ่มทั้งหมด ({currentTicket.seatIds.length} ที่นั่ง)
                        </button>
                     )}
                     {onTakeSurvey && activeTicket.seatId !== undefined && (
                       <button 
                          type="button"
                          onClick={() => onTakeSurvey(currentTicket, activeTicket.seatId)}
                          disabled={hasSurvey}
                          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors ${hasSurvey ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-100'}`}
                        >
                          <ClipboardList className="w-4 h-4" /> 
                          {hasSurvey ? 'ผู้ใช้นี้ได้ทำแบบประเมินแล้ว' : 'ทำแบบประเมินสำหรับรายการนี้'}
                        </button>
                     )}
                     {wonPrize && !wonPrize.claimed && onClaimPrize && (
                        <button 
                          type="button"
                          onClick={() => {
                            onClaimPrize(
                              currentTicket.id, 
                              activeTicket.seatId, 
                              activeTicket.rawQRData || JSON.stringify({ ticketId: currentTicket.id, tableId: currentTicket.tableId, seatId: activeTicket.seatId })
                            );
                            setScanResult(prev => prev ? { ...prev, message: prev.message.replace('*** ยินดีด้วย! ที่นั่งนี้ได้รับรางวัล ลัคกี้ดรอว์ ***', 'สถานะรางวัล: รับรางวัลไปแล้ว') } : null);
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors bg-white text-amber-600 border border-amber-300 hover:bg-amber-50"
                        >
                          🎁 กดเพื่อยืนยันการรับรางวัล
                        </button>
                     )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Wristband Simulator */}
            <div className="w-full mt-8 pt-8 border-t border-slate-100">
               <div className="flex items-center justify-between mb-6">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2">
                   <div className={`p-2 rounded-lg ${activeTicket ? 'bg-primary text-white shadow-md shadow-primary/30' : 'bg-slate-100 text-slate-600'}`}>
                     <GlassWater className="w-5 h-5" />
                   </div> 
                   จ่ายเครื่องดื่ม
                 </h3>
                 {activeTicket && (
                   <span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold animate-pulse">
                     🟢 ตรวจสอบแล้ว
                   </span>
                 )}
               </div>

               {activeTicket && (() => {
                 const welcomeInfo = getTicketWelcomeDrinksInfo(activeTicket.ticket, config, tables);
                 if (welcomeInfo.totalAllowance > 0) {
                   return (
                     <div className="mb-6 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 p-4 rounded-2xl flex flex-col sm:flex-row justify-between gap-4 shadow-sm">
                       <div className="space-y-1.5 text-left flex-1 min-w-0">
                         <h4 className="font-bold text-indigo-950 text-sm flex items-center gap-2">
                           🍹 บันทึกสิทธิ์ Welcome Drink สำหรับที่นั่งนี้
                         </h4>
                         <p className="text-xs text-slate-500 font-medium leading-relaxed">
                           ตั๋วนี้อยู่ในโซน <span className="font-extrabold text-indigo-700">{activeTicket.ticket.tableId.split('-')[0]}</span> (โต๊ะ {activeTicket.ticket.tableId}) ซึ่งได้รับสิทธิ์เครื่องดื่มต้อนรับ <span className="font-extrabold text-indigo-700">{welcomeInfo.zoneQuota} แก้ว/ที่นั่ง</span>
                         </p>
                         {welcomeInfo.matchingDrinks.length > 0 ? (
                           <div className="text-xs text-slate-600 font-bold flex flex-wrap gap-1.5 items-center mt-2">
                             <span>เครื่องดื่มต้อนรับที่ร่วมรายการ:</span>
                             {welcomeInfo.matchingDrinks.map((d: any) => (
                               <span key={d.id} className="bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                                 {d.name}
                               </span>
                             ))}
                           </div>
                         ) : (
                           <p className="text-[10px] text-rose-500 font-bold mt-1">
                             ⚠️ ยังไม่มีการตั้งค่าเครื่องดื่มชนิดใดเป็น Welcome Drink สำหรับที่นั่งนี้
                           </p>
                         )}
                       </div>
                       <div className="flex sm:flex-col items-center justify-center gap-2 sm:gap-1 shrink-0 bg-white border border-indigo-100 px-4 py-2.5 rounded-xl min-w-[120px]">
                         <div className="text-center">
                           <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">สิทธิ์คงเหลือ</span>
                           <span className="text-2xl font-black text-indigo-700 font-sans">
                             {welcomeInfo.remainingAllowance} <span className="text-xs font-bold text-slate-500">/ {welcomeInfo.totalAllowance} แก้ว</span>
                           </span>
                         </div>
                       </div>
                     </div>
                   );
                 }
                 return null;
               })()}

               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                 {config.drinks?.length === 0 ? (
                   <p className="text-slate-400 text-sm w-full md:col-span-4 text-center py-4">ไม่มีรายการเครื่องดื่ม</p>
                 ) : (
                   config.drinks?.map((drink: any) => {
                     const currentCount = drinkCart[drink.id] || 0;
                     const colorClasses: Record<string, string> = {
                       blue: 'bg-blue-50 text-blue-800 border-blue-200 shadow-blue-500/10 hover:bg-blue-100',
                       amber: 'bg-amber-50 text-amber-800 border-amber-200 shadow-amber-500/10 hover:bg-amber-100',
                       emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-500/10 hover:bg-emerald-100',
                       rose: 'bg-rose-50 text-rose-800 border-rose-200 shadow-rose-500/10 hover:bg-rose-100',
                       purple: 'bg-purple-50 text-purple-800 border-purple-200 shadow-purple-500/10 hover:bg-purple-100',
                     };
                     const currentClass = colorClasses[drink.color] || colorClasses.blue;
                     const disabledClass = !activeTicket ? 'opacity-40 grayscale pointer-events-none' : '';
                     const selectedClass = currentCount > 0 ? 'ring-2 ring-primary ring-offset-2' : '';

                     return (
                       <div key={drink.id} className="relative group">
                         {currentCount > 0 && (
                           <div className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center font-bold text-xs shadow-md z-10 animate-in zoom-in">
                             {currentCount}
                           </div>
                         )}
                         <button 
                           disabled={!activeTicket}
                           type="button"
                           onClick={() => setDrinkCart(prev => ({...prev, [drink.id]: (prev[drink.id] || 0) + 1}))}
                           className={`flex flex-col items-center justify-center p-3 sm:p-4 w-full rounded-2xl font-bold border transition-all shadow-sm min-h-[5rem] ${currentClass} ${disabledClass} ${selectedClass} active:scale-95`}
                         >
                           <span className="text-center text-sm md:text-base leading-tight break-words text-balance px-1">{drink.name}</span>
                           {drink.price > 0 && <span className="text-xs mt-1 font-medium bg-white/50 px-2 rounded-full text-slate-800">฿{drink.price}</span>}
                         </button>
                         {currentCount > 0 && (
                           <button 
                             type="button"
                             onClick={(e) => { 
                               e.stopPropagation(); 
                               setDrinkCart(prev => { 
                                 const val = prev[drink.id] - 1; 
                                 if(val <= 0) { const newCart={...prev}; delete newCart[drink.id]; return newCart; } 
                                 return {...prev, [drink.id]: val}; 
                               }); 
                             }}
                             className="absolute -bottom-2 -left-2 w-7 h-7 bg-slate-800 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-md z-10 hover:scale-110 transition-transform"
                             title="ลดจำนวน"
                           >
                             -
                           </button>
                         )}
                       </div>
                     );
                   })
                 )}
               </div>

               {activeTicket && (
                 <div className="mt-8 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-4">
                   <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-4">
                     <h4 className="font-bold text-slate-800 mb-3 text-sm">รายการที่เลือกรอชำระ/หักยอด:</h4>
                     {Object.keys(drinkCart).length === 0 ? (
                       <p className="text-sm text-slate-400 text-center py-2">แตะเลือกเครื่องดื่มจากด้านบน</p>
                     ) : (
                       <div className="space-y-2">
                         {Object.entries(drinkCart).map(([dId, qty]) => {
                           const d = config.drinks?.find((x:any)=>x.id === dId);
                           const breakdown = cartCalculation?.itemBreakdown?.[dId];
                           const itemTotal = breakdown ? breakdown.price : calculateDrinkPrice(d, qty as number, config.isWholeStoreFree);
                           const freeQty = breakdown ? breakdown.freeQty : 0;
                           
                           let promoText = '';
                           if (freeQty > 0) {
                             promoText += `🍹 [Welcome Drink ฟรี ${freeQty} แก้ว] `;
                           }
                           if (config.isWholeStoreFree) {
                             promoText = '[เหมาร้าน - ฟรี]';
                           } else if (d?.isFree) {
                             promoText = '[สินค้าแจกฟรี]';
                           } else {
                             if (d?.buyQty > 0 && d?.freeQty > 0) {
                                promoText += `[ซื้อ ${d.buyQty} แถม ${d.freeQty}] `;
                             }
                             if (d?.discountPercent > 0) {
                                promoText += `[-${d.discountPercent}%] `;
                             }
                             if (d?.serviceChargePercent > 0) {
                                promoText += `[+${d.serviceChargePercent}% SC] `;
                             }
                           }
                           
                           return (
                             <div key={dId} className="flex justify-between items-center text-sm bg-white p-2 rounded-lg border border-slate-100">
                               <span className="font-medium text-slate-600 flex flex-col">
                                 <span>
                                   {d?.name || 'Unknown'}
                                   {d?.price > 0 && <span className="text-xs text-slate-400 ml-2">(@฿{d.price})</span>}
                                 </span>
                                 {promoText && <span className="text-[10px] text-emerald-600 font-bold mt-0.5">{promoText}</span>}
                               </span>
                               <div className="flex items-center gap-3">
                                 <span className="font-black text-primary text-base px-2 bg-slate-50 rounded-md">x{qty}</span>
                                 {itemTotal > 0 && <span className="font-bold text-slate-800 w-16 text-right">฿{itemTotal.toLocaleString()}</span>}
                               </div>
                             </div>
                           )
                         })}
                         {drinkTotalPrice > 0 && (
                           <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between items-center">
                             <span className="font-bold text-slate-800 text-sm">ยอดจ่ายเพิ่มเติม:</span>
                             <span className="font-bold text-lg text-primary">฿{drinkTotalPrice.toLocaleString()}</span>
                           </div>
                         )}
                       </div>
                     )}
                   </div>
                   
                   {showPayment ? (
                     <div className="bg-white p-4 rounded-2xl border border-slate-200 mb-4 animate-in fade-in slide-in-from-top-4 flex flex-col items-center">
                       <h4 className="font-bold text-slate-800 mb-2">แสกนเพื่อชำระเงิน</h4>
                       <div className="mb-4">
                          <ThaiQRPayment promptpayId={activeTicket?.ticket ? getZoneForTicket(activeTicket.ticket)?.bankAccount || '' : ''} amount={drinkTotalPrice} width={240} />
                       </div>
                       {activeTicket?.ticket && getZoneForTicket(activeTicket.ticket) && (
                         <div className="text-center text-sm space-y-1 mb-4 bg-slate-50 w-full p-3 rounded-lg border border-slate-200">
                           <p className="font-bold text-slate-700">บัญชี {getZoneForTicket(activeTicket.ticket)?.name}</p>
                           <p className="text-slate-600">{getZoneForTicket(activeTicket.ticket)?.bankName} • {getZoneForTicket(activeTicket.ticket)?.bankAccount}</p>
                           <p className="text-xs text-slate-500">คุณ {getZoneForTicket(activeTicket.ticket)?.bankAccountName}</p>
                         </div>
                       )}
                       <div className="flex gap-3 w-full">
                         <button 
                           type="button"
                           onClick={() => setShowPayment(false)}
                           className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors w-1/3 text-sm"
                         >
                           ย้อนกลับ
                         </button>
                         <button 
                           type="button"
                           onClick={handleConfirmRedeem}
                           className="flex-1 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                         >
                           <CheckCircle2 className="w-5 h-5" /> ยืนยันชำระเงินแล้ว
                         </button>
                       </div>
                     </div>
                   ) : (
                     <div className="flex gap-3">
                       <button 
                         type="button"
                         onClick={() => { setActiveTicket(null); setDrinkCart({}); setScanResult(null); }}
                         className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition-colors w-1/3"
                       >
                         ยกเลิก
                       </button>
                       <button 
                         type="button"
                         disabled={Object.keys(drinkCart).length === 0}
                         onClick={() => drinkTotalPrice > 0 ? setShowPayment(true) : handleConfirmRedeem()}
                         className="flex-1 px-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:grayscale shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                       >
                         {drinkTotalPrice > 0 ? (
                           <>ดำเนินการชำระ ฿{drinkTotalPrice.toLocaleString()}</>
                         ) : (
                           <><CheckCircle2 className="w-5 h-5" /> ยืนยัน ({Object.values(drinkCart).reduce((a: number, b: number) => a + Number(b), 0)} ชิ้น)</>
                         )}
                       </button>
                     </div>
                   )}
                 </div>
               )}
            </div>

            {/* รายงานประวัติรับของที่ระลึก */}
            {(() => {
              const claimedWinners = luckyDrawWinners.filter((w: any) => w.claimed);
              return (
                <div className="w-full mt-8 pt-8 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 font-sans">
                      <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                        <Gift className="w-5 h-5" />
                      </div>
                      ประวัติการสแกนรับของรางวัลหน้างาน ({claimedWinners.length} รายการ)
                    </h3>
                  </div>
                  
                  {claimedWinners.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-sm text-slate-400 font-sans">ยังไม่มีผู้โชคดีมาสแกนรับของรางวัลในขณะนี้</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {claimedWinners.map((w: any, idx: number) => (
                        <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5 hover:shadow-sm transition font-sans">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-800 text-sm">🎉 {w.userName || 'ผู้โชคดีไม่ระบุนาม'}</span>
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                              รับรางวัลแล้ว
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-slate-500">
                            <p>โต๊ะ: <span className="font-bold text-slate-700">{w.tableId || 'N/A'}</span> • ที่นั่ง: <span className="font-bold text-slate-700">{w.seatId || 'all'}</span></p>
                            <p className="text-right">เวลาสแกน: <span className="font-medium text-slate-700">{w.claimedAt ? new Date(w.claimedAt).toLocaleTimeString('th-TH') : 'N/A'}</span></p>
                          </div>
                          {w.scannedQR && (
                            <div className="bg-white px-2 py-1.5 rounded border border-slate-100 font-mono text-[9px] text-slate-400 break-all leading-normal max-h-12 overflow-y-auto mt-1">
                              <span className="font-bold text-slate-500">QR Code Payload:</span> {w.scannedQR}
                            </div>
                          )}
                          {w.claimedBy && (
                            <p className="text-[10px] text-right text-slate-400">สตาฟผู้ตรวจสอบ: <span className="text-slate-500 font-medium">{w.claimedBy}</span></p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="w-full flex flex-col gap-6 font-sans">
            <div className="bg-rose-50/50 rounded-2xl p-4 border border-rose-100 flex items-start gap-3">
              <Store className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800 leading-relaxed">
                <p className="font-bold">โหมดบันทึกข่าวกิจกรรมบูธร้านค้า (Staff Booth Logger)</p>
                <p className="text-slate-500">กรอกยอดสินค้าหรือบริการพิมพ์รายละเอียด และสแกนคิวอาร์โค้ดผู้ร่วมสนุกเพื่อยืนยันการทำรายการ บันทึกพฤติกรรม และออกรายงานแยกบูธ</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">ประจำการบูธกิจกรรม *</label>
                <select
                  value={selectedBoothId}
                  onChange={(e) => {
                    setSelectedBoothId(e.target.value);
                    setBoothScanResult(null);
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold font-sans text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">-- โปรดเลือกบูธจำพวงของคุณ --</option>
                  {(booths || []).map((b) => (
                    <option key={b.id} value={b.id}>
                      🎪 {b.name} ({b.ownerName})
                    </option>
                  ))}
                </select>
                {booths.length === 0 && (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-100 font-bold mt-1">❌ ขณะนี้ไม่มีข้อมูลบูธในระบบ แอดมินต้องทำการเพิ่มบูธที่หน้าดีแชร์บอร์ดแอดมินก่อน</p>
                )}
              </div>

              {selectedBoothId && (() => {
                const currentBooth = booths.find(b => b.id === selectedBoothId);
                return (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">ระบุยอดซื้อจำหน่าย (บาท - เพื่อจัดรายงานยอดขาย)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-extrabold text-slate-400">฿</span>
                          <input
                            type="number"
                            min="0"
                            value={boothSalesAmount}
                            onChange={(e) => setBoothSalesAmount(e.target.value)}
                            className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">รายละเอียดกิจกรรม / สินค้าที่แลกเปลี่ยน</label>
                        <input
                          type="text"
                          value={boothNotes}
                          onChange={(e) => setBoothNotes(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                          placeholder="เช่น รับสิทธิ์ร่วมสนุก, ซื้อบัตรเติมคำ, ขนมหม้อแกง"
                        />
                      </div>
                    </div>

                    {currentBooth && currentBooth.promptpayId && Number(boothSalesAmount) > 0 && (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 border-dashed flex flex-col items-center">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold mb-3">
                          <Landmark className="w-4 h-4 text-primary shrink-0" />
                          <span>สแกนจ่ายตรงเข้าร้านชำระสินค้า / QR Code</span>
                        </div>
                        <ThaiQRPayment promptpayId={currentBooth.promptpayId} amount={Number(boothSalesAmount)} width={170} />
                        <div className="text-center mt-2.5 space-y-0.5">
                          <p className="font-bold text-slate-700 text-xs">{currentBooth.promptpayName || currentBooth.ownerName}</p>
                          <p className="font-mono text-slate-500 text-[10px]">{currentBooth.promptpayId}</p>
                          <p className="font-mono font-black text-primary text-sm mt-1">ยอดเงินพรีเซ็ต: ฿{Number(boothSalesAmount).toLocaleString()}</p>
                        </div>
                      </div>
                    )}

                    {isBoothCameraActive ? (
                      <div className="w-full max-w-[280px] flex flex-col items-center mx-auto mt-4">
                        <div className="w-full rounded-3xl overflow-hidden shadow-inner border-4 border-rose-300 relative bg-slate-900 aspect-square">
                          <Scanner 
                            onScan={(result) => result && result.length > 0 && processBoothScan(result[0].rawValue)}
                            components={{ audio: false, finder: false }}
                            styles={{ container: { width: '100%', height: '100%' } }}
                          />
                          <div className="absolute inset-0 border-4 border-slate-800/10 pointer-events-none z-10" />
                          <div className="absolute inset-x-0 top-1/2 h-0.5 bg-rose-500 shadow-[0_0_15px_var(--theme-primary)] opacity-80 animate-pulse z-20" />
                          <button 
                            type="button"
                            onClick={() => setIsBoothCameraActive(false)}
                            className="absolute top-2 right-2 bg-black/50 p-2 rounded-full text-white hover:bg-black/80 z-30 transition-colors"
                            title="ปิดกล้อง"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-2 animate-pulse">กล้องบูธกำลังแสตนด์บาย...</p>
                      </div>
                    ) : (
                      <div 
                        className="w-full h-40 rounded-2xl flex flex-col items-center justify-center bg-rose-50/40 border border-dashed border-rose-200 cursor-pointer hover:bg-rose-50 transition-all duration-300 group mt-4 shadow-sm"
                        onClick={() => setIsBoothCameraActive(true)}
                      >
                        <div className="p-3 bg-white rounded-xl shadow-sm border border-rose-100 group-hover:scale-110 transition-transform">
                          <Camera className="w-8 h-8 text-rose-500" />
                        </div>
                        <p className="text-xs font-bold text-rose-700 mt-2">สแกน QR Code ผู้ร่วมสนุก</p>
                        <p className="text-[10px] text-slate-400 mt-1">สแกนเพื่อผูกกิจกรรมและยอดจำหน่าย</p>
                      </div>
                    )}

                    <button 
                      type="button"
                      onClick={simulateBoothScan}
                      className="text-slate-400 hover:text-slate-600 text-xs font-medium underline underline-offset-4 w-full text-center py-2 block transition-colors"
                    >
                      จำลองการสแกนบูธ (Simulation Demo Mode)
                    </button>

                    {boothScanResult && (
                      <div className={`p-4 rounded-xl flex items-start gap-3 border animate-in zoom-in-95 ${boothScanResult.status === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                        {boothScanResult.status === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs">{boothScanResult.status === 'success' ? 'บันทึกสำเร็จ' : 'ข้อผิดพลาด'}</p>
                          <p className="text-[11px] mt-1 whitespace-pre-line leading-relaxed">{boothScanResult.message}</p>
                        </div>
                      </div>
                    )}

                    {/* ประวัติสแกนเฉพาะบูธนี้ */}
                    {(() => {
                      const filteredLogs = boothScanLogs.filter(log => log.boothId === selectedBoothId);
                      return (
                        <div className="w-full mt-4 pt-4 border-t border-slate-100">
                          <h4 className="font-bold text-slate-700 text-xs flex items-center gap-1.5 mb-2">
                            <History className="w-4 h-4 text-slate-500 shrink-0" />
                            ประวัติเข้าบูธของคุณ ({filteredLogs.length} ท่าน)
                          </h4>
                          {filteredLogs.length === 0 ? (
                            <p className="text-[10px] text-slate-400 text-center py-5 bg-slate-50 border border-slate-100 rounded-xl">ยังไม่มีรายการผู้เข้าร่วมที่จารึกของบูธนี้</p>
                          ) : (
                            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                              {filteredLogs.map((log: any, idx) => (
                                <div key={log.id || idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] flex justify-between items-center hover:shadow-xs transition">
                                  <div>
                                    <p className="font-bold text-slate-800">👤 คุณ {log.userName}</p>
                                    <p className="text-slate-400 text-[9px] font-mono mt-0.5">พาสพอร์ต: {log.ticketId.slice(0, 8)}... • {new Date(log.timestamp).toLocaleTimeString('th-TH')}</p>
                                    {log.notes && <p className="text-slate-500 text-[10px] mt-0.5 bg-white py-0.5 px-1.5 rounded border border-slate-100 inline-block font-sans">📝 {log.notes}</p>}
                                  </div>
                                  {log.salesAmount > 0 ? (
                                    <span className="font-mono font-black text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                                      +฿{log.salesAmount.toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">สแกนชมนิทรรศการ</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
