# Plani teknik i MVP-së: AZ Zeiterfassung

> Aplikacion **vetëm për AZ Trockenbau & Innenausbau** (Ludwigsburg).
> Bën vetëm një gjë: **regjistrimin dhe llogaritjen e orëve të punës me START / PAUZË / STOP**.
> Duhet të plotësojë ligjet gjermane dhe të jetë gati për **App Store dhe Google Play**.

Dokumenti për pronarin (jo teknik): https://claude.ai/artifact/BKQkde3s2BkrVSL1t6CG3G

---

## 1. Parimet

1. **Një buton.** Punëtori nuk duhet të mësojë asgjë. Ekrani kryesor ka vetëm START / PAUZË / STOP.
2. **Ligjërisht i sigurt.** Orët regjistrohen në moment, nuk ndryshohen pa gjurmë dhe ruhen 2 vjet.
3. **Funksionon pa internet.** Kantieret shpesh nuk kanë sinjal.
4. **Aplikacion i vërtetë (native)** për Android dhe iPhone, që publikohet në dyqane pa rishkrim.
5. **Vetëm një kompani.** Nuk ka multi-tenant, regjistrim kompanish apo abonime.

---

## 2. Teknologjia

| Shtresa | Zgjedhja | Pse |
|---|---|---|
| Aplikacioni | **Expo (React Native) + TypeScript + Expo Router** | Një kod për Android, iPhone dhe web (ekrani i pronarit në kompjuter). Publikohet në dyqane me EAS. |
| Build dhe publikimi | **EAS Build / EAS Submit / EAS Update** | Build në cloud (nuk nevojitet Mac), dërgim direkt te Apple/Google, rregullime të vogla pa rishikim të ri. |
| Backend | **Supabase**, regjioni **Frankfurt (eu-central-1)** | Postgres, Auth, Edge Functions dhe pg_cron. Të dhënat në BE (DSGVO). |
| Offline | **expo-sqlite**, si radhë lokale e veprimeve | START/PAUZË/STOP ruhen menjëherë në telefon dhe sinkronizohen më vonë. |
| Lokacioni | **expo-location**, vetëm *foreground* dhe vetëm një lexim | Merret vetëm në momentin e START/STOP, nëse pronari e aktivizon. **Asnjëherë në background.** |
| Njoftimet | **expo-notifications** | Kujtesa për STOP të harruar. |
| Gjuhët | **i18next** (`sq`, `de`) | Gjuha zgjidhet për çdo punëtor. |
| Validimi | **Zod** | |
| Raportet | **Edge Function**: PDF (pdf-lib) + Excel (SheetJS) | Raporti mujor gjenerohet në server, i njëjtë kudo. |
| Testet | **Vitest** për logjikën e orëve, **Maestro** për rrjedhat në app | Llogaritja e orëve dhe pagave duhet të ketë teste. |
| Gabimet | **Sentry** (regjioni EU) | Opsional, por i dobishëm gjatë pilotit. |

### Ora (shumë e rëndësishme për ligjin)
- Çdo veprim ruan **dy kohë**: `device_time` (ora e telefonit në momentin e shtypjes) dhe `received_at` (ora e serverit kur arrin).
- Nëse veprimi arrin online dhe dallimi është më shumë se 5 min, ose ora e telefonit duket e manipuluar, hyrja **shënohet për kontroll** te pronari.
- Të gjitha llogaritjet bëhen në zonën kohore `Europe/Berlin` (orari veror/dimëror).

### Kyçja
- **Punëtori:** numri personal + **PIN me 6 shifra**. Brenda sistemit lidhet me një përdorues Supabase me email sintetik (`p-<id>@az.internal`). Sesioni mbetet aktiv me muaj, që punëtori të mos kyçet çdo ditë. Pas 5 PIN-eve të gabuara llogaria bllokohet përkohësisht.
- **Pronari/zyra:** email + fjalëkalim.
- Llogaritë i krijon **vetëm pronari**. Nuk ka regjistrim publik.

---

## 3. Databaza

```
employees ── employee_rates
    │
    ├── shifts ── breaks
    │      └── (audit_log përmes trigger-it)
sites (opsionale)
month_closings
settings (një rresht)
```

**employees**
| kolona | tipi | shënim |
|---|---|---|
| id | uuid PK | |
| user_id | uuid → auth.users | |
| personnel_no | text unique | përdoret te kyçja |
| first_name, last_name | text | |
| role | enum `worker`, `admin` | |
| weekly_hours | numeric | p.sh. 40 |
| locale | text | `sq` / `de` |
| entry_date, exit_date | date | |
| active | bool | |

**employee_rates**: `employee_id`, `valid_from`, `hourly_rate_cents`. Ruhet historia, që muajt e kaluar të mos ndryshojnë.

**sites** (përdoret vetëm nëse `settings.require_site = true`): `id`, `name`, `address`, `active`.

