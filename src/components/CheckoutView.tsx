/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import React, { useState, useContext, useRef } from 'react';
import { ZONES } from '../data';
import { ConfigContext } from '../ConfigContext';
import { ArrowLeft, Upload, CheckCircle2, Timer, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import ThaiQRPayment from './ThaiQRPayment';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function CheckoutView({ cart, cartTotals, tables, onBack, holdExpiryTime, onHoldExpired, onComplete }: any) {
  const { config, t } = useContext(ConfigContext);
  const activeZones = config.zones || ZONES;

  const [timeLeft, setTimeLeft] = useState<number>(() => {
    return Math.max(0, Math.floor((holdExpiryTime - Date.now()) / 1000));
  });

  React.useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((holdExpiryTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        onHoldExpired();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [holdExpiryTime, onHoldExpired]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalHoldDuration = (config.temporaryHoldMinutes || 5) * 60;
  const progressPercent = Math.max(0, Math.min(100, (timeLeft / totalHoldDuration) * 100));

  const [step, setStep] = useState<1 | 2>(1); // 1: Info, 2: Payment
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mainTable = cart[0] ? tables.find((t:any) => t.id === cart[0].tableId) : null;
  const zone = mainTable ? activeZones[mainTable.zoneId as keyof typeof activeZones] : activeZones.REGULAR;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsVerifying(true);
    
    try {
      // 1. Upload file to Firebase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `slips/slip_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // 2. Generate tickets and complete checkout
      setIsVerifying(false);
      const tickets: any[] = [];
      cart.forEach((item: any) => {
        const table = tables.find((t:any) => t.id === item.tableId);
        const itemZone = activeZones[table?.zoneId as keyof typeof activeZones];
        
        item.seatIds.forEach((seatId: number) => {
          tickets.push({
            id: `TKT-${Math.floor(Math.random()*10000).toString().padStart(4,'0')}-${table?.id}-${seatId}`,
            userName: formData.name,
            phone: formData.phone,
            email: formData.email,
            tableId: item.tableId,
            seatIds: [seatId],
            totalAmount: config.isTicketFree ? 0 : (itemZone?.pricePerSeat || 0),
            paymentMethod: 'PROMPTPAY',
            status: 'paid',
            qrCodeUrl: 'demo-qr',
            drinksRedeemed: 0,
            slipUrl: downloadURL
          });
        });
      });
      onComplete(tickets);

    } catch (error) {
      console.error("Upload failed", error);
      setIsVerifying(false);
      alert("Failed to upload slip. Please try again.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <button onClick={step === 1 ? onBack : () => setStep(1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 font-medium">
        <ArrowLeft className="w-5 h-5" /> {t('ย้อนกลับ')}
      </button>

      {/* Temporary Holding Timer Card */}
      <div className="bg-rose-50/50 border border-rose-100/80 rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center animate-pulse">
              <Timer className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm font-sans">จับเวลาล็อคที่นั่งชั่วคราว (Temporary Reservation Lock)</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                ที่นั่งของคุณได้รับการล็อคชั่วคราวแล้ว กรุณากรอกข้อมูลและชำระเงินภายในเวลาที่กำหนด
              </p>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 bg-rose-600 text-white px-3.5 py-1.5 rounded-xl text-lg font-black font-mono shadow-sm shadow-rose-600/10 tracking-wider">
            {formatTime(timeLeft)}
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-200/60 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-rose-500 to-rose-600 rounded-full"
            initial={{ width: `${progressPercent}%` }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: "linear" }}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-100">
          <div className={`flex-1 p-4 text-center font-bold ${step === 1 ? 'border-b-2 border-secondary text-secondary' : 'text-slate-400 bg-slate-50'}`}>
            {t('1. ข้อมูลผู้จอง')}
          </div>
          <div className={`flex-1 p-4 text-center font-bold ${step === 2 ? 'border-b-2 border-accent text-accent' : 'text-slate-400 bg-slate-50'}`}>
            {t('2. ชำระเงิน')}
          </div>
        </div>

        <div className="p-8">
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8">
                <h3 className="font-bold text-slate-800 mb-4">{t('สรุปรายการ (Order Summary)')}</h3>
                <div className="space-y-2">
                  {cart.map((item:any) => {
                    const tableZoneId = tables.find((t: any) => t.id === item.tableId)?.zoneId;
                    const zonePrice = config.isTicketFree ? 0 : (activeZones[tableZoneId as string]?.pricePerSeat || 0);
                    return (
                      <div key={item.tableId} className="flex justify-between items-start gap-4 text-sm">
                        <span className="text-slate-600 flex-1 min-w-0 break-words leading-relaxed">{t('โต๊ะ')} {item.tableId} ({t('ที่นั่ง')} {item.seatIds.join(', ')})</span>
                        <span className="font-medium shrink-0">฿{(item.seatIds.length * zonePrice).toLocaleString()}</span>
                      </div>
                    );
                  })}
                  <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-bold text-lg">
                    <span>{t('ยอดรวมทั้งสิ้น')}</span>
                    <span className="text-secondary">฿{cartTotals.price.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('ชื่อ-นามสกุล (Name)')}</label>
                  <input type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none" placeholder="ระบุชื่อผู้จอง" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('เบอร์โทร (Phone)')}</label>
                    <input type="tel" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none" placeholder="08x-xxx-xxxx" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('อีเมล (Email)')}</label>
                    <input type="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none" placeholder="สำหรับรับ QR" />
                  </div>
                </div>
              </div>

              {config.consentEnabled !== false && (
                <div className="mt-6 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start gap-3 text-left">
                  <input
                    id="consent-checkbox"
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-slate-300 text-accent focus:ring-accent accent-accent shrink-0 cursor-pointer transition-colors"
                  />
                  <label htmlFor="consent-checkbox" className="text-xs text-slate-600 leading-relaxed cursor-pointer select-none font-sans flex flex-wrap gap-y-1">
                    <span className="inline-block whitespace-nowrap">ข้าพเจ้าตกลงและยินยอมให้</span>{" "}
                    <span className="font-bold text-slate-800 inline-flex flex-wrap">
                      {(() => {
                        const name = config.consentCompanyName || 'บริษัท ใจกล้า ดิจิตอล จำกัด';
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
                    </span>{" "}
                    <span className="inline-block whitespace-nowrap">เก็บรวบรวม</span>{" "}
                    <span className="inline-block whitespace-nowrap">ใช้</span>{" "}
                    <span className="inline-block whitespace-nowrap">และเปิดเผยข้อมูลส่วนบุคคล</span>
                    <span className="inline-block whitespace-nowrap">ของข้าพเจ้า</span>{" "}
                    <span className="inline-block whitespace-nowrap">ได้แก่</span>{" "}
                    <span className="font-medium text-slate-800 inline-flex flex-wrap">
                      <span className="inline-block whitespace-nowrap">[</span>
                      {(config.consentDataTypes || 'ชื่อ-นามสกุล, เบอร์โทรศัพท์, อีเมล, รูปภาพ').split(/,\s*/).map((item: string, idx: number, arr: string[]) => (
                        <span key={idx} className="inline-block whitespace-nowrap">
                          {item}
                          {idx < arr.length - 1 ? ",\u0020" : ""}
                        </span>
                      ))}
                      <span className="inline-block whitespace-nowrap">]</span>
                    </span>{" "}
                    <span className="inline-block whitespace-nowrap">เพื่อวัตถุประสงค์ในการ</span>
                    <span className="font-medium text-slate-800 inline-block whitespace-nowrap">
                      {config.consentPurpose || 'ดำเนินกิจกรรม'}
                    </span>
                  </label>
                </div>
              )}

              <button 
                disabled={!formData.name || !formData.phone || !formData.email || !/^\S+@\S+\.\S+$/.test(formData.email) || (config.consentEnabled !== false && !consentAccepted)}
                onClick={() => setStep(2)}
                className="w-full mt-6 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white py-4 rounded-xl font-bold tracking-wide transition-all duration-200"
              >
                {t('ไปหน้าชำระเงิน')}
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col md:flex-row gap-8">
              
              <div className="flex-1 space-y-6">
                <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                  <ThaiQRPayment promptpayId={zone.bankAccount || ''} amount={cartTotals.price} width={280} />
                  
                  {zone.bankName || zone.bankAccountName ? (
                    <div className="mt-4 bg-white p-3 rounded-lg border border-blue-100 w-full text-left space-y-1">
                      {zone.bankName && <p className="text-sm font-semibold text-blue-900 break-words whitespace-normal leading-tight"><span className="text-blue-500 font-normal text-xs uppercase tracking-wider block">ธนาคาร</span>{zone.bankName}</p>}
                      {zone.bankAccount && <p className="text-sm font-semibold text-blue-900 mt-2 break-words whitespace-normal leading-tight"><span className="text-blue-500 font-normal text-xs uppercase tracking-wider block">เลขบัญชี</span>{zone.bankAccount}</p>}
                      {zone.bankAccountName && <p className="text-sm font-semibold text-blue-900 mt-2 break-words whitespace-normal leading-tight"><span className="text-blue-500 font-normal text-xs uppercase tracking-wider block">ชื่อบัญชี</span>{zone.bankAccountName}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-blue-700 mt-2 break-words text-balance px-4">{zone.bankAccount}</p>
                  )}
                  
                </div>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-600">{t('ยอดที่ต้องชำระ')}</span>
                  <span className="text-xl font-bold text-accent">฿{cartTotals.price.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                
                {config.lineGroupLink ? (
                  <div className="border-2 border-dashed border-green-500/40 bg-green-50/50 rounded-2xl p-8 text-center flex flex-col justify-center h-full">
                    <div className="bg-[#06C755] w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">L</div>
                    <p className="font-bold text-slate-800 mb-2">ส่งสลิปยืนยันทาง LINE OA</p>
                    <p className="text-sm text-slate-600 mb-6">คลิกปุ่มด้านล่างเพื่อเพิ่มเพื่อน LINE OA ของเรา และส่งรูปสลิปของคุณเข้าไปในแชทเพื่อให้ระบบตรวจสอบอัตโนมัติ</p>
                    <a 
                      href={config.lineGroupLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-[#06C755] text-white hover:bg-[#05b34c] px-6 py-3 rounded-xl font-bold transition-colors w-full mb-4 shadow-sm block text-center"
                    >
                      เพิ่มเพื่อน LINE OA เพื่อส่งสลิป
                    </a>
                    
                    <button 
                      onClick={() => {
                        if (window.confirm('คุณได้ส่งสลิปเข้าไปในแชท LINE เรียบร้อยแล้วใช่หรือไม่?')) {
                          setIsVerifying(true);
                          const tickets: any[] = [];
                          cart.forEach((item: any) => {
                            const table = tables.find((t:any) => t.id === item.tableId);
                            const itemZone = activeZones[table?.zoneId as keyof typeof activeZones];
                            
                            item.seatIds.forEach((seatId: number) => {
                              tickets.push({
                                id: `TKT-${Math.floor(Math.random()*10000).toString().padStart(4,'0')}-${table?.id}-${seatId}`,
                                userName: formData.name,
                                phone: formData.phone,
                                email: formData.email,
                                tableId: item.tableId,
                                seatIds: [seatId],
                                totalAmount: config.isTicketFree ? 0 : (itemZone?.pricePerSeat || 0),
                                paymentMethod: 'PROMPTPAY',
                                status: 'paid',
                                qrCodeUrl: 'demo-qr',
                                drinksRedeemed: 0,
                                slipUrl: 'line_slip_uploaded'
                              });
                            });
                          });
                          onComplete(tickets);
                        }
                      }}
                      className="border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 px-6 py-3 rounded-xl font-bold transition-colors w-full"
                    >
                      ฉันส่งสลิปในแชท LINE แล้ว (ยืนยัน)
                    </button>
                  </div>
                ) : !isVerifying ? (
                  <div 
                    className="border-2 border-dashed border-accent/40 hover:border-accent rounded-2xl p-8 text-center hover:bg-accent/5 transition cursor-pointer" 
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-12 h-12 text-accent/60 mx-auto mb-4" />
                    <p className="font-bold text-slate-700 mb-1">{t('อัพโหลดสลิปโอนเงิน')}</p>
                    <p className="text-xs text-slate-500 mb-4">รองรับไฟล์รูปภาพ (JPG, PNG)</p>
                    <button className="bg-accent text-white hover:bg-accent-hover px-6 py-2 rounded-lg text-sm font-medium transition-colors">
                      {t('เลือกไฟล์สลิป')}
                    </button>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                    />
                  </div>
                ) : (
                  <div className="border-2 border-secondary/20 rounded-2xl p-8 text-center bg-secondary/5 flex flex-col items-center justify-center h-full">
                    <motion.div 
                      animate={{ rotate: 360 }} 
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full mb-4"
                    />
                    <p className="font-bold text-secondary">{t('กำลังอัพโหลดและตรวจสอบสลิป...')}</p>
                    <p className="text-sm text-secondary/70 mt-2">{t('โปรดรอสักครู่ ระบบกำลังยืนยันยอดเงินจากธนาคาร')}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
      
      {step === 2 && (
        <div className="mt-6 bg-rose-50 border border-rose-100 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-rose-800 mb-1">มีปัญหาในการชำระเงิน?</h4>
            <p className="text-sm text-rose-600">ชำระเงินไม่เรียบร้อย หรือต้องการความช่วยเหลือ โปรดติดต่อเจ้าหน้าที่</p>
          </div>
          <a 
            href="https://line.me/R/ti/p/@792zqqbw" 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center gap-2 bg-[#00B900] text-white px-6 py-2.5 rounded-xl font-bold hover:brightness-110 transition whitespace-nowrap"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            LINE OA: digitecteam
          </a>
        </div>
      )}
    </div>
  );
}
