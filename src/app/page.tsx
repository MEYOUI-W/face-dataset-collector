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

// รายการท่าทางใหม่ 9 ท่าทางตามที่กำหนด
const POSES: PoseConfig[] = [
  {
    id: '01_frontal_neutral',
    title: '1. หน้าตรง',
    instruction: 'มองตรงมาที่กล้อง สีหน้าปกติเป็นธรรมชาติ ไม่ต้องยิ้ม ไม่เอียงหน้า',
    badge: 'ท่าที่ 1: หน้าตรง',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '02_yaw_left',
    title: '2. หันซ้าย',
    instruction: 'หันใบหน้าไปทางซ้ายของคุณเล็กน้อย (~15° - 30°) ให้เห็นมิติด้านข้าง',
    badge: 'ท่าที่ 2: หันซ้าย',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '03_yaw_right',
    title: '3. หันขวา',
    instruction: 'หันใบหน้าไปทางขวาของคุณเล็กน้อย (~15° - 30°) ให้เห็นมิติด้านข้าง',
    badge: 'ท่าที่ 3: หันขวา',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '04_pitch_down',
    title: '4. ก้มหน้า',
    instruction: 'ก้มหน้าลงเล็กน้อย และช้อนสายตามองกล้อง',
    badge: 'ท่าที่ 4: ก้มหน้า',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '05_pitch_up',
    title: '5. เงยหน้า',
    instruction: 'เชิดคางและเงยหน้าขึ้นเล็กน้อย สบตากับกล้อง',
    badge: 'ท่าที่ 5: เงยหน้า',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '06_screen_light',
    title: '6. แสงสะท้อนบนใบหน้า',
    instruction: 'หน้าจอจะส่องแสงสว่าง มองตรงที่กล้องเพื่อบันทึกแสงตกกระทบผิวหน้า',
    badge: 'ท่าที่ 6: แสงสะท้อน',
    bgColor: '#FFF5E8',
    skippable: false,
  },
  {
    id: '07_slight_smile',
    title: '7. ยิ้มเล็กน้อย',
    instruction: 'มองตรงและยิ้มเล็กน้อยอย่างเป็นธรรมชาติ ให้มุมปากยกขึ้น',
    badge: 'ท่าที่ 7: ยิ้มเล็กน้อย',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '08_squint_eyes',
    title: '8. หรี่ตา',
    instruction: 'มองตรงและหรี่ตาลงเล็กน้อย (หรี่ตาเพื่อสู้แสง ไม่ต้องหลับตา)',
    badge: 'ท่าที่ 8: หรี่ตา',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '09_closed_eyes',
    title: '9. ปิดตา',
    instruction: 'หลับตาทั้งสองข้างและทำหน้านิ่งเป็นธรรมชาติ',
    badge: 'ท่าที่ 9: ปิดตา',
    bgColor: '#FFFFFF',
    skippable: false,
  },
];

interface CapturedImage {
  poseName: string;
  title: string;
  base64Data: string;
}

