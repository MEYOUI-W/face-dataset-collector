import { NextResponse } from 'next/server';

const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzkrAr5WpqIO8H-BI3W_-KN2CezofHkzwU8GjWVU3viJ8CJmtWQyhZyY1Ne6oC1OLLv/exec';

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    if (!payload || (!payload.userId && !payload.userName) || !payload.images || payload.images.length === 0) {
      return NextResponse.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน กรุณากรอกรหัสประจำตัวและถ่ายภาพ' }, { status: 400 });
    }

    const scriptUrl = process.env.GOOGLE_SCRIPT_URL || DEFAULT_SCRIPT_URL;

    // ส่ง payload ต่อไปยัง Google Apps Script (Server-to-Server, ไม่มีปัญหา CORS)
    const googleRes = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const data = await googleRes.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error forwarding upload to Google Drive:', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ Google Drive',
      },
      { status: 500 }
    );
  }
}
