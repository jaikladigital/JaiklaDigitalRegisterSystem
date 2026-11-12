/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import generatePayload from 'promptpay-qr';

interface ThaiQRPaymentProps {
  promptpayId: string;
  amount: number;
  width?: number;
}

export default function ThaiQRPayment({ promptpayId, amount, width = 300 }: ThaiQRPaymentProps) {
  // Generate the promptpay payload string
  // Removing any dashes or spaces from the user input just in case
  const cleanId = promptpayId.replace(/[^0-9]/g, '');
  const payloadOpts = amount > 0 ? { amount } : {};
  const payload = cleanId ? generatePayload(cleanId, payloadOpts) : '';

  return (
    <div 
      className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative font-sans mx-auto flex flex-col"
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="bg-[#113566] text-white p-4 flex items-center justify-center gap-3">
        {/* Simple approximation of Thai QR Payment Logo */}
        <div className="bg-white p-1 rounded">
           <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M5 5H15V15H5V5Z" fill="#113566"/>
             <path d="M25 5H35V15H25V5Z" fill="#113566"/>
             <path d="M5 25H15V35H5V25Z" fill="#113566"/>
             <path d="M20 20H40V40H20V20Z" fill="#EB2328"/>
             <path d="M25 25H35V35H25V25Z" fill="white"/>
           </svg>
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-lg leading-tight tracking-wide">THAI QR</span>
          <span className="font-bold text-lg leading-tight tracking-wide">PAYMENT</span>
        </div>
      </div>
      
      {/* QR Code Container */}
      <div className="p-8 pb-4 flex justify-center bg-white">
        {payload ? (
          <QRCodeSVG 
             value={payload} 
             size={width - 64} 
             level="M"
             includeMargin={false}
          />
        ) : (
          <div 
            className="flex items-center justify-center bg-slate-100 text-slate-400 text-sm text-center"
            style={{ width: width - 64, height: width - 64 }}
          >
            ระบุเบอร์โทรศัพท์หรือ<br/>บัตรประชาชน (PromptPay)
          </div>
        )}
      </div>

      {/* Footer / Amount */}
      <div className="px-6 pb-6 text-center">
         <div className="text-slate-500 text-sm mb-1">สแกนเลยด้วยแอปธนาคาร</div>
         {amount > 0 && (
           <div className="text-2xl font-bold text-slate-800">
             ฿{amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
           </div>
         )}
      </div>
    </div>
  );
}
