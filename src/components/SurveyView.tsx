/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle2, Frown, Smile, Heart, MapPin, Utensils, Music, Coffee, UserCog, ClipboardCheck, Car } from 'lucide-react';
import { TicketPayload, SurveyPayload } from '../types';

export const SURVEY_TOPICS = [
  { id: 'atmosphere', label: 'บรรยากาศภายในงาน', icon: <MapPin className="w-5 h-5 mx-auto mb-1 text-slate-400" /> },
  { id: 'food', label: 'อาหารและเครื่องดื่ม', icon: <Utensils className="w-5 h-5 mx-auto mb-1 text-slate-400" /> },
  { id: 'entertainment', label: 'ความบันเทิง', icon: <Music className="w-5 h-5 mx-auto mb-1 text-slate-400" /> },
  { id: 'facilities', label: 'สิ่งอำนวยความสะดวก', icon: <Coffee className="w-5 h-5 mx-auto mb-1 text-slate-400" /> },
  { id: 'staff', label: 'เจ้าหน้าที่ให้บริการ', icon: <UserCog className="w-5 h-5 mx-auto mb-1 text-slate-400" /> },
  { id: 'registration', label: 'ระบบลงทะเบียนเข้างาน', icon: <ClipboardCheck className="w-5 h-5 mx-auto mb-1 text-slate-400" /> },
  { id: 'travel', label: 'การเดินทาง', icon: <Car className="w-5 h-5 mx-auto mb-1 text-slate-400" /> },
];

export const SURVEY_LEVELS = [
  { value: 1, label: 'ปรับปรุง', icon: <Frown className="w-6 h-6" />, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-200', activeBorder: 'ring-rose-500' },
  { value: 2, label: 'พอใจ', icon: <Smile className="w-6 h-6" />, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', activeBorder: 'ring-amber-500' },
  { value: 3, label: 'ชื่นชอบ', icon: <Heart className="w-6 h-6" />, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', activeBorder: 'ring-emerald-500' }
];

export default function SurveyView({ activeTicket, onSubmit, onBack }: { activeTicket: {ticket: TicketPayload, seatId: number}, onSubmit: (data: SurveyPayload) => void, onBack: () => void }) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const isComplete = SURVEY_TOPICS.every(t => ratings[t.id]);

  const handleSubmit = () => {
    if (!isComplete) return;
    onSubmit({
      id: Math.random().toString(36).substr(2, 9),
      ticketId: activeTicket.ticket.id,
      seatId: activeTicket.seatId,
      ratings,
      comment,
      timestamp: Date.now()
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex-1 flex flex-col pt-16 px-4">
        <div className="max-w-md w-full mx-auto text-center py-20">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle2 className="w-12 h-12" />
          </motion.div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">ขอบคุณสำหรับคำติชม</h2>
          <p className="text-slate-600 mb-8">เราจะนำข้อมูลไปปรับปรุงการจัดงานในครั้งต่อไป</p>
          <button 
            onClick={onBack}
            className="w-full bg-slate-800 text-white font-bold py-4 rounded-2xl"
          >
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-32 pt-20 px-4 bg-slate-50">
      <div className="max-w-md w-full mx-auto">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium mb-6"
        >
          <ArrowLeft className="w-5 h-5" /> กลับ
        </button>

        <div className="mb-6">
          <h2 className="text-3xl font-black text-slate-800 mb-2">แบบประเมินความพึงพอใจ</h2>
          <p className="text-slate-500 break-words whitespace-normal leading-tight mt-2">
            ผู้ให้ข้อมูล: คุณ {activeTicket.ticket.userName} <br className="sm:hidden" />
            <span className="text-sm">โต๊ะ {activeTicket.ticket.tableId} • ที่นั่ง {activeTicket.seatId}</span>
          </p>
        </div>

        <div className="space-y-4">
          {SURVEY_TOPICS.map(topic => (
            <div key={topic.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-center mb-4">
                {topic.icon}
                <div className="font-bold text-slate-800">{topic.label}</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {SURVEY_LEVELS.map(level => {
                  const isSelected = ratings[topic.id] === level.value;
                  return (
                    <button
                      key={level.value}
                      onClick={() => setRatings(prev => ({ ...prev, [topic.id]: level.value }))}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all
                        ${isSelected ? `${level.bg} ${level.color} ring-2 ${level.activeBorder} border-transparent` : `border-slate-100 text-slate-400 hover:bg-slate-50`}
                      `}
                    >
                      <div className="mb-1">{level.icon}</div>
                      <span className="text-[11px] font-bold">{level.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <label className="block font-bold text-slate-800 mb-2 text-center">ข้อเสนอแนะเพิ่มเติม</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="พิมพ์ข้อเสนอแนะเพื่อการปรับปรุง..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
              rows={3}
            />
          </div>
        </div>

        <div className="mt-8">
          <button
            onClick={handleSubmit}
            disabled={!isComplete}
            className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center transition-all ${isComplete ? 'bg-slate-800 text-white hover:bg-slate-900 active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            <CheckCircle2 className="w-6 h-6 mr-2" />
            ส่งแบบประเมิน
          </button>
          {!isComplete && (
            <p className="text-center text-sm text-slate-500 mt-3">กรุณาประเมินให้ครบทุกหัวข้อ</p>
          )}
        </div>
      </div>
    </div>
  );
}
