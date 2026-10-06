# Strata — План «Лучший HR-продукт в мире»

**Дата:** 4 октября 2026 · **База:** `main` `33382de7` — все 11 CI-гейтов `success` (`Lint`/`Type Check`/`Unit Tests`/`Build`/`E2E`/`Security Audit`/`CodeQL`/`Deploy Production`) · **Аудит-база:** `docs/market-readiness-audit-2026-09-30.md` + финализация `33382de7`

> **Цель:** из «крепкого локального HRIS для AM 50–300» → в **мировой Top-3 для distributed-команд 50–1000 с операциями в Армении**. Не «добавить фич», а закрыть доверие (Security/Data), затем выиграть скоростью и UX.

---

## 0. Принципы — как мы строим, чтобы CI никогда не падал

Взяты из `AGENTS.md` + `lean-build` — обязательны для каждой задачи, иначе PR не мерджится.

1.  **Один узкий вертикальный слайс за пуш** — не «переписать модуль», а `schema → convex → UI → test` по одному шву. Пример: `quizAttempts.expiresAt` был `schema + convex + LearningClient + market-readiness-audit 1/35` — один `git push origin main`.
2.  **CI-превентивный бандл ДО пуша (локально):**
    ```bash
    npx tsc --noEmit -p tsconfig.verify.json
    npx prettier --check "**/*.{ts,tsx,js,jsx,json,css,md}" --ignore-path .prettierignore
    node scripts/audit-gate.mjs
    npm run check:locales
    npx jest <затронутые suites> --no-coverage
    ```
    Только `EXIT:0` → `git add` → `git commit --no-verify -m "feat/fix(scope): ..."` → `git push origin main` (bypass правила ветки — intentional).
3.  **No silent truncation:** любой `take(N)` → `take(N+1)` + `slice(N)` + `isCapped = len > N` (`void isCapped` если breaking). Paginated — `native paginate` курсором.
4.  **Tenant-bound:** любой `organizationId` из args → `resolveOrgScope`/`resolveOrgStaff` из `convex/lib/orgAccess.ts`, не `isSuperadminEmail(email)`. Query → `[]` degrade, Mutation → `throw Access denied`.
5.  **Backward-compat:** `v.optional` в `schema/*`, старые записи без поля — не требуют миграции.

---

## 1. Где мы сейчас — честный срез (что уже зелено)

| Домен                | Было в сентябре                                                                                        | Стало `33382de7`                                                                                                                                                                                    | CI-доказательство                                |
| -------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **DATA-01**          | `shifts.getRoster` брал 2000 и резал `filter(date)` — новая смена терялась                             | ~120+ `take(N+1)` idle (`recruitment` 29 + `sla`/`integrations`/`signatures` `take(N+1)`), `enrollmentDetails` `paginate` `by_status`, `courseCatalog` `by_org_published` + `lessonCountIsCapped`   | `37/37` `market-readiness-audit`, `audit-gate 0` |
| **courseCompletion** | `N` последовательных `by_lesson` + `quizAttempts first()` → 500 запросов, лимит Convex 64              | `Promise.all lessons/progress/quizzes` + `CHUNK=50` batched `by_lesson` + `Promise.all quizAttempts` + `COMPLETION_READ_BUDGET=DEFAULT_LIST_CAP`                                                    | `97e66a1a` `Deploy success`                      |
| **Quiz**             | positional `userAnswer`, `maxAttempts` застревал на 500, `submit` до `Exhausted`                       | `startQuizAttempt` authoritative `startedAt`/`expiresAt=startedAt+timeLimit*60000` `already in progress` `maxAttempts`, `submit deadline` `Quiz not started`/`Time limit exceeded`                  | `b16975d0`→`68ee9676` `LearningClient 47/47`     |
| **Version/Revoke**   | нет версионирования, `historical` не отзыв                                                             | `courses.contentVersion?` `certificates contentVersion?/isOutdated?` + bump `updateCourse/lesson/quiz`, `certificates isRevoked?/revokedAt?/revokedBy?` `revokeCertificate` admin-only idempotent   | `f41b6aa6` `Deploy success`                      |
| **Renewals**         | `enrollments.expiresAt` игнор в `hasCertificate`                                                       | `renewEnrollment expired→in_progress` `cert isOutdated:true`, `sweepExpiredEnrollments cap 50 isCapped`, `issueCertificate` `enrollment.expiresAt` propagation, `MyCourses Sweep expired` + `Renew` | `f224f2dc`→`cd307dfc` `36→37/37`                 |
| **ACL реестр**       | `leaveAccrual getLeavePolicies` anon, `leaves/queries.getAllLeaves` `if(orgId&&!requesterId)take` leak | `resolveOrgScope throw` + `resolveOrgStaff []` scoped, ветвь удалена → `[]`, `documents` 12 handlers `checkAccess→lib/orgAccess` (`scope.organizationId!`)                                          | `b23b7628`                                       |
| **Scrollbar**        | `100vw` сдвиг `mx-auto` без скроллбара                                                                 | `src/app/globals.css:315,326,681` `scrollbar-gutter: stable` `585px`                                                                                                                                | `w-screen` в `src` — 0                           |
| **Инфра**            | `redis.ts` sliding→fixed, `proxy.ts` `PROTECTED` неполный, `sw.js` кэш `authorization`                 | `fixed-window`+warning, `PROTECTED` +6, `sw.js` private no-cache                                                                                                                                    | `audit-gate 0`, `locales 23 OK`                  |

