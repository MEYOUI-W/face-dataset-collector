# Face Dataset Registration Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a localhost-first Next.js full-stack web application for authenticated users to capture a diverse face recognition training dataset (12 white-background pose/expression steps + 3 pastel screen-light reflection steps) with real-time MediaPipe quality gating, server-side ONNX Runtime (`SCRFD`) 5-point `112×112` alignment, SQLite metadata storage, self-service photo management, and admin ZIP export.

**Architecture:** Browser clients run `@mediapipe/tasks-vision` (Face Landmarker) to compute 3D head pose, blendshapes, eye-blink checks, Face-ROI brightness, and Laplacian blur in real time against a `#FFFFFF` background (switching to 3 pastel colors for Phase B). Approved frames upload to Next.js App Router API routes backed by `node:sqlite`, `onnxruntime-node` (for server SCRFD 5-point verification and post-training ArcFace/GhostFaceNets/MobileFaceNet embedding extraction), `sharp` (similarity-transform `112×112` crops), and local `dataset_storage/`.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS, Node.js 24 (`node:sqlite`, `node:crypto`), `@mediapipe/tasks-vision`, `onnxruntime-node`, `sharp`, `archiver`, `vitest`

**Spec:** `docs/superpowers/specs/2026-11-12-face-dataset-registration-design.md`

## Global Constraints

- Runs locally on Windows workstation (`http://localhost:3000`); keep all URLs, cookies, and storage paths relative so adding HTTPS later requires no code changes.
- Store large image files on disk under `dataset_storage/raw/<user_id>/` and `dataset_storage/aligned_112x112/<user_id>/`, never as binary blobs in SQLite.
- Serve MediaPipe WASM/task assets locally from `public/mediapipe/` and ONNX models locally from `models/` (zero runtime CDN dependency).
- Keep background `#FFFFFF` across all 12 Phase A steps, then `#B8E2FF`, `#FFE0B2`, `#FFD1E6` for Phase B colored screen-light reflection steps.
- Require login (`INVITE_CODE` gated signup) and explicit persisted consent (`users.consent_accepted_at`) before camera capture or upload.
- Enforce `faceWidth >= 160` px (warn `< 224` px), `eyeBlinkLeft < 0.4 && eyeBlinkRight < 0.4`, Face-ROI mean luminance `65 <= meanY <= 215`, overexposed clipping (`Y >= 250`) `< 15%`, Laplacian variance above threshold, and 500ms stability hold with a 10-second `manual_fallback` escape hatch.

## Review Focus

- **Path traversal or malformed IDs in disk storage & file routes:** Passing `../` or invalid characters in `userId`, `sessionId`, `poseType`, or `/api/files/[...path]` must throw/return `400` or `403` and never access files outside `dataset_storage/`. (Tested in Task 2 & Task 7)
- **Corrupted, non-image, or zero/multi-face uploads reaching server alignment:** Uploading invalid bytes or a frame where server SCRFD finds `0` or `>1` faces must return `422` without writing orphan disk files or SQLite rows. (Tested in Task 6)
- **Consent bypass and cross-user / non-admin authorization:** Uploading or creating a session while `consent_accepted_at` is `NULL`, viewing/deleting another user's `face_images`, or hitting `/api/admin/*` as role `'user'` must return `403`. (Tested in Task 6 & Task 7)
- **480p webcam, backlit frame, and 10-second timeout edge cases:** A `170px` wide face passes with a `"move_closer"` nudge, a frame with bright `255` background but dark `meanY = 40` Face ROI fails brightness, and waiting `>= 10000ms` unlocks `manual_fallback` (plus `skip` for optional steps). (Tested in Task 5)
- **Cascade deletion & approved-only ZIP export:** Deleting a photo or user account removes both `raw/` and `aligned_112x112/` disk files and SQLite rows cleanly; `/api/admin/export` excludes `is_approved = 0` rows and skips missing disk files gracefully without crashing. (Tested in Task 7)

---

## File Structure

