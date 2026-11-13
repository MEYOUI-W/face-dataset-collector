#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const MEDIAPIPE_TASK_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const SCRFD_MODEL_URL = 'https://github.com/yakhy/face/raw/main/weights/scrfd_500m_bnkps.onnx';

async function downloadFile(url, destPath, description) {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
    console.log(`[OK] ${description} already exists at ${destPath} (${fs.statSync(destPath).size} bytes). Skipping.`);
    return true;
  }

  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  console.log(`[INFO] Downloading ${description} from ${url}...`);
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status} ${res.statusText}`);
    }
    const fileStream = fs.createWriteStream(destPath, { flags: 'w' });
    await finished(Readable.fromWeb(res.body).pipe(fileStream));
    console.log(`[SUCCESS] Downloaded ${description} (${fs.statSync(destPath).size} bytes).`);
    return true;
  } catch (err) {
    console.warn(`[WARN] Failed to download ${description}: ${err.message}`);
    console.warn(`[MANUAL STEP] Please download ${url} manually and place it at: ${destPath}`);
    // Clean up partial empty file if created
    if (fs.existsSync(destPath) && fs.statSync(destPath).size === 0) {
      try { fs.unlinkSync(destPath); } catch {}
    }
    return false;
  }
}

function copyMediaPipeWasm() {
  const sourceDir = path.join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
  const targetDir = path.join(ROOT, 'public', 'mediapipe', 'wasm');

  if (!fs.existsSync(sourceDir)) {
    console.warn(`[WARN] MediaPipe WASM source not found at: ${sourceDir}`);
    console.warn(`[INFO] Ensure 'npm install' has been executed first.`);
    return false;
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const files = fs.readdirSync(sourceDir);
  let count = 0;
  for (const file of files) {
    const srcFile = path.join(sourceDir, file);
    const destFile = path.join(targetDir, file);
    if (fs.statSync(srcFile).isFile()) {
      fs.copyFileSync(srcFile, destFile);
      count++;
    }
  }

  console.log(`[OK] Copied ${count} MediaPipe WASM files to ${targetDir}`);
  return true;
}

async function main() {
  console.log('=== Face Dataset Registration - Offline Model Setup ===\n');

  // 1. Copy MediaPipe WASM files
  console.log('1. Copying MediaPipe WASM files...');
  copyMediaPipeWasm();

  // 2. Download face_landmarker.task
  console.log('\n2. Checking MediaPipe Face Landmarker model...');
  const landmarkerPath = path.join(ROOT, 'public', 'mediapipe', 'face_landmarker.task');
  await downloadFile(MEDIAPIPE_TASK_URL, landmarkerPath, 'MediaPipe Face Landmarker');

  // 3. Download SCRFD ONNX model
  console.log('\n3. Checking SCRFD ONNX model...');
  const scrfdPath = path.join(ROOT, 'models', 'scrfd_500m_bnkps.onnx');
  await downloadFile(SCRFD_MODEL_URL, scrfdPath, 'SCRFD 500M ONNX model');

  console.log('\n=== Offline Model Setup Finished ===');
}

main().catch((err) => {
  console.error('[FATAL] download-models script error:', err);
  process.exit(1);
});