**Итог:** Кодовые P0/P1 — технически `complete, pending external`. `Deploy Production success` на всех CODE-Gates. `DATA-01` idle, публичный ACL пилотного scope покрыт.

---

## 2. Что мешает стать №1 — 7 групп недостатков

### A. Доверие (Legal/Security) — БЛОКЕР для реальных PII

| Недостаток                                                                | Риск                       | Кто закрывает                       |
| ------------------------------------------------------------------------- | -------------------------- | ----------------------------------- |
| Нет `DPA`/`vendor register`/`privacy/data map`/`Biometrics DPIA`/`AI Act` | Штраф GDPR, иск сотрудника | Внешний юрист AM/EU                 |
| `competitors.ts` source log без `edition/date/source` per claim           | `misleading compare` → иск | Продукт + демо вендоров             |
| `SOC2` `no` → `partial` был `misleading`                                  | `enterprise` не купит      | Аудитор, после `OPS-01`             |
| `isSuperadminEmail` legacy вне pilot scope — полный реестр ~350 fns       | скрытый IDOR               | Инженер (уже 60→120, осталось ~230) |

### B. Инфраструктура — БЛОКЕР для пилота

| Недостаток                                                                                        | Риск                                  | Фикс                                                    |
| ------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------- |
| `UPSTASH_REDIS_URL` отсутствует в prod → rate-limiter падает на in-memory, офис под NAT блокирует | Пилот встанет в первый день           | `env` pin + `isBlocked` pre-check уже, нужен prod Redis |
| `SENTRY_DSN` отсутствует → нет `critical alerts`                                                  | Инцидент без алерта                   | `Sentry` pin + `COVERAGE Badge` уже                     |
| `multiple lockfiles` + `custom Cache-Control _next/static`                                        | `npm ci` дрифт, `immutableChunks` лом | Удалить верхний lockfile, `next.config.js headers()`    |
| `@vladmandic/face-api` >500KB babel                                                               | Client bundle жирный, `CLS`           | `next/dynamic ssr:false` lazy + `FaceId` isolate        |

### C. Производительность — не доказано

| Недостаток                                                  | Риск                                                      |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| Нет нагрузочного `100/300/1000` + `3 года roster/analytics` | `enterprise 300+` — `низкий` в матрице, `COGS` неизвестен |
| Нет `per-tenant COGS` метрики                               | Невозможно ценообразование                                |
| `apiV1` `incremental sync` `API-01` not proven              | `300+` sync дубли/пропуски                                |

### D. Продуктовая глубина

| Недостаток                                                  | Кому больно                                   |
| ----------------------------------------------------------- | --------------------------------------------- |
| Нет `native mobile push/camera/offline/MDM` (`MOBILE-01`)   | `Logycore` ops, `Hirebee` PWA бьет            |
| Нет `calibration/SCORM/xAPI/advanced workflow` (`DEPTH-01`) | LMS-тендеры `Docebo`                          |
| `SRC/bank` acceptance не подписан                           | `Armenian Software` бьет доверием бухгалтеров |

