/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import { createContext } from 'react';

export const ConfigContext = createContext<any>(null);

export const translations = {
  en: {
    'จองที่นั่ง': 'Book Seats',
    'บัตรของฉัน': 'My Tickets',
    'จนท. หน้างาน': 'Staff Portal',
    'แดชบอร์ด': 'Dashboard',
    'ตรวจสอบสถานะบัตร': 'Ticket Status',
    
    // FloorPlanView
    'เลือกลักษณะการจัดโต๊ะ': 'Select Layout',
    'โซนต่างๆ': 'Zones',
    'คลิกที่โต๊ะเพื่อเลือกที่นั่ง': 'Click on a table to select seats',
    'ราคายังไม่กำหนด': 'Price TBA',
    'ว่าง': 'Available',
    'ไม่ว่าง': 'Unavailable',
    'เลือกอยู่': 'Selected',
    
    // FloorPlanView table detail
    'รายละเอียดโต๊ะ': 'Table Details',
    'โซน': 'Zone',
    'ซื้อยกโต๊ะ (ประหยัดกว่า)': 'Book Whole Table',
    'เลือกทีละที่นั่ง': 'Select Individual Seats',
    'ไม่มีที่นั่งว่างในโต๊ะนี้': 'No seats available at this table',
    'เลือกที่นั่งที่ต้องการ': 'Select Your Seats',
    'ที่นั่ง': 'Seat',
    
    'สรุปการจอง': 'Booking Summary',
    'ที่นั่งที่เลือกแล้ว': 'Selected Seats',
    'โต๊ะ': 'Table',
    'ดำเนินการชำระเงิน': 'Proceed to Checkout',
    'รถเข็นว่างเปล่า': 'Cart is empty',
    
    // Checkout
    'ย้อนกลับ': 'Back',
    '1. ข้อมูลผู้จอง': '1. Buyer Info',
    '2. ชำระเงิน': '2. Payment',
    'สรุปรายการ (Order Summary)': 'Order Summary',
    'ยอดรวมทั้งสิ้น': 'Total Amount',
    'ชื่อ-นามสกุล (Name)': 'Name',
    'เบอร์โทร (Phone)': 'Phone',
    'อีเมล (Email)': 'Email',
    'ไปหน้าชำระเงิน': 'Proceed to Payment',
    'ยอดที่ต้องชำระ': 'Amount due',
    'อัพโหลดสลิปโอนเงิน': 'Upload Slip',
    'ระบบจะทำการตรวจสอบสลิปอัตโนมัติ (SlipOK API Demo)': 'Auto-verify slip (SlipOK API Demo)',
    'กดเพื่อจำลองการอัพโหลด': 'Click to simulate upload',
    'กำลังตรวจสอบสลิป...': 'Verifying slip...',
    'โปรดรอสักครู่ ระบบกำลังยืนยันยอดเงินจากธนาคาร': 'Please wait, verifying bank transfer',
    'ฟรี': 'Free',
    'รวมทั้งหมด': 'Total Amount',
    'ชำระเงินด้วย PromptPay': 'Pay with PromptPay',
    'สแกน QR Code นี้ด้วยแอปธนาคารของคุณ': 'Scan QR Code with your banking app',
    'อัปโหลดสลิปโอนเงิน': 'Upload Payment Slip',
    'ยืนยันการชำระเงิน': 'Confirm Payment',
    
    // Success
    'ชำระเงินสำเร็จ!': 'Payment Successful!',
    'ระบบได้ส่งตั๋วและใบเสร็จไปที่อีเมลของคุณแล้ว': 'Tickets and receipt have been sent to your email.',
    'คุณสามารถดู QR Code ของตั๋วได้ในหน้า "บัตรของฉัน"': 'You can view your Ticket QR codes in the "My Tickets" page.',
    'ตรวจสอบตั๋วของฉัน': 'View My Tickets',
    
    // MyTickets
    'ดาวน์โหลดบัตร Seat': 'Download Seat ',
    'ทำแบบประเมิน': 'Take Survey',
    'ประเมินแล้ว': 'Survey Done',
    'แลกรับเครื่องดื่ม': 'Redeem Drinks',
    'ไม่มีตั๋วในรายการ': 'No tickets found',
    'คุณยังไม่ได้ทำการจองที่นั่ง': 'You have not booked any seats yet',
    'รหัสการจอง': 'Booking ID',
    'ไม่สามารถดาวน์โหลดได้ ลองใหม่อีกครั้ง': 'Cannot download, please try again',
    'สามารถทำแบบประเมินได้ในวันที่จัดกิจกรรมเท่านั้น': 'Survey is available only on the event date',
    'คุณไม่ได้อยู่ในสถานที่จัดกิจกรรม (ระยะเกิน 2 กม.)': 'You are not at the event location (over 2 km distance)',
    'ไม่สามารถระบุตำแหน่งของคุณได้ กรุณาเปิด GPS': 'Unable to pinpoint your location. Please enable GPS',
    'เบราว์เซอร์ของคุณไม่รองรับการตรวจสอบสถานที่': 'Your browser does not support Geolocation verification',
  } as Record<string, string>
};

