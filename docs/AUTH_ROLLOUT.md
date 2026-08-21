# ลำดับการเปิดระบบ Login — WorkloadIQ

โครงสร้างของ Phase 0–2 ติดตั้งไว้แล้วในโค้ด แต่ **ยังไม่เปิดใช้งาน**
สวิตช์อยู่ที่ `VITE_REQUIRE_AUTH` ซึ่งตั้งเป็น `false` ไว้

เอกสารนี้คือลำดับการเปิดที่ไม่ทำให้ระบบล่ม

---

## ข้อค้นพบที่กำหนดลำดับทั้งหมด

policy ที่มีอยู่ทุกตัวเขียนว่า `FOR ALL TO anon` แต่ request ของคนที่ล็อกอินแล้ว
รันเป็น role **`authenticated`** ไม่ใช่ `anon` — และเพราะ RLS เปิดอยู่แล้ว
แต่ไม่มี policy สำหรับ `authenticated` ผลคือ **default deny**

วินาทีที่คนแรกล็อกอินสำเร็จ:

- ทุก `SELECT` คืน `[]` **แบบเงียบๆ** — RLS กรองแถวออก ไม่ throw error ให้เห็น
- ทุกการเขียนล้มด้วย `new row violates row-level security policy`
- `AppContext` โหลดได้ array ว่าง แล้วยังรายงานว่าต่อ database สำเร็จ
  → แอปดูเหมือนเพิ่งติดตั้งใหม่ที่ยังไม่มีข้อมูล ทั้งที่ข้อมูลยังอยู่ครบ

**ดังนั้น Phase 0 ไม่ใช่งานเอกสาร — เป็นเงื่อนไขบังคับ**

---

## สิ่งที่ติดตั้งไว้แล้ว

### SQL — `supabase/migrations/`

| ไฟล์ | ทำอะไร | ผลกระทบ |
|---|---|---|
| `00_survey.sql` | สำรวจ policy/RLS/คอลัมน์จริง (READ-ONLY) | ไม่มี |
| `01_baseline_ddl.sql` | DDL ย้อนหลังของ `epics`, `extra_tasks` | ไม่มี — `IF NOT EXISTS` ทั้งหมด |
| `02_authenticated_policies.sql` | **เพิ่ม policy ของ `authenticated`** | ไม่มี — permissive policy ถูก OR กัน |
| `03_auth_core.sql` | `profiles`, `is_admin()`, trigger, `staff_assignments`, `progress_updates` | เพิ่มตารางใหม่ |
| `04_bootstrap_admin.sql` | ยก user เป็น admin คนแรก · **ทางกู้ระบบถาวร** | 1 แถว |
| `99_verify.sql` | assertion 9 ข้อ — รันหลังทุกไฟล์ | ไม่มี |
| `99_emergency_rollback.sql` | 🚨 เปิดระบบกลับให้ทุกคนเข้าได้ทันที | คืนสภาพเดิม |

### โค้ด

| ไฟล์ | บทบาท |
|---|---|
| `src/lib/auth/provider.ts` | **ไฟล์เดียวที่รู้ว่า auth ทำงานอย่างไร** — สลับไป Entra SSO ที่บรรทัด export ท้ายไฟล์ |
| `src/lib/auth/errors.ts` | แปล error ของ Supabase เป็นไทย |
| `src/lib/auth/sessionCache.ts` | ล้าง cache `wiq:*` ตอนออกจากระบบ (เก็บ `wiq:theme`) |
| `src/lib/permissions.ts` | **ตาราง `can(role, permission)` จุดเดียวของระบบ** |
| `src/types/auth.ts` | `AuthState` เป็น discriminated union |
| `src/context/AuthContext.tsx` | state machine + เช็ค `is_active` ซ้ำทุก 5 นาที |
| `src/components/auth/AuthGate.tsx` | กั้นหน้าแอป + หน้าจอของทุกสถานะ |
| `src/App.tsx` | กั้น **switch ที่ render หน้า** ไม่ใช่แค่ซ่อนเมนู |
| `src/components/layout/Sidebar.tsx` | เมนูตามสิทธิ์ + ชื่อผู้ใช้ + ปุ่มออกจากระบบ |

`src/components/auth/LoginPage.tsx` **ไม่ถูกแก้แม้แต่บรรทัดเดียว** — ไม่รู้จัก Supabase เลย

---

## ตารางสิทธิ์

| Permission | admin | staff |
|---|---|---|
| `view:team` (Dashboard, รายงาน) | ✅ | ❌ |
| `view:own-work` (โปรเจคของฉัน) | ✅ | ✅ |
| `view:epics` / `edit:epics` | ✅ | ✅ |
| `view:extra-tasks` / `edit:extra-tasks` | ✅ | ✅ |
| `submit:progress` · `sync:ado` | ✅ | ✅ |
| `manage:master-data` (Master Data) | ✅ | ❌ |
| `import:data` (Import CSV) | ✅ | ❌ |
| `manage:users` | ✅ | ❌ |
| `reset:demo-data` | ✅ | ❌ |

หน้าแรกหลังล็อกอิน: admin → Team Dashboard · staff → โปรเจคของฉัน

> ⚠️ **ตารางนี้เป็นเรื่อง UX เท่านั้นจนกว่าจะถึง Phase 5**
> วันนี้ staff คนไหนก็ยัง `curl` เข้า REST endpoint อ่านและเขียนทุกตารางได้
> การซ่อนปุ่มไม่ใช่ความปลอดภัย — RLS เท่านั้นที่เป็น