### E. UX/Onboarding

| Недостаток                                                | Фикс                                           |
| --------------------------------------------------------- | ---------------------------------------------- |
| `MyCourses` до `f224f2dc` — нет `Renew`/`Sweep` видимости | Уже `cd307dfc` `Sweep expired` + `Renew` admin |
| `CertificatesTab` до `f41b6aa6` — нет `Revoked/Outdated`  | Уже `4a46c084` badge                           |
| 5 buyer journeys не прогнаны end-to-end с HR              | `UX-01` пилоты                                 |

### F. GTM/Прайсинг

| Недостаток                                                          | Фикс                                                                        |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `PRICE-01/02` `volume cliff` уже `monthlyTotal` монотонен           | Осталось сверить `checkout/webhook/seat enforcement` `49/50,99/100,249/250` |
| `GTM-01` `unknown=no` → `partial` уже `COMPARE_VERIFIED 2026-09-30` | Нужны `edition/date/source` per claim + vendor demos                        |

### G. Кодовый долг (мелкий, но накапливается)

`candidatePortal ctx.auth?.getUserIdentity typeof` already fixed `851c0073`, `tsconfig.verify` `.next` exclude — done. Осталось: `outputFileTracingExcludes` для `ai-site-editor`, `billing` 9 literals уже `requireSuperadmin` — done.

---

## 3. Дорожная карта — 4 фазы, 90 дней + 6 месяцев до мирового уровня

### Фаза 0 — Безопасность и корректность (Дни 1–14) — НЕ новые модули

**Цель:** Пилот с реальными данными без `NO-GO`.

| #   | Задача                                                    | DoD                                                                                | Усилие           | Владелец  |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------- | --------- |
| 0.1 | `DPA` draft + `privacy/data map` для `AM` пилота 50–300   | Подписан `DPA`, `data map` с retention/deletion, `region=AM`                       | 3 дня + юрист    | Legal     |
| 0.2 | `Biometrics DPIA` или `biometrics disabled` toggle        | `faceIdBlocked` flow документирован, `loginWithFace` `blocked` тест 6 попыток пасс | 2 дня            | Eng+Legal |
| 0.3 | `UPSTASH_REDIS` + `Sentry DSN` в prod + `CLEAR_PAGES` уже | `redis.ts` `isBlocked` pre-check, `sw.js` private no-cache, алерт доставлен        | 1 день           | Infra     |
| 0.4 | Backup restore drill на staging                           | `measured RTO/RPO` artifact, `rollback` работает                                   | 1 неделя + infra | Infra     |
| 0.5 | `competitors.ts` `edition/date/source` per claim          | Нет `unknown=no`, `COMPARE_VERIFIED` обновлен                                      | 2 дня + demos    | Product   |

**Выход Gate B:** `2-tenant negative matrix` `37/37` уже, `DPA` подписан, `staging restore` доказан.

### Фаза 1 — Доказать масштаб (Дни 15–35)

| #   | Задача                                                                                                 | DoD                                                     |
| --- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| 1.1 | Нагрузочный профиль `100/300/1000` + `3 года` `getRoster` `by_org_date gte/lte` + `analytics` `by_org` | `100` roster без дублей/пропусков, `300` <2с P95        |
| 1.2 | `per-tenant COGS` метрика (`Convex` read/write + `Vercel` bandwidth)                                   | `COGS` per `50/300` известен, ценообразование проверено |
| 1.3 | `API-01` cursor/incremental `apiV1` `changed/deleted`                                                  | `>300` sync без дублей, documented `isCapped` limits    |
| 1.4 | `multiple lockfiles` + `Cache-Control` фикс                                                            | `npm ci` детерминирован, `next build` без warning       |
| 1.5 | `face-api` lazy `next/dynamic`                                                                         | Bundle <250KB reduction, `CLS` <0.1                     |

### Фаза 2 — Выиграть AM 50–300 (Дни 36–65)

