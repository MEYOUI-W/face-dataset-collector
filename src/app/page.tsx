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

const POSES: PoseConfig[] = [
  {
    id: '01_frontal_neutral',
    title: '1. หน้าตรง – หน้านิ่ง',
    instruction: 'มองตรงมาที่กล้อง สีหน้าปกติเป็นธรรมชาติ ไม่ต้องยิ้ม',
    badge: 'ท่าที่ 1: หน้าตรง',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '02_frontal_smile',
    title: '2. หน้าตรง – ยิ้ม',
    instruction: 'มองตรงมาที่กล้อง พร้อมรอยยิ้มเห็นฟันอย่างเป็นธรรมชาติ',
    badge: 'ท่าที่ 2: รอยยิ้ม',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '03_frontal_expression',
    title: '3. หน้าตรง – ขยับปากหรือเลิกคิ้ว',
    instruction: 'มองตรงมาที่กล้อง อ้าปากเล็กน้อย หรือเลิกคิ้วขึ้น',
    badge: 'ท่าที่ 3: สีหน้า',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '04_frontal_scale',
    title: '4. หน้าตรง – ระยะใกล้ขึ้นเล็กน้อย',
    instruction: 'ขยับใบหน้าเข้ามาใกล้กล้องอีกเล็กน้อย (หน้าใหญ่ขึ้น)',
    badge: 'ท่าที่ 4: สเกลภาพ',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '05_yaw_left_15',
    title: '5. หันซ้ายเล็กน้อย (~15°)',
    instruction: 'เอียงใบหน้าไปทางซ้ายเล็กน้อย ยังคงมองเห็นตาทั้งสองข้าง',
    badge: 'ท่าที่ 5: หันซ้าย 15°',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '06_yaw_left_30',
    title: '6. หันซ้ายปานกลาง (~30°)',
    instruction: 'หันใบหน้าไปทางซ้ายมากขึ้นอีกนิด โดยตายังชำเลืองมองกล้องได้',
    badge: 'ท่าที่ 6: หันซ้าย 30°',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '07_yaw_right_15',
    title: '7. หันขวาเล็กน้อย (~15°)',
    instruction: 'เอียงใบหน้าไปทางขวาเล็กน้อย ยังคงมองเห็นตาทั้งสองข้าง',
    badge: 'ท่าที่ 7: หันขวา 15°',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '08_yaw_right_30',
    title: '8. หันขวาปานกลาง (~30°)',
    instruction: 'หันใบหน้าไปทางขวามากขึ้นอีกนิด โดยตายังชำเลืองมองกล้องได้',
    badge: 'ท่าที่ 8: หันขวา 30°',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '09_pitch_up_15',
    title: '9. เงยหน้าขึ้นเล็กน้อย (~15°)',
    instruction: 'เชิดคางและเงยหน้าขึ้นเล็กน้อย สบตากับกล้อง',
    badge: 'ท่าที่ 9: เงยหน้า',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '10_pitch_down_15',
    title: '10. ก้มหน้าลงเล็กน้อย (~15°)',
    instruction: 'ก้มหน้าลงเล็กน้อยและช้อนตามองกล้อง',
    badge: 'ท่าที่ 10: ก้มหน้า',
    bgColor: '#FFFFFF',
    skippable: false,
  },
  {
    id: '11_roll_or_glasses',
    title: '11. เอียงคอเล็กน้อย หรือถอด/สวมแว่น',
    instruction: 'เอียงศีรษะซ้ายหรือขวาเล็กน้อย (ถ้าสวมแว่น สามารถลองถอดแว่นได้)',
    badge: 'ท่าที่ 11: เอียงคอ / แว่นตา',
    bgColor: '#FFFFFF',
    skippable: true,
  },
  {
    id: '12_screen_warm_light',
    title: '12. แสงสะท้อน – หน้าตรง หน้านิ่ง',
    instruction: 'หน้าจอจะเปลี่ยนเป็นโทนแสงสีอุ่น มองตรงที่กล้องเพื่อเก็บแสงสะท้อนบนผิวหน้า',
    badge: 'ท่าที่ 12: แสงสะท้อน',
    bgColor: '#FFE8D6',
    skippable: false,
  },
];

