'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

// ประกาศตัวแปร global faceapi จาก CDN
declare global {
  interface Window {
    faceapi: any;
  }
}

interface PoseConfig {
  id: string;
  title: string;
  instruction: string;
  badge: string;
  bgColor: string;
  skippable: boolean;
}

// ชุดสีสำหรับท่าแสงสะท้อนบนใบหน้า (White, Warm Amber, Cool Blue, Vivid Green)
const LIGHT_COLORS = [
  { id: '06_light_white', title: '6.1 แสงสะท้อน – สีขาว', color: '#FFFFFF', label: 'แสงขาว ⚪ (1/4)' },
  { id: '06_light_warm', title: '6.2 แสงสะท้อน – สีส้ม', color: '#FF7A00', label: 'แสงส้ม 🟠 (2/4)' },
  { id: '06_light_blue', title: '6.3 แสงสะท้อน – สีฟ้า', color: '#0066FF', label: 'แสงฟ้า 🔵 (3/4)' },
  { id: '06_light_green', title: '6.4 แสงสะท้อน – สีเขียว', color: '#00C853', label: 'แสงเขียว 🟢 (4/4)' },
];

// รายการท่าทาง 8 ท่าทางหลัก
const POSES: PoseConfig[] = [
  {
    id: '01_frontal_neutral',
    title: 'หน้าตรง',
    instruction: 'มองตรงมาที่กล้อง สีหน้าปกติ ไม่ต้องยิ้ม',
    badge: '1/8',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '02_yaw_left',
    title: 'หันซ้าย',
    instruction: 'หันศีรษะไปทางซ้ายของคุณเล็กน้อย (~20°)',
    badge: '2/8',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '03_yaw_right',
    title: 'หันขวา',
    instruction: 'หันศีรษะไปทางขวาของคุณเล็กน้อย (~20°)',
    badge: '3/8',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '04_pitch_down',
    title: 'ก้มหน้า',
    instruction: 'ก้มหน้าลงเล็กน้อย และช้อนสายตามองกล้อง',
    badge: '4/8',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '05_pitch_up',
    title: 'เงยหน้า',
    instruction: 'เชิดคางและเงยหน้าขึ้นเล็กน้อย สบตากับกล้อง',
    badge: '5/8',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '06_screen_light',
    title: 'แสงสะท้อนบนใบหน้า (4 สี)',
    instruction: 'มองตรงที่กล้อง หน้านิ่ง จอจะกะพริบเปลี่ยน 4 สี (ขาว, ส้ม, ฟ้า, เขียว) และจับภาพอัตโนมัติ',
    badge: '6/8',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '07_slight_smile',
    title: 'ยิ้มเล็กน้อย',
    instruction: 'มองตรงและยิ้มเล็กน้อย ให้มุมปากยกขึ้น',
    badge: '7/8',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '08_squint_eyes',
    title: 'หรี่ตา',
    instruction: 'มองตรงและหรี่ตาลงเล็กน้อย (ไม่ต้องหลับตา)',
    badge: '8/8',
    bgColor: '#FFFFFF',
    skippable: false,
  },
];

interface CapturedImage {
  poseName: string;
  title: string;
  base64Data: string;
}

// คำนวณ Eye Aspect Ratio (EAR) จากจุด Landmark 6 จุด
function calculateEAR(eyePoints: { x: number; y: number }[]): number {
  if (!eyePoints || eyePoints.length < 6) return 0.3;
  const v1 = Math.hypot(eyePoints[1].x - eyePoints[5].x, eyePoints[1].y - eyePoints[5].y);
  const v2 = Math.hypot(eyePoints[2].x - eyePoints[4].x, eyePoints[2].y - eyePoints[4].y);
  const h = Math.hypot(eyePoints[0].x - eyePoints[3].x, eyePoints[0].y - eyePoints[3].y);
  if (h === 0) return 0.3;
  return (v1 + v2) / (2.0 * h);
}

