/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import express from 'express';
import path from 'path';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

// Initialize Firebase for server-side config reading
let db: any = null;
try {
  let firebaseConfig: any = null;
  if (process.env.FIREBASE_CONFIG) {
    try {
      firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
    } catch {
      console.warn("Could not parse FIREBASE_CONFIG env var");
    }
  }
  
  if (!firebaseConfig) {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  }

  if (firebaseConfig) {
    const fbApp = initializeApp(firebaseConfig, 'ServerApp_' + Date.now());
    db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
  }
} catch (e) {
  console.warn("Could not initialize Firebase in server:", e);
}

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

const getResend = () => {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
};

// Variable to store latest LINE Group ID
let latestLineGroupId = '';

// Create an express Router for API routes
const apiRouter = express.Router();

apiRouter.post('/translate', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured' });
    }
    
    const ai = new GoogleGenAI({ apiKey });
    const { text, mode } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Missing text' });
    }

    let prompt = '';
    if (mode === 'bilingual') {
      prompt = `You are a helpful translation assistant. The user will provide a text in Thai (or another language). 
Your task is to convert it into a well-formatted BILINGUAL message (Thai first, followed by an empty line, then English).
If the text contains template variables like {{variableName}}, you MUST keep them exactly the same in both the Thai and English versions.
Make the tone professional and friendly.

Text:
${text}

Return ONLY the bilingual formatted text.`;
    } else {
      prompt = `Translate the following text to English. Maintain any template variables formatted as {{variableName}}. Return ONLY the translated English text.

Text:
${text}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({ translation: response.text });
  } catch (error: any) {
    console.error('Translation error:', error);
    res.status(500).json({ error: error.message || 'Error occurred during translation' });
  }
});

// API Route for sending email
apiRouter.post('/send-email', async (req, res) => {
  try {
    const { to, subject, text, html, attachments, eventName } = req.body;
    
    if (!to || (Array.isArray(to) && to.length === 0)) {
      return res.status(400).json({ error: 'กรุณาระบุที่อยู่อีเมลผู้รับตรง (No recipient email provided)' });
    }

    const toArray = Array.isArray(to) ? to : [to];
    const validEmails = toArray.filter(email => typeof email === 'string' && /^\S+@\S+\.\S+$/.test(email.trim()));

    if (validEmails.length === 0) {
      return res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง (Invalid email format)' });
    }
    
    const verifiedTo = validEmails;

    if (!subject || (!text && !html)) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, text/html' });
    }

    // Sanitize subject to remove newlines (Resend rejects subjects with \n)
    const sanitizedSubject = subject.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

    // Convert attachments to buffers to be completely safe
    const convertToBuffer = (content: string) => {
      if (content && content.includes('base64,')) {
        return Buffer.from(content.split('base64,')[1], 'base64');
      }
      return Buffer.from(content, 'base64');
    };

    const unifiedAttachments = attachments ? attachments.map((a: any) => ({
      filename: a.filename,
      content: convertToBuffer(a.content),
    })) : [];
    
    const errorsList: string[] = [];
    const resend = getResend();

    // 1. Try Resend first
    if (resend) {
      try {
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@jaikladigital.com';
        const envFromName = process.env.RESEND_FROM_NAME || '';
        const fromName = envFromName || eventName || 'Event Ticketing Pro';
        
        const payload: any = {
          from: `${fromName} <${fromEmail}>`,
          to: verifiedTo,
          subject: sanitizedSubject,
        };
        if (text) payload.text = text;
        if (html) payload.html = html;
        if (unifiedAttachments.length > 0) payload.attachments = unifiedAttachments;

        const { data, error } = await resend.emails.send(payload);

        if (!error) {
          return res.status(200).json({ data, provider: 'resend' });
        }
        
        const errMsg = typeof error === 'object' ? (error.message || JSON.stringify(error)) : String(error);
        console.warn('Resend failed:', errMsg);
        errorsList.push(`Resend: ${errMsg}`);
      } catch (e: any) {
        const errMsg = e.message || String(e);
        console.warn('Resend caught exception:', errMsg);
        errorsList.push(`Resend: ${errMsg}`);
      }
    }

    // 2. Fallback to Gmail SMTP (Nodemailer)
    if (process.env.GMAIL_SMTP_USER && process.env.GMAIL_SMTP_PASSWORD) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_SMTP_USER,
          pass: process.env.GMAIL_SMTP_PASSWORD,
        },
      });

      const toAddress = verifiedTo.join(', ');

      try {
        const senderName = process.env.RESEND_FROM_NAME || eventName || "Event Ticketing Pro";
        const info = await transporter.sendMail({
          from: `"${senderName}" <${process.env.GMAIL_SMTP_USER}>`,
          to: toAddress,
          subject: sanitizedSubject,
          text: text || '',
          html: html || '',
          attachments: unifiedAttachments,
        });

        return res.status(200).json({ data: info, provider: 'gmail_smtp' });
      } catch (smtpError: any) {
        console.warn('Gmail SMTP failed:', smtpError.message);
        errorsList.push(`Gmail: ${smtpError.message}`);
      }
    }

    // If we reach here, either no providers were configured, or they all failed.
    console.warn('Email sending failed or no configured providers.');
    const errorMsg = errorsList.length > 0
      ? `Failed to send email:\n${errorsList.join('\n')}`
      : 'Please configure RESEND_API_KEY or GMAIL_SMTP_USER/PASSWORD variables in Settings.';
      
    return res.status(500).json({ error: errorMsg, details: errorsList });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// LINE Webhook
apiRouter.post('/line/webhook', async (req, res) => {
  try {
    const events = req.body?.events;
    if (!events || events.length === 0) return res.status(200).send('OK');

    for (const event of events) {
      if (event.source && event.source.type === 'group' && event.source.groupId) {
        latestLineGroupId = event.source.groupId;
      }

      if (event.type === 'message' && event.message.type === 'image') {
        try {
          // Get Config
          let channelId = process.env.LINE_CHANNEL_ID;
          let channelSecret = process.env.LINE_CHANNEL_SECRET;
          let approveMsg = "ชำระเงินเรียบร้อย";
          let rejectMsg = "ชำระเงินไม่เรียบร้อย";
          let primaryModel = 'gemini-3.5-flash';
          let fallbackModel = 'gemini-2.5-flash';

          if (db) {
            const configSnap = await getDoc(doc(db, 'config', 'main'));
            if (configSnap.exists()) {
              const configData = configSnap.data();
              if (configData.lineChannelId) channelId = configData.lineChannelId;
              if (configData.lineChannelSecret) channelSecret = configData.lineChannelSecret;
              if (configData.lineSlipApproveMsg) approveMsg = configData.lineSlipApproveMsg;
              if (configData.lineSlipRejectMsg) rejectMsg = configData.lineSlipRejectMsg;
              if (configData.geminiPrimaryModel) primaryModel = configData.geminiPrimaryModel;
              if (configData.geminiFallbackModel) fallbackModel = configData.geminiFallbackModel;
            }
          }

          if (!channelId || !channelSecret) {
            console.warn("No LINE credentials found to process image");
            continue;
          }

          // 1. Get Access Token
          const tokenResp = await fetch('https://api.line.me/v2/oauth/accessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: channelId,
              client_secret: channelSecret
            }).toString()
          });
          const tokenData = await tokenResp.json();
          const accessToken = tokenData.access_token;

          if (accessToken) {
            // 2. Download Image
            const imgResp = await fetch(`https://api-data.line.me/v2/bot/message/${event.message.id}/content`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const imgBuffer = await imgResp.arrayBuffer();
            const base64Image = Buffer.from(imgBuffer).toString('base64');

            // 3. Process with Gemini
            const apiKey = process.env.GEMINI_API_KEY;
            if (apiKey) {
              const ai = new GoogleGenAI({ apiKey });
              const prompt = `You are an expert at analyzing Thai bank transfer slips (e-slips). 
Examine the image to determine if it is a genuine bank transfer slip.
Extract the following information:
- isSlip: boolean (true if it's a bank transfer slip, false otherwise)
- amount: number (the transfer amount)
- date: string (the transfer date, e.g., '25/06/2026' or '25 มิ.ย. 69')
- time: string (the transfer time, e.g., '14:30')
- receiverName: string (the name of the person or business receiving the money)
- looksValid: boolean (true if there are no obvious signs of forgery or tampering, false if it looks edited or suspicious)

Return ONLY a JSON object:
{
  "isSlip": boolean,
  "looksValid": boolean,
  "amount": number,
  "date": "string",
  "time": "string",
  "receiverName": "string"
}`;
              let result;
              try {
                const response = await ai.models.generateContent({
                  model: primaryModel,
                  contents: [
                    {
                      role: 'user',
                      parts: [
                        { text: prompt },
                        { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
                      ]
                    }
                  ],
                  config: { responseMimeType: 'application/json' }
                });
                result = JSON.parse(response.text);
              } catch (aiErr: any) {
                console.error(`${primaryModel} Error:`, aiErr);
                const isQuotaError = aiErr?.status === 429 || String(aiErr).toLowerCase().includes('quota') || String(aiErr).toLowerCase().includes('exhausted');
                
                if (isQuotaError) {
                  console.log(`⚠️ ${primaryModel} Quota Exceeded. Falling back to ${fallbackModel}...`);
                  
                  // 1. Notify Admin via LINE if admin ID exists
                  let adminId = null;
                  if (db) {
                    const configSnap = await getDoc(doc(db, 'config', 'main'));
                    if (configSnap.exists()) {
                      adminId = configSnap.data().lineAdminUserId;
                    }
                  }
                  if (adminId) {
                     await fetch('https://api.line.me/v2/bot/message/push', {
                       method: 'POST',
                       headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                       body: JSON.stringify({
                         to: adminId,
                         messages: [{ type: 'text', text: `⚠️ [System Alert] โควต้า ${primaryModel} เต็ม!\nระบบได้ทำการสลับไปใช้รุ่นสำรอง (${fallbackModel}) อัตโนมัติเพื่อให้การตรวจสลิปทำงานต่อได้` }]
                       })
                     }).catch(e => console.error("Failed to notify admin", e));
                  }

                  // 2. Fallback to Gemini 2.5 Flash
                  const fallbackResponse = await ai.models.generateContent({
                    model: fallbackModel,
                    contents: [
                      {
                        role: 'user',
                        parts: [
                          { text: prompt },
                          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
                        ]
                      }
                    ],
                    config: { responseMimeType: 'application/json' }
                  });
                  result = JSON.parse(fallbackResponse.text);
                } else {
                  throw aiErr;
                }
              }

              if (result && result.isSlip) {
                const replyText = result.looksValid 
                  ? `✅ สลิปยอด ${result.amount} บาท (เวลา ${result.time})\n${approveMsg}`
                  : `❌ ตรวจพบปัญหาในสลิปยอด ${result.amount} บาท (เวลา ${result.time})\n${rejectMsg}`;
                
                await fetch('https://api.line.me/v2/bot/message/reply', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                  },
                  body: JSON.stringify({
                    replyToken: event.replyToken,
                    messages: [{ type: 'text', text: replyText }]
                  })
                });
              }
            }
          }

        } catch (imgErr) {
          console.error("Error processing LINE image:", imgErr);
        }
      }
    }
    return res.status(200).send('OK');
  } catch (error) {
    console.error('LINE Webhook Error:', error);
    return res.status(500).send('Error');
  }
});

