/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';

export default function SurveyCountdownPopup({ 
  onClose, 
  eventDate, 
  eventTime,
  themeColor,
  buttonText = 'กดเพื่อทำแบบประเมินความพึงพอใจ',
  buttonFontSize = 22
}: { 
  onClose: () => void, 
  eventDate: string, 
  eventTime?: string,
  themeColor: string,
  buttonText?: string,
  buttonFontSize?: number
}) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    let targetTime: number;
    let timeStr = eventTime || '00:00';
    if (timeStr.length === 5) timeStr += ':00';
    targetTime = new Date(`${eventDate}T${timeStr}`).getTime();

    const update = () => {
      const now = new Date().getTime();
      const distance = targetTime - now;
      if (isNaN(distance) || distance <= 0) {
        setTimeLeft('00 วัน 00 ชม. 00 นาที 00 วินาที');
        return;
      }
      
      const d = Math.floor(distance / (1000 * 60 * 60 * 24));
      const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((distance % (1000 * 60)) / 1000);
      
      const pad = (n: number) => n.toString().padStart(2, '0');
      setTimeLeft(`${pad(d)} วัน ${pad(h)} ชม. ${pad(m)} นาที ${pad(s)} วินาที`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [eventDate, eventTime]);

  let formattedDate = eventDate;
  try {
    const dObj = new Date(eventDate);
    const months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    formattedDate = `${dObj.getDate()} ${months[dObj.getMonth()]} ${dObj.getFullYear() + 543}`;
  } catch (e) {}

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div 
        className="relative max-w-md w-full rounded-2xl p-6 shadow-2xl flex flex-col items-center"
        style={{ backgroundColor: themeColor, color: '#ffffff' }}
      >
        <button 
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 bg-white text-slate-800 rounded-full flex items-center justify-center font-bold shadow-lg hover:scale-110 transition-transform"
        >
          ✕
        </button>

        <h3 
          className="font-bold text-center mb-4 leading-tight"
          style={{ fontSize: `${buttonFontSize}px` }}
          dangerouslySetInnerHTML={{ __html: buttonText.replace(/\n/g, '<br/>') }}
        >
        </h3>
        
        <div className="w-full border-t border-dashed border-white/50 my-2"></div>
        
        <p className="text-sm border border-white/20 bg-black/20 rounded-lg px-4 py-2 mt-4 mb-3 font-medium">
          เปิดให้ทำแบบประเมินภายในวันกิจกรรมเท่านั้น
        </p>
        
        <div className="bg-black/10 rounded-xl py-3 px-5 w-full flex flex-col items-center justify-center text-center">
          <div className="text-xl font-bold tracking-wider mb-1 whitespace-nowrap">
            {timeLeft}
          </div>
          <div className="text-sm opacity-80 mt-1">
            ({formattedDate}{eventTime ? ` เวลา ${eventTime} น.` : ''})
          </div>
        </div>
      </div>
    </div>
  );
}
