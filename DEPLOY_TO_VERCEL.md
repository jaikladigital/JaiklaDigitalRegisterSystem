# 🚀 คู่มือการนำระบบขึ้น Vercel (Deployment Guide to Vercel.com)

ระบบนี้ได้รับการเตรียมความพร้อมสำหรับ **Vercel** เรียบร้อยแล้ว โดยโครงสร้างรองรับทั้ง:
1. **Frontend**: Vite + React 19 + Tailwind CSS (ทำงานผ่าน Global Edge CDN รวดเร็ว)
2. **Backend API**: Node.js Serverless Functions (`/api/index.ts` และ `src/apiApp.ts`) รองรับ API ส่งเมล, Gemini AI ตรวจสลิป, แปลภาษา และ LINE Webhook
3. **Database**: Firebase Firestore & Auth (เชื่อมต่ออัตโนมัติ)

---

## 📋 สารบัญขั้นตอน
1. [เตรียมโค้ดขึ้น GitHub](#1-นำโค้ดขึ้น-github)
2. [Import โครงการเข้า Vercel](#2-นำเข้าสู่-vercelcom)
3. [ตั้งค่า Environment Variables บน Vercel](#3-ตั้งค่า-environment-variables-ใน-vercel)
4. [ตั้งค่า Firebase Authorized Domains (สำคัญมาก!)](#4-ตั้งค่า-firebase-authorized-domains-สำคัญมาก)
5. [ตั้งค่า LINE Webhook (ถ้ามี)](#5-ตั้งค่า-line-webhook)

---

## 1. นำโค้ดขึ้น GitHub

หากคุณมีโค้ดในเครื่องคอมพิวเตอร์ของคุณ:

```bash
# 1. สร้าง Git repository ในโฟลเดอร์โครงการ
git init

# 2. เพิ่มไฟล์ทั้งหมดเข้า git
git add .

# 3. บันทึก Commit
git commit -m "feat: ready for vercel deployment"

# 4. ตั้งชื่อ branch เป็น main
git branch -M main

# 5. เชื่อมต่อกับ GitHub Repository ของคุณ (สร้าง repo เปล่าบน github.com ก่อน)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 6. Push โค้ดขึ้น GitHub
git push -u origin main
```

---

## 2. นำเข้าสู่ Vercel.com

1. ไปที่เว็บไซต์ [https://vercel.com](https://vercel.com) และเข้าสู่ระบบ (ล็อกอินด้วย GitHub)
2. คลิกปุ่ม **"Add New..."** มุมขวาบน -> เลือก **"Project"**
3. เลือก Repository ที่คุณเพิ่ง Push ขึ้นไป แล้วคลิก **"Import"**
4. การตั้งค่า **Configure Project**:
   - **Framework Preset**: เลือก `Vite` (Vercel จะตรวจพบอัตโนมัติ)
   - **Root Directory**: `./` (ไม่ต้องแก้ไข)
   - **Build Command**: `vite build` (หรือปล่อยค่าเริ่มต้น)
   - **Output Directory**: `dist` (ค่าเริ่มต้น)
5. อย่าเพิ่งกด Deploy ทันที ให้ไปที่หัวข้อ **Environment Variables** ในข้อถัดไปก่อน

---

## 3. ตั้งค่า Environment Variables ใน Vercel

ในหน้าตั้งค่า Project บน Vercel ให้เปิดหัวข้อ **Environment Variables** แล้วเพิ่มค่าต่อไปนี้:

| Key | คำอธิบาย | ตัวอย่างค่า |
|---|---|---|
| `GEMINI_API_KEY` | API Key จาก Google AI Studio สำหรับ AI ตรวจสลิป และแปล 2 ภาษา | `AIzaSy...` |
| `RESEND_API_KEY` | API Key ของ Resend สำหรับส่งอีเมลตั๋ว (ถ้าใช้) | `re_12345...` |
| `RESEND_FROM_EMAIL` | อีเมลผู้ส่งที่ Verify บน Resend แล้ว | `info@jaikladigital.com` |
| `RESEND_FROM_NAME` | ชื่อผู้ส่งที่จะแสดงในกล่องจดหมาย | `Event Ticketing Pro` |
| `GMAIL_SMTP_USER` | Gmail ผู้ส่ง (กรณีใช้ส่งอีเมลสำรอง) | `your-email@gmail.com` |
| `GMAIL_SMTP_PASSWORD` | รหัสผ่าน App Password 16 หลักของ Gmail | `xxxx xxxx xxxx xxxx` |
| `LINE_CHANNEL_ID` | LINE Messaging API Channel ID | `200...` |
| `LINE_CHANNEL_SECRET` | LINE Messaging API Channel Secret | `xxxxxxxx` |
| `LINE_ADMIN_USER_ID` | LINE User ID ของผู้ดูแลระบบสำหรับรับแจ้งเตือน | `U12345678...` |

*(ไฟล์ `firebase-applet-config.json` มีอยู่ในตัวโปรเจกต์แล้ว ระบบจะอ่านการตั้งค่า Firebase โดยอัตโนมัติ)*

หลังจากใส่เสร็จแล้ว คลิกปุ่ม **"Deploy"** 🚀
ระบบจะใช้เวลาประมาณ 1-2 นาที เมื่อเสร็จแล้วคุณจะได้ URL เช่น: `https://your-project.vercel.app`

---

## 4. ตั้งค่า Firebase Authorized Domains (สำคัญมาก!) ⚠️

เมื่อแอปขึ้น Vercel แล้ว **คุณต้องเพิ่มโดเมนของ Vercel เข้าไปใน Firebase Authentication** เพื่อให้ระบบอนุญาตให้ล็อกอินและเชื่อมต่อได้:

1. เข้าไปที่ [Firebase Console](https://console.firebase.google.com/)
2. เลือก Project: `gen-lang-client-0436034249` (หรือโปรเจกต์ Firebase ของคุณ)
3. ไปที่เมนูด้านซ้าย **Build** -> **Authentication**
4. คลิกแท็บ **Settings** ด้านบน
5. เลื่อนลงมาที่หัวข้อ **Authorized domains** (โดเมนที่ได้รับอนุญาต)
6. คลิก **"Add domain"**
7. ใส่โดเมนของ Vercel ของคุณ (เช่น `your-project.vercel.app` และโดเมนแบบกำหนดเองถ้ามี เช่น `ticket.mydomain.com`) โดยไม่ต้องใส่ `https://`
8. คลิก **Save**

---

## 5. ตั้งค่า LINE Webhook (กรณีใช้ระบบตรวจสลิปอัตโนมัติในกลุ่ม LINE)

หากคุณใช้งานบอทตรวจสลิปธนาคารอัตโนมัติ:
1. เข้าไปที่ [LINE Developers Console](https://developers.line.biz/)
2. เลือก Channel ของ Messaging API ของคุณ
3. ไปที่แท็บ **Messaging API**
4. ที่หัวข้อ **Webhook settings**:
   - ใส่ **Webhook URL**: `https://your-project.vercel.app/api/line/webhook`
   - คลิก **Update** และกดปุ่ม **Verify** เพื่อทดสอบ
   - เปิดสวิตช์ **Use webhook** ให้เป็น **ON**

---

## 🔄 การอัปเดตโค้ดในอนาคต

ทุกครั้งที่คุณแก้ไขโค้ดและทำการ `git push` ขึ้น GitHub:
Vercel จะทำการตรวจจับและ Deploy เวอร์ชันใหม่ให้อัตโนมัติ (CI/CD) ทันทีภายในเวลาไม่กี่วินาที!
