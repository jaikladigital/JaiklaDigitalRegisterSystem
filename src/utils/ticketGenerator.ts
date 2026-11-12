/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';

export async function generateTicketImage(data: {
  ticketId: string;
  tableId: string;
  seatId: number;
  zoneName: string;
  zonePrice: number;
  eventName: string;
  zoneColor?: string;
}): Promise<string> {
  const qrData = JSON.stringify({ ticketId: data.ticketId, tableId: data.tableId, seatId: data.seatId });
  const qrDataUrl = await QRCode.toDataURL(qrData, { margin: 1, width: 200 });

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve(qrDataUrl);

    // Set canvas dimensions
    canvas.width = 400;
    canvas.height = 500;

    // Draw background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw header / event name
    ctx.fillStyle = data.zoneColor || '#e11d48'; // Primary theme color or zone color
    ctx.fillRect(0, 0, canvas.width, 80);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(data.eventName || 'EventTicket', 200, 45);

    // Wait for QR code image to load
    const img = new Image();
    img.onload = () => {
      // Draw QR code border colored by zone
      if (data.zoneColor) {
        ctx.fillStyle = data.zoneColor;
        ctx.fillRect(96, 96, 208, 208);
      }
      // Draw QR code
      ctx.drawImage(img, 100, 100, 200, 200);

      // Draw Details
      ctx.fillStyle = '#1e293b'; // slate-800
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      
      ctx.fillText(`Table: ${data.tableId}`, 200, 340);
      ctx.fillText(`Seat: ${data.seatId}`, 200, 370);
      
      const priceText = data.zonePrice === 0 ? 'COMPED (FREE)' : `${data.zonePrice.toLocaleString()} THB`;
      
      ctx.fillStyle = data.zoneColor || '#64748b'; // slate-500
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`Zone: ${data.zoneName}`, 200, 410);

      ctx.fillStyle = '#64748b'; // slate-500
      ctx.font = '18px sans-serif';
      ctx.fillText(`Price: ${priceText}`, 200, 440);

      const base64 = canvas.toDataURL('image/png');
      resolve(base64);
    };
    img.src = qrDataUrl;
  });
}

export async function generateSurveyButtonImage(zoneColor?: string): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  canvas.width = 600;
  canvas.height = 100;
  
  ctx.fillStyle = zoneColor || '#e11d48';
  // Use fillRect, to avoid any compatibility issues, we can simulate rounded corners or just use straightforward rect.
  // Actually, standard roundRect is fine in modern browsers, let's use it if available, else fallback
  if (ctx.roundRect) {
    ctx.roundRect(0, 0, 600, 100, 20);
  } else {
    ctx.fillRect(0, 0, 600, 100);
  }
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif'; 
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ทำแบบประเมินความพึงพอใจ', 300, 50);

  return canvas.toDataURL('image/png');
}

export async function generateTicketPDF(data: {
  ticketId: string;
  tableId: string;
  seatId: number;
  seatIds: number[];
  userName: string;
  zoneName: string;
  zonePrice: number;
  eventName: string;
  zoneColor?: string;
}): Promise<jsPDF> {
  const dataUrl = await generateTicketImage(data);
  const surveyButtonDataUrl = await generateSurveyButtonImage(data.zoneColor);
  
  // Use A4 or custom size? Let's use a custom size matching the image proportions.
  // Proportions: 400x500. Let's make it 80x100 mm.
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 120] // Made it slightly taller to fit the button
  });
  
  // Add the ticket image
  doc.addImage(dataUrl, 'PNG', 0, 0, 80, 100);
  
  // Construct survey URL
  const baseUrl = window.location.origin + window.location.pathname;
  const surveyUrl = `${baseUrl}?view=SURVEY&ticketId=${encodeURIComponent(data.ticketId)}&name=${encodeURIComponent(data.userName)}&table=${encodeURIComponent(data.tableId)}&seats=${data.seatIds.join(',')}&seatId=${data.seatId}`;
  
  // Draw the button image (with Thai text)
  if (surveyButtonDataUrl) {
    doc.addImage(surveyButtonDataUrl, 'PNG', 10, 105, 60, 10);
  } else {
    // Fallback if canvas fails
    doc.setDrawColor(data.zoneColor || '#e11d48');
    doc.setFillColor(data.zoneColor || '#e11d48');
    doc.roundedRect(10, 105, 60, 10, 2, 2, 'FD');
    doc.setTextColor('#ffffff');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Take Survey', 40, 111.5, { align: 'center' });
  }
  
  // Add the invisible clickable link over the button rect
  doc.link(10, 105, 60, 10, { url: surveyUrl });
  
  return doc;
}
