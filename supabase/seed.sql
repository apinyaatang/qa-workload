-- ============================================================
--  WorkloadIQ — Seed Data (Demo)
--  รันหลังจาก schema.sql แล้วเท่านั้น
-- ============================================================

-- Employees
insert into employees (id, first_name, last_name, department, position, skills, start_date, is_active) values
  ('emp-001','สมชาย','ใจดี','Engineering','Senior Developer',array['React','TypeScript','Node.js','PostgreSQL'],'2021-03-15',true),
  ('emp-002','สมหญิง','รักงาน','Engineering','Backend Developer',array['Python','Django','PostgreSQL','Docker'],'2022-01-10',true),
  ('emp-003','วิชัย','เก่งงาน','Design','UI/UX Designer',array['Figma','Adobe XD','CSS','User Research'],'2020-06-01',true),
  ('emp-004','นภา','สร้างสรรค์','Engineering','QA Engineer',array['Selenium','Cypress','Postman','Test Planning'],'2022-09-05',true),
  ('emp-005','พิชัย','วิเคราะห์เก่ง','Product','Business Analyst',array['Requirements Analysis','SQL','Power BI','JIRA'],'2019-11-20',true),
  ('emp-006','อนงค์','ดูแลดี','Engineering','DevOps Engineer',array['Kubernetes','Terraform','AWS','CI/CD'],'2021-07-12',true),
  ('emp-007','กมลา','ฉลาดคิด','Product','Product Manager',array['Product Strategy','Roadmap','Agile','Stakeholder Management'],'2020-02-28',true),
  ('emp-008','ธนาพร','ทำงานเร็ว','Design','Graphic Designer',array['Illustrator','Photoshop','Motion Graphics'],'2023-04-03',true)
on conflict (id) do nothing;

-- Projects
insert into projects (id, code, name, description, department, owner_id, start_date, end_date, status, budget) values
  ('proj-001','PRJ-2026-001','WorkloadIQ Platform v2','พัฒนาระบบ Workload Dashboard รุ่นที่ 2','Engineering','emp-007','2026-01-01','2026-06-30','Active',500000),
  ('proj-002','PRJ-2026-002','Mobile App — Customer Portal','แอป Mobile สำหรับลูกค้า','Engineering','emp-007','2026-03-01','2026-09-30','Active',800000),
  ('proj-003','PRJ-2025-010','Legacy System Migration','ย้าย Legacy System ไป Cloud','Engineering','emp-006','2025-06-01','2026-03-31','Completed',1200000),
  ('proj-004','PRJ-2026-003','Design System 2.0','ปรับปรุง Design System ให้ครอบคลุมทุก Platform','Design','emp-003','2026-04-01',null,'Active',null),
  ('proj-005','PRJ-2026-004','Q3 Marketing Campaign','แคมเปญ Marketing ไตรมาส 3','Product','emp-005','2026-07-01','2026-09-30','Inactive',null)
on conflict (id) do nothing;

