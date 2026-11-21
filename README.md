# ASTRAEA — คืนฝากดาว

โปรเจกต์นี้รับช่วงจาก Source Code ที่แนบ โดย `festival.html` และภาพ `public/assets/lantern-*.webp` ยังคงเป็นหน้าและภาพโคมจริงของเว็บไซต์ ไม่ได้สร้าง UI ชุดใหม่

## Runtime ที่ใช้ใน Managed Hosting

Workspace นี้ใช้ Node.js Managed Server และ Managed MySQL (`DATABASE_URL`) เนื่องจาก Cloudflare account และ D1 จริงไม่ได้อยู่ใน ZIP และไม่สามารถนำฐานข้อมูลจากเว็บต้นทางมาใช้ข้ามแพลตฟอร์มได้ ตัวหน้าเว็บ, URL API, กติกา identity, rate limit, Request ID และการแสดงท้องฟ้ายังคงทำงานตาม contract เดิม ส่วน `lib/mysql-lantern-store.mjs` เป็นชั้นข้อมูลของโฮสต์นี้

## ระบบออนไลน์ทำงานอย่างไร

1. Browser เปิด `festival.html` และส่ง/อ่านข้อมูลผ่าน URL API `/api/lanterns` บน origin เดียวกัน ไม่ได้ใช้ `localStorage` เป็นที่เก็บกลาง
2. Managed Node Server ตรวจคำขอและใช้ guest cookie แบบ `HttpOnly; Secure` เพื่อระบุเจ้าของ จากนั้นบันทึกข้อมูลลง Managed MySQL (`lanterns`); ค่า actor ถูก hash และไม่ส่งกลับให้ผู้เข้าชม
3. เมื่อบันทึกสำเร็จ Server ตอบกลับก่อน UI จึงเริ่มแอนิเมชันปล่อยโคม จากนั้น browser ทุกเครื่องดึงท้องฟ้ารวมซ้ำทุกประมาณ 8 วินาที โคมและข้อความจึงปรากฏแก่ผู้เข้าชมคนอื่นและอยู่ในฐานข้อมูลหลัง reload/restart
4. เจ้าของลบรายการของตนด้วย owner cookie; ทุกคนอ่านท้องฟ้าได้ แต่ API ปฏิเสธการลบข้ามเจ้าของ

ขณะนี้มี Managed Server/Database และ Preview สำหรับตรวจ แต่ `infra/overview` รายงาน `not_deployed`; เว็บไซต์ยังไม่เป็น public URL จนกว่าเจ้าของจะเลือก access policy และสั่ง Publish เอง

## เพลงพื้นหลัง

เพลง “Emotional” ของ AtlasAudio (Pixabay ID 631198) อยู่ใน `public/assets/emotional-631198.mp3` และใช้เป็นส่วนหนึ่งของประสบการณ์ ASTRAEA หน้าเว็บจะพยายามเริ่มเล่นเพลงวนทันทีเมื่อเข้าเว็บและตั้งเสียงเริ่มต้นเบา; หาก browser บล็อก autoplay เพลงจะเริ่มทันทีเมื่อผู้ใช้แตะ/คลิก/กดปุ่มครั้งแรกที่ใดก็ได้ในหน้า (เบราว์เซอร์ไม่อนุญาตให้มีเสียงก่อนมี interaction แรก); ปุ่ม “เปิดเพลง” ยังใช้เริ่มเองได้ และหากผู้ใช้กด “ปิดเพลง” จะไม่เล่นซ้ำเอง และเมื่อเล่นอยู่ปุ่มเดียวกันใช้ “ปิดเพลง” เพื่อหยุดเสียง

