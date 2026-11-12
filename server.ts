/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

// Initialize Firebase for server-side config reading
let db: any = null;
try {
  const rawConfig = fs.readFileSync('firebase-applet-config.json', 'utf8');
  const firebaseConfig = JSON.parse(rawConfig);
  const fbApp = initializeApp(firebaseConfig);
  db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  console.warn("Could not initialize Firebase Admin in server:", e);
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.post('/api/translate', async (req, res) => {
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
  app.post('/api/send-email', async (req, res) => {
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
      
      let lastProviderError: any = null;
      const errorsList: string[] = [];

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
          lastProviderError = error;
          errorsList.push(`Resend: ${errMsg}`);
        } catch (e: any) {
          const errMsg = e.message || String(e);
          console.warn('Resend caught exception:', errMsg);
          lastProviderError = e;
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

        // if 'to' is an array, join it
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
          lastProviderError = smtpError;
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

  // Variable to store latest LINE Group ID
  let latestLineGroupId = '';

  app.post('/api/line/webhook', express.json(), async (req, res) => {
    try {
      const events = req.body.events;
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

  app.get('/api/line/latest-group-id', (req, res) => {
    res.json({ groupId: latestLineGroupId });
  });

  // API Route for sending LINE/SMS notifications
  app.post('/api/notify', async (req, res) => {
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
