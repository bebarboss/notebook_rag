# Notebook AI Helper

สร้างเว็บแอป UI ชื่อ "Notebook RAG" ให้หน้าตาและ layout คล้าย Google NotebookLM

(3-panel layout: Sources ซ้าย / เนื้อหาหลักตรงกลาง / รายละเอียดขวา) โดยเชื่อมกับ REST API

ที่มีอยู่แล้ว (FastAPI, base URL เก็บเป็น env var VITE_API_BASE_URL ค่า default

http://localhost:8000)

=== ภาพรวม Layout ===

1) Sidebar ซ้าย "Sources" (กว้าง ~280px, ย่อ/ขยายได้)

   - ปุ่ม "+ Add source" เปิด modal อัปโหลดไฟล์

   - รายการไฟล์ที่อัปโหลดแล้วในเซสชันนี้ (เก็บ state ฝั่ง client เพราะ API ยังไม่มี

     endpoint list sources) แต่ละรายการแสดง: ไอคอนตามชนิดไฟล์ (.pdf .txt .epub .xps

     .fb2 .cbz = เอกสาร, .csv = incident), ชื่อไฟล์, tag service (ถ้ามี), checkbox

     เลือกเพื่อกรองตอนค้นหา, สถานะ (uploading / ingested / error)

   - แถบค้นหา/กรอง source ตาม service ด้านบนสุดของ sidebar

2) พื้นที่กลาง "Chat / Ask"

   - ช่องพิมพ์คำถามด้านล่าง (เหมือน NotebookLM) พร้อม toggle เลือกโหมดค้นหา:

     "เอกสาร" (เรียก GET /search) หรือ "Incidents" (เรียก GET /search/incidents)

   - เมื่อส่งคำถาม แสดงเป็น "การ์ดคำตอบ" ที่เรียงผลลัพธ์จาก API ตาม score มากไปน้อย

     ไม่ใช่คำตอบสังเคราะห์เดียว (เพราะ backend เป็น semantic search ไม่ใช่ LLM

     generation) — ให้ดีไซน์เป็น "แหล่งอ้างอิงที่เกี่ยวข้องที่สุด" คล้าย citation

     list ของ NotebookLM แต่ละใบแสดง:

       - badge % ความเกี่ยวข้อง (คำนวณจาก score เช่น 0.87 -> 87%)

       - ชื่อไฟล์ต้นทาง (source) + service (ถ้ามี)

       - โหมดเอกสาร: เลขหน้า (page) และ chunk_index, เนื้อหา (content) แบบ

         truncate พร้อมปุ่ม "ดูเพิ่มเติม"

       - โหมด incident: incident_no, problem / cause / workaround แยกเป็น

         3 บรรทัดชัดเจน (ใช้ label ไทย: ปัญหา / สาเหตุ / วิธีแก้ไข)

   - ประวัติคำถามก่อนหน้าในเซสชันแสดงเรียงเป็น thread ด้านบน (คล้าย chat history)

   - แถบด้านบนมี dropdown/slider ปรับ top_k (1-50, default 5) และช่องกรอง service

3) Panel ขวา "รายละเอียด source ที่เลือก" (เปิดเมื่อคลิก source ใน sidebar)

   - แสดง metadata: filename, service, ext, เวลาที่อัปโหลด, สถานะ ingest

   - ปุ่ม "ลบออกจากรายการ" (เอาออกจาก client state เท่านั้น ไม่มี delete endpoint

     จริง — ใส่ tooltip อธิบาย)

=== การเชื่อมต่อ API (ใช้ตามนี้เป๊ะ ๆ) ===

GET {BASE}/health

  -> { "status": "ok" }   ใช้แสดง indicator สีเขียว/แดงมุมขวาบนของแอปว่า backend

     online หรือไม่ (poll ทุก 30 วิ)

GET {BASE}/search?q=...&top_k=5&service=xxx

  response: {

    "query": string,

    "results": [{

      "id": number, "source": string, "service": string|null,

      "page": number|null, "chunk_index": number, "content": string,

      "score": number   // 0-1 ยิ่งเข้าใกล้ 1 ยิ่งตรง

    }]

  }

GET {BASE}/search/incidents?q=...&top_k=5&service=xxx

  response: {

    "query": string,

    "results": [{

      "id": number, "source": string, "incident_no": string|null,

      "service": string|null, "problem": string|null, "cause": string|null,

      "workaround": string|null, "score": number

    }]

  }

POST {BASE}/upload   (multipart/form-data)

  fields: file (required), service (optional text)

  รองรับนามสกุล: .pdf .txt .epub .xps .fb2 .cbz .csv (csv ต้องมี column

  incident_no,service,problem,cause,workaround) สูงสุด 50MB

  response 201: { "filename": string, "saved_path": string,

                  "service": string|null, "status": "ingested" }

  error: 415 (นามสกุลไม่รองรับ), 413 (ไฟล์ใหญ่เกิน), 422 (csv column ไม่ครบ),

         500 (ingest ล้มเหลว) -> body { "detail": string }

=== พฤติกรรมที่ต้องมี ===

- ตอนอัปโหลด: แสดง progress/spinner บนการ์ด source นั้น เพราะ ingest ใช้เวลานาน

  (โหลดโมเดล embedding) ให้ใส่ข้อความ "กำลังประมวลผล อาจใช้เวลาสักครู่..."

  ระหว่างรอ response ของ /upload (เป็น synchronous call ไม่ใช่ background job)

- error handling: ถ้า /upload หรือ /search ตอบ error ให้ toast แสดง body.detail

- responsive: ใช้งานได้บนจอมือถือ โดย sidebar ซ้าย/ขวายุบเป็น drawer ที่เลื่อนออกมา

- dark mode support (คล้าย NotebookLM ที่มีทั้ง light/dark)

- ใช้ฟอนต์ที่รองรับภาษาไทยอ่านง่าย (เช่น Noto Sans Thai) เพราะ label และเนื้อหา

  ส่วนใหญ่เป็นภาษาไทย

- Empty state ตอนยังไม่มี source: แสดงภาพ/ข้อความชวนอัปโหลดไฟล์แรก คล้าย

  NotebookLM's onboarding

=== สิ่งที่ไม่ต้องทำ ===

- ไม่ต้องสร้างระบบ auth/login

- ไม่ต้องเรียก LLM ใด ๆ เพื่อสรุปคำตอบ — แสดงผลลัพธ์ดิบจาก API ตามที่ออกแบบไว้

  ในการ์ดผลลัพธ์เท่านั้น

- ไม่ต้องมีปุ่ม "Generate summary / audio overview" แบบ NotebookLM เพราะ backend

  ไม่มีความสามารถนี้

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/daf49337-1d11-4a72-b262-e83489f75bcc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