// คำนวณ Eye Aspect Ratio (EAR) จากจุด Landmark 6 จุดของดวงตา
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

  // การตั้งค่า Auto-Capture
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [isJustCaptured, setIsJustCaptured] = useState(false);
  const [singleRetakeIndex, setSingleRetakeIndex] = useState<number | null>(null);

  // สถานะ AI จาก face-api.js
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [poseMatched, setPoseMatched] = useState(false);
  const [aiFeedbackText, setAiFeedbackText] = useState('กำลังโหลดโมเดล AI...');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectIntervalRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Refs ตรวจจับความต่อเนื่องเพื่อป้องกัน False-Trigger
  const steadyMatchFramesRef = useRef(0);
  const isCoolingDownRef = useRef(false);

  const currentPose = POSES[currentPoseIndex];

  // เล่นเสียงชัตเตอร์ (Web Audio API)
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
      // ignore audio error
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

  // ฟังก์ชันถ่ายภาพลง canvas
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    playShutterSound();
    setFlash(true);
    setTimeout(() => setFlash(false), 180);

    return canvas.toDataURL('image/jpeg', 0.92);
  }, [facingMode, playShutterSound]);

  // เมื่อภาพถูกจับและบันทึก
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

    // หากเป็นการถ่ายซ้ำเฉพาะท่าจากหน้า Review ให้กลับไป Review ทันที
    if (singleRetakeIndex !== null) {
      setTimeout(() => {
        setIsJustCaptured(false);
        setSingleRetakeIndex(null);
        setStage('review');
        isCoolingDownRef.current = false;
      }, 700);
      return;
    }

    // หน่วงเวลาเล็กน้อย 0.8 วิ ให้ผู้ใช้เห็นข้อความสำเร็จ แล้วไปยังท่าต่อไป
    setTimeout(() => {
      setIsJustCaptured(false);
      if (currentPoseIndex + 1 < POSES.length) {
        setCurrentPoseIndex((prev) => prev + 1);
        setAiFeedbackText(`👉 เตรียมตัว: ${POSES[currentPoseIndex + 1].title}`);
        // ให้เวลา 1.1 วินาทีในการขยับท่าทางก่อนเริ่มตรวจจับท่าถัดไป
        setTimeout(() => {
          isCoolingDownRef.current = false;
        }, 1100);
      } else {
        isCoolingDownRef.current = false;
        setStage('review');
      }
    }, 750);
  }, [currentPose.id, currentPose.title, currentPoseIndex, singleRetakeIndex]);

  // ชัตเตอร์กดเอง (Manual)
  const handleManualCapture = () => {
    const dataUrl = captureFrame();
    if (dataUrl) {
      saveAndAdvance(dataUrl);
    }
  };

  // ตรวจสอบความถูกต้องของท่าทางอย่างแม่นยำ (Strict Landmark Validation)
  const validatePoseCriteria = useCallback((single: any, poseId: string): { matched: boolean; feedback: string } => {
    const landmarks = single.landmarks;
    const expressions = single.expressions || {};
    const jaw = landmarks.getJawOutline();
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    // 1. คำนวณ Yaw (การหันซ้าย-ขวา)
    const jawLeft = jaw[0];
    const jawRight = jaw[16];
    const noseTip = nose[3]; // จุดที่ 30
    const jawWidth = Math.abs(jawRight.x - jawLeft.x);
    const noseDistToLeft = Math.abs(noseTip.x - jawLeft.x);
    const yawRatio = jawWidth > 0 ? noseDistToLeft / jawWidth : 0.5;

    // 2. คำนวณ Pitch (ก้มหน้า-เงยหน้า)
    const noseBridge = nose[0]; // จุดที่ 27
    const chin = jaw[8]; // คาง
    const upperH = Math.abs(noseTip.y - noseBridge.y);
    const lowerH = Math.abs(chin.y - noseTip.y);
    const pitchRatio = (upperH + lowerH) > 0 ? upperH / (upperH + lowerH) : 0.45;

    // 3. คำนวณ Eye Aspect Ratio (EAR)
    const earLeft = calculateEAR(leftEye);
    const earRight = calculateEAR(rightEye);
    const avgEar = (earLeft + earRight) / 2;

    // 4. Expression
    const happyScore = expressions.happy || 0;

    switch (poseId) {
      case '01_frontal_neutral':
        // หน้าตรง: yaw อยู่ตรงกลาง (0.43 - 0.57), pitch อยู่ตรงกลาง (0.35 - 0.51), ตาเปิด (> 0.20), หน้านิ่ง
        if (yawRatio > 0.58) {
          return { matched: false, feedback: '👈 หันหน้าตรงครับ (กำลังเอียงซ้าย)' };
        }
        if (yawRatio < 0.42) {
          return { matched: false, feedback: '👉 หันหน้าตรงครับ (กำลังเอียงขวา)' };
        }
        if (pitchRatio > 0.52) {
          return { matched: false, feedback: '👆 เงยหน้าขึ้นอีกนิดครับ (ก้มอยู่)' };
        }
        if (pitchRatio < 0.34) {
          return { matched: false, feedback: '👇 ก้มหน้าลงอีกนิดครับ (เงยอยู่)' };
        }
        if (happyScore > 0.35) {
          return { matched: false, feedback: '😐 กรุณาทำหน้านิ่งเป็นธรรมชาติครับ' };
        }
        if (avgEar < 0.18) {
          return { matched: false, feedback: '👁️ ลืมตาตามปกติครับ' };
        }
        return { matched: true, feedback: '✅ หน้าตรงถูกต้อง!' };

      case '02_yaw_left':
        // หันซ้าย: yawRatio ต้องเอียงชัดเจน (>= 0.58)
        if (yawRatio < 0.46) {
          return { matched: false, feedback: '👈 กรุณาหันไปทางซ้ายครับ (กำลังหันขวา)' };
        }
        if (yawRatio < 0.57) {
          return { matched: false, feedback: '👈 หันหน้าไปทางซ้ายอีกนิดครับ' };
        }
        return { matched: true, feedback: '✅ หันซ้ายถูกต้อง!' };

      case '03_yaw_right':
        // หันขวา: yawRatio ต้องเอียงชัดเจน (<= 0.43)
        if (yawRatio > 0.54) {
          return { matched: false, feedback: '👉 กรุณาหันไปทางขวาครับ (กำลังหันซ้าย)' };
        }
        if (yawRatio > 0.43) {
          return { matched: false, feedback: '👉 หันหน้าไปทางขวาอีกนิดครับ' };
        }
        return { matched: true, feedback: '✅ หันขวาถูกต้อง!' };

      case '04_pitch_down':
        // ก้มหน้า: pitchRatio >= 0.51 (คางชิด)
        if (pitchRatio < 0.50) {
          return { matched: false, feedback: '👇 ก้มหน้าลงอีกนิด และมองกล้องครับ' };
        }
        return { matched: true, feedback: '✅ ก้มหน้าถูกต้อง!' };

      case '05_pitch_up':
        // เงยหน้า: pitchRatio <= 0.35 (เชิดคาง)
        if (pitchRatio > 0.36) {
          return { matched: false, feedback: '☝️ เชิดคางและเงยหน้าขึ้นอีกนิดครับ' };
        }
        return { matched: true, feedback: '✅ เงยหน้าถูกต้อง!' };

      case '06_screen_light':
        // แสงสะท้อน: หน้าตรงรับแสงสะท้อนจากจอ
        if (yawRatio < 0.42 || yawRatio > 0.58) {
          return { matched: false, feedback: '💡 มองตรงที่กล้องเพื่อรับแสงสะท้อนครับ' };
        }
        return { matched: true, feedback: '✅ แสงสะท้อนและหน้าตรงถูกต้อง!' };

      case '07_slight_smile':
        // ยิ้มเล็กน้อย: happyScore >= 0.25
        if (happyScore < 0.22) {
          return { matched: false, feedback: '😊 ยิ้มเล็กน้อยให้มุมปากยกขึ้นครับ' };
        }
        return { matched: true, feedback: `✅ รอยยิ้มถูกต้อง (${Math.round(happyScore * 100)}%)!` };

      case '08_squint_eyes':
        // หรี่ตา: avgEar แคบลง (0.12 - 0.22)
        if (avgEar > 0.24) {
          return { matched: false, feedback: '😑 กรุณาหรี่ตาลงอีกนิดครับ (สู้แสง)' };
        }
        if (avgEar < 0.11) {
          return { matched: false, feedback: '👁️ อย่าเพิ่งหลับตาสนิทครับ แค่หรี่ตา' };
        }
        return { matched: true, feedback: '✅ หรี่ตาถูกต้อง!' };

      case '09_closed_eyes':
        // ปิดตา: avgEar < 0.13 (หลับตาสนิท)
        if (avgEar >= 0.14) {
          return { matched: false, feedback: '😌 กรุณาหลับตาทั้งสองข้างให้สนิทครับ' };
        }
        return { matched: true, feedback: '✅ ปิดตาสนิทถูกต้อง!' };

      default:
        return { matched: true, feedback: '✅ ท่าทางถูกต้อง' };
    }
  }, []);

  // ลูปตรวจจับใบหน้าแบบ Real-time ด้วย face-api.js
  const runFaceDetection = useCallback(async () => {
    if (
      !videoRef.current ||
      !modelsLoaded ||
      !window.faceapi ||
      videoRef.current.paused ||
      videoRef.current.ended ||
      isCoolingDownRef.current ||
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
        setAiFeedbackText('🔍 กรุณาให้ใบหน้าอยู่หน้ากล้อง');
        return;
      }

      if (detections.length > 1) {
        setFaceDetected(false);
        setPoseMatched(false);
        steadyMatchFramesRef.current = 0;
        setAiFeedbackText('👥 ตรวจพบมากกว่า 1 คน กรุณาถ่ายทีละคน');
        return;
      }

      const single = detections[0];
      setFaceDetected(true);

      // ตรวจสอบเงื่อนไขของท่าทางปัจจุบัน
      const validation = validatePoseCriteria(single, currentPose.id);
      setAiFeedbackText(validation.feedback);

      if (validation.matched) {
        setPoseMatched(true);
        steadyMatchFramesRef.current += 1;

        // ไม่ต้องนับถอยหลัง: เมื่อท่าทางถูกต้องและนิ่ง 2 เฟรมต่อเนื่อง (~150-200ms) จับภาพทันที!
        if (autoCaptureEnabled && steadyMatchFramesRef.current >= 2) {
          steadyMatchFramesRef.current = 0;
          const dataUrl = captureFrame();
          if (dataUrl) {
            saveAndAdvance(dataUrl);
          }
        }
      } else {
        setPoseMatched(false);
        steadyMatchFramesRef.current = 0;
      }
    } catch {
      // ignore detection errors
    }
  }, [modelsLoaded, isJustCaptured, currentPose.id, autoCaptureEnabled, validatePoseCriteria, captureFrame, saveAndAdvance]);

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
    if (!userName.trim()) {
      alert('กรุณากรอกชื่อ-นามสกุลก่อนเริ่มถ่ายภาพครับ');
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

  const skipPose = () => {
    advancePose();
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
          userName: userName.trim(),
          userId: userId.trim(),
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
      className="min-h-screen flex flex-col justify-between transition-colors duration-500 font-sans"
      style={{ backgroundColor: stage === 'camera' ? currentPose.bgColor : '#FFFFFF' }}
    >
      {/* HEADER */}
      <header className="w-full bg-white/90 backdrop-blur border-b border-slate-200 py-3 px-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow">
            AI
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">Face Dataset Collection</h1>
            <p className="text-xs text-slate-500">Auto Snap on Pose Matched</p>
          </div>
        </div>

        {stage === 'camera' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setAutoCaptureEnabled((prev) => !prev)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition flex items-center space-x-1 ${
                autoCaptureEnabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}
              title="เปิด/ปิดการจับภาพอัตโนมัติเมื่อท่าทางถูกต้อง"
            >
              <span>{autoCaptureEnabled ? '⚡ Auto Snap' : '✋ กดเอง'}</span>
            </button>
            <div className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
              {currentPoseIndex + 1} / {POSES.length}
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 w-full max-w-md mx-auto p-4 flex flex-col justify-center">
        {/* 1. INTRO STAGE */}
        {stage === 'intro' && (
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center space-y-5">
            <div className="w-16 h-16 mx-auto bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
              🎯
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">บันทึกภาพใบหน้า 9 ท่าทาง</h2>
              <p className="text-sm text-slate-500 mt-1">
                ระบบ AI ตรวจจับท่าทางแม่นยำ <b>จับภาพทันทีเมื่อทำท่าทางถูกต้อง</b>
              </p>
            </div>

            <div className="text-left space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อ - นามสกุล <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="เช่น สมชาย ใจดี"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รหัสนักศึกษา / รหัสพนักงาน (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="เช่น 65012345"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm outline-none transition"
                />
              </div>
            </div>

            <div className="bg-blue-50/70 p-3.5 rounded-xl text-left text-xs text-blue-950 space-y-1.5 border border-blue-200">
              <p className="font-semibold text-blue-900">✨ ท่าทางทั้ง 9 ท่าที่จะบันทึก:</p>
              <p>• 1. หน้าตรง 2. หันซ้าย 3. หันขวา</p>
              <p>• 4. ก้มหน้า 5. เงยหน้า 6. แสงสะท้อนบนใบหน้า</p>
              <p>• 7. ยิ้มเล็กน้อย 8. หรี่ตา 9. ปิดตา</p>
              <p className="text-emerald-700 font-semibold pt-1">
                ⚡ ทำท่าทางตามคำแนะนำบนจอ เมื่อถูกต้องระบบจะจับภาพทันทีอัตโนมัติ!
              </p>
            </div>

            <button
              onClick={handleStart}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition active:scale-[0.98]"
            >
              เริ่มเปิดกล้อง ➜
            </button>
          </section>
        )}

        {/* 2. CAMERA STAGE */}
        {stage === 'camera' && (
          <section className="flex flex-col items-center space-y-3">
            {/* Progress Bar */}
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${((currentPoseIndex + 1) / POSES.length) * 100}%` }}
              />
            </div>

            {/* Instruction Card */}
            <div className="w-full bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center relative">
              {singleRetakeIndex !== null && (
                <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  ถ่ายใหม่เฉพาะท่านี้
                </span>
              )}
              <div className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 mb-1">
                {currentPose.badge}
              </div>
              <h3 className="text-base font-bold text-slate-900">{currentPose.title}</h3>
              <p className="text-xs text-slate-600 font-medium mt-0.5">{currentPose.instruction}</p>
            </div>

            {/* Camera Viewport with Oval Guide & Face-api Feedback */}
            <div className="relative w-full aspect-[3/4] max-h-[460px] bg-slate-900 rounded-2xl overflow-hidden shadow-md flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />

              {/* Status Badge ด้านบนพร้อมคำแนะนำ Real-time */}
              <div className="absolute top-3 inset-x-3 flex items-center justify-center pointer-events-none z-20">
                <span
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold backdrop-blur shadow transition-all ${
                    poseMatched
                      ? 'bg-emerald-600 text-white border border-emerald-400 scale-105'
                      : faceDetected
                      ? 'bg-amber-500/90 text-white border border-amber-300'
                      : 'bg-black/60 text-slate-200 border border-white/20'
                  }`}
                >
                  {aiFeedbackText}
                </span>
              </div>

              {/* Oval Guide (เปลี่ยนเป็นสีเขียวหนาขึ้นทันทีเมื่อท่าทางตรงเป๊ะ) */}
              <div
                className="absolute pointer-events-none transition-all duration-200"
                style={{
                  width: '62%',
                  height: '72%',
                  border: poseMatched
                    ? '4px solid #10B981'
                    : faceDetected
                    ? '3px solid rgba(245, 158, 11, 0.9)'
                    : '3px dashed rgba(59, 130, 246, 0.85)',
                  borderRadius: '50% / 50%',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.22)',
                }}
              />

              {/* Flash effect */}
              {flash && <div className="absolute inset-0 bg-white pointer-events-none transition-opacity duration-150 opacity-95 z-40" />}

              {/* Just Captured Success Message */}
              {isJustCaptured && (
                <div className="absolute inset-0 bg-emerald-950/75 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none z-30 text-white animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-3xl font-bold shadow-lg mb-2">
                    ✓
                  </div>
                  <p className="text-base font-bold">จับภาพ {currentPose.title} เรียบร้อย!</p>
                  <p className="text-xs text-emerald-200 mt-1">กำลังไปท่าถัดไป...</p>
                </div>
              )}
            </div>

            {/* Controls Bar */}
            <div className="w-full flex items-center justify-between px-2 pt-1">
              {/* ปุ่มย้อนกลับ */}
              {currentPoseIndex > 0 ? (
                <button
                  onClick={goToPreviousPose}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 py-2 px-3 rounded-lg flex items-center space-x-1"
                >
                  <span>⏮️ ท่าก่อน</span>
                </button>
              ) : (
                <div className="w-16" />
              )}

              {/* ปุ่มชัตเตอร์ */}
              <div className="flex flex-col items-center">
                <button
                  onClick={handleManualCapture}
                  className={`w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white text-2xl active:scale-95 transition ${
                    poseMatched
                      ? 'bg-emerald-600 hover:bg-emerald-700 ring-4 ring-emerald-300'
                      : faceDetected
                      ? 'bg-amber-500 hover:bg-amber-600'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  title="กดถ่ายทันที หรือปล่อยให้ระบบ Auto จับภาพเมื่อท่าถูกต้อง"
                >
                  📷
                </button>
                <span className="text-[10px] text-slate-400 mt-1">
                  {autoCaptureEnabled ? 'จับภาพ Auto เมื่อท่าถูกต้อง' : 'กดปุ่มเพื่อถ่าย'}
                </span>
              </div>

              {/* ปุ่มสลับกล้อง / ข้าม */}
              <div className="flex items-center space-x-1">
                {currentPose.skippable && (
                  <button
                    onClick={skipPose}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 py-2 px-2 rounded-lg"
                  >
                    ข้าม
                  </button>
                )}
                <button
                  onClick={switchCamera}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 py-2 px-2.5 rounded-lg flex items-center space-x-1"
                >
                  <span>🔄 สลับกล้อง</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* 3. REVIEW ALL STAGE */}
        {stage === 'review' && (
          <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
            <div>
              <span className="text-3xl">🎉</span>
              <h2 className="text-lg font-bold text-slate-900 mt-1">บันทึกภาพครบ 9 ท่าทางเรียบร้อย!</h2>
              <p className="text-xs text-slate-500">ตรวจสอบรูปภาพของคุณ หากรูปไหนต้องการถ่ายซ้ำ สามารถกดที่รูปเพื่อถ่ายใหม่ได้ครับ</p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 max-h-80 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200">
              {capturedImages.map((img, i) => (
                <div key={i} className="group relative aspect-square bg-slate-200 rounded-lg overflow-hidden border border-slate-300 shadow-sm">
                  <img src={img.base64Data} alt={img.title} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] p-1 truncate text-center">
                    {img.title}
                  </div>
                  {/* ปุ่มถ่ายใหม่เฉพาะท่านี้ */}
                  <button
                    onClick={() => handleRetakeSinglePose(i)}
                    className="absolute inset-0 bg-black/50 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center space-x-1"
                  >
                    <span>🔄 ถ่ายใหม่</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={handleUpload}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md transition active:scale-[0.98] flex items-center justify-center space-x-2"
              >
                <span>☁️ บันทึกลง Google Drive</span>
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
          </section>
        )}

        {/* 4. UPLOADING STAGE */}
        {stage === 'uploading' && (
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
            <h3 className="text-base font-bold text-slate-900">กำลังบันทึกภาพลง Google Drive...</h3>
            <p className="text-xs text-slate-500">กรุณาอย่าเพิ่งปิดหน้าต่างนี้ กำลังอัปโหลดภาพและสร้างโฟลเดอร์ให้คุณ</p>
          </section>
        )}

        {/* 5. SUCCESS STAGE */}
        {stage === 'success' && successInfo && (
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-3xl shadow-inner">
              ✓
            </div>
            <h2 className="text-xl font-bold text-slate-900">บันทึกสำเร็จเรียบร้อย!</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              ภาพถ่ายทั้งหมดของคุณถูกจัดเก็บลงในโฟลเดอร์ Google Drive อย่างปลอดภัยเรียบร้อยแล้ว
            </p>

            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-200 text-left space-y-1">
              <p>
                <span className="font-semibold">โฟลเดอร์:</span> {successInfo.folderName}
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
                className="block w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition"
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
              className="w-full py-2 px-4 text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
            >
              ลงทะเบียนคนถัดไป
            </button>
          </section>
        )}
      </main>

      {/* FOOTER */}
      <footer className="py-3 text-center text-xs text-slate-400">
        Face Dataset Collection with face-api.js &copy; 2026
      </footer>
    </div>
  );
}