apiRouter.get('/line/latest-group-id', (_req, res) => {
  res.json({ groupId: latestLineGroupId });
});

// API Route for sending LINE/SMS notifications
apiRouter.post('/notify', async (req, res) => {
  try {
    const { type, payload } = req.body;
    
    if (type === 'line_messaging_api') {
      const channelId = payload.channelId || process.env.LINE_CHANNEL_ID;
      const channelSecret = payload.channelSecret || process.env.LINE_CHANNEL_SECRET;
      const targetUserId = (payload.targetUserId || process.env.LINE_ADMIN_USER_ID || '').trim(); 

      if (!channelId || !channelSecret) return res.status(400).json({ error: 'LINE Channel ID or Secret is not configured' });
      
      // 1. Get Access Token
      const tokenResp = await fetch('https://api.line.me/v2/oauth/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: channelId,
          client_secret: channelSecret
        }).toString()
      });
      
      if (!tokenResp.ok) throw new Error(`LINE Token failed: ${await tokenResp.text()}`);
      const tokenData = await tokenResp.json();
      const accessToken = tokenData.access_token;
      
      // 2. Send Message
      const endpoint = targetUserId ? 'https://api.line.me/v2/bot/message/push' : 'https://api.line.me/v2/bot/message/broadcast';
      const bodyData = targetUserId ? {
        to: targetUserId,
        messages: [{ type: 'text', text: payload.message }]
      } : {
        messages: [{ type: 'text', text: payload.message }]
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(bodyData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("LINE Messaging API Error:", response.status, errorText, "Payload:", bodyData);
        throw new Error(`LINE Messaging API failed: ${errorText}`);
      }
      return res.json({ success: true, provider: 'line_messaging_api' });
    }

    if (type === 'line_notify') {
      const token = payload.token || process.env.LINE_NOTIFY_TOKEN;
      if (!token) return res.status(400).json({ error: 'LINE_NOTIFY_TOKEN is not configured' });
      
      const response = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: new URLSearchParams({ message: payload.message }).toString()
      });
      
      if (!response.ok) throw new Error(`LINE Notify failed: ${response.statusText}`);
      return res.json({ success: true, provider: 'line_notify' });
    }
    
    if (type === 'line_push') {
      const token = payload.token || process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (!token) return res.status(400).json({ error: 'LINE_CHANNEL_ACCESS_TOKEN is not configured' });
      
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          to: payload.userId,
          messages: [{ type: 'text', text: payload.message }]
        })
      });
      
      if (!response.ok) throw new Error(`LINE Push failed: ${await response.text()}`);
      return res.json({ success: true, provider: 'line_push' });
    }

    if (type === 'sms_twilio') {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_FROM_NUMBER;
      if (!accountSid || !authToken || !fromNumber) return res.status(400).json({ error: 'Twilio credentials are not configured' });
      
      const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: payload.phone,
          Body: payload.message
        }).toString()
      });
      
      if (!response.ok) throw new Error(`Twilio SMS failed: ${await response.text()}`);
      return res.json({ success: true, provider: 'sms_twilio' });
    }
    
    return res.status(400).json({ error: 'Unsupported notification type' });
  } catch (error: any) {
    console.error('Error sending notification:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Location Search Proxy (OpenStreetMap Nominatim)
apiRouter.get('/location/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'กรุณาระบุคำค้นหาอย่างน้อย 2 ตัวอักษร' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const searchUrl = new URL('https://nominatim.openstreetmap.org/search');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('q', q);
    searchUrl.searchParams.set('limit', '6');
    searchUrl.searchParams.set('addressdetails', '1');
    searchUrl.searchParams.set('accept-language', 'th,en');

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'EventTicketingPro/1.0 (venue-location-picker)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.status(502).json({ error: `Geocoding service returned ${response.status}` });
    }

    const data = await response.json();
    const results = Array.isArray(data)
      ? data.map((item: any) => ({
          placeId: String(item.place_id || ''),
          displayName: String(item.display_name || ''),
          lat: Number(item.lat),
          lng: Number(item.lon),
          type: String(item.type || item.class || ''),
        })).filter((item: any) => !isNaN(item.lat) && !isNaN(item.lng))
      : [];

    return res.json({ results });
  } catch (error: any) {
    console.error('Location search error:', error);
    return res.status(500).json({ error: error?.name === 'AbortError' ? 'หมดเวลาการค้นหาสถานที่' : (error.message || 'ไม่สามารถค้นหาสถานที่ได้') });
  }
});

