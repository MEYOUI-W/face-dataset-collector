/**
 * ระบบลงทะเบียนและบันทึกภาพใบหน้าสำหรับสร้าง Dataset (Google Apps Script)
 * บันทึกรูปภาพแยกโฟลเดอร์ตามชื่อผู้ใช้ลงใน Google Drive อัตโนมัติ
 */

// ชื่อโฟลเดอร์หลักใน Google Drive ที่จะใช้เก็บ Dataset ทั้งหมด
const ROOT_FOLDER_NAME = "Face_Dataset";

/**
 * ฟังก์ชันหลักสำหรับเปิดหน้าเว็บ
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("ระบบบันทึกภาพใบหน้าสำหรับสร้าง Dataset")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * รองรับการส่งภาพจากหน้าเว็บภายนอก (Direct POST) เข้า Google Drive
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const result = uploadFaceDataset(payload);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * รับภาพและข้อมูลจากหน้าเว็บ แล้วบันทึกลง Google Drive
 * @param {Object} payload { userName: string, userId: string, images: Array<{ poseName: string, base64Data: string }> }
 */
function uploadFaceDataset(payload) {
  try {
    if (!payload || !payload.userName || !payload.images || payload.images.length === 0) {
      throw new Error("ข้อมูลไม่ครบถ้วน กรุณากรอกชื่อและถ่ายภาพให้ครบ");
    }

    const userName = sanitizeName(payload.userName);
    const userId = payload.userId ? sanitizeName(payload.userId) : "";
    const folderLabel = userId ? `${userId}_${userName}` : userName;

    // 1. หาหรือสร้างโฟลเดอร์หลัก Face_Dataset
    const rootFolder = getOrCreateFolder(DriveApp.getRootFolder(), ROOT_FOLDER_NAME);

    // 2. สร้างโฟลเดอร์ย่อยเฉพาะของแต่ละคน (พร้อม Timestamp ป้องกันการเขียนทับ)
    const timestampStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd_HHmmss");
    const userFolderName = `${folderLabel}_${timestampStr}`;
    const userFolder = rootFolder.createFolder(userFolderName);

    // 3. บันทึกไฟล์ภาพแต่ละท่าทาง
    const savedFiles = [];
    payload.images.forEach((item, index) => {
      if (!item.base64Data) return;
      
      // แปลง base64 เป็น Blob
      const base64Data = item.base64Data.replace(/^data:image\/(jpeg|png);base64,/, "");
      const decodedBytes = Utilities.base64Decode(base64Data);
      const fileName = `${item.poseName || "pose_" + (index + 1)}.jpg`;
      
      const blob = Utilities.newBlob(decodedBytes, "image/jpeg", fileName);
      const file = userFolder.createFile(blob);
      savedFiles.push({
        fileName: fileName,
        fileId: file.getId(),
        fileUrl: file.getUrl()
      });
    });

    // 4. บันทึก metadata.json กำกับไว้ในโฟลเดอร์
    const metadata = {
      userName: payload.userName,
      userId: payload.userId || "",
      capturedAt: new Date().toISOString(),
      timeZone: "Asia/Bangkok",
      totalImages: savedFiles.length,
      files: savedFiles,
      deviceInfo: payload.deviceInfo || "Unknown"
    };
    userFolder.createFile("metadata.json", JSON.stringify(metadata, null, 2), "application/json");

    return {
      success: true,
      message: "บันทึกภาพทั้งหมดลง Google Drive สำเร็จเรียบร้อย",
      folderName: userFolderName,
      folderUrl: userFolder.getUrl(),
      totalSaved: savedFiles.length
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "เกิดข้อผิดพลาดในการบันทึกภาพ"
    };
  }
}

/**
 * ค้นหาโฟลเดอร์ ถ้ายังไม่มีให้สร้างใหม่
 */
function getOrCreateFolder(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(folderName);
}

/**
 * ตัดอักขระพิเศษออกจากชื่อโฟลเดอร์
 */
function sanitizeName(str) {
  return str.replace(/[\\/:*?"<>|]/g, "_").trim();
}
