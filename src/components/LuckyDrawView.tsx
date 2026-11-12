/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import React, { useState, useContext, useRef } from 'react';
import { TicketPayload, SurveyPayload } from '../types';
import { Gift, X, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ConfigContext } from '../ConfigContext';
import { addLuckyDrawWinner } from '../lib/firebaseCollections';

export default function LuckyDrawView({ tickets, surveys, luckyDrawWinners, setLuckyDrawWinners, onClose }: { tickets: TicketPayload[], surveys: SurveyPayload[], luckyDrawWinners: any[], setLuckyDrawWinners: any, onClose: () => void }) {
  const { config } = useContext(ConfigContext);

  const [isDrawing, setIsDrawing] = useState(false);
  const [winner, setWinner] = useState<{ticket: TicketPayload, seatId: number} | null>(null);
  const [displayItem, setDisplayItem] = useState<string>('???');
  const [ticker, setTicker] = useState(0);

  // Filter drawPool so that only seats that have a corresponding survey record are included
  // AND they haven't already won
  const drawPool = tickets.flatMap(ticket => 
    ticket.seatIds
      .filter(seatId => surveys.some(s => s.ticketId === ticket.id && (s.seatId === seatId || s.seatId == null)))
      .filter(seatId => !luckyDrawWinners.some(w => w.ticketId === ticket.id && w.seatId === seatId))
      .map(seatId => ({ ticket, seatId }))
  );

  const playSound = (type: 'tick' | 'win' | 'click') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (type === 'click') {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'square';
        oscillator.frequency.value = 400; 
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      } else if (type === 'tick') {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 800 + Math.random() * 400; // slight variation
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.05);
      } else if (type === 'win') {
        [440, 554.37, 659.25, 880, 1108.73].forEach((freq, i) => { // A major chord spread
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.type = 'triangle';
          oscillator.frequency.value = freq;
          gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.1);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.5);
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.start(audioCtx.currentTime + i * 0.05);
          oscillator.stop(audioCtx.currentTime + 3);
        });
      }
    } catch(e) {}
  };

  const handleDraw = () => {
    if (drawPool.length === 0) return;
    
    playSound('click');
    setIsDrawing(true);
    setWinner(null);
    let counter = 0;
    const maxTicks = 45; // slightly longer animation
    
    // Quick randomizer effect (Slot Machine like)
    const interval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * drawPool.length);
      setDisplayItem(drawPool[randomIdx].ticket.userName);
      setTicker(prev => prev + 1); // trigger animation key
      playSound('tick');
      counter++;
      
      if (counter >= maxTicks) {
        clearInterval(interval);
        const finalWinner = drawPool[Math.floor(Math.random() * drawPool.length)];
        setWinner(finalWinner);
        setDisplayItem(finalWinner.ticket.userName);
        
        // Register winner globally via Firebase
        addLuckyDrawWinner({ 
          ticketId: finalWinner.ticket.id, 
          seatId: finalWinner.seatId, 
          claimed: false, 
          userName: finalWinner.ticket.userName,
          tableId: finalWinner.ticket.tableId
        });
        
        setTicker(prev => prev + 1);
        playSound('win');
        setIsDrawing(false);
      }
    }, 80);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col justify-center items-center overflow-hidden font-sans view-lucky-draw">
      
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {config.bannerUrl && (
          <>
            <img src={config.bannerUrl} alt="Background" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-md scale-105" />
            <div className="absolute inset-0 bg-slate-950/60" />
          </>
        )}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]" />
      </div>

      {/* Header Banner - Event Name Outside Draw Area */}
      <div className="absolute top-[4vmin] left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-[80vw] flex justify-center">
        <div className="bg-white/10 backdrop-blur-md px-[6vmin] py-[1.5vmin] rounded-[4vmin] border border-white/20 shadow-lg text-center inline-block max-w-full">
          <h1 className="text-[3.5vmin] md:text-[3vmin] font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-200 leading-normal break-words text-balance">
            {config.eventName || '6th Hopeful Awards 2027'}
          </h1>
        </div>
      </div>

      {/* Close Button */}
      <button 
        onClick={() => { playSound('click'); onClose(); }}
        className="absolute top-[4vmin] right-[4vmin] p-[1.5vmin] bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-all shadow-lg z-20 hover:scale-110"
        title="Close Screen"
      >
        <X className="w-[4vmin] h-[4vmin]" />
      </button>

      {/* Main Container - Scaled by vmin */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full px-[5vmin] pt-[15vmin] pb-[5vmin]">
        
        <div className="mb-[4vmin] shrink-0 flex flex-col items-center">
          <Gift className="w-[8vmin] h-[8vmin] md:w-[10vmin] md:h-[10vmin] text-primary mb-[2vmin] animate-bounce-slow drop-shadow-[0_0_15px_rgba(var(--theme-primary-rgb),0.5)]" />
          <h2 className="text-[5vmin] md:text-[6vmin] font-black tracking-widest text-center uppercase drop-shadow-xl leading-tight">
            ระบบจับฉลากผู้โชคดี <br/>
            <span className="text-primary text-[3vmin] md:text-[4vmin] mt-[1vmin] block">LUCKY DRAW</span>
          </h2>
        </div>

        <div className="w-[90vmin] bg-slate-900/80 backdrop-blur-2xl rounded-[4vmin] p-[6vmin] text-center border-[0.5vmin] border-slate-700/50 shadow-[0_0_80px_rgba(0,0,0,0.6)] relative flex-1 min-h-[40vmin] max-h-[55vmin] flex items-center justify-center overflow-hidden">
          
          <AnimatePresence mode="popLayout">
            {!winner && (
              <motion.div 
                key={`roll-${ticker}`} // Changes every tick for slot machine rolling
                initial={{ opacity: 0, y: isDrawing ? '-60%' : 0, filter: isDrawing ? 'blur(4px)' : 'blur(0px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: isDrawing ? '60%' : 0, filter: isDrawing ? 'blur(4px)' : 'blur(0px)' }}
                transition={{ duration: 0.1, ease: "linear" }}
                className="flex items-center justify-center w-full absolute inset-0 p-[4vmin]"
              >
                <h3 className={`text-[6.5vmin] md:text-[7.5vmin] font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 transition-all py-[2vmin] leading-normal break-words whitespace-normal text-balance px-[2vmin] w-full`}>
                  {drawPool.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-[1vmin]">
                      <span className="whitespace-nowrap">ยังไม่มีผู้มีสิทธิ์</span>
                      <span className="text-[4vmin] text-amber-300 md:text-[3.5vmin] opacity-80 whitespace-nowrap">(ต้องทำแบบประเมินก่อน)</span>
                    </div>
                  ) : displayItem}
                </h3>
              </motion.div>
            )}

            {winner && (
              <motion.div 
                key="winner"
                initial={{ opacity: 0, scale: 0.2, y: '30%' }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0.6, duration: 1 }}
                className="flex flex-col items-center justify-center w-full z-10 w-full px-[2vmin] py-[2vmin]"
              >
                <Trophy className="w-[12vmin] h-[12vmin] text-yellow-400 mb-[2vmin] drop-shadow-[0_0_30px_rgba(250,204,21,0.6)] shrink-0" />
                <h3 className="text-[6.5vmin] md:text-[7.5vmin] font-black tracking-wider text-white mb-[4vmin] drop-shadow-[0_0_40px_rgba(255,255,255,0.4)] break-words text-balance leading-tight max-w-full text-center px-[2vmin] w-full">
                  {winner.ticket.userName}
                </h3>
                <div className="bg-primary/90 backdrop-blur-sm px-[5vmin] py-[1.5vmin] rounded-full text-[3.5vmin] font-bold border-[0.5vmin] border-white/30 shadow-2xl shrink-0 whitespace-nowrap">
                  โต๊ะ {winner.ticket.tableId} • ที่นั่ง {winner.seatId}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        <button 
          disabled={isDrawing || drawPool.length === 0}
          onClick={handleDraw}
          className="mt-[4vmin] md:mt-[6vmin] shrink-0 bg-gradient-to-r from-primary to-orange-500 hover:from-primary-hover hover:to-orange-600 disabled:opacity-50 disabled:grayscale text-white px-[8vmin] py-[2.5vmin] md:py-[3vmin] rounded-full text-[3.5vmin] md:text-[4vmin] font-black shadow-[0_15px_60px_var(--theme-primary)] transition-all transform hover:scale-105 active:scale-95"
        >
          {isDrawing ? 'กำลังสุ่ม...' : 'START RANDOM'}
        </button>
      </div>

    </div>
  );
}