export default function FaceCaptureStudio() {
  const [stage, setStage] = useState<'intro' | 'camera' | 'review' | 'uploading' | 'success'>('intro');
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [flash, setFlash] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ folderName: string; totalSaved: number; folderUrl?: string } | null>(null);

  // การตั้งค่า Auto-Capture และ แสงหลายสี
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [isJustCaptured, setIsJustCaptured] = useState(false);
  const [singleRetakeIndex, setSingleRetakeIndex] = useState<number | null>(null);
  const [currentLightColor, setCurrentLightColor] = useState<string | null>(null);

  // สถานะ AI จาก face-api.js
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [poseMatched, setPoseMatched] = useState(false);
  const [aiFeedbackText, setAiFeedbackText] = useState('กำลังโหลดโมเดล AI...');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectIntervalRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Refs ตรวจจับความนิ่งต่อเนื่องเพื่อความแม่นยำ
  const steadyMatchFramesRef = useRef(0);
  const isCoolingDownRef = useRef(false);
  const isColorSequenceRunningRef = useRef(false);

  const currentPose = POSES[currentPoseIndex];

  // เล่นเสียงชัตเตอร์แบบสังเคราะห์
  const playShutterSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(850, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.09);

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {
      // ignore
    }
  }, []);

  // โหลดโมเดล face-api.js
  useEffect(() => {
    let checkCount = 0;
    const interval = setInterval(async () => {
      checkCount++;
      if (typeof window !== 'undefined' && window.faceapi) {
        clearInterval(interval);
        try {
          const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
          await Promise.all([
            window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            window.faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          ]);
          setModelsLoaded(true);
          setAiFeedbackText('AI พร้อมทำงาน');
        } catch (err) {
          console.warn('โหลดโมเดล face-api.js ไม่สำเร็จ:', err);
          setAiFeedbackText('AI โหมดพื้นฐาน');
        }
      } else if (checkCount > 30) {
        clearInterval(interval);
        setAiFeedbackText('AI โหมดพื้นฐาน');
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  // เปิด/ปิดกล้องตาม Stage
  useEffect(() => {
    if (stage === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [stage, facingMode]);

  const startCamera = async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      alert(`ไม่สามารถเปิดกล้องได้: ${err.message}\nกรุณาอนุญาตให้เบราว์เซอร์เข้าถึงกล้องครับ`);
    }
  };

  const stopCamera = () => {
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
      detectIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // ฟังก์ชันถ่ายภาพลง canvas (Crop เป็นจัตุรัส 640x640 คมชัด น้ำหนักเบา เหมาะสำหรับ Dataset)
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    const targetSize = 640;
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const minDim = Math.min(vw, vh);
    const sx = (vw - minDim) / 2;
    const sy = (vh - minDim) / 2;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);

    playShutterSound();
    setFlash(true);
    setTimeout(() => setFlash(false), 160);

    return canvas.toDataURL('image/jpeg', 0.84);
  }, [facingMode, playShutterSound]);

  // เมื่อบันทึกภาพทั่วไป
  const saveAndAdvance = useCallback((dataUrl: string) => {
    const newEntry: CapturedImage = {
      poseName: currentPose.id,
      title: currentPose.title,
      base64Data: dataUrl,
    };

    setCapturedImages((prev) => {
      if (singleRetakeIndex !== null) {
        const copy = [...prev];
        copy[singleRetakeIndex] = newEntry;
        return copy;
      } else {
        const filtered = prev.filter((item) => item.poseName !== currentPose.id);
        return [...filtered, newEntry];
      }
    });

    setIsJustCaptured(true);
    setPoseMatched(false);
    steadyMatchFramesRef.current = 0;
    isCoolingDownRef.current = true;

    // หากเป็นการถ่ายซ้ำเฉพาะท่าจากหน้า Review
    if (singleRetakeIndex !== null) {
      setTimeout(() => {
        setIsJustCaptured(false);
        setSingleRetakeIndex(null);
        setStage('review');
        isCoolingDownRef.current = false;
      }, 600);
      return;
    }

    // หน่วงเวลา 0.7 วิ แล้วไปยังท่าต่อไป
    setTimeout(() => {
      setIsJustCaptured(false);
      if (currentPoseIndex + 1 < POSES.length) {
        setCurrentPoseIndex((prev) => prev + 1);
        setAiFeedbackText(`👉 เตรียมตัว: ${POSES[currentPoseIndex + 1].title}`);
        setTimeout(() => {
          isCoolingDownRef.current = false;
        }, 1000);
      } else {
        isCoolingDownRef.current = false;
        setStage('review');
      }
    }, 700);
  }, [currentPose.id, currentPose.title, currentPoseIndex, singleRetakeIndex]);

  // ลูปถ่ายภาพแสงสะท้อนหลายสีแบบรวดเร็ว (Multi-color Flash Sequence)
  const triggerColorSequence = useCallback(async () => {
    if (isColorSequenceRunningRef.current) return;
    isColorSequenceRunningRef.current = true;
    isCoolingDownRef.current = true;

    for (let i = 0; i < LIGHT_COLORS.length; i++) {
      const item = LIGHT_COLORS[i];
      setCurrentLightColor(item.color);
      setAiFeedbackText(`💡 นิ่งไว้: ถ่าย ${item.label}`);

      // หน่วงเวลา 320ms ให้แสงสีสะท้อนบนใบหน้าเต็มที่
      await new Promise((r) => setTimeout(r, 320));

      const dataUrl = captureFrame();
      if (dataUrl) {
        const newEntry: CapturedImage = {
          poseName: item.id,
          title: item.title,
          base64Data: dataUrl,
        };
        setCapturedImages((prev) => {
          const filtered = prev.filter((p) => p.poseName !== item.id);
          return [...filtered, newEntry];
        });
      }
      await new Promise((r) => setTimeout(r, 120));
    }

    setCurrentLightColor(null);
    setIsJustCaptured(true);
    setAiFeedbackText('✅ บันทึกแสงสะท้อนครบ 4 สีเรียบร้อย!');

    setTimeout(() => {
      setIsJustCaptured(false);
      isColorSequenceRunningRef.current = false;
      if (singleRetakeIndex !== null) {
        setSingleRetakeIndex(null);
        setStage('review');
        isCoolingDownRef.current = false;
      } else {
        if (currentPoseIndex + 1 < POSES.length) {
          setCurrentPoseIndex((prev) => prev + 1);
          setAiFeedbackText(`👉 เตรียมตัว: ${POSES[currentPoseIndex + 1].title}`);
          setTimeout(() => {
            isCoolingDownRef.current = false;
          }, 1000);
        } else {
          isCoolingDownRef.current = false;
          setStage('review');
        }
      }
    }, 750);
  }, [captureFrame, currentPoseIndex, singleRetakeIndex]);

  // ชัตเตอร์กดเอง
  const handleManualCapture = () => {
    if (currentPose.id === '06_screen_light') {
      triggerColorSequence();
    } else {
      const dataUrl = captureFrame();
      if (dataUrl) {
        saveAndAdvance(dataUrl);
      }
    }
  };

  // ตรวจสอบเงื่อนไขท่าทางอย่างแม่นยำ
  const validatePoseCriteria = useCallback((single: any, poseId: string): { matched: boolean; feedback: string } => {
    const landmarks = single.landmarks;
    const expressions = single.expressions || {};
    const jaw = landmarks.getJawOutline();
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    // 1. Yaw
    const jawLeft = jaw[0];
    const jawRight = jaw[16];
    const noseTip = nose[3];
    const jawWidth = Math.abs(jawRight.x - jawLeft.x);
    const noseDistToLeft = Math.abs(noseTip.x - jawLeft.x);
    const yawRatio = jawWidth > 0 ? noseDistToLeft / jawWidth : 0.5;

    // 2. Pitch
    const noseBridge = nose[0];
    const chin = jaw[8];
    const upperH = Math.abs(noseTip.y - noseBridge.y);
    const lowerH = Math.abs(chin.y - noseTip.y);
    const pitchRatio = (upperH + lowerH) > 0 ? upperH / (upperH + lowerH) : 0.45;

    // 3. EAR (ดวงตา)
    const earLeft = calculateEAR(leftEye);
    const earRight = calculateEAR(rightEye);
    const avgEar = (earLeft + earRight) / 2;

    // 4. Expression
    const happyScore = expressions.happy || 0;

    switch (poseId) {
      case '01_frontal_neutral':
        if (yawRatio > 0.58) return { matched: false, feedback: '👈 กรุณามองตรง (เอียงซ้าย)' };
        if (yawRatio < 0.42) return { matched: false, feedback: '👉 กรุณามองตรง (เอียงขวา)' };
        if (pitchRatio > 0.52) return { matched: false, feedback: '👆 เงยหน้าขึ้นอีกนิดครับ' };
        if (pitchRatio < 0.34) return { matched: false, feedback: '👇 ก้มหน้าลงอีกนิดครับ' };
        if (happyScore > 0.35) return { matched: false, feedback: '😐 กรุณาทำหน้านิ่งครับ' };
        if (avgEar < 0.18) return { matched: false, feedback: '👁️ ลืมตาตามปกติครับ' };
        return { matched: true, feedback: '✅ หน้าตรงถูกต้อง' };

      case '02_yaw_left':
        if (yawRatio < 0.46) return { matched: false, feedback: '👈 กรุณาหันไปทางซ้ายครับ' };
        if (yawRatio < 0.57) return { matched: false, feedback: '👈 หันซ้ายอีกนิดครับ' };
        return { matched: true, feedback: '✅ หันซ้ายถูกต้อง' };

      case '03_yaw_right':
        if (yawRatio > 0.54) return { matched: false, feedback: '👉 กรุณาหันไปทางขวาครับ' };
        if (yawRatio < 0.43) return { matched: false, feedback: '👉 หันขวาอีกนิดครับ' };
        return { matched: true, feedback: '✅ หันขวาถูกต้อง' };

      case '04_pitch_down':
        if (pitchRatio < 0.50) return { matched: false, feedback: '👇 ก้มหน้าลงอีกนิดครับ' };
        return { matched: true, feedback: '✅ ก้มหน้าถูกต้อง' };

      case '05_pitch_up':
        if (pitchRatio > 0.36) return { matched: false, feedback: '☝️ เงยหน้าขึ้นอีกนิดครับ' };
        return { matched: true, feedback: '✅ เงยหน้าถูกต้อง' };

      case '06_screen_light':
        if (yawRatio < 0.42 || yawRatio > 0.58) return { matched: false, feedback: '💡 มองตรงเพื่อรับแสงหน้าจอครับ' };
        return { matched: true, feedback: '✅ หน้าตรงพร้อมถ่ายแสง 4 สี' };

      case '07_slight_smile':
        if (happyScore < 0.22) return { matched: false, feedback: '😊 ยิ้มเล็กน้อยให้มุมปากยกขึ้นครับ' };
        return { matched: true, feedback: '✅ ยิ้มกำลังดี' };

      case '08_squint_eyes':
        if (avgEar > 0.24) return { matched: false, feedback: '😑 กรุณาหรี่ตาลงอีกนิดครับ' };
        if (avgEar < 0.11) return { matched: false, feedback: '👁️ แค่หรี่ตา อย่าเพิ่งหลับตาสนิทครับ' };
        return { matched: true, feedback: '✅ หรี่ตาถูกต้อง' };

      default:
        return { matched: true, feedback: '✅ ท่าทางถูกต้อง' };
    }
  }, []);

  // ลูปตรวจจับใบหน้า
  const runFaceDetection = useCallback(async () => {
    if (
      !videoRef.current ||
      !modelsLoaded ||
      !window.faceapi ||
      videoRef.current.paused ||
      videoRef.current.ended ||
      isCoolingDownRef.current ||
      isColorSequenceRunningRef.current ||
      isJustCaptured
    ) {
      return;
    }

    try {
      const video = videoRef.current;
      const options = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 });
      const detections = await window.faceapi
        .detectAllFaces(video, options)
        .withFaceLandmarks()
        .withFaceExpressions();

      if (!detections || detections.length === 0) {
        setFaceDetected(false);
        setPoseMatched(false);
        steadyMatchFramesRef.current = 0;
        setAiFeedbackText('🔍 จัดใบหน้าให้อยู่ในวงกลม');
        return;
      }

      if (detections.length > 1) {
        setFaceDetected(false);
        setPoseMatched(false);
        steadyMatchFramesRef.current = 0;
        setAiFeedbackText('👥 กรุณาถ่ายทีละคนครับ');
        return;
      }

      const single = detections[0];
      setFaceDetected(true);

      const validation = validatePoseCriteria(single, currentPose.id);
      setAiFeedbackText(validation.feedback);

      if (validation.matched) {
        setPoseMatched(true);
        steadyMatchFramesRef.current += 1;

        // เมื่อท่าทางถูกต้องนิ่ง ~150ms ให้เริ่มทำงาน
        if (autoCaptureEnabled && steadyMatchFramesRef.current >= 2) {
          steadyMatchFramesRef.current = 0;
          if (currentPose.id === '06_screen_light') {
            triggerColorSequence();
          } else {
            const dataUrl = captureFrame();
            if (dataUrl) {
              saveAndAdvance(dataUrl);
            }
          }
        }
      } else {
        setPoseMatched(false);
        steadyMatchFramesRef.current = 0;
      }
    } catch {
      // ignore
    }
  }, [modelsLoaded, isJustCaptured, currentPose.id, autoCaptureEnabled, validatePoseCriteria, captureFrame, saveAndAdvance, triggerColorSequence]);

  useEffect(() => {
    if (stage === 'camera' && modelsLoaded) {
      detectIntervalRef.current = setInterval(runFaceDetection, 120);
    }
    return () => {
      if (detectIntervalRef.current) clearInterval(detectIntervalRef.current);
    };
  }, [stage, modelsLoaded, runFaceDetection]);

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleStart = () => {
    if (!userId.trim()) {
      alert('กรุณากรอกรหัสประจำตัวก่อนเริ่มถ่ายภาพครับ (ระบบจะใช้รหัสนี้เป็นชื่อโฟลเดอร์ใน Google Drive)');
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
        audioCtxRef.current.resume();
      }
    } catch {
      // ignore
    }

    setStage('camera');
    setCurrentPoseIndex(0);
    setCapturedImages([]);
    setSingleRetakeIndex(null);
    steadyMatchFramesRef.current = 0;
    isCoolingDownRef.current = false;
  };

  const advancePose = () => {
    if (currentPoseIndex + 1 < POSES.length) {
      setCurrentPoseIndex((prev) => prev + 1);
      steadyMatchFramesRef.current = 0;
      isCoolingDownRef.current = true;
      setTimeout(() => {
        isCoolingDownRef.current = false;
      }, 1000);
    } else {
      setStage('review');
    }
  };

  const goToPreviousPose = () => {
    if (currentPoseIndex > 0) {
      setCurrentPoseIndex((prev) => prev - 1);
      steadyMatchFramesRef.current = 0;
      isCoolingDownRef.current = true;
      setTimeout(() => {
        isCoolingDownRef.current = false;
      }, 800);
    }
  };

  const handleRetakeSinglePose = (index: number) => {
    setSingleRetakeIndex(index);
    setCurrentPoseIndex(index);
    setStage('camera');
    steadyMatchFramesRef.current = 0;
    isCoolingDownRef.current = true;
    setTimeout(() => {
      isCoolingDownRef.current = false;
    }, 1000);
  };

  const handleUpload = async () => {
    setStage('uploading');
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId.trim(),
          userName: userName.trim() || userId.trim(),
          folderName: userId.trim(),
          images: capturedImages,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'บันทึกภาพไม่สำเร็จ');
      }

      setSuccessInfo({
        folderName: data.folderName,
        totalSaved: data.totalSaved,
        folderUrl: data.folderUrl,
      });
      setStage('success');
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการบันทึกภาพ:\n${err.message}\nกรุณาลองใหม่อีกครั้ง`);
      setStage('review');
    }
  };

  return (
    <div
      className="fixed inset-0 w-screen h-[100dvh] flex flex-col justify-between items-center transition-colors duration-300 overflow-hidden select-none"
      style={{
        backgroundColor: currentLightColor || (stage === 'camera' ? currentPose.bgColor : '#FFFFFF'),
      }}
    >
      {/* 1. INTRO STAGE */}
      {stage === 'intro' && (
        <main className="flex-1 w-full max-w-sm mx-auto p-6 flex flex-col justify-center items-center text-center space-y-6">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-4xl shadow-inner border border-blue-100">
            📸
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">ลงทะเบียนภาพใบหน้า</h1>
            <p className="text-xs text-slate-500 mt-1">ระบบตรวจจับและบันทึกอัตโนมัติ 8 ท่าทาง (พร้อมแสง 4 สี)</p>
          </div>

          <div className="w-full space-y-3 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                รหัสประจำตัว (ID เพื่อใช้เป็นชื่อโฟลเดอร์) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="เช่น 65012345 หรือ ID001"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm outline-none transition bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อ - นามสกุล (ถ้ามี)
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="เช่น สมชาย ใจดี"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm outline-none transition bg-white"
              />
            </div>
          </div>

          <div className="w-full bg-slate-50 p-3 rounded-xl text-left text-xs text-slate-600 space-y-1 border border-slate-200">
            <p className="font-semibold text-slate-800">💡 จุดเด่นของระบบ:</p>
            <p>• พื้นหลังสีขาวเต็มจอทำหน้าที่เป็นไฟสตูดิโอ</p>
            <p>• จับภาพอัตโนมัติทันทีเมื่อท่าทางถูกต้อง</p>
            <p>• ในท่าแสงสะท้อน จอจะสลับสี (ขาว, ส้ม, ฟ้า, เขียว) และบันทึกรัวให้อัตโนมัติ</p>
          </div>

          <button
            onClick={handleStart}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full shadow-md transition active:scale-[0.98]"
          >
            เริ่มเปิดกล้อง ➜
          </button>
        </main>
      )}

      {/* 2. CAMERA STAGE (พื้นหลังสีขาว/สีแสงสะท้อนเต็มจอ ตรงกลางมีแค่วิดีโอวงกลม) */}
      {stage === 'camera' && (
        <div className="relative w-full h-full flex flex-col justify-between items-center py-6 px-4">
          {/* ส่วนบน: ข้อมูลท่าทาง & คำแนะนำ AI */}
          <div className="w-full flex flex-col items-center space-y-2 z-20">
            {/* ป้ายบอกลำดับท่าทาง */}
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 bg-white/90 backdrop-blur border border-slate-200 text-slate-800 text-xs font-bold rounded-full shadow-sm">
                ท่าที่ {currentPose.badge} : {currentPose.title}
              </span>
              <button
                onClick={() => setAutoCaptureEnabled((prev) => !prev)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition backdrop-blur ${
                  autoCaptureEnabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-white text-slate-600 border-slate-300'
                }`}
              >
                {autoCaptureEnabled ? '⚡ Auto' : '✋ กดเอง'}
              </button>
            </div>

            {/* คำแนะนำคำสั่งท่าทาง */}
            <p
              className={`text-sm font-semibold text-center px-4 transition-colors ${
                currentLightColor ? 'text-white drop-shadow-md' : 'text-slate-800'
              }`}
            >
              {currentPose.instruction}
            </p>

            {/* ข้อความ Feedback จาก AI */}
            <div className="h-6 flex items-center justify-center">
              <span
                className={`text-xs font-bold px-3 py-0.5 rounded-full transition-all duration-200 backdrop-blur ${
                  currentLightColor
                    ? 'bg-black/70 text-white'
                    : poseMatched
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : faceDetected
                    ? 'text-amber-700 bg-amber-50 border border-amber-200'
                    : 'text-slate-500 bg-white border border-slate-200'
                }`}
              >
                {aiFeedbackText}
              </span>
            </div>
          </div>

          {/* ตรงกลาง: กล่องแสดงวิดีโอรูปวงกลม (Circular Video Viewport) */}
          <div className="flex-1 flex items-center justify-center w-full z-10">
            <div
              className={`relative aspect-square w-64 sm:w-72 md:w-80 rounded-full overflow-hidden shadow-2xl transition-all duration-200 ${
                currentLightColor
                  ? 'border-4 border-white ring-8 ring-white/50 scale-[1.03]'
                  : poseMatched
                  ? 'border-4 border-emerald-500 ring-8 ring-emerald-200/60 scale-[1.02]'
                  : faceDetected
                  ? 'border-4 border-blue-400'
                  : 'border-4 border-slate-200'
              }`}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />

              {/* Success Badge เมื่อจับภาพเสร็จ */}
              {isJustCaptured && (
                <div className="absolute inset-0 bg-emerald-600/85 backdrop-blur-sm flex flex-col items-center justify-center text-white z-30 animate-fade-in">
                  <div className="w-14 h-14 rounded-full bg-white text-emerald-600 flex items-center justify-center text-3xl font-bold shadow-lg mb-1">
                    ✓
                  </div>
                  <p className="text-sm font-bold">บันทึกเรียบร้อย</p>
                </div>
              )}
            </div>
          </div>

          {/* ส่วนล่าง: ปุ่มควบคุมแบบ Minimal */}
          <div className="w-full flex items-center justify-between max-w-xs px-4 pb-2 z-20">
            {/* ปุ่มย้อนกลับ */}
            {currentPoseIndex > 0 ? (
              <button
                onClick={goToPreviousPose}
                className="w-10 h-10 rounded-full bg-white/90 backdrop-blur hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center text-sm shadow-sm transition active:scale-95"
                title="ย้อนกลับท่าก่อนหน้า"
              >
                ⏮️
              </button>
            ) : (
              <div className="w-10 h-10" />
            )}

            {/* ปุ่มชัตเตอร์ (สำหรับกดเอง) */}
            <button
              onClick={handleManualCapture}
              className={`w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white text-2xl active:scale-95 transition ${
                currentLightColor || poseMatched
                  ? 'bg-emerald-600 ring-4 ring-emerald-300'
                  : faceDetected
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-slate-400'
              }`}
              title="แตะเพื่อจับภาพทันที"
            >
              📷
            </button>

            {/* ปุ่มสลับกล้องหน้า/หลัง */}
            <button
              onClick={switchCamera}
              className="w-10 h-10 rounded-full bg-white/90 backdrop-blur hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center text-sm shadow-sm transition active:scale-95"
              title="สลับกล้อง"
            >
              🔄
            </button>
          </div>

          {/* เอฟเฟกต์ไฟแฟลช */}
          {flash && (
            <div className="fixed inset-0 bg-white pointer-events-none z-50 transition-opacity duration-150 opacity-100" />
          )}
        </div>
      )}

      {/* 3. REVIEW STAGE */}
      {stage === 'review' && (
        <main className="flex-1 w-full max-w-md mx-auto p-5 flex flex-col justify-center items-center text-center space-y-4">
          <div>
            <span className="text-4xl">🎉</span>
            <h2 className="text-xl font-bold text-slate-900 mt-1">บันทึกภาพครบถ้วนแล้ว!</h2>
            <p className="text-xs text-slate-500">รวมทั้งหมด {capturedImages.length} ภาพ (รวมแสงสะท้อน 4 สี)</p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 max-h-80 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200 w-full">
            {capturedImages.map((img, i) => (
              <div
                key={i}
                onClick={() => handleRetakeSinglePose(i)}
                className="group relative aspect-square bg-slate-200 rounded-xl overflow-hidden border border-slate-300 shadow-sm cursor-pointer hover:ring-2 hover:ring-blue-500 transition"
              >
                <img src={img.base64Data} alt={img.title} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] p-1 truncate text-center">
                  {img.title}
                </div>
                <div className="absolute inset-0 bg-black/40 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  🔄 ถ่ายใหม่
                </div>
              </div>
            ))}
          </div>

          <div className="w-full space-y-2 pt-2">
            <button
              onClick={handleUpload}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-full shadow-md transition active:scale-[0.98]"
            >
              ☁️ บันทึกลง Google Drive
            </button>
            <button
              onClick={() => {
                setStage('camera');
                setCurrentPoseIndex(0);
                setCapturedImages([]);
                setSingleRetakeIndex(null);
              }}
              className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
            >
              ถ่ายใหม่ทั้งหมดตั้งแต่ท่าแรก
            </button>
          </div>
        </main>
      )}

      {/* 4. UPLOADING STAGE */}
      {stage === 'uploading' && (
        <main className="flex-1 w-full max-w-sm mx-auto p-6 flex flex-col justify-center items-center text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
          <h3 className="text-base font-bold text-slate-900">กำลังส่งรูปภาพเข้า Google Drive...</h3>
          <p className="text-xs text-slate-500">กรุณารอสักครู่ ระบบกำลังจัดเก็บข้อมูลลงโฟลเดอร์รหัสของคุณ</p>
        </main>
      )}

      {/* 5. SUCCESS STAGE */}
      {stage === 'success' && successInfo && (
        <main className="flex-1 w-full max-w-sm mx-auto p-6 flex flex-col justify-center items-center text-center space-y-5">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-3xl shadow-inner border border-emerald-200">
            ✓
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">บันทึกสำเร็จเรียบร้อย!</h2>
            <p className="text-xs text-slate-500 mt-1">ภาพถ่ายทั้งหมดถูกจัดเก็บลงในโฟลเดอร์ Google Drive เรียบร้อยแล้ว</p>
          </div>

          <div className="w-full p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-200 text-left space-y-1">
            <p>
              <span className="font-semibold">โฟลเดอร์รหัส:</span> {successInfo.folderName}
            </p>
            <p>
              <span className="font-semibold">จำนวนภาพที่บันทึก:</span> {successInfo.totalSaved} ภาพ
            </p>
          </div>

          {successInfo.folderUrl && (
            <a
              href={successInfo.folderUrl}
              target="_blank"
              rel="noreferrer"
              className="block w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full shadow transition text-center"
            >
              📂 เปิดดูโฟลเดอร์ใน Google Drive
            </a>
          )}

          <button
            onClick={() => {
              setStage('intro');
              setUserName('');
              setUserId('');
              setCapturedImages([]);
              setSuccessInfo(null);
              setSingleRetakeIndex(null);
            }}
            className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
          >
            ลงทะเบียนคนถัดไป
          </button>
        </main>
      )}
    </div>
  );
}