หน้าสรุปใบอนุญาตของ Pixabay ระบุว่าสามารถใช้คอนเทนต์ได้ฟรีโดยไม่บังคับระบุเครดิต แต่ห้ามแจกจ่ายเพลงเดี่ยวโดยไม่มีงานสร้างสรรค์อื่นประกอบ ASTRAEA จึงไม่ทำปุ่มดาวน์โหลดแทร็กแยก ดูที่มาของไฟล์และข้อกำหนดเต็มได้ใน [บันทึกเพลง](docs/pixabay-music-source.md), [Pixabay License Summary](https://pixabay.com/service/license-summary/) และ [Pixabay FAQ](https://pixabay.com/service/faq/)

## ภาพพื้นหลังทั้งเว็บไซต์

พื้นหลังคือ `public/assets/galaxy-background.webp` (ภาพรวมกาแล็กซี 1895×946) จัดให้ครอบ viewport และเลื่อนโฟกัสไปทางขวาบนมือถือ ให้เห็นแกนกาแล็กซีเสมอ โดยมีเลเยอร์ที่ขยับซ้อนทับตำแหน่งเดียวกัน:

- `galaxy-ribbon.webp` (สายทางช้างเผือก) — วาดบน canvas `#ribbon-flow` ให้พลิ้วไหลเป็นสายน้ำ มีแสงวิ่งและละอองดาวไหลลงตามเส้นโค้ง
- `galaxy-spiral.webp` (วงกาแล็กซี) — หมุนด้วย CSS 3 วง ความเร็วต่างกัน (ใน 46 วินาที/รอบ, กลาง 92, นอก 170) รอบจุดศูนย์กลางที่ 73.35% / 80.87% ของภาพ
- ดาวระยิบระยับ — วาดใน canvas `#stars` (ค่า `glints`) ความสว่างต่ำและอยู่ใต้โคมทั้งหมด
- ทุกเลเยอร์อยู่ใต้ `.lantern-layer` จึงไม่บังโคม; เมื่อเปิด `prefers-reduced-motion` หรือกดปุ่ม "หยุดการเคลื่อนไหว" ภาพจะนิ่ง

ปรับตำแหน่งโฟกัสภาพได้ที่ `--px` ใน `.bg-stack`

- `npm ci` — ติดตั้งตาม lockfile ที่มากับ source
- `npm run db:migrate:managed` — สร้างตาราง MySQL แบบ additive หนึ่งครั้ง ใช้ `DATABASE_URL` ของ Managed DB และบันทึก migration history; ตรวจว่าเป็นฐาน ASTRAEA ที่ตั้งใจใช้ก่อนสั่ง เพราะ dev/production แชร์ฐานเดียวกัน
- `npm run dev` — รัน Preview server บน `PORT` (ค่าเริ่มต้น 3000)
- `npm test` — ทดสอบ API ด้วย store จำลองแยกจาก Managed DB และตรวจ UI เพลง, ภาพพื้นหลังทั้งเว็บ, reduced motion และ ritual layout layering
- `npm run build` — regenerate `festival-html.ts` จาก `festival.html` เพื่อตรวจ/generate artifact
- `npm run db:generate`, `npm run dev:worker`, `npm run build:worker`, `npm run start:worker` — เก็บคำสั่ง Vinext/Cloudflare Worker/D1 เดิมไว้แยกต่างหาก ไม่ใช้เป็น runtime ของ Manus Managed MySQL

Dockerfile ใช้ `PORT` และ expose 3000; readiness endpoint คือ `/_app/health` (ตอบ 200 โดยไม่ต้องล็อกอิน) การตั้งค่าให้ publish ต้องใช้ Managed Server และ container Dockerfile ที่ root

## API และความปลอดภัย

- `GET /api/lanterns` คืน 100 รายการล่าสุดและยอดรวม; UI แสดงไม่เกิน 40 และดึงข้อมูลใหม่ทุกประมาณ 8 วินาที
- `GET /api/lanterns?mine=1` คืนรายการของ Guest Session ปัจจุบัน; `GET /api/lanterns?after=<id>` รองรับอ่านหลัง ID
- `POST /api/lanterns` รับ JSON `{name, wish, color, requestId}`; ชื่อสูงสุด 60, คำอธิษฐานสูงสุด 300, สี 0–4, และไม่เกิน 5 โคม/10 นาที/actor
- `DELETE /api/lanterns/<id>` ลบได้เฉพาะ actor ที่เป็นเจ้าของ; ใน UI แตะโคมของตนเพื่ออ่าน แล้วเลือก “ลบคำอธิษฐานของฉัน” และยืนยัน หรือเปิด “โคมของฉัน” แล้วลบจากรายการ
- เมื่อไม่มี trusted server identity ใช้ `__Host-astraea-wisher` ซึ่งเป็น HttpOnly, Secure, SameSite=None guest cookie; API ไม่เชื่อ header identity ที่ client ส่งเอง
- สิทธิ์เจ้าของผูกกับ cookie ของ browser นี้ ไม่ใช่บัญชีผู้ใช้; ถ้าลบ cookie หรือเปลี่ยนอุปกรณ์จะเรียกดู/ลบโคมเก่าของตนไม่ได้ แม้โคมยังอยู่ในท้องฟ้ารวม
- Request ID ที่ซ้ำจาก session เดิมคืนรายการเดิม ไม่สร้างโคมเพิ่ม; API mutation ตรวจ same-origin/fetch metadata; API response เป็น no-store
- HTML แสดง animation ลอยหลัง server ตอบสำเร็จเท่านั้น หากเขียน DB ไม่สำเร็จจะแจ้ง retry และไม่แสดงว่าฝากสำเร็จ

คำอธิษฐานในท้องฟ้ารวมเป็นเนื้อหาที่ผู้เข้าชมหน้าเว็บอ่านได้ตามข้อกำหนดของกิจกรรม ไม่ควรใส่ข้อมูลส่วนบุคคลหรือข้อมูลลับ

## Migration และการย้ายข้อมูล

ห้ามแก้ `drizzle/0000_organic_ultimates.sql` ที่เป็น migration เดิม Migration สำหรับ Managed MySQL เพิ่มแยกไว้ที่ `drizzle/0001_managed_mysql.sql` และมี `lantern_actor_locks` เพื่อ serialize การส่งพร้อมกันและคุม rate limit ต่อผู้ใช้ข้ามหลาย instance สคริปต์ migrate ใช้ `CREATE TABLE IF NOT EXISTS` และ migration ledger; ไม่มีคำสั่ง DROP/DELETE และไม่ได้ย้ายข้อมูลจริงจาก D1

การเปิดใช้ Managed DB ไม่ได้ทำให้เว็บเป็น public โดยอัตโนมัติ ค่าใช้งานและโควตาต้องดูจากหน้า Billing/Hosting ของบัญชีจริง; สภาพแวดล้อมนี้ไม่ส่งตัวเลขราคาหรือโควตาที่อนุมัติได้มาให้ ห้ามถือว่าใช้ฟรีตลอดไป ฐานนี้เป็นฐานเดียวสำหรับ development/production ไม่มีฐาน dev แยกและไม่พบ API สำหรับ point-in-time restore/export ใน capability นี้ อย่ารันทดสอบ POST/DELETE กับฐานนี้ เพราะข้อมูลทดสอบจะกระทบฐานที่เผยแพร่

## เผยแพร่

ก่อนเปิด public ให้เจ้าของเลือก access policy ในหน้า Project/Hosting ก่อน Managed Database ของโปรเจกต์ inject `DATABASE_URL` ให้ Managed Server เอง จึงไม่ต้องตั้งเป็น secret ซ้ำและห้ามใส่ DSN ใน Git; migration `0001_managed_mysql.sql` ถูก apply กับฐานปัจจุบันแล้ว หากเลือกฐานอื่นค่อยรัน `npm run db:migrate:managed` กับฐานเป้าหมายและตรวจว่าเป็น DB ที่ตั้งใจใช้ การ checkpoint source และการ publish เป็นคนละขั้น Auto Publish ของโปรเจกต์นี้ปิดอยู่และยังไม่มีการ publish; หลังเจ้าของเลือก visibility แล้วจึงตรวจ deployment image/health และกด Publish เอง