-- Tasks (May 2026)
insert into tasks (id, name, assignee_ids, estimated_hours, deadline, task_type, source, status, period_start, period_end, azure_work_item_id) values
  ('task-001','Develop Workload Dashboard UI',array['emp-001'],32,'2026-05-15','Planned','Excel/GSheet','In-Progress','2026-05-01','2026-05-31',null),
  ('task-002','API Integration for Azure DevOps',array['emp-001'],24,'2026-05-20','Planned','Excel/GSheet','In-Progress','2026-05-01','2026-05-31',null),
  ('task-003','Fix Critical Auth Bug',array['emp-001'],16,'2026-05-06','Adhoc','Azure DevOps','In-Progress','2026-05-01','2026-05-31','ADO-4521'),
  ('task-004','Performance Optimization Sprint',array['emp-001'],20,'2026-05-28','Adhoc','Azure DevOps','Pending','2026-05-01','2026-05-31','ADO-4530'),
  ('task-005','Code Review Sprint',array['emp-001'],8,'2026-05-10','Planned','Excel/GSheet','Done','2026-05-01','2026-05-31',null),
  ('task-006','Backend API Refactoring',array['emp-002'],40,'2026-05-25','Planned','Excel/GSheet','In-Progress','2026-05-01','2026-05-31',null),
  ('task-007','Database Migration Script',array['emp-002'],24,'2026-05-18','Planned','Excel/GSheet','Pending','2026-05-01','2026-05-31',null),
  ('task-008','Hotfix: Payment Processing Error',array['emp-002'],8,'2026-05-08','Adhoc','Azure DevOps','Done','2026-05-01','2026-05-31','ADO-4525'),
  ('task-009','Design System Update v2',array['emp-003'],24,'2026-05-22','Planned','Excel/GSheet','In-Progress','2026-05-01','2026-05-31',null),
  ('task-010','Mobile App UX Wireframes',array['emp-003'],16,'2026-05-15','Planned','Excel/GSheet','Done','2026-05-01','2026-05-31',null),
  ('task-011','Quick Logo Revision — Marketing',array['emp-003'],4,'2026-05-09','Adhoc','Azure DevOps','Done','2026-05-01','2026-05-31','ADO-4527'),
  ('task-012','Test Automation for Auth Module',array['emp-004'],16,'2026-05-20','Planned','Excel/GSheet','In-Progress','2026-05-01','2026-05-31',null),
  ('task-013','Regression Test Suite',array['emp-004'],12,'2026-05-30','Planned','Excel/GSheet','Pending','2026-05-01','2026-05-31',null),
  ('task-014','Manual Testing — Dashboard Feature',array['emp-004'],4,'2026-05-31','Adhoc','Azure DevOps','Pending','2026-05-01','2026-05-31','ADO-4540'),
  ('task-015','Old Test Plan (Cancelled)',array['emp-004'],20,'2026-05-15','Planned','Excel/GSheet','Cancelled','2026-05-01','2026-05-31',null),
  ('task-016','Requirements Gathering — Phase 2',array['emp-005'],30,'2026-05-20','Planned','Excel/GSheet','In-Progress','2026-05-01','2026-05-31',null),
  ('task-017','Market Analysis Report',array['emp-005'],20,'2026-05-28','Planned','Excel/GSheet','Pending','2026-05-01','2026-05-31',null),
  ('task-018','Emergency Stakeholder Deck',array['emp-005'],8,'2026-05-07','Adhoc','Azure DevOps','In-Progress','2026-05-01','2026-05-31','ADO-4535'),
  ('task-019','Kubernetes Cluster Upgrade',array['emp-006'],40,'2026-05-25','Planned','Excel/GSheet','In-Progress','2026-05-01','2026-05-31',null),
  ('task-020','CI/CD Pipeline Optimization',array['emp-006'],20,'2026-05-15','Planned','Excel/GSheet','In-Progress','2026-05-01','2026-05-31',null),
  ('task-021','Production Incident Response',array['emp-006'],12,'2026-05-05','Adhoc','Azure DevOps','Done','2026-05-01','2026-05-31','ADO-4520'),
  ('task-022','Security Patch Deployment',array['emp-006'],8,'2026-05-10','Adhoc','Azure DevOps','Done','2026-05-01','2026-05-31','ADO-4528'),
  ('task-023','Q2 Product Roadmap Review',array['emp-007'],16,'2026-05-12','Planned','Excel/GSheet','Done','2026-05-01','2026-05-31',null),
  ('task-024','User Interview Sessions',array['emp-007'],12,'2026-05-25','Planned','Excel/GSheet','Pending','2026-05-01','2026-05-31',null),
  ('task-025','Marketing Banner Design',array['emp-008'],8,'2026-05-31','Planned','Excel/GSheet','Pending','2026-05-01','2026-05-31',null),
  ('task-026','Architecture Design Session',array['emp-001','emp-002','emp-006'],8,'2026-05-14','Planned','Excel/GSheet','Done','2026-05-01','2026-05-31',null)
on conflict (id) do nothing;

-- Leave Records
insert into leave_records (id, employee_id, date, leave_type, status) values
  ('leave-001','emp-001','2026-05-04','annual','approved'),
  ('leave-002','emp-002','2026-05-11','sick','approved'),
  ('leave-003','emp-002','2026-05-12','sick','approved'),
  ('leave-004','emp-002','2026-05-30','annual','pending'),
  ('leave-005','emp-005','2026-05-14','personal','approved')
on conflict (id) do nothing;

-- Public Holidays
insert into public_holidays (id, date, name) values
  ('ph-001','2026-05-01','วันแรงงาน'),
  ('ph-002','2026-05-05','วันฉัตรมงคล')
on conflict (id) do nothing;