// Safe Google Maps Short-URL Resolver
apiRouter.post('/location/resolve-url', async (req, res) => {
  try {
    const rawUrl = String(req.body?.url || '').trim();
    if (!rawUrl) {
      return res.status(400).json({ error: 'กรุณาระบุ URL' });
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return res.status(400).json({ error: 'รูปแบบลิงก์ไม่ถูกต้อง' });
    }

    const allowedHosts = new Set([
      'maps.app.goo.gl',
      'goo.gl',
      'maps.google.com',
      'www.google.com',
      'google.com',
      'maps.google.co.th',
      'www.google.co.th',
    ]);

    if (!['https:', 'http:'].includes(parsed.protocol) || !allowedHosts.has(parsed.hostname.toLowerCase())) {
      return res.status(400).json({ error: 'รองรับเฉพาะลิงก์จาก Google Maps เท่านั้น' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const response = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EventTicketingPro/1.0)',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    let htmlSnippet = '';
    try {
      const text = await response.text();
      htmlSnippet = text.slice(0, 12000);
    } catch {
      // ignore body read errors
    }

    return res.json({
      resolvedUrl: response.url || rawUrl,
      htmlSnippet,
    });
  } catch (error: any) {
    console.error('Resolve map URL error:', error);
    return res.status(500).json({ error: 'ไม่สามารถเปิดลิงก์ย่อได้ กรุณาคัดลอกลิงก์เต็มจากแถบที่อยู่ของเบราว์เซอร์' });
  }
});

// Approximate IP Geolocation Fallback (when browser GPS is unavailable)
apiRouter.get('/location/ip-approx', async (req, res) => {
  try {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const isPrivateIp =
      !forwarded ||
      forwarded === '::1' ||
      forwarded.startsWith('127.') ||
      forwarded.startsWith('10.') ||
      forwarded.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(forwarded);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const targetUrl = isPrivateIp
      ? 'https://ipwho.is/'
      : `https://ipwho.is/${encodeURIComponent(forwarded)}`;

    const response = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.status(502).json({ error: 'IP geolocation unavailable' });
    }
    const data: any = await response.json();
    if (!data?.success || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      return res.status(404).json({ error: 'ไม่พบพิกัดจากเครือข่าย' });
    }

    return res.json({
      lat: data.latitude,
      lng: data.longitude,
      city: data.city || '',
      region: data.region || '',
      country: data.country || '',
    });
  } catch (error: any) {
    console.error('IP approx error:', error);
    return res.status(500).json({ error: 'ไม่สามารถประมาณการตำแหน่งจากเครือข่ายได้' });
  }
});

// Mount the API router on both /api and root level
app.use('/api', apiRouter);
app.use(apiRouter);

export default app;
