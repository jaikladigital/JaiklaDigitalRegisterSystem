/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import React, { useContext } from 'react';
import { CheckCircle2, Ticket } from 'lucide-react';
import { motion } from 'motion/react';
import { ConfigContext } from '../ConfigContext';
import { normalizeLineOaInfo } from '../utils/lineHelpers';

export default function SuccessView({ onGoToTickets }: any) {
  const { config } = useContext(ConfigContext);
  const successMessage = config.notificationCustomerSuccess || 'ชำระเงินเรียบร้อย ตรวจสอบอีเมลของคุณ';
  const lineInfo = normalizeLineOaInfo(config.lineGroupLink);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <motion.div 
        initial={{ scale: 0 }} 
        animate={{ scale: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
      >
        <CheckCircle2 className="w-24 h-24 text-emerald-500 mb-6" />
      </motion.div>
      <h2 className="text-3xl font-bold text-slate-800 mb-2">ชำระเงินสำเร็จ!</h2>
      <p className="text-slate-500 mb-8 max-w-md text-center text-lg">
        {successMessage}
      </p>
      <div className="flex flex-col gap-4">
        <button 
          onClick={onGoToTickets}
          className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition"
        >
          <Ticket className="w-5 h-5" /> ดูบัตรของฉัน (My Tickets)
        </button>
        <a 
          href={lineInfo.url}
          target="_blank"
          rel="noreferrer"
          className="bg-[#00B900] hover:brightness-110 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          ติดตาม LINE OA ({lineInfo.id})
        </a>
      </div>
    </div>
  );
}
