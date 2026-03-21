# SpecCon Academy — Textbooks Project Map
_Generated: 2026-03-13_

---

## Project Purpose

This project catalogs South African CAPS curriculum textbooks across multiple publishers, maps their topics against the SpecCon Academy's internal lesson topic system, and provides a web application for managing and browsing those mappings.

---

## Top-Level Structure

```
SpecCon Academy - Textbooks/
├── Indexes (English Textbooks)/   ← 119 TXT index files, 5 publisher series
├── Spreadsheets/                  ← 5 Excel mapping files
├── Vecel App/textbook-mapping/    ← Node.js/TypeScript web app
├── LAP Content Report 2025 (01).xlsx
├── Textbook Topic Mapping.xlsx
├── Textbook Topic Mapping v2.xlsx
├── Midstream Textbook List.pdf
├── Textbooks - Westville.pdf
├── Dashboard of Textbooks 01.png
├── Dashboard of Textbooks 02.png
├── Paywall Issues with Textbooks.png
└── Paywall Issues with Textbooks (1).png
```

---

## 1. Textbook Indexes

### Overview

| Publisher Series            | Books | Grades  | Total Entries | Processed       |
|-----------------------------|-------|---------|---------------|-----------------|
| Platinum                    | 52    | 4–12    | ~12,500+      | 2026-02-17      |
| Spot On                     | 20    | 4–12    | ~3,300+       | 2026-02-17      |
| Focus                       | 15    | 10–12   | ~2,900+       | 2026-02-17      |
| Afrikaans sonder grense     | 9     | 4–12    | 3,109         | 2026-02-17      |
| English in Context          | 2     | 11–12   | 631           | 2026-02-17      |
| **TOTAL**                   | **98**|         |               |                 |

All processing: 0 failures across all 98 books.

---

### Platinum (52 books) — `Indexes (English Textbooks)/Platinum/`

| Subject                            | Grades Available         | Entry Count Range |
|------------------------------------|--------------------------|-------------------|
| Afrikaans Huistaal                 | 4, 5, 6, 7, 8, 9, 10, 11, 12 | 23–683 |
| Business Studies                   | 10, 11, 12               | 125–818           |
| Creative Arts                      | 9                        | 104               |
| English First Additional Language  | 4, 5, 6, 10, 11, 12      | 29–296            |
| English Home Language              | 5, 6, 10                 | 181–204           |
| Geography                          | 10, 12                   | 158–705           |
| Mathematical Literacy              | 10, 11, 12               | 100–667           |
| Mathematics                        | 4, 5, 6, 7, 8, 9, 10, 11, 12 | 69–218    |
| Natural Sciences and Technology    | 4, 5, 6                  | 92–98             |
| Natural Sciences                   | 7, 8, 9                  | 98–123            |
| Physical Sciences                  | 10, 11, 12               | 102–776           |
| Social Sciences                    | 4, 5, 6, 7, 8, 9         | 61–539            |
| Technology                         | 7                        | 93                |

---

### Spot On (20 books) — `Indexes (English Textbooks)/Spot On/`

| Subject                          | Grades Available | Entry Count Range |
|----------------------------------|------------------|-------------------|
| Creative Arts                    | 7, 8             | 208–221           |
| Economic and Management Sciences | 7, 8, 9          | 107–119           |
| English First Additional Language| 7, 8, 9          | 152–277           |
| Geography                        | 11               | 113               |
| History                          | 11, 12           | 109–130           |
| Life Orientation                 | 7, 8, 9          | 116–122           |
| Life Sciences                    | 12               | 111               |
| Life Skills                      | 4, 5, 6          | 173–176           |
| Technology                       | 8, 9             | 46–64             |

---

### Focus (15 books) — `Indexes (English Textbooks)/Focus/`

| Subject                         | Grades Available | Entry Count Range |
|---------------------------------|------------------|-------------------|
| Accounting                      | 10, 11, 12       | 65–93             |
| Computer Applications Technology| 10, 11, 12       | 125–153           |
| Economics                       | 10, 11, 12       | 119–186           |
| History                         | 10               | 523               |
| Life Orientation                | 10, 11, 12       | 90–95             |
| Life Sciences                   | 10, 11           | 252–696           |

---

### Afrikaans sonder grense (9 books) — `Indexes (English Textbooks)/Afrikaans sonder grense/`

| Subject                          | Grades Available          | Entry Count Range |
|----------------------------------|---------------------------|-------------------|
| Afrikaans Eerste Addisionele Taal| 4, 5, 6, 7, 8, 9, 10, 11, 12 | 285–378      |

---

### English in Context (2 books) — `Indexes (English Textbooks)/English in Context/`

| Subject               | Grades Available | Entry Count Range |
|-----------------------|------------------|-------------------|
| English Home Language | 11, 12           | 56–575            |

---

## 2. Spreadsheets

### `Spreadsheets/` folder

| File                                              | Purpose                                              |
|---------------------------------------------------|------------------------------------------------------|
| `Academy Topics vs Lesson Topics v2.xlsx`         | English mapping: Academy internal topics → lesson topics |
| `Akademie Onderwerpe vs Lesonderwerpe v2.xlsx`    | Afrikaans version of the same mapping                |
| `Topics by Grade (Tanya) - Matched (Updated).xlsx`| Grade-by-grade topic matching (contributor: Tanya)  |
| `Lesson Topics.xlsx`                              | Master list of lesson topics                         |
| `Mapped Topics.xlsx`                              | Final/reviewed mapped topics output                  |

### Root-level spreadsheets