- `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `.env.local` — Next.js + Vitest setup and native server externals (`onnxruntime-node`, `sharp`, `node:sqlite`)
- `scripts/download-models.mjs` — Downloads local `face_landmarker.task` + WASM files to `public/mediapipe/` and SCRFD `.onnx` to `models/`
- `scripts/seed-admin.mjs` — CLI helper to create/promote an admin account in `data/app.db`
- `src/lib/db/schema.ts` — `getDb()`, `initSchema(db)` defining `users`, `capture_sessions`, `face_images`, `face_embeddings`
- `src/lib/storage/paths.ts` — `resolveSafeStoragePath()`, `buildImageRelativePath()`
- `src/lib/auth/password.ts` — `hashPassword()`, `verifyPassword()`
- `src/lib/auth/session.ts` — `signSessionToken()`, `verifySessionToken()`, `getSessionUser()`, `requireAuth()`
- `src/app/api/auth/register/route.ts`, `login/route.ts`, `logout/route.ts`, `consent/route.ts`, `me/route.ts` — Auth & consent API endpoints
- `src/lib/vision/alignment.ts` — `solveSimilarityTransform()`, `alignFace112()` (`sharp` + Umeyama 5-point transform)
- `src/lib/vision/scrfd.ts` — `detectSingleFaceScrfd()` (`onnxruntime-node` SCRFD wrapper with injectable runner)
- `src/lib/vision/embedder.ts` — `extractEmbeddingOnnx()`, `batchExtractEmbeddings()` (post-training ArcFace/GhostFaceNets/MobileFaceNet hook)
- `src/lib/capture/protocol.ts` — `CAPTURE_STEPS`, `buildCapturePlan()`, `evaluateStepPoseAndExpression()`, `shouldUnlockFallback()`
- `src/lib/capture/quality.ts` — `computeFaceRoiBrightness()`, `computeLaplacianVariance()`, `evaluateQualityGate()`
- `src/app/api/sessions/route.ts`, `src/app/api/sessions/[id]/complete/route.ts`, `src/app/api/upload/route.ts` — Capture session & upload pipeline
- `src/app/api/my-photos/route.ts`, `src/app/api/my-photos/[imageId]/route.ts`, `src/app/api/account/route.ts`, `src/app/api/files/[...path]/route.ts` — Self-service image viewing & cascade deletion
- `src/app/api/admin/images/route.ts`, `src/app/api/admin/images/[imageId]/route.ts`, `src/app/api/admin/export/route.ts`, `src/app/api/admin/embeddings/route.ts` — Admin curation, ZIP/CSV export, batch embedding trigger
- `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/app/page.tsx`, `src/components/CaptureStudio.tsx`, `src/app/my-photos/page.tsx`, `src/app/admin/page.tsx` — UI pages & MediaPipe capture component

---

### Task 1: Project Scaffolding & Offline Model Downloader

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `.env.local`, `src/app/layout.tsx`, `src/app/globals.css`, `scripts/download-models.mjs`, `scripts/seed-admin.mjs`
- Test: `tests/setup/smoke.test.ts`

**Interfaces:**
- Produces: Next.js 15 App Router project configured with `serverExternalPackages: ['onnxruntime-node', 'sharp']`, Vitest test runner (`npm test`), and local model asset directories (`public/mediapipe/`, `models/`).

- [ ] **Step 1: Scaffold project environment files**
  Create `.env.example` and `.env.local` with `INVITE_CODE`, `SESSION_SECRET`, `DB_PATH=data/app.db`, `STORAGE_DIR=dataset_storage`, `SCRFD_MODEL_PATH=models/scrfd_500m_bnkps.onnx`. (Version control / Git initialization is intentionally skipped per user request.)

- [ ] **Step 2: Install dependencies and configure Next.js + Vitest**
  Install runtime dependencies (`next`, `react`, `react-dom`, `@mediapipe/tasks-vision`, `onnxruntime-node`, `sharp`, `archiver`) and dev dependencies (`typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `@types/archiver`, `tailwindcss`, `@tailwindcss/postcss`, `vitest`). Configure `next.config.ts` with `serverExternalPackages: ['onnxruntime-node', 'sharp']` and `vitest.config.ts` with `@/` path alias resolving to `src/`.

- [ ] **Step 3: Write smoke test verifying Node `node:sqlite` and Vitest config**
  ```ts
  import { describe, it, expect } from 'vitest';
  import { DatabaseSync } from 'node:sqlite';

  describe('environment smoke check', () => {
    it('supports in-memory node:sqlite DatabaseSync', () => {
      const db = new DatabaseSync(':memory:');
      db.exec('CREATE TABLE ping (id INTEGER PRIMARY KEY)');
      const row = db.prepare('SELECT 1 AS ok').get() as { ok: number };
      expect(row.ok).toBe(1);
      db.close();
    });
  });
  ```

- [ ] **Step 4: Run smoke test and create offline model download script**
  Run: `npx vitest run tests/setup/smoke.test.ts`
  Expected: PASS (1 passed).
  Implement `scripts/download-models.mjs` to copy `@mediapipe/tasks-vision` WASM files from `node_modules/@mediapipe/tasks-vision/wasm` to `public/mediapipe/wasm/`, fetch `face_landmarker.task` to `public/mediapipe/face_landmarker.task`, and fetch/verify `scrfd_500m_bnkps.onnx` into `models/scrfd_500m_bnkps.onnx` (skipping if already present).

---

### Task 2: SQLite Schema & Safe Filesystem Storage Paths

**Files:**
- Create: `src/lib/db/schema.ts`, `src/lib/storage/paths.ts`
- Test: `tests/lib/db-and-paths.test.ts`

**Interfaces:**
- Produces:
  - `initSchema(db: DatabaseSync): void`
  - `getDb(dbPath?: string): DatabaseSync`
  - `resolveSafeStoragePath(rootDir: string, relativePath: string): string`
  - `buildImageRelativePath(bucket: 'raw' | 'aligned_112x112', userId: string, sessionId: string, poseType: string, lightingType: string): string`

- [ ] **Step 1: Write failing tests for schema creation, foreign keys, and path traversal guard**
  ```ts
  import { describe, it, expect } from 'vitest';
  import { DatabaseSync } from 'node:sqlite';
  import path from 'node:path';
  import { initSchema } from '@/lib/db/schema';
  import { resolveSafeStoragePath, buildImageRelativePath } from '@/lib/storage/paths';

  describe('SQLite schema & safe paths', () => {
    it('creates all 4 tables with foreign keys enabled', () => {
      const db = new DatabaseSync(':memory:');
      initSchema(db);
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
      expect(tables.map((t) => t.name)).toEqual(
        expect.arrayContaining(['users', 'capture_sessions', 'face_images', 'face_embeddings'])
      );
      const fk = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
      expect(fk.foreign_keys).toBe(1);
      db.close();
    });

    it('builds safe relative paths and rejects path traversal attempts', () => {
      const rel = buildImageRelativePath('aligned_112x112', 'user-123', 'abcdef123456', 'yaw_left_15', 'screen_white');
      expect(rel).toBe(path.join('aligned_112x112', 'user-123', 'abcdef12_yaw_left_15_screen_white.jpg'));
      expect(() => resolveSafeStoragePath('/tmp/dataset_storage', '../etc/passwd')).toThrow(/Invalid storage path/);
      expect(() => buildImageRelativePath('raw', '../evil', 'sess1234', 'frontal', 'screen_white')).toThrow(/Invalid identifier/);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run tests/lib/db-and-paths.test.ts`
  Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/lib/db/schema.ts` and `src/lib/storage/paths.ts`**
  - In `schema.ts`: enable `PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;`, create `users` (`id`, `username`, `display_name`, `password_hash`, `role`, `consent_accepted_at`, `created_at`), `capture_sessions` (`id`, `user_id` ON DELETE CASCADE, `device_info`, `status`, `created_at`, `completed_at`), `face_images` (`id`, `user_id` ON DELETE CASCADE, `session_id` ON DELETE CASCADE, `pose_type`, `lighting_type`, `capture_mode`, `brightness_score`, `blur_score`, `yaw`, `pitch`, `roll`, `raw_image_path`, `aligned_image_path`, `is_approved`, `captured_at`), and `face_embeddings` (`id`, `user_id` ON DELETE CASCADE, `source_image_id` ON DELETE CASCADE, `model_version`, `embedding`, `created_at`).
  - In `paths.ts`: validate path segments with `/^[a-zA-Z0-9_-]+$/` and enforce `path.resolve(rootDir, relativePath)` starts with `path.resolve(rootDir) + path.sep`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run tests/lib/db-and-paths.test.ts`
  Expected: PASS (2 passed).