| #   | Задача                                             | DoD                                                                             |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| 2.1 | `10–15 интервью` `AM HR/бухгалтер/IT 50–300`       | `current stack` + `buyer job` per interview                                     |
| 2.2 | `SRC/bank` acceptance с армянским бухгалтером      | Подписанные эталонные `расчеты/экспорт`, `version/date` закона                  |
| 2.3 | `3–5 платных пилотов` одинаковый core scope        | Измеренный `TTV/ROI`, 2 `customer references`                                   |
| 2.4 | `MOBILE-01` discovery (не писать app ради галочки) | `push/camera/offline/MDM` проверен для `AM` клиента — решение `PWA` vs `native` |

### Фаза 3 — Стать мировым для distributed-команд (Месяцы 4–9)

| #   | Задача                                                         | DoD                                                           |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| 3.1 | `Region/residency` solution (`Convex` region pin + `data map`) | `AM` данные не покидают `region`, `DPA` per tenant            |
| 3.2 | `IdP/deprovisioning` (`SSO` + `SCIM` light + `access reviews`) | `JIT` + `deprovision` <5 мин                                  |
| 3.3 | `LMS` глубина только по платящим `SCORM/xAPI`                  | Не добавлять десятки модулей заранее — `DEPTH-01` по интервью |
| 3.4 | Независимый **pentest** + `report/cert` если требует buyer     | `report` без `P0`, `remediation` <30 дней                     |
| 3.5 | `SOC2` readiness (после `OPS-01` `backup` + `alerts` + `COGS`) | `readiness` без `no→partial` misleading                       |

**Позиционирование мирового №1:** `HR operations layer for teams with an Armenian entity` — единственная ниша, где Strata уже `наиболее высокий` потенциал. Не обещать `on-prem` без архитектуры.

---

## 4. Детальный бэклог — один слайс за пуш (lean)

Каждая строка — один `git push origin main` с CI-бандлом. Порядок — по `RICE` (Reach × Impact × Confidence / Effort).

| Приоритет | ID            | Слайс (один шов)                                                | Файлы шва                                        | Тест-шлюз                                     | Effort        |
| --------- | ------------- | --------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------- | ------------- |
| **P0**    | `OPS-01`      | `UPSTASH_REDIS` prod pin + `Sentry` + `backup restore` artifact | `src/lib/redis.ts` `src/proxy.ts` `public/sw.js` | `proxy-middleware 36/36` + manual `isBlocked` | 3д            |
| **P0**    | `LOCK-01`     | `multiple lockfiles` удаление + `Cache-Control` fix             | `package-lock.json` `next.config.js`             | `next build` `guardrails passed`              | 0.5д          |
| **P0**    | `FACE-01`     | `face-api` `next/dynamic ssr:false` lazy                        | `src/components/auth/*`                          | `bundle` <250KB                               | 1д            |
| **P1**    | `LOAD-01`     | `100/300/1000` нагрузочный + `COGS`                             | `convex/shifts.ts` `convex/analytics.ts`         | `P95 <2с` `isCapped`                          | 5д            |
| **P1**    | `API-01`      | `apiV1` incremental `changed/deleted`                           | `convex/http.ts` `apiV1`                         | `>300` without dup                            | 4д            |
| **P1**    | `PAY-VAL`     | `SRC/bank` `taxRules` `armenia` validation с бухгалтером        | `convex/lib/taxRules.ts`                         | подписанный export                            | 3д+юрист      |
| **P1**    | `PRICE-CHK`   | `checkout/webhook/seat` `49/50` `99/100` `249/250`              | `src/lib/pricing.ts` `subscriptions`             | `e2e` seat                                    | 2д            |
| **P2**    | `MOBILE-DISC` | `push/camera/offline` discovery                                 | —                                                | решение `PWA/native`                          | 1д            |
| **P2**    | `CALIB-01`    | `calibration` только если платящий требует                      | по интервью                                      | —                                             | по требованию |

**Non-CODE** (параллельно, не блокирует `Build`): `DPA` `Biometrics DPIA` `competitors` source log `vendor register` — владелец `Legal/Product`.

---

## 5. Метрики — как понять, что мы №1

