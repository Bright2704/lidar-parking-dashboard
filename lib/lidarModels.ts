// ---- ข้อมูลรุ่น LiDAR จริง + ขีดจำกัด (ใช้ร่วมกันระหว่างซิมและหน้า Logic) ----
// ตัวเลขอ้างอิงจากสเปกผู้ผลิต (ดูแหล่งอ้างอิงในหน้า Logic)

export interface LidarModel {
  id: string;
  brand: string;
  model: string;
  tier: string; // ป้ายระดับ (ไทย)
  channels: number; // จำนวนชั้นเลเซอร์ (0 = non-repetitive)
  vLines: number; // เส้นแนวตั้งสำหรับประมาณความหนาแน่นจุด
  maxRange: number; // ระยะตรวจจับสูงสุด (m) — ใช้เป็นเพดานสไลเดอร์
  minRange: number; // ระยะใกล้สุด (m)
  vfov: number; // มุมเปิดแนวตั้งสูงสุด (°) — ใช้เป็นเพดานสไลเดอร์
  ptsPerSec: number; // จุดต่อวินาที (โดยประมาณ)
  recMount: [number, number]; // ความสูงติดตั้งแนะนำ (m)
  note: string;
  source: string;
  formFactor: "spinning" | "dome"; // ฟอร์มตัวเครื่องสำหรับวาด illustration
  imageUrl?: string; // รูปถ่ายจริง (ถ้ามี) — วางไฟล์ที่ public/lidar/<id>.jpg
}

export const LIDAR_MODELS: LidarModel[] = [
  {
    id: "velodyne-vlp16",
    brand: "Velodyne",
    model: "Puck (VLP-16)",
    tier: "เริ่มต้น · 16 ชั้น",
    channels: 16,
    vLines: 16,
    maxRange: 100,
    minRange: 0.5,
    vfov: 30, // ±15°
    ptsPerSec: 300000,
    recMount: [3, 6],
    note: "ลานเล็ก-กลาง 360° แนวนอน · ความละเอียดแนวตั้งหยาบ (~2°/ชั้น) ช่องไกลอาจได้จุดน้อย",
    source: "Velodyne VLP-16 datasheet",
    formFactor: "spinning",
  },
  {
    id: "hesai-xt32",
    brand: "Hesai",
    model: "Pandar XT32",
    tier: "กลาง · 32 ชั้น",
    channels: 32,
    vLines: 32,
    maxRange: 120,
    minRange: 0.05,
    vfov: 31,
    ptsPerSec: 640000,
    recMount: [4, 8],
    note: "ความละเอียดสูง (~1°/ชั้น) · ระยะใกล้สุดเกือบ 0 m เหมาะติดในร่ม/ทางเข้า",
    source: "Hesai PandarXT32 spec",
    formFactor: "spinning",
  },
  {
    id: "ouster-os0-128",
    brand: "Ouster",
    model: "OS0-128",
    tier: "มุมกว้างพิเศษ · 128 ชั้น",
    channels: 128,
    vLines: 128,
    maxRange: 50,
    minRange: 0.3,
    vfov: 90,
    ptsPerSec: 2621440,
    recMount: [3, 6],
    note: "vFOV กว้าง 90° เห็นโซนใกล้ใต้เสาได้ดีมาก เหมาะในร่ม/เพดานต่ำ · แต่ระยะสั้น (~50 m)",
    source: "Ouster OS0 datasheet",
    formFactor: "spinning",
  },
  {
    id: "ouster-os1-128",
    brand: "Ouster",
    model: "OS1-128",
    tier: "กลาง-ไกล · 128 ชั้น",
    channels: 128,
    vLines: 128,
    maxRange: 120, // สูงสุดตามสเปก ~200 m, ใช้งานจริง ~120 m
    minRange: 0.3,
    vfov: 45, // 42.4°
    ptsPerSec: 2621440,
    recMount: [5, 10],
    note: "สมดุลระยะ-ความละเอียด (สเปกสูงสุด 200 m) · ตัวเลือกอเนกประสงค์",
    source: "Ouster OS1 datasheet",
    formFactor: "spinning",
  },
  {
    id: "ouster-os2-128",
    brand: "Ouster",
    model: "OS2-128",
    tier: "ระยะไกล · 128 ชั้น",
    channels: 128,
    vLines: 128,
    maxRange: 240,
    minRange: 1,
    vfov: 22.5,
    ptsPerSec: 2621440,
    recMount: [6, 12],
    note: "ระยะไกลมากแต่ vFOV แคบ (22.5°) ต้องติดสูงและเล็งดี เหมาะลานกว้างกลางแจ้ง",
    source: "Ouster OS2 datasheet",
    formFactor: "spinning",
  },
  {
    id: "livox-mid360",
    brand: "Livox",
    model: "Mid-360",
    tier: "ประหยัด · non-repetitive",
    channels: 0,
    vLines: 40, // ประมาณการสำหรับคำนวณความหนาแน่น (สแกนแบบ non-repetitive)
    maxRange: 70, // 70 m ที่ผิวสะท้อน 80%, ~40 m ที่ 10%
    minRange: 0.1,
    vfov: 59, // -7°..+52°
    ptsPerSec: 200000,
    recMount: [2.5, 5],
    note: "ราคาประหยัด · ระยะจริง ~40 m กับรถสีเข้ม (สะท้อน 10%) · vFOV เอียง -7°..+52°",
    source: "Livox Mid-360 spec",
    formFactor: "dome",
  },
];

export const DETECTION = {
  HEIGHT_THRESHOLD: 0.3, // m — จุดสูงกว่าพื้นเกินนี้ถือว่าเป็นวัตถุ/รถ
  MIN_POINTS: 8, // จำนวนจุดขั้นต่ำในโซนที่ถือว่า "ตรวจเจอ"
  MAX_POINT_SPACING: 0.5, // m — ถ้าจุดห่างเกินนี้ที่ขอบไกล ความเชื่อมั่นต่ำ
};

export const getModel = (id: string) =>
  LIDAR_MODELS.find((m) => m.id === id) || LIDAR_MODELS[0];

// ระยะห่างจุดแนวตั้งบนพื้นโดยประมาณ ที่ระยะ r (m) — ยิ่งไกล จุดยิ่งห่าง
export function pointSpacing(r: number, vfovDeg: number, vLines: number) {
  if (vLines <= 0) return Infinity;
  const dTheta = (vfovDeg * Math.PI) / 180 / vLines; // เรเดียนต่อเส้น
  return r * dTheta;
}

// โซนพื้นที่ครอบคลุม (ไม่คิดสิ่งบดบัง) จากความสูง H, tilt, FOV
export function groundCoverage(H: number, tiltDeg: number, vfovDeg: number, maxRange: number) {
  const aBot = ((tiltDeg + vfovDeg / 2) * Math.PI) / 180;
  const aTop = ((tiltDeg - vfovDeg / 2) * Math.PI) / 180;
  const near = aBot > 1e-4 ? H / Math.tan(aBot) : Infinity;
  const far = aTop > 1e-4 ? Math.min(H / Math.tan(aTop), maxRange) : maxRange;
  return { near, far };
}