| File                              | Purpose                                              |
|-----------------------------------|------------------------------------------------------|
| `Textbook Topic Mapping.xlsx`     | Original textbook-to-topic mapping                  |
| `Textbook Topic Mapping v2.xlsx`  | Revised/updated version                             |
| `LAP Content Report 2025 (01).xlsx` | LAP (Learning Achievement Platform?) content report |

---

## 3. Web Application — `Vecel App/textbook-mapping/`

### Stack

| Layer    | Technology                         |
|----------|------------------------------------|
| Frontend | React + TypeScript (Vite)          |
| Backend  | Express.js (Node.js)               |
| Database | PostgreSQL via Drizzle ORM         |
| Hosting  | Vercel                             |

### Database Schema (`src/db/schema.ts`)

```
subjects              — Subject names (e.g., Mathematics, Geography)
system_topics         — Academy's internal topic list (language, grade, subject, term, topic, submodule)
publishers            — Publisher names (Platinum, Focus, Spot On, etc.)
textbook_mappings     — Links system_topics → publisher with matched textbook topic name + notes
missing_textbook_topics — Textbook topics that exist in books but have no match in system
users                 — App users with email, password hash, name, role (admin/user)
```

### API Routes (`src/server/index.ts` → `src/server/routes/`)

| Route                | File               | Purpose                                      |
|----------------------|--------------------|----------------------------------------------|
| `/api/topics`        | `topics.ts`        | CRUD for system topics                       |
| `/api/mappings`      | `mappings.ts`      | CRUD for textbook mappings                   |
| `/api/publishers`    | `publishers.ts`    | List/manage publishers                       |
| `/api/stats`         | `stats.ts`         | Dashboard statistics                         |

### Frontend Pages (`src/client/pages/`)

| Page              | File                | Purpose                                         |
|-------------------|---------------------|-------------------------------------------------|
| Login             | `Login.tsx`         | Authentication                                  |
| Dashboard         | `Dashboard.tsx`     | Overview stats and summary                      |
| Browse Topics     | `BrowseTopics.tsx`  | Browse/filter system topics and their mappings  |
| Missing Topics    | `MissingTopics.tsx` | View textbook topics not yet in the system      |
| Admin Users       | `AdminUsers.tsx`    | User management (admin only)                    |

### Frontend Components (`src/client/components/`)

| Component      | Purpose                                      |
|----------------|----------------------------------------------|
| `FilterBar`    | Subject/grade/term filter controls           |
| `MappingPanel` | Side panel for editing/viewing a mapping     |
| `TopicTable`   | Table display for topics with mapped status  |

---

## 4. Reference Documents

| File                          | Purpose                                           |
|-------------------------------|---------------------------------------------------|
| `Midstream Textbook List.pdf` | Textbook list for Midstream campus/school         |
| `Textbooks - Westville.pdf`   | Textbook list for Westville campus/school         |

---

## 5. Visual Assets

| File                                      | Purpose                                       |
|-------------------------------------------|-----------------------------------------------|
| `Dashboard of Textbooks 01.png`           | Screenshot of mapping dashboard               |
| `Dashboard of Textbooks 02.png`           | Second dashboard screenshot                   |
| `Paywall Issues with Textbooks.png`       | Screenshot documenting paywall access issues  |
| `Paywall Issues with Textbooks (1).png`   | Additional paywall issue documentation        |

---

## 6. Subject Coverage — Cross-Publisher Matrix

| Subject                            | Platinum | Spot On | Focus | AfrikSG | EngCtx |
|------------------------------------|----------|---------|-------|---------|--------|
| Afrikaans Huistaal                 | ✓ 4–12   |         |       |         |        |
| Afrikaans Eerste Addisionele Taal  |          |         |       | ✓ 4–12  |        |
| English Home Language              | ✓ 5,6,10 |         |       |         | ✓ 11,12|
| English First Additional Language  | ✓ 4–6,10–12 | ✓ 7–9 |      |         |        |
| Mathematics                        | ✓ 4–12   |         |       |         |        |
| Mathematical Literacy              | ✓ 10–12  |         |       |         |        |
| Natural Sciences & Technology      | ✓ 4–6    |         |       |         |        |
| Natural Sciences                   | ✓ 7–9    |         |       |         |        |
| Physical Sciences                  | ✓ 10–12  |         |       |         |        |
| Life Sciences                      |          | ✓ 12    | ✓ 10–11 |       |        |
| Social Sciences                    | ✓ 4–9    |         |       |         |        |
| Geography                          | ✓ 10,12  | ✓ 11    |       |         |        |
| History                            |          | ✓ 11–12 | ✓ 10  |         |        |
| Business Studies                   | ✓ 10–12  |         |       |         |        |
| Economics                          |          |         | ✓ 10–12 |       |        |
| Accounting                         |          |         | ✓ 10–12 |       |        |
| Computer Applications Technology   |          |         | ✓ 10–12 |       |        |
| Economic & Management Sciences     |          | ✓ 7–9   |       |         |        |
| Life Orientation                   |          | ✓ 7–9   | ✓ 10–12 |       |        |
| Life Skills                        |          | ✓ 4–6   |       |         |        |
| Creative Arts                      | ✓ 9      | ✓ 7–8   |       |         |        |
| Technology                         | ✓ 7      | ✓ 8–9   |       |         |        |

---

## 7. Grade Coverage Summary

| Phase                     | Grades | Key Publishers              |
|---------------------------|--------|-----------------------------|
| Intermediate Phase        | 4–6    | Platinum, Spot On, AfrikSG  |
| Senior Phase              | 7–9    | Platinum, Spot On           |
| Further Education & Training (FET) | 10–12 | Platinum, Focus, Spot On, AfrikSG, EngCtx |