---

## ลำดับการเปิด

### Phase 0 — รันได้ทันทีบน production (ผลกระทบ: ไม่มี)

```
1. supabase/migrations/00_survey.sql          → เก็บผลลัพธ์ไว้
2. supabase/migrations/01_baseline_ddl.sql
3. supabase/migrations/02_authenticated_policies.sql
4. supabase/migrations/99_verify.sql          → A1 และ A2 ต้อง PASS
```

**ห้ามไปต่อถ้า A1 หรือ A2 เป็น FAIL**

ขั้นนี้ไม่แตะโค้ดแอปเลย และย้อนกลับได้ — ทำวันไหนก็ได้

---

### Phase 1 — เปิด login (ผลกระทบ: ทั้งระบบ)

```
5. supabase/migrations/03_auth_core.sql
6. สร้าง user ใน Dashboard → Authentication → Users → Add user
      ☑ Auto Confirm User    ← ไม่ติ๊ก = ล็อกอินไม่ได้
7. แก้ admin_email ใน 04_bootstrap_admin.sql แล้วรัน
8. ปิด public signup: Dashboard → Authentication → Providers → Email
      ปิด "Enable email signups"
9. supabase/migrations/99_verify.sql          → ทั้ง 9 ข้อต้อง PASS
```

จากนั้นทดสอบ **บน preview deploy ก่อน production**:

```
10. ตั้ง VITE_REQUIRE_AUTH=true บน preview environment แล้ว deploy
11. เปิด browser profile ที่สอง ล็อกอินด้วย admin ที่สร้างไว้
12. ยืนยันว่าข้อมูลทุกตารางยังโหลดครบ ไม่ใช่ตารางว่าง
13. ทดลองแก้ข้อมูล 1 แถว → ต้องบันทึกสำเร็จ
14. ยืนยันว่ากดออกจากระบบแล้วกลับมาหน้า login
```

**ผ่านทั้ง 5 ข้อ** จึงตั้ง `VITE_REQUIRE_AUTH=true` บน production

> เปิด browser profile ที่สองไว้ในสถานะล็อกอินตลอดช่วง deploy
> ถ้าอะไรพัง จะเห็นทันทีโดยไม่ต้องรอคนในทีมมาแจ้ง

---

### 🚨 ถ้าพลาด

```
1. รัน supabase/migrations/99_emergency_rollback.sql
      (เปิด Supabase SQL Editor — ไม่ต้อง deploy อะไรเลย)
2. ตั้ง VITE_REQUIRE_AUTH=false แล้ว redeploy
3. หาสาเหตุด้วย 99_verify.sql
```

---

## ที่ยังไม่ได้ทำ

| Phase | งาน | ต้องทำหลัง |
|---|---|---|
| **2** | ปุ่ม "Reset to defaults" ใน Master Data ยังไม่ผูกกับ `reset:demo-data` — มันยัดข้อมูล employee **ปลอม** กลับเข้า state แล้วการแก้ครั้งถัดไปจะ upsert ลงตารางจริง | 1 |
| **3** | `UpdateProgressForm` ยัง hardcode `staffId: 'offline'` และ `updatedBy: 'System'` ลงคอลัมน์ที่อ้าง `auth.users(id)` — ต้องเปลี่ยนเป็น user id จริง **ก่อน** ใส่ policy ที่บังคับ `auth.uid() = staff_id` | 1 |
| **4** | "โปรเจคของฉัน" ยังแสดงโปรเจคของ**ทุกคน** — ต้องผูกตัวตนผ่าน `staff_assignments` + หน้าจัดการ user (ต้องมี Edge Function `admin-users` ที่ถือ `service_role`) | 1, 3 |
| **5** | **ปิด RLS ให้จริง** — 4 ขั้น ห้ามรวมเป็น migration เดียว: รัดกุม `authenticated` ทีละตารางต่อ deploy → ลด `anon` เหลือแค่อ่าน → ลบ policy `anon` → **ถอน grant ที่อยู่ข้างใต้** (การลบ policy ไม่ถอน grant) | 0, 1, 3, 4 |
| **6** | ย้าย ADO PAT และ Teams webhook ไปฝั่ง server — เริ่มที่ Teams ก่อน เพราะไม่มีเรื่อง CORS | อิสระ |

**Phase 5 คือจุดที่ login หยุดเป็นแค่เปลือก** และเป็น phase ที่มีโอกาสถูกเลื่อนออกไป
มากที่สุด เมื่อแอป*ดูเหมือน*ปลอดภัยแล้ว — อย่าปล่อยให้หลุด

---

## สิ่งที่ตั้งใจไม่ทำ

ผู้ใช้รีเซ็ตรหัสผ่านเอง · เชิญทาง email · บังคับเปลี่ยนรหัสผ่าน (v1) ·
ลบ user จริง (ใช้ปิดการใช้งานแทน เพื่อรักษาประวัติ progress) · MFA ·
ตาราง audit log กลาง (ตาราง `progress_updates` เป็น log อยู่แล้ว) ·
"จำฉันไว้" · role ที่สาม · หมดเวลาเมื่อไม่ใช้งาน

**Azure Entra SSO** — ทำทีหลัง แต่ออกแบบรอไว้แล้ว: มีโมดูลเดียวที่รู้ว่า auth
ทำงานอย่างไร (`src/lib/auth/provider.ts`) และหน้า login ไม่แตะ Supabase เลย
