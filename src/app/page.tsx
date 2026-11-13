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

  // สถานะ AI จาก face-api.js
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [aiFeedbackText, setAiFeedbackText] = useState('กำลังโหลดโมเดล AI...');
  const [smileScore, setSmileScore] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectIntervalRef = useRef<any>(null);

  const currentPose = POSES[currentPoseIndex];

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

  // ลูปตรวจจับใบหน้าแบบ Real-time ด้วย face-api.js
  const runFaceDetection = useCallback(async () => {
    if (!videoRef.current || !modelsLoaded || !window.faceapi || videoRef.current.paused || videoRef.current.ended) {
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
        setAiFeedbackText('🔍 กรุณาให้ใบหน้าอยู่หน้ากล้อง');
        return;
      }

      if (detections.length > 1) {
        setFaceDetected(false);
        setSmileScore(null);
        setAiFeedbackText('👥 ตรวจพบมากกว่า 1 คน กรุณาถ่ายทีละคน');
        return;
      }

      const single = detections[0];
      setFaceDetected(true);

      // ตรวจจับรอยยิ้ม
      const happyScore = single.expressions?.happy || 0;
      setSmileScore(Math.round(happyScore * 100));

      // ให้คำแนะนำสดตามท่าทางปัจจุบัน
      if (currentPose.id === '02_frontal_smile') {
        if (happyScore > 0.5) {
          setAiFeedbackText(`😊 เยี่ยมมาก! กำลังยิ้ม (${Math.round(happyScore * 100)}%)`);
        } else {
          setAiFeedbackText('😐 หน้านิ่งอยู่ ยิ้มกว้างขึ้นอีกนิดครับ');
        }
      } else if (currentPose.id === '05_yaw_left_15' || currentPose.id === '06_yaw_left_30') {
        setAiFeedbackText('👈 กำลังเอียงหันซ้าย พร้อมถ่าย');
      } else if (currentPose.id === '07_yaw_right_15' || currentPose.id === '08_yaw_right_30') {
        setAiFeedbackText('👉 กำลังเอียงหันขวา พร้อมถ่าย');
      } else {
        setAiFeedbackText('✅ ตรวจพบใบหน้า พร้อมถ่าย');
      }
    } catch {
      // ignore frame check errors
    }
  }, [modelsLoaded, currentPose.id]);

  useEffect(() => {
    if (stage === 'camera' && modelsLoaded && !tempSnapshot) {
      detectIntervalRef.current = setInterval(runFaceDetection, 250);
    }
    return () => {
      if (detectIntervalRef.current) clearInterval(detectIntervalRef.current);
    };
  }, [stage, modelsLoaded, tempSnapshot, runFaceDetection]);

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleStart = () => {
    if (!userName.trim()) {
      alert('กรุณากรอกชื่อ-นามสกุลก่อนเริ่มถ่ายภาพครับ');
      return;
    }
    setStage('camera');
    setCurrentPoseIndex(0);
    setCapturedImages([]);
    setTempSnapshot(null);
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    setFlash(true);
    setTimeout(() => setFlash(false), 250);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setTempSnapshot(dataUrl);
  };

  const retakeSnapshot = () => {
    setTempSnapshot(null);
  };

  const confirmSnapshot = () => {
    if (!tempSnapshot) return;
    const newEntry: CapturedImage = {
      poseName: currentPose.id,
      title: currentPose.title,
      base64Data: tempSnapshot,
    };
    setCapturedImages((prev) => [...prev, newEntry]);
    setTempSnapshot(null);
    advancePose();
  };

  const skipPose = () => {
    setTempSnapshot(null);
    advancePose();
  };

  const advancePose = () => {
    if (currentPoseIndex + 1 < POSES.length) {
      setCurrentPoseIndex((prev) => prev + 1);
    } else {
      setStage('review');
    }
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
      if (data.success) {
        setSuccessInfo({
          folderName: data.folderName || userName,
          totalSaved: data.totalSaved || capturedImages.length,
          folderUrl: data.folderUrl,
        });
        setStage('success');
      } else {
        alert(`เกิดข้อผิดพลาด: ${data.message || 'ไม่ทราบสาเหตุ'}`);
        setStage('review');
      }
    } catch (err: any) {
      alert(`ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้: ${err.message}`);
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
            <p className="text-xs text-slate-500">face-api.js + Google Drive</p>
          </div>
        </div>
        {stage === 'camera' && (
          <div className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
            ท่าที่ {currentPoseIndex + 1} / {POSES.length}
          </div>
        )}
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 w-full max-w-md mx-auto p-4 flex flex-col justify-center">
        {/* 1. INTRO STAGE */}
        {stage === 'intro' && (
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center space-y-5">
            <div className="w-16 h-16 mx-auto bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
              📸
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">ลงทะเบียนเก็บภาพใบหน้า</h2>
              <p className="text-sm text-slate-500 mt-1">
                ระบบขับเคลื่อนด้วย <b>face-api.js</b> เพื่อช่วยตรวจจับท่าทางและบันทึกภาพลง Google Drive
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

            <div className="bg-blue-50/70 p-3.5 rounded-xl text-left text-xs text-blue-900 space-y-1 border border-blue-100">
              <p className="font-semibold">💡 จุดเด่นระบบใหม่ (face-api.js):</p>
              <p>• มี AI ตรวจจับใบหน้าและรอยยิ้มแบบ Real-time บนหน้าจอ</p>
              <p>• หน้าจอเปิดพื้นหลังสีขาวเพื่อช่วยส่องแสงสว่างให้ใบหน้า</p>
              <p>• บันทึกภาพดิบ 12 ท่าทางตรงเข้า Google Drive ของคุณ</p>
            </div>

            <button
              onClick={handleStart}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition active:scale-[0.98]"
            >
              เริ่มเปิดกล้องถ่ายภาพ ➜
            </button>
          </section>
        )}

        {/* 2. CAMERA STAGE */}
        {stage === 'camera' && (
          <section className="flex flex-col items-center space-y-4">
            {/* Progress Bar */}
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${((currentPoseIndex + 1) / POSES.length) * 100}%` }}
              />
            </div>

            {/* Instruction Card */}
            <div className="w-full bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-center">
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
              {!tempSnapshot && (
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
              )}

              {/* Oval Guide (เปลี่ยนเป็นสีเขียวเมื่อตรวจพบหน้า) */}
              {!tempSnapshot && (
                <div
                  className="absolute pointer-events-none transition-colors duration-300"
                  style={{
                    width: '62%',
                    height: '72%',
                    border: faceDetected ? '3px solid rgba(16, 185, 129, 0.95)' : '3px dashed rgba(59, 130, 246, 0.85)',
                    borderRadius: '50% / 50%',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.22)',
                  }}
                />
              )}

              {/* Flash effect */}
              {flash && <div className="absolute inset-0 bg-white pointer-events-none transition-opacity duration-200 opacity-90" />}

              {/* Captured snapshot preview */}
              {tempSnapshot && (
                <img src={tempSnapshot} alt="Preview" className="absolute inset-0 w-full h-full object-cover z-10" />
              )}
            </div>

            {/* Controls */}
            <div className="w-full flex items-center justify-center space-x-3 pt-1">
              {!tempSnapshot ? (
                <div className="w-full flex items-center justify-between px-2">
                  {currentPose.skippable ? (
                    <button onClick={skipPose} className="text-xs font-semibold text-slate-400 hover:text-slate-600 py-2 px-3 rounded-lg">
                      ข้ามท่านี้
                    </button>
                  ) : (
                    <div className="w-16" />
                  )}

                  <button
                    onClick={takeSnapshot}
                    className={`w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white text-2xl active:scale-95 transition ${
                      faceDetected ? 'bg-emerald-600 hover:bg-emerald-700 ring-4 ring-emerald-300/60' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    📷
                  </button>

                  <button onClick={switchCamera} className="text-xs font-semibold text-slate-500 hover:text-slate-700 py-2 px-3 rounded-lg flex items-center space-x-1">
                    <span>🔄 สลับกล้อง</span>
                  </button>
                </div>
              ) : (
                <div className="w-full flex items-center space-x-3">
                  <button
                    onClick={retakeSnapshot}
                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition"
                  >
                    🔄 ถ่ายใหม่
                  </button>
                  <button
                    onClick={confirmSnapshot}
                    className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition"
                  >
                    ใช้รูปนี้ & ถัดไป ➜
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 3. REVIEW ALL STAGE */}
        {stage === 'review' && (
          <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
            <div>
              <span className="text-3xl">🎉</span>
              <h2 className="text-lg font-bold text-slate-900 mt-1">ถ่ายภาพครบทุกท่าเรียบร้อย!</h2>
              <p className="text-xs text-slate-500">ตรวจสอบรูปภาพของคุณก่อนกดส่งเข้า Google Drive</p>
            </div>

            <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
              {capturedImages.map((img, i) => (
                <div key={i} className="relative aspect-square bg-slate-200 rounded-lg overflow-hidden border border-slate-300">
                  <img src={img.base64Data} alt={img.title} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] p-1 truncate text-center">
                    {img.title}
                  </div>
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
                }}
                className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
              >
                ถ่ายใหม่ทั้งหมด
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