interface CapturedImage {
  poseName: string;
  title: string;
  base64Data: string;
}

export default function FaceCaptureStudio() {
  const [stage, setStage] = useState<'intro' | 'camera' | 'review' | 'uploading' | 'success'>('intro');
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [tempSnapshot, setTempSnapshot] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [flash, setFlash] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ folderName: string; totalSaved: number; folderUrl?: string } | null>(null);

  // การตั้งค่า Auto-Capture
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isJustCaptured, setIsJustCaptured] = useState(false);
  const [singleRetakeIndex, setSingleRetakeIndex] = useState<number | null>(null);

  // สถานะ AI จาก face-api.js
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [aiFeedbackText, setAiFeedbackText] = useState('กำลังโหลดโมเดล AI...');
  const [smileScore, setSmileScore] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectIntervalRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Refs สำหรับการนับถอยหลัง Auto-Capture
  const steadyFramesRef = useRef(0);
  const isCoolingDownRef = useRef(false);
  const countdownTimerRef = useRef<any>(null);

  const currentPose = POSES[currentPoseIndex];

  // เล่นเสียงชัตเตอร์แบบสังเคราะห์ (Web Audio API)
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

      // เสียงคลิกชัตเตอร์ 2 จังหวะสั้นๆ
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
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

  // ฟังก์ชันถ่ายภาพและบันทึก
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
    setTimeout(() => setFlash(false), 200);

    return canvas.toDataURL('image/jpeg', 0.92);
  }, [facingMode, playShutterSound]);

  // ฟังก์ชันเมื่อบันทึกรูปสำเร็จ (ทั้ง Auto และ Manual)
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
    setCountdown(null);
    steadyFramesRef.current = 0;
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

    // หน่วงเวลาเล็กน้อย 0.8 วิ แสดงข้อความสำเร็จ แล้วไปยังท่าต่อไป
    setTimeout(() => {
      setIsJustCaptured(false);
      if (currentPoseIndex + 1 < POSES.length) {
        setCurrentPoseIndex((prev) => prev + 1);
        setAiFeedbackText(`👉 เตรียมตัว: ${POSES[currentPoseIndex + 1].title}`);
        // ให้เวลาผู้ใช้ 1.2 วินาทีในการปรับท่าทาง ก่อนเริ่มนับ Auto-capture รอบใหม่
        setTimeout(() => {
          isCoolingDownRef.current = false;
        }, 1200);
      } else {
        isCoolingDownRef.current = false;
        setStage('review');
      }
    }, 800);
  }, [currentPose.id, currentPose.title, currentPoseIndex, singleRetakeIndex]);

  // ชัตเตอร์กดเอง (Manual Shutter)
  const handleManualCapture = () => {
    const dataUrl = captureFrame();
    if (dataUrl) {
      saveAndAdvance(dataUrl);
    }
  };

  // ลูปตรวจจับใบหน้าและ Auto-Capture แบบ Real-time ด้วย face-api.js
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
        setSmileScore(null);
        setCountdown(null);
        steadyFramesRef.current = 0;
        setAiFeedbackText('🔍 กรุณาให้ใบหน้าอยู่หน้ากล้อง');
        return;
      }

      if (detections.length > 1) {
        setFaceDetected(false);
        setSmileScore(null);
        setCountdown(null);
        steadyFramesRef.current = 0;
        setAiFeedbackText('👥 ตรวจพบมากกว่า 1 คน กรุณาถ่ายทีละคน');
        return;
      }

      const single = detections[0];
      setFaceDetected(true);

      const happyScore = single.expressions?.happy || 0;
      setSmileScore(Math.round(happyScore * 100));

      // เช็คว่าท่าทางสอดคล้องกับ Requirement หรือไม่
      let isPoseReady = true;

      if (currentPose.id === '02_frontal_smile') {
        if (happyScore > 0.40) {
          setAiFeedbackText(`😊 ยิ้มสวยมาก! (${Math.round(happyScore * 100)}%)`);
          isPoseReady = true;
        } else {
          setAiFeedbackText('😃 ยิ้มกว้างขึ้นอีกนิดครับ กำลังรอรอยยิ้ม...');
          isPoseReady = false;
          // รีเซ็ตการนับหากยังไม่ยิ้ม
          steadyFramesRef.current = 0;
          setCountdown(null);
        }
      } else {
        setAiFeedbackText('✅ ตรวจพบใบหน้า พร้อมบันทึก');
      }

      // ถ้าเปิดโหมด Auto-Capture และท่าทางพร้อม
      if (autoCaptureEnabled && isPoseReady) {
        steadyFramesRef.current += 1;

        // เฟรมที่ 1-2: เริ่มนับถอยหลัง 2
        // เฟรมที่ 3-4: นับถอยหลัง 1
        // เฟรมที่ 5: แชะ! ถ่ายอัตโนมัติ (ใช้เวลาประมาณ 1.2 วินาทีในการค้างท่านิ่ง)
        if (steadyFramesRef.current >= 5) {
          steadyFramesRef.current = 0;
          setCountdown(null);
          const dataUrl = captureFrame();
          if (dataUrl) {
            saveAndAdvance(dataUrl);
          }
        } else if (steadyFramesRef.current >= 3) {
          setCountdown(1);
        } else if (steadyFramesRef.current >= 1) {
          setCountdown(2);
        }
      } else if (!autoCaptureEnabled) {
        setCountdown(null);
      }
    } catch {
      // ignore detection errors
    }
  }, [modelsLoaded, isJustCaptured, currentPose.id, autoCaptureEnabled, captureFrame, saveAndAdvance]);

  useEffect(() => {
    if (stage === 'camera' && modelsLoaded) {
      detectIntervalRef.current = setInterval(runFaceDetection, 250);
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
    // ปลดล็อค Web Audio API จาก interaction แรก
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
    setTempSnapshot(null);
    setSingleRetakeIndex(null);
    steadyFramesRef.current = 0;
    isCoolingDownRef.current = false;
  };

  const skipPose = () => {
    advancePose();
  };

  const advancePose = () => {
    if (currentPoseIndex + 1 < POSES.length) {
      setCurrentPoseIndex((prev) => prev + 1);
      steadyFramesRef.current = 0;
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
      steadyFramesRef.current = 0;
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
    steadyFramesRef.current = 0;
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
            <p className="text-xs text-slate-500">Auto-Capture with face-api.js</p>
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
              title="เปิด/ปิดการถ่ายภาพอัตโนมัติเมื่อตรวจพบใบหน้า"
            >
              <span>{autoCaptureEnabled ? '⚡ Auto: เปิด' : '✋ กดเอง'}</span>
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
              ⚡
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">ระบบบันทึกใบหน้าอัตโนมัติ</h2>
              <p className="text-sm text-slate-500 mt-1">
                ตรวจจับใบหน้าและ <b>บันทึกภาพอัตโนมัติ (Hands-free)</b> โดยไม่ต้องกดชัตเตอร์เอง
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

            <div className="bg-emerald-50/70 p-3.5 rounded-xl text-left text-xs text-emerald-950 space-y-1.5 border border-emerald-200">
              <p className="font-semibold text-emerald-900">✨ ระบบ Auto-Capture ทำงานอย่างไร:</p>
              <p>• เพียงทำท่าทางตามที่ระบบแจ้งบนหน้าจอ</p>
              <p>• เมื่อตรวจพบใบหน้านิ่งหรือรอยยิ้ม ระบบจะนับถอยหลังและ <b>แชะภาพให้อัตโนมัติ</b></p>
              <p>• ขยับไปท่าต่อไปจนครบ 12 ท่าทางโดยไม่ต้องแตะหน้าจอ</p>
              <p>• หน้าจอเปิดพื้นหลังสีขาวช่วยส่องแสงสว่างให้ใบหน้า</p>
            </div>

            <button
              onClick={handleStart}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition active:scale-[0.98]"
            >
              เริ่มเปิดกล้อง (โหมด Auto) ➜
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
                  กำลังถ่ายใหม่เฉพาะท่านี้
                </span>
              )}
              <div className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 mb-1">
                {currentPose.badge}
              </div>
              <h3 className="text-base font-bold text-slate-900">{currentPose.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{currentPose.instruction}</p>
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

              {/* Status Badge จาก face-api.js ด้านบน */}
              <div className="absolute top-3 inset-x-3 flex items-center justify-center pointer-events-none z-20">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur shadow transition-all ${
                    faceDetected
                      ? 'bg-emerald-600/90 text-white border border-emerald-400'
                      : 'bg-black/60 text-slate-200 border border-white/20'
                  }`}
                >
                  {aiFeedbackText}
                </span>
              </div>

              {/* Oval Guide (เปลี่ยนเป็นสีเขียวเมื่อตรวจพบหน้า) */}
              <div
                className="absolute pointer-events-none transition-all duration-300"
                style={{
                  width: '62%',
                  height: '72%',
                  border: faceDetected
                    ? countdown !== null
                      ? '4px solid #10B981'
                      : '3px solid rgba(16, 185, 129, 0.95)'
                    : '3px dashed rgba(59, 130, 246, 0.85)',
                  borderRadius: '50% / 50%',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.22)',
                }}
              />

              {/* Countdown Overlay ขนาดใหญ่เมื่อตรวจพบนิ่ง */}
              {countdown !== null && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 bg-black/10">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/95 text-white flex items-center justify-center text-4xl font-extrabold shadow-2xl animate-pulse border-4 border-white">
                    {countdown}
                  </div>
                  <span className="mt-2 px-3 py-1 bg-black/70 text-white text-xs font-bold rounded-full">
                    📸 กำลังบันทึกอัตโนมัติ...
                  </span>
                </div>
              )}

              {/* Flash effect */}
              {flash && <div className="absolute inset-0 bg-white pointer-events-none transition-opacity duration-150 opacity-95 z-40" />}

              {/* Just Captured Success Message */}
              {isJustCaptured && (
                <div className="absolute inset-0 bg-emerald-950/70 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none z-30 text-white animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-3xl font-bold shadow-lg mb-2">
                    ✓
                  </div>
                  <p className="text-base font-bold">บันทึกท่านี้เรียบร้อย!</p>
                  <p className="text-xs text-emerald-200 mt-1">กำลังขยับไปท่าต่อไป...</p>
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

              {/* ปุ่มชัตเตอร์ (สามารถกดได้ทั้งคู่: ระบบ Auto หรือกดเองได้ทันที) */}
              <div className="flex flex-col items-center">
                <button
                  onClick={handleManualCapture}
                  className={`w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white text-2xl active:scale-95 transition ${
                    faceDetected
                      ? 'bg-emerald-600 hover:bg-emerald-700 ring-4 ring-emerald-300/60'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  title="กดถ่ายทันที หรือปล่อยให้ระบบ Auto บันทึกเอง"
                >
                  📷
                </button>
                <span className="text-[10px] text-slate-400 mt-1">
                  {autoCaptureEnabled ? 'ระบบ Auto กำลังตรวจจับ' : 'กดปุ่มเพื่อถ่าย'}
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
              <h2 className="text-lg font-bold text-slate-900 mt-1">ถ่ายภาพครบทุกท่าเรียบร้อย!</h2>
              <p className="text-xs text-slate-500">ตรวจสอบรูปภาพของคุณ หากรูปไหนไม่ชัด สามารถกดถ่ายใหม่เฉพาะท่านั้นได้ครับ</p>
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