| Метрика                          | Сейчас             | Цель 90 дней                                                                | Цель 12 мес  |
| -------------------------------- | ------------------ | --------------------------------------------------------------------------- | ------------ |
| `CI` `Deploy Production success` | `33382de7` `11/11` | 100% `green` (сейчас уже)                                                   | 100%         |
| `market-readiness-audit`         | `37/37`            | `37/37` + `E2E learning-evidence` `start→submit→certificate→revoke` browser | `load` `P95` |
| `P95` `getRoster` 300            | неизвестно         | <2с                                                                         | <1с          |
| `COGS` per tenant 50/300         | неизвестно         | известен                                                                    | <30% `MRR`   |
| Пилоты `AM 50–300`               | 0                  | 3–5 платных, 2 references                                                   | 15           |
| `NPS` пилотов                    | —                  | >50                                                                         | >70          |
| `Churn` пилотов                  | —                  | <5%                                                                         | <3%          |
| `pentest` `P0`                   | —                  | 0 `P0` после fix                                                            | `SOC2` ready |

---

## 6. Риски и антидоты

| Риск                                    | Антидот                                                            |
| --------------------------------------- | ------------------------------------------------------------------ |
| `legal` тянет `DPA` месяцы              | `biometrics disabled` toggle — пилот без биометрии сразу           |
| `Convex` `N+1` на `1000` истории        | Уже `CHUNK=50` + `COMPLETION_READ_BUDGET`, но `LOAD-01` обязателен |
| `Hirebee` `PWA` бьет `mobile`           | Не писать app — `MOBILE-DISC` решает `PWA` достаточно              |
| `Armenian Software` доверие бухгалтеров | `PAY-VAL` с конкретным бухгалтером `AM` — не generic claim         |
| `AI` хочет добавить 10 модулей          | `DEPTH-01` — только требования платящих `AM 50–300`                |

---

## 7. Чеклист первых 7 дней (что делать завтра утром)

- [ ] День 1: `UPSTASH_REDIS` + `Sentry` в prod, `git push` `LOCK-01`, `face-api` lazy — `CI 11/11` остается.
- [ ] День 2–3: `DPA` draft юристу + `Biometrics DPIA` решение (disable vs DPIA).
- [ ] День 3–5: `backup restore` drill на staging — `RTO/RPO` artifact.
- [ ] День 5–7: `competitors.ts` `edition/date/source` + `pricing` `49/50` e2e, `10 интервью` старт.
- [ ] Неделя 2: `LOAD-01` `100/300/1000` + `COGS`, `API-01` incremental.

**Готовая команда для старта:**

```bash
npx tsc --noEmit -p tsconfig.verify.json && \
npx prettier --check "**/*.{ts,tsx,js,jsx,json,css,md}" --ignore-path .prettierignore && \
node scripts/audit-gate.mjs && npm run check:locales && \
npx jest src/__tests__/market-readiness-audit.test.ts --no-coverage
# только EXIT:0 → git push origin main
```

---

## 8. Почему этот план сделает Strata №1 именно в своей нише

Мы не пытаемся победить `Workday/SAP` в `global 300+` (там продают масштаб/control/SLA, не экраны). Мы делаем **единственный мировой HRIS, который честно и быстро закрывает `AM 50-300` + `distributed`**: язык `hy/ru/de` `23 NS`, `time/shifts/leaves/docs` с локальными `by_org_date` индексами, `payroll AM` с `approximate:true` честно, `2-tenant negative` тесты + `isCapped` — это редкость даже у глобальных. После `Gate B-D+F+revoke` мы уже `Deploy` `success`, осталось доказать `DPA`/`restore`/`load` — тогда 3–5 пилотов дадут `references` и `COGS`, и ни один локальный (`Hirebee`/`ListWork`/`Resalt`) не сможет повторить `realtime Convex` + `AM depth` без тех же 4 фаз.

**Следующий шаг:** запустить `OPS-01` (`UPSTASH_REDIS` + `Sentry` + `backup drill`) — один `git push` = один шов + CI-бандл. План выше — инструкция и для тебя, и для любой ИИ-модели: бери одну строку из таблицы §4, делай `schema→convex→UI→test`, проверяй 5 команд, пушь.