---

### Task 3: Password Hashing, Signed Session Auth, & Auth/Consent APIs

**Files:**
- Create: `src/lib/auth/password.ts`, `src/lib/auth/session.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/auth/consent/route.ts`, `src/app/api/auth/me/route.ts`, `scripts/seed-admin.mjs`
- Test: `tests/lib/auth.test.ts`, `tests/api/auth-routes.test.ts`

**Interfaces:**
- Consumes: `getDb()` from `src/lib/db/schema.ts`
- Produces:
  - `hashPassword(password: string): string`, `verifyPassword(password: string, stored: string): boolean`
  - `signSessionToken(payload: SessionPayload, secret?: string): string`
  - `verifySessionToken(token: string, secret?: string): SessionPayload | null`
  - `getSessionUser(db: DatabaseSync, request?: Request): AuthUser | null` (where `AuthUser` includes `id`, `username`, `displayName`, `role`, `consentAcceptedAt`)
  - `POST /api/auth/register` (requires `INVITE_CODE`), `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/consent`, `GET /api/auth/me`

- [ ] **Step 1: Write failing tests for password hashing, session HMAC signing, invite-code register, login, and consent update**
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import { DatabaseSync } from 'node:sqlite';
  import { initSchema } from '@/lib/db/schema';
  import { hashPassword, verifyPassword } from '@/lib/auth/password';
  import { signSessionToken, verifySessionToken } from '@/lib/auth/session';
  import { handleRegister, handleLogin, handleConsent } from '@/lib/auth/handlers';

  describe('auth & consent', () => {
    let db: DatabaseSync;
    beforeEach(() => {
      db = new DatabaseSync(':memory:');
      initSchema(db);
      process.env.INVITE_CODE = 'FRIEND2026';
      process.env.SESSION_SECRET = 'test-secret-key-32-chars-minimum!!';
    });

    it('hashes and verifies passwords with scrypt', () => {
      const h = hashPassword('secret123');
      expect(verifyPassword('secret123', h)).toBe(true);
      expect(verifyPassword('wrong', h)).toBe(false);
    });

    it('signs and rejects tampered session tokens', () => {
      const token = signSessionToken({ userId: 'u1', role: 'user', exp: Date.now() + 60_000 });
      expect(verifySessionToken(token)?.userId).toBe('u1');
      expect(verifySessionToken(token + 'x')).toBeNull();
    });

    it('rejects wrong invite code and records consent timestamp on acceptance', () => {
      expect(() => handleRegister(db, { username: 'alice', displayName: 'Alice', password: 'pw', inviteCode: 'BAD' })).toThrow(/Invalid invite code/);
      const user = handleRegister(db, { username: 'alice', displayName: 'Alice', password: 'pw', inviteCode: 'FRIEND2026' });
      expect(user.consentAcceptedAt).toBeNull();
      const updated = handleConsent(db, user.id);
      expect(updated.consentAcceptedAt).toBeTruthy();
      expect(handleLogin(db, { username: 'alice', password: 'pw' }).id).toBe(user.id);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run tests/lib/auth.test.ts`
  Expected: FAIL with module not found.

- [ ] **Step 3: Implement `password.ts`, `session.ts`, pure `handlers.ts`, Next.js `/api/auth/*` routes, and `scripts/seed-admin.mjs`**
  - `password.ts`: `randomBytes(16)` salt + `scryptSync(password, salt, 64)` stored as `${salt}:${hash}`; verify with `timingSafeEqual`.
  - `session.ts`: base64url JSON payload + HMAC-SHA256 signature; `httpOnly`, `sameSite: 'lax'`, relative cookie path `/`.
  - `handlers.ts`: `handleRegister`, `handleLogin`, `handleConsent`, `getUserById` (reused directly by route handlers and tests).
  - `/api/auth/*` routes: map errors to `400`, `401`, `403`, `409` cleanly and set/clear `fd_session` cookie.

- [ ] **Step 4: Run auth tests**
  Run: `npx vitest run tests/lib/auth.test.ts`
  Expected: PASS (3 passed).

---

### Task 4: 5-Point ArcFace Similarity Alignment & ONNX Runtime SCRFD Detector

**Files:**
- Create: `src/lib/vision/alignment.ts`, `src/lib/vision/scrfd.ts`
- Test: `tests/lib/vision-alignment.test.ts`

**Interfaces:**
- Produces:
  - `Point2D = { x: number; y: number }`
  - `ARCFACE_DST_112: readonly [Point2D, Point2D, Point2D, Point2D, Point2D]`
  - `solveSimilarityTransform(src: Point2D[], dst: Point2D[]): { a: number; b: number; tx: number; ty: number }` (maps `src -> dst` via `x' = a*x - b*y + tx`, `y' = b*x + a*y + ty`)
  - `alignFace112(jpegBuffer: Buffer, landmarks5: [Point2D, Point2D, Point2D, Point2D, Point2D]): Promise<Buffer>`
  - `detectSingleFaceScrfd(jpegBuffer: Buffer, runner?: ScrfdRunner): Promise<{ bbox: [number, number, number, number]; score: number; landmarks5: [Point2D, Point2D, Point2D, Point2D, Point2D] }>`

- [ ] **Step 1: Write failing tests for Umeyama 2D similarity matrix, `112×112` aligned output via `sharp`, and SCRFD 0/1/2-face error handling**
  ```ts
  import { describe, it, expect } from 'vitest';
  import sharp from 'sharp';
  import { ARCFACE_DST_112, solveSimilarityTransform, alignFace112 } from '@/lib/vision/alignment';
  import { detectSingleFaceScrfd } from '@/lib/vision/scrfd';

  describe('ArcFace alignment & SCRFD wrapper', () => {
    it('recovers exact similarity transform from scaled/rotated landmarks', () => {
      const src = ARCFACE_DST_112.map((p) => ({ x: p.x * 2 + 40, y: p.y * 2 + 25 }));
      const m = solveSimilarityTransform(src, [...ARCFACE_DST_112]);
      const mapped0 = { x: m.a * src[0].x - m.b * src[0].y + m.tx, y: m.b * src[0].x + m.a * src[0].y + m.ty };
      expect(mapped0.x).toBeCloseTo(ARCFACE_DST_112[0].x, 3);
      expect(mapped0.y).toBeCloseTo(ARCFACE_DST_112[0].y, 3);
    });

    it('produces a valid 112x112 JPEG buffer from alignFace112', async () => {
      const synthetic = await sharp({ create: { width: 320, height: 320, channels: 3, background: { r: 180, g: 150, b: 130 } } })
        .jpeg()
        .toBuffer();
      const src = ARCFACE_DST_112.map((p) => ({ x: p.x * 2 + 40, y: p.y * 2 + 40 })) as [any, any, any, any, any];
      const out = await alignFace112(synthetic, src);
      const meta = await sharp(out).metadata();
      expect(meta.width).toBe(112);
      expect(meta.height).toBe(112);
      expect(meta.format).toBe('jpeg');
    });

    it('rejects 0 faces or multiple faces from SCRFD runner', async () => {
      const buf = Buffer.from([0xff, 0xd8, 0xff]);
      await expect(detectSingleFaceScrfd(buf, async () => [])).rejects.toThrow(/NO_FACE_DETECTED/);
      await expect(detectSingleFaceScrfd(buf, async () => [{ score: 0.9 } as any, { score: 0.8 } as any])).rejects.toThrow(/MULTIPLE_FACES_DETECTED/);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run tests/lib/vision-alignment.test.ts`
  Expected: FAIL with module not found.

- [ ] **Step 3: Implement `alignment.ts` and `scrfd.ts`**
  - `alignment.ts`: closed-form 2D similarity least-squares solver (`a`, `b`, `tx`, `ty` without reflection), inverse-mapped bilinear interpolation over raw RGB buffer decoded by `sharp`, encoded back as 95% quality JPEG `112×112`.
  - `scrfd.ts`: lazy-loads `onnxruntime-node` `InferenceSession` from `process.env.SCRFD_MODEL_PATH`, preprocesses `640×640` letterboxed RGB tensor, decodes 8/16/32 stride anchor heads + NMS (IoU 0.4, score >= 0.45), and maps bbox + 5 landmarks back to original image pixels; throws `NO_FACE_DETECTED` or `MULTIPLE_FACES_DETECTED` when count !== 1.

- [ ] **Step 4: Run alignment & SCRFD tests**
  Run: `npx vitest run tests/lib/vision-alignment.test.ts`
  Expected: PASS (3 passed).

---

### Task 5: Capture Protocol State Machine & Client Quality Gate Logic

**Files:**
- Create: `src/lib/capture/protocol.ts`, `src/lib/capture/quality.ts`
- Test: `tests/lib/capture-protocol-quality.test.ts`

**Interfaces:**
- Produces:
  - `CaptureStepId`, `CaptureStepSpec` (includes `id`, `phase: 'A' | 'B'`, `bgColor: string`, `poseType: string`, `lightingType: string`, `skippable: boolean`, `instructionTh: string`)
  - `buildCapturePlan(wearsGlasses: boolean): CaptureStepSpec[]` (returns 14 steps when `false`, 15 steps when `true` — all Phase A steps have `bgColor: '#FFFFFF'`, Phase B has `#B8E2FF`, `#FFE0B2`, `#FFD1E6`)
  - `evaluateStepPoseAndExpression(stepId: CaptureStepId, metrics: FaceMetrics, baselineFaceWidthPx?: number): { matched: boolean; hintTh: string }`
  - `shouldUnlockFallback(elapsedMs: number, skippable: boolean): { allowManualCapture: boolean; allowSkip: boolean }`
  - `computeFaceRoiBrightness(rgba: Uint8ClampedArray, imgW: number, imgH: number, roi: { x: number; y: number; w: number; h: number }): { meanY: number; overexposedRatio: number }`
  - `computeLaplacianVariance(rgba: Uint8ClampedArray, imgW: number, imgH: number, roi: { x: number; y: number; w: number; h: number }): number`
  - `evaluateQualityGate(input: QualityInput): { passed: boolean; warning?: 'move_closer'; failureReason?: string }`

- [ ] **Step 1: Write failing tests covering capture plan, pose/blink/scale rules, backlit Face-ROI check, 480p `160px` vs `224px` nudge, blur check, and 10s fallback**
  ```ts
  import { describe, it, expect } from 'vitest';
  import { buildCapturePlan, evaluateStepPoseAndExpression, shouldUnlockFallback } from '@/lib/capture/protocol';
  import { computeFaceRoiBrightness, evaluateQualityGate } from '@/lib/capture/quality';

  describe('capture protocol & quality gates', () => {
    it('builds 14 or 15 steps with #FFFFFF for all Phase A and 3 pastel colors for Phase B', () => {
      const noGlasses = buildCapturePlan(false);
      const withGlasses = buildCapturePlan(true);
      expect(noGlasses).toHaveLength(14);
      expect(withGlasses).toHaveLength(15);
      expect(withGlasses.filter((s) => s.phase === 'A').every((s) => s.bgColor === '#FFFFFF')).toBe(true);
      expect(withGlasses.filter((s) => s.phase === 'B').map((s) => s.bgColor)).toEqual(['#B8E2FF', '#FFE0B2', '#FFD1E6']);
      expect(withGlasses.find((s) => s.id === 'roll_tilt_15')?.skippable).toBe(true);
    });

    it('fails backlit frame when background is 255 white but Face ROI is dark (meanY < 65)', () => {
      const w = 100, h = 100;
      const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
      for (let y = 30; y < 70; y++) {
        for (let x = 30; x < 70; x++) {
          const i = (y * w + x) * 4;
          rgba[i] = 35; rgba[i + 1] = 35; rgba[i + 2] = 35;
        }
      }
      const { meanY } = computeFaceRoiBrightness(rgba, w, h, { x: 30, y: 30, w: 40, h: 40 });
      expect(meanY).toBeCloseTo(35, 1);
      const res = evaluateQualityGate({ faceCount: 1, faceWidthPx: 240, eyeBlinkLeft: 0.1, eyeBlinkRight: 0.1, meanY, overexposedRatio: 0, blurVariance: 80 });
      expect(res.passed).toBe(false);
      expect(res.failureReason).toBe('too_dark');
    });

    it('allows 480p face >= 160px with move_closer warning, blocks blinking, and unlocks fallback at 10s', () => {
      const soft = evaluateQualityGate({ faceCount: 1, faceWidthPx: 175, eyeBlinkLeft: 0.1, eyeBlinkRight: 0.1, meanY: 130, overexposedRatio: 0.02, blurVariance: 80 });
      expect(soft.passed).toBe(true);
      expect(soft.warning).toBe('move_closer');

      const blink = evaluateQualityGate({ faceCount: 1, faceWidthPx: 240, eyeBlinkLeft: 0.7, eyeBlinkRight: 0.1, meanY: 130, overexposedRatio: 0.02, blurVariance: 80 });
      expect(blink.passed).toBe(false);
      expect(blink.failureReason).toBe('eyes_closed');

      expect(shouldUnlockFallback(9999, true)).toEqual({ allowManualCapture: false, allowSkip: false });
      expect(shouldUnlockFallback(10000, true)).toEqual({ allowManualCapture: true, allowSkip: true });
      expect(shouldUnlockFallback(10000, false)).toEqual({ allowManualCapture: true, allowSkip: false });
    });

    it('validates yaw, pitch, smile, and scale shift thresholds', () => {
      expect(evaluateStepPoseAndExpression('yaw_left_15', { yaw: -16, pitch: 0, roll: 0, smile: 0, jawOpen: 0, browUp: 0, faceWidthPx: 220 }).matched).toBe(true);
      expect(evaluateStepPoseAndExpression('frontal_smile', { yaw: 0, pitch: 0, roll: 0, smile: 0.55, jawOpen: 0, browUp: 0, faceWidthPx: 220 }).matched).toBe(true);
      expect(evaluateStepPoseAndExpression('frontal_scale_shift', { yaw: 0, pitch: 0, roll: 0, smile: 0, jawOpen: 0, browUp: 0, faceWidthPx: 260 }, 220).matched).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run tests/lib/capture-protocol-quality.test.ts`
  Expected: FAIL with module not found.

- [ ] **Step 3: Implement `protocol.ts` and `quality.ts`**
  - Define exact thresholds from spec: frontal `|yaw|<=6, |pitch|<=6, |roll|<=8`; `yaw_left_15` `[-20, -12]`; `yaw_left_30` `[-33, -23]`; `yaw_right_15` `[12, 20]`; `yaw_right_30` `[23, 33]`; `pitch_up_15` `[10, 18]`; `pitch_down_15` `[-18, -10]`; `roll_tilt_15` `|roll| in [10, 20]`; `frontal_scale_shift` `|w - base| / base >= 0.15`.
  - Quality thresholds: `faceWidthPx >= 160` (`warning: 'move_closer'` if `< 224`), `eyeBlink < 0.4`, `65 <= meanY <= 215`, `overexposedRatio < 0.15`, `blurVariance >= 25`.

- [ ] **Step 4: Run protocol & quality tests**
  Run: `npx vitest run tests/lib/capture-protocol-quality.test.ts`
  Expected: PASS (4 passed).

---

### Task 6: Capture Session & Server Upload/Alignment API

**Files:**
- Create: `src/lib/capture/upload-service.ts`, `src/app/api/sessions/route.ts`, `src/app/api/sessions/[id]/complete/route.ts`, `src/app/api/upload/route.ts`
- Test: `tests/api/upload-and-sessions.test.ts`

**Interfaces:**
- Consumes: `getDb()` (`Task 2`), `resolveSafeStoragePath()`, `buildImageRelativePath()` (`Task 2`), `getSessionUser()` (`Task 3`), `detectSingleFaceScrfd()` & `alignFace112()` (`Task 4`)
- Produces:
  - `createCaptureSession(db: DatabaseSync, user: AuthUser, deviceInfo: string): { id: string }` (throws `CONSENT_REQUIRED` if `consentAcceptedAt === null`)
  - `processAndSaveUpload(deps: UploadDeps, input: UploadInput): Promise<FaceImageRecord>`
  - `POST /api/sessions`, `POST /api/sessions/[id]/complete`, `POST /api/upload`

- [ ] **Step 1: Write failing tests for consent gate, zero-face rejection without orphan disk files, and valid `112×112` save + SQLite insertion**
  ```ts
  import { describe, it, expect, beforeEach, afterEach } from 'vitest';
  import { DatabaseSync } from 'node:sqlite';
  import fs from 'node:fs';
  import os from 'node:os';
  import path from 'node:path';
  import sharp from 'sharp';
  import { initSchema } from '@/lib/db/schema';
  import { handleRegister, handleConsent } from '@/lib/auth/handlers';
  import { ARCFACE_DST_112 } from '@/lib/vision/alignment';
  import { createCaptureSession, processAndSaveUpload, completeCaptureSession } from '@/lib/capture/upload-service';

  describe('capture sessions & upload pipeline', () => {
    let db: DatabaseSync;
    let tmpDir: string;

    beforeEach(() => {
      process.env.INVITE_CODE = 'OK';
      db = new DatabaseSync(':memory:');
      initSchema(db);
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'face-upload-'));
    });

    afterEach(() => {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('blocks session creation and upload before consent is accepted', async () => {
      const user = handleRegister(db, { username: 'bob', displayName: 'Bob', password: 'pw', inviteCode: 'OK' });
      expect(() => createCaptureSession(db, user, 'Chrome')).toThrow(/CONSENT_REQUIRED/);
    });

    it('leaves zero orphan files on disk when SCRFD rejects upload with 0 faces', async () => {
      const reg = handleRegister(db, { username: 'bob', displayName: 'Bob', password: 'pw', inviteCode: 'OK' });
      const user = handleConsent(db, reg.id);
      const session = createCaptureSession(db, user, 'Chrome');
      const jpeg = await sharp({ create: { width: 320, height: 320, channels: 3, background: { r: 100, g: 100, b: 100 } } }).jpeg().toBuffer();

      await expect(
        processAndSaveUpload(
          { db, storageRoot: tmpDir, detectFace: async () => { throw new Error('NO_FACE_DETECTED'); } },
          { user, sessionId: session.id, poseType: 'frontal_neutral', lightingType: 'screen_white', captureMode: 'auto', brightnessScore: 120, blurScore: 50, yaw: 0, pitch: 0, roll: 0, jpegBuffer: jpeg }
        )
      ).rejects.toThrow(/NO_FACE_DETECTED/);

      expect(fs.readdirSync(tmpDir)).toEqual([]);
      expect((db.prepare('SELECT COUNT(*) AS c FROM face_images').get() as { c: number }).c).toBe(0);
    });

    it('writes raw + aligned 112x112 images and SQLite row on valid upload and completes session', async () => {
      const reg = handleRegister(db, { username: 'bob', displayName: 'Bob', password: 'pw', inviteCode: 'OK' });
      const user = handleConsent(db, reg.id);
      const session = createCaptureSession(db, user, 'Chrome');
      const jpeg = await sharp({ create: { width: 320, height: 320, channels: 3, background: { r: 180, g: 150, b: 130 } } }).jpeg().toBuffer();
      const landmarks = ARCFACE_DST_112.map((p) => ({ x: p.x * 2 + 40, y: p.y * 2 + 40 })) as [any, any, any, any, any];

      const record = await processAndSaveUpload(
        { db, storageRoot: tmpDir, detectFace: async () => ({ bbox: [40, 40, 260, 260], score: 0.99, landmarks5: landmarks }) },
        { user, sessionId: session.id, poseType: 'frontal_neutral', lightingType: 'screen_white', captureMode: 'manual_fallback', brightnessScore: 140, blurScore: 65, yaw: 1, pitch: -1, roll: 0, jpegBuffer: jpeg }
      );

      expect(fs.existsSync(path.join(tmpDir, record.rawImagePath))).toBe(true);
      const alignedMeta = await sharp(path.join(tmpDir, record.alignedImagePath)).metadata();
      expect(alignedMeta.width).toBe(112);
      expect(alignedMeta.height).toBe(112);

      completeCaptureSession(db, user.id, session.id);
      const row = db.prepare('SELECT status FROM capture_sessions WHERE id = ?').get(session.id) as { status: string };
      expect(row.status).toBe('completed');
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run tests/api/upload-and-sessions.test.ts`
  Expected: FAIL with module not found.

- [ ] **Step 3: Implement `upload-service.ts` and API routes `/api/sessions`, `/api/sessions/[id]/complete`, `/api/upload`**
  - Validate multipart/form-data (`image` <= 10 MB, JPEG magic bytes `0xFF 0xD8`), verify session ownership (`session.user_id === user.id`), run `detectFace` -> `alignFace112`, write files atomically, insert into `face_images` (rolling back disk files if SQLite insert fails).
  - Map `CONSENT_REQUIRED` -> `403`, `NO_FACE_DETECTED` / `MULTIPLE_FACES_DETECTED` / invalid image -> `422`.

- [ ] **Step 4: Run upload & session tests**
  Run: `npx vitest run tests/api/upload-and-sessions.test.ts`
  Expected: PASS (3 passed).

---

### Task 7: Self-Service Review/Delete, Admin Curation/ZIP Export, & Pluggable ONNX Embedder

**Files:**
- Create: `src/lib/vision/embedder.ts`, `src/lib/admin/dataset-service.ts`, `src/app/api/my-photos/route.ts`, `src/app/api/my-photos/[imageId]/route.ts`, `src/app/api/account/route.ts`, `src/app/api/files/[...path]/route.ts`, `src/app/api/admin/images/route.ts`, `src/app/api/admin/images/[imageId]/route.ts`, `src/app/api/admin/export/route.ts`, `src/app/api/admin/embeddings/route.ts`
- Test: `tests/api/self-service-and-admin.test.ts`

**Interfaces:**
- Consumes: `getDb()`, `resolveSafeStoragePath()`, `getSessionUser()`
- Produces:
  - `deleteUserImage(db, storageRoot, requestingUserId, imageId): void` (enforces ownership, deletes `raw` & `aligned_112x112` files + SQLite row)
  - `deleteUserAccount(db, storageRoot, userId): void` (cascades disk files + SQLite user)
  - `buildApprovedDatasetZip(db, storageRoot): Promise<NodeJS.ReadableStream>` (includes only `is_approved = 1` files + `metadata.csv`, skips missing files without throwing)
  - `extractEmbeddingOnnx(aligned112Buffer: Buffer, modelPath: string, runner?: EmbedRunner): Promise<Float32Array>` (normalizes `[0,255] -> [-1,1]` RGB NCHW `1×3×112×112`, L2-normalizes output vector)
  - `batchExtractEmbeddings(db, storageRoot, modelPath, modelVersion, runner?): Promise<{ processed: number }>`

- [ ] **Step 1: Write failing tests for cross-user authorization isolation, cascade file+DB deletion, approved-only ZIP export, and L2-normalized embedding extraction**
  ```ts
  import { describe, it, expect, beforeEach, afterEach } from 'vitest';
  import { DatabaseSync } from 'node:sqlite';
  import fs from 'node:fs';
  import os from 'node:os';
  import path from 'node:path';
  import sharp from 'sharp';
  import { initSchema } from '@/lib/db/schema';
  import { handleRegister, handleConsent } from '@/lib/auth/handlers';
  import { deleteUserImage, deleteUserAccount, collectApprovedExportEntries } from '@/lib/admin/dataset-service';
  import { extractEmbeddingOnnx, batchExtractEmbeddings } from '@/lib/vision/embedder';

  describe('self-service deletion, admin export, and ONNX embedder', () => {
    let db: DatabaseSync;
    let tmpDir: string;

    beforeEach(() => {
      process.env.INVITE_CODE = 'OK';
      db = new DatabaseSync(':memory:');
      initSchema(db);
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'face-admin-'));
    });

    afterEach(() => {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('prevents cross-user deletion and cascades file removal on owner delete', async () => {
      const a = handleConsent(db, handleRegister(db, { username: 'a', displayName: 'A', password: 'pw', inviteCode: 'OK' }).id);
      const b = handleConsent(db, handleRegister(db, { username: 'b', displayName: 'B', password: 'pw', inviteCode: 'OK' }).id);
      db.prepare("INSERT INTO capture_sessions (id, user_id, status) VALUES ('s1', ?, 'completed')").run(a.id);
      const rawRel = path.join('raw', a.id, 's1_frontal.jpg');
      const alignedRel = path.join('aligned_112x112', a.id, 's1_frontal.jpg');
      fs.mkdirSync(path.dirname(path.join(tmpDir, rawRel)), { recursive: true });
      fs.mkdirSync(path.dirname(path.join(tmpDir, alignedRel)), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, rawRel), 'raw');
      fs.writeFileSync(path.join(tmpDir, alignedRel), 'aligned');
      db.prepare("INSERT INTO face_images (id, user_id, session_id, pose_type, lighting_type, raw_image_path, aligned_image_path, is_approved) VALUES ('img1', ?, 's1', 'frontal', 'screen_white', ?, ?, 1)").run(a.id, rawRel, alignedRel);

      expect(() => deleteUserImage(db, tmpDir, b.id, 'img1')).toThrow(/FORBIDDEN_OR_NOT_FOUND/);
      deleteUserImage(db, tmpDir, a.id, 'img1');
      expect(fs.existsSync(path.join(tmpDir, rawRel))).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, alignedRel))).toBe(false);
      deleteUserAccount(db, tmpDir, b.id);
      expect(db.prepare('SELECT id FROM users WHERE id = ?').get(b.id)).toBeUndefined();
    });

    it('excludes unapproved or missing files from export entries and stores L2-normalized embeddings', async () => {
      const u = handleConsent(db, handleRegister(db, { username: 'u', displayName: 'U', password: 'pw', inviteCode: 'OK' }).id);
      db.prepare("INSERT INTO capture_sessions (id, user_id, status) VALUES ('s1', ?, 'completed')").run(u.id);
      const aligned1 = path.join('aligned_112x112', u.id, 'ok.jpg');
      fs.mkdirSync(path.dirname(path.join(tmpDir, aligned1)), { recursive: true });
      const buf112 = await sharp({ create: { width: 112, height: 112, channels: 3, background: { r: 120, g: 120, b: 120 } } }).jpeg().toBuffer();
      fs.writeFileSync(path.join(tmpDir, aligned1), buf112);

      db.prepare("INSERT INTO face_images (id, user_id, session_id, pose_type, lighting_type, raw_image_path, aligned_image_path, is_approved) VALUES ('i1', ?, 's1', 'frontal', 'screen_white', ?, ?, 1)").run(u.id, aligned1, aligned1);
      db.prepare("INSERT INTO face_images (id, user_id, session_id, pose_type, lighting_type, raw_image_path, aligned_image_path, is_approved) VALUES ('i2', ?, 's1', 'smile', 'screen_white', ?, ?, 0)").run(u.id, aligned1, aligned1);

      const entries = collectApprovedExportEntries(db, tmpDir);
      expect(entries).toHaveLength(1);
      expect(entries[0].imageId).toBe('i1');

      const vec = await extractEmbeddingOnnx(buf112, 'models/arcface.onnx', async () => new Float32Array([3, 4]));
      expect(vec[0]).toBeCloseTo(0.6, 4);
      expect(vec[1]).toBeCloseTo(0.8, 4);

      const res = await batchExtractEmbeddings(db, tmpDir, 'models/arcface.onnx', 'arcface_v1', async () => new Float32Array([3, 4]));
      expect(res.processed).toBe(1);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run tests/api/self-service-and-admin.test.ts`
  Expected: FAIL with module not found.

- [ ] **Step 3: Implement `embedder.ts`, `dataset-service.ts`, and all `/api/my-photos/*`, `/api/account`, `/api/files/[...path]`, `/api/admin/*` route handlers**
  - `/api/files/[...path]`: check `resolveSafeStoragePath` and enforce `user.role === 'admin' || pathOwner === user.id` so users only read their own images.
  - `/api/admin/*`: enforce `user.role === 'admin'` (`403` otherwise).
  - `/api/admin/export`: stream ZIP containing `aligned_112x112/<user_id>/<file>.jpg` and `metadata.csv` with `user_id,username,display_name,pose_type,lighting_type,capture_mode,brightness_score,blur_score,yaw,pitch,roll,aligned_image_path`.

- [ ] **Step 4: Run self-service & admin tests**
  Run: `npx vitest run tests/api/self-service-and-admin.test.ts`
  Expected: PASS (2 passed).

---

### Task 8: Frontend Pages & MediaPipe Face Landmarker Capture Studio UI

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/app/page.tsx`, `src/components/ConsentGate.tsx`, `src/components/CaptureStudio.tsx`, `src/app/my-photos/page.tsx`, `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `/api/auth/*`, `/api/sessions/*`, `/api/upload`, `/api/my-photos/*`, `/api/account`, `/api/files/*`, `/api/admin/*`, `buildCapturePlan()`, `evaluateStepPoseAndExpression()`, `shouldUnlockFallback()`, `computeFaceRoiBrightness()`, `computeLaplacianVariance()`, `evaluateQualityGate()`

- [ ] **Step 1: Implement `/login` and `/register` pages**
  Clean Thai UI forms for `username`, `display_name`, `password`, and `inviteCode` (on `/register`), redirecting to `/` on success.

- [ ] **Step 2: Implement `ConsentGate.tsx`, `CaptureStudio.tsx`, and `/` home capture page**
  - Check `/api/auth/me` (server component redirect to `/login` if unauthenticated).
  - Show explicit consent notice & checkbox calling `POST /api/auth/consent` if `consentAcceptedAt === null`.
  - Pre-capture toggle: `"ฉันสวมแว่นตา"` (`wearsGlasses`) to build the 14- or 15-step plan.
  - Initialize `@mediapipe/tasks-vision` `FaceLandmarker` from `/mediapipe/wasm` and `/mediapipe/face_landmarker.task` with `outputFaceBlendshapes: true` and `outputFacialTransformationMatrixes: true`.
  - Render full-viewport background matching `currentStep.bgColor` (`#FFFFFF` across all 12 Phase A steps, then `#B8E2FF`, `#FFE0B2`, `#FFD1E6` for Phase B) with high-contrast dark guide text, live face-oval frame, step progress (`1/15`), 500ms stability countdown ring, and 10-second fallback revealing **"ถ่ายภาพเอง (Manual)"** (and **"ข้ามขั้นตอน"** for `skippable` steps).
  - Upload captured JPEG frames via `POST /api/upload`, handle `422` server SCRFD rejection by keeping the user on that step with a Thai retry message, allow step retake, and call `POST /api/sessions/[id]/complete` at the end.

- [ ] **Step 3: Implement `/my-photos` and `/admin` pages**
  - `/my-photos`: display logged-in user's captured images via `/api/files/...`, per-photo delete button, and delete-account confirmation modal.
  - `/admin`: filter by user / `capture_mode = 'manual_fallback'`, toggle approval (`PATCH /api/admin/images/[imageId]`), trigger ZIP download (`GET /api/admin/export`), and trigger batch ONNX embedding extraction (`POST /api/admin/embeddings`).

- [ ] **Step 4: Run full Vitest suite, TypeScript typecheck, and Next.js production build**
  Run: `npx vitest run`
  Expected: All unit & API tests PASS.
  Run: `npx tsc --noEmit && npm run build`
  Expected: Typecheck and Next.js build exit `0` with zero errors.

---

## Self-Review Checklist (Verified Against Spec)

- **Spec Coverage:** Every section of `docs/superpowers/specs/2026-11-12-face-dataset-registration-design.md` maps directly to Tasks 1–8 (local `localhost` setup, offline assets, `users`/`capture_sessions`/`face_images`/`face_embeddings` SQLite tables, `raw/` + `aligned_112x112/` storage, SCRFD `112×112` Umeyama alignment, 10 core + 2 conditional white-bg steps + 3 pastel colored-light steps, Face-ROI brightness/blink/blur + 10s fallback, consent + `/my-photos` cascade delete, `/admin` review + ZIP export + ONNX embedding hook).
- **Type & Signature Consistency:** `getDb`, `initSchema`, `resolveSafeStoragePath`, `buildImageRelativePath`, `handleRegister`, `handleLogin`, `handleConsent`, `ARCFACE_DST_112`, `solveSimilarityTransform`, `alignFace112`, `detectSingleFaceScrfd`, `buildCapturePlan`, `evaluateStepPoseAndExpression`, `shouldUnlockFallback`, `computeFaceRoiBrightness`, `evaluateQualityGate`, `createCaptureSession`, `processAndSaveUpload`, `deleteUserImage`, `deleteUserAccount`, `extractEmbeddingOnnx` match identically across `Interfaces` and test blocks.