**shifts** (një ditë/turn pune)
| kolona | tipi | shënim |
|---|---|---|
| id | uuid PK | |
| client_id | uuid unique | gjenerohet në telefon; sinkronizimi nuk krijon dublikata |
| employee_id, site_id | uuid | |
| started_at, ended_at | timestamptz | `ended_at` null = turn i hapur |
| device_started_at, device_ended_at | timestamptz | ora e telefonit |
| received_at | timestamptz | ora e serverit |
| start_lat, start_lng, start_accuracy_m | numeric | null nëse lokacioni është i çaktivizuar |
| end_lat, end_lng, end_accuracy_m | numeric | |
| source | enum `app`, `admin` | `admin` = e shtuar nga pronari |
| flagged | bool + `flag_reason` | për kontroll (ora, STOP i harruar, ArbZG) |
| month_closed | bool | pas mbylljes së muajit nuk ndryshon më |

**breaks**: `id`, `shift_id`, `client_id`, `started_at`, `ended_at`, `kind` (`button` = me PAUZË, `declared` = deklaruar te STOP).

**audit_log** (append-only, nuk fshihet): `table_name`, `row_id`, `action`, `old` jsonb, `new` jsonb, `changed_by`, `changed_at`, `reason`. Mbushet me **trigger** për `shifts`, `breaks`, `employee_rates`.

**month_closings**: `year`, `month`, `closed_by`, `closed_at`, `snapshot` jsonb (totalet e ngrira), `pdf_path`, `xlsx_path`.

**settings** (një rresht): `require_site`, `capture_location`, `break_mode` (`button` / `ask_at_stop` / `fixed`), `overtime_daily_after_h`, `overtime_weekly_after_h`, `overtime_surcharge_pct`, `min_wage_cents` sipas vitit (jsonb), `reminder_after_h`, `retention_years` (min. 2).

### Siguria (RLS)
- `worker`: lexon vetëm `shifts`/`breaks` e veta. Shton vetëm për veten. **Nuk mund të ndryshojë** një turn të mbyllur.
- `admin`: lexon gjithçka. Korrigjimet bëhen vetëm përmes funksionit `correct_shift(id, changes, reason)`, ku arsyeja është e detyrueshme dhe nuk lejohet në muaj të mbyllur.
- Askush nuk mund të fshijë nga `audit_log`.
- `pg_cron` fshin të dhënat pas afatit të ruajtjes. Afati konfirmohet me Steuerberater-in, por nuk është kurrë më pak se 2 vjet.

---

## 4. Logjika e orëve (`/packages/core`, kod i përbashkët app + server)

`calculateDay(shift, breaks, settings)` → `{ worked_min, break_min, warnings[] }`
`calculateMonth(employee, days, rates, settings)` → `{ total_h, regular_h, overtime_h, gross_cents, warnings[] }`

1. Koha e punës = (STOP − START) − pauzat.
2. **Pauza te STOP** (`break_mode = ask_at_stop`): nëse puna është mbi 6 orë dhe pauzat nën 30 min (ose mbi 9 orë dhe nën 45 min), aplikacioni pyet: *„Sa pauzë bëre sot?”* me butonat **30 min / 45 min / Tjetër**. Pauza ruhet si `declared`.
3. Orët shtesë sipas `settings` (ditore ose javore).
4. **Paga bruto** = orët × tarifa e vlefshme në atë datë + shtesa për orët shtesë.
5. **Paga minimale:** nëse tarifa efektive bie nën `min_wage_cents` të vitit, del paralajmërim.

### Paralajmërimet (shfaqen te pronari)
| Kontrolli | Rregulli |
|---|---|
| Mbi 10 orë në ditë | ArbZG §3 |
| Pauzë e pamjaftueshme | ArbZG §4 (30/45 min) |
| Më pak se 11 orë pushim mes turneve | ArbZG §5 |
| Punë në të diel ose festë (BW) | ArbZG §9 |
| STOP i harruar (turn i hapur më shumë se `reminder_after_h`) | Kujtesë për punëtorin; pas 13 orësh, njoftim për pronarin |
| Ora e telefonit dallon nga serveri | Kontroll kundër manipulimit |

---

## 5. Ekranet

### Punëtori (5 ekrane)
1. **Kyçja**: numri personal + PIN.
2. **Ballina**:
   - një buton i madh: **START** (i gjelbër) / **STOP** (i kuq);
   - butoni **PAUZË / VAZHDO**;
   - kohëmatësi i ditës, kantieri (nëse kërkohet) dhe treguesi offline;
   - pas STOP, përmbledhja: *„Sot: 8:15 orë, pauzë 30 min”*.
3. **Zgjedhja e kantierit** (vetëm nëse `require_site`): kantieri i djeshëm del sipër dhe zgjidhet me një prekje.
4. **Orët e mia**: java dhe muaji, ditë për ditë, me totalet. Punëtori ka të drejtë t'i shohë të dhënat e veta (DSGVO Art. 15).
5. **Profili**: gjuha, politika e privatësisë, **kërkesa për fshirjen e llogarisë**, dalja.

