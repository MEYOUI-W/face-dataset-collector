# คู่มือการ Deploy ระบบขึ้น Vercel (ได้ลิงก์เปิดกล้องติด 100%)

โปรเจกต์นี้เป็น **Next.js Web App** น้ำหนักเบา ออกแบบมาเพื่อเปิดกล้องเว็บแคมบนคอมพิวเตอร์และมือถือได้อย่างสมบูรณ์แบบ (ไม่มีกรอบ Iframe มาบล็อกสิทธิ์กล้อง) และส่งภาพดิบ 12 ท่าทางไปจัดเก็บใน **Google Drive** ของคุณอัตโนมัติ

---

## 🌟 จุดเด่นเมื่อขึ้น Vercel

1. **กล้องเปิดได้ 100%:** รันบนโดเมนตัวเอง (`.vercel.app`) มี HTTPS ในตัว ไม่มี Iframe ของ Google Apps Script มาตัดสิทธิ์กล้อง
2. **ภาพเข้า Google Drive เหมือนเดิม:** ระบบส่งข้อมูลผ่าน API หลังบ้านของ Next.js ไปยัง Google Apps Script ของคุณโดยตรง ไม่มีปัญหาเรื่อง CORS
3. **ฟรีและเร็ว:** Vercel ให้บริการโฮสติ้งฟรีสำหรับโปรเจกต์ส่วนตัว รองรับการใช้งานได้ไม่อั้น

---

## 🚀 วิธี Deploy ขึ้น Vercel (เลือกวิธีที่สะดวกได้เลยครับ)

### วิธีที่ 1: Deploy ผ่าน GitHub (แนะนำที่สุด — ทำครั้งเดียว ใช้งานได้ตลอดไป)

1. เข้าไปที่ [github.com](https://github.com) ➜ สร้าง Repository ใหม่ (ตั้งชื่อ เช่น `face-dataset-collector`)
2. เปิด Terminal หรือ PowerShell ในโฟลเดอร์ `d:\get_data_set` แล้วสั่ง Push โค้ดขึ้น GitHub:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/ชื่อคุณ/face-dataset-collector.git
   git push -u origin main
   ```
3. เข้าไปที่ [vercel.com](https://vercel.com) ➜ ล็อกอินด้วยบัญชี GitHub
4. กดปุ่ม **"Add New..."** ➜ เลือก **"Project"**
5. เลือก Repository `face-dataset-collector` ที่เพิ่งสร้าง ➜ กด **"Import"**
6. กดปุ่ม **"Deploy"** สีน้ำเงินได้เลย! (Vercel จะดาวน์โหลดแพ็กเกจและบิลด์ให้อัตโนมัติในคลาวด์ ไม่กินแรงเครื่องคอมของคุณ)
7. รอประมาณ 30–60 วินาที คุณจะได้ลิงก์ เช่น:
   ```text
   https://face-dataset-collector.vercel.app
   ```
   สามารถนำลิงก์นี้ไปส่งให้เพื่อนๆ เปิดบนคอมหรือมือถือเพื่อถ่ายภาพได้ทันที!

---

### วิธีที่ 2: Deploy ด้วย Vercel CLI ผ่าน Terminal โดยตรง (ไม่ต้องสร้าง GitHub)

1. เปิด PowerShell บนคอมพิวเตอร์ของคุณ แล้วเข้าไปที่โฟลเดอร์นี้:
   ```bash
   cd d:\get_data_set
   ```
2. รันคำสั่งของ Vercel:
   ```bash
   npx vercel
   ```
3. ทำตามคำแนะนำบนหน้าจอ:
   - กด **Y** เพื่อยืนยันการตั้งค่า
   - เลือกล็อกอินผ่าน Email หรือ GitHub
   - กด **Enter** ยืนยันค่าเริ่มต้นทุกข้อ
4. เมื่ออัปโหลดเสร็จ Vercel จะพิมพ์ URL เว็บแอปของคุณออกมาให้ทันทีครับ!

---

## ⚙️ การตั้งค่า Google Drive Script URL (ถ้าต้องการเปลี่ยนในอนาคต)

ระบบได้ตั้งค่าเริ่มต้นให้เชื่อมต่อกับ Google Apps Script ของคุณไว้แล้ว:
`https://script.google.com/macros/s/AKfycbzkrAr5WpqIO8H-BI3W_-KN2CezofHkzwU8GjWVU3viJ8CJmtWQyhZyY1Ne6oC1OLLv/exec`

หากในอนาคตคุณสร้างสคริปต์ Google Drive ใหม่ สามารถเข้าไปที่ Vercel Dashboard ➜ โปรเจกต์ของคุณ ➜ **Settings** ➜ **Environment Variables** แล้วเพิ่มตัวแปร:
- Key: `GOOGLE_SCRIPT_URL`
- Value: `<URL สคริปต์ใหม่ของคุณ>`