### Pronari / zyra (në app dhe në web)
6. **Sot**: kush është në punë tani, në cilin kantier, që nga ora sa; kush ka STOP të harruar.
7. **Orët**: lista sipas punëtorit dhe muajit, me paralajmërimet. Klik mbi një ditë hap **korrigjimin me arsye**, plus historinë e ndryshimeve.
8. **Punëtorët**: shto, ndrysho tarifën (me datën nga kur vlen), rivendos PIN-in, çaktivizo.
9. **Kantieret** (opsional): shto ose mbyll.
10. **Raporti mujor**: tabela me orët, orët shtesë dhe pagën bruto për çdo punëtor. Butoni **Mbyll muajin** krijon PDF + Excel.
11. **Cilësimet**: rregullat e pauzave dhe orëve shtesë, lokacioni po/jo, kantieri po/jo, paga minimale.

---

## 6. Kërkesat për App Store dhe Google Play

- [ ] Llogaritë e zhvilluesit **në emrin e AZ** (organizatë): Apple 99 USD në vit, Google 25 USD një herë. Duhet **numri D-U-N-S**.
- [ ] **Politika e privatësisë** në një URL publike (`az-innenausbau.de/datenschutz-app`), në gjermanisht.
- [ ] **Apple App Privacy** dhe **Google Data safety**: emri, ID e punonjësit, kohët e punës, lokacioni i saktë (opsional, vetëm për funksionin e aplikacionit), pa reklama dhe pa tracking.
- [ ] Lokacioni: vetëm **„When In Use”**, me shpjegim në `Info.plist` (DE/SQ). **Pa background location**, sepse Google kërkon deklaratë speciale dhe Apple e kontrollon rreptë.
- [ ] **Fshirja e llogarisë**: butoni në app + faqe web për kërkesën (Google e kërkon URL-në).
- [ ] **Llogari demo** për rishikuesit e Apple/Google, me të dhëna testuese.
- [ ] Apple: **Unlisted App Distribution**, sepse aplikacioni është vetëm për punonjësit e AZ.
- [ ] `ITSAppUsesNonExemptEncryption = false` (vetëm HTTPS standard).
- [ ] Ikona, screenshots, përshkrimi DE, age rating.
- [ ] Google: target API level i fundit (Expo e mban automatikisht me SDK-në e re).
- [ ] Testimi: **TestFlight** (iPhone) dhe **Internal testing** (Android).

## 7. Dokumentet ligjore që përgatiten bashkë me app-in
- [ ] **Datenschutzhinweis për punonjësit** (DSGVO Art. 13): çfarë ruhet, pse, sa gjatë.
- [ ] **Verzeichnis von Verarbeitungstätigkeiten** (regjistri i përpunimit).
- [ ] **AVV/DPA** me Supabase (dhe Sentry, nëse përdoret).
- [ ] Nëse ka **Betriebsrat**: marrëveshje (Betriebsvereinbarung, §87 BetrVG).
- [ ] Udhëzim i shkurtër për punëtorët (1 faqe, SQ/DE).

---

## 8. Struktura e projektit

```
/mobile                ← Expo (Android, iOS, web)
  /app/(auth)/login
  /app/(worker)/index, my-hours, profile, site-picker
  /app/(admin)/today, hours, employees, sites, report, settings
  /src/offline          ← radha në SQLite + sinkronizimi
  /src/i18n/sq.json, de.json
/mobile/src/core      ← calculateDay, calculateMonth, kontrollet ArbZG + teste
/supabase
  /migrations/*.sql     ← tabelat, RLS, trigger-at e audit
  /functions/report     ← PDF + Excel
  /functions/reminders  ← STOP i harruar
```

---

## 9. Fazat

| Faza | Përmbajtja |
|---|---|
| 0. Përgatitja | D-U-N-S, llogaritë Apple/Google, projekti Supabase në Frankfurt, repo, Expo/EAS |
| 1. Backend | Tabelat, RLS, audit, kyçja me PIN, logjika e orëve + teste |
| 2. App i punëtorit | START/PAUZË/STOP, offline, orët e mia, SQ/DE |
| 3. Ekrani i pronarit | Sot, orët, korrigjimet, punëtorët, raporti mujor |
| 4. Pilot | 2–3 punëtorë krahas letrës, krahasimi i orëve, rregullimet |
| 5. Gjithë ekipi + dyqanet | Politika e privatësisë, App Store (unlisted) + Google Play |

---

## 10. Vendime që presin pronarin
- Paga: me orë apo rrogë mujore? A duhet paga bruto në raport, apo vetëm orët?
- Orët shtesë: nga kur dhe me çfarë shtese?
- Pauza: me buton, pyetje te STOP, apo fikse?
- Kantieri te START: po/jo. Lokacioni te START/STOP: po/jo.
- Kush e sheh ekranin e pronarit?
- Formati për Steuerberater-in: klienti përdor DATEV, por **lidhja me DATEV nuk bëhet tani**. Programi mbetet i brendshëm; Steuerberater-i merr PDF + Excel. DATEV shtohet më vonë (duhen Berater-Nr, Mandanten-Nr, LODAS/Lohn und Gehalt, numrat e Lohnart).
- A ka Betriebsrat?
