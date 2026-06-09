"use client";

import { useState } from "react";
import {
  LIDAR_MODELS,
  DETECTION,
  getModel,
  groundCoverage,
  pointSpacing,
} from "@/lib/lidarModels";
import { LidarVisual } from "@/components/SideView";
import { MiniScene } from "@/components/MiniScene";

function Slider({ label, val, unit, min, max, step, onChange }: { label: string; val: number; unit: string; min: number; max: number; step: number; onChange: (v: number) => void; }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-300">{label}</span>
        <span className="text-xs font-mono text-sky-300">{val.toFixed(step < 1 ? 1 : 0)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-sky-400" />
    </label>
  );
}

function Card({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#0d1726] p-5">
      <h2 className="text-base font-bold text-sky-300 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Diagram({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <div className="rounded-lg overflow-hidden">
      {children}
      <p className="text-[11px] text-slate-400 leading-snug mt-1.5 px-1">{caption}</p>
    </div>
  );
}

export default function LogicPage() {
  const [modelId, setModelId] = useState(LIDAR_MODELS[0].id);
  const model = getModel(modelId);
  const [H, setH] = useState(4.5);
  const [tilt, setTilt] = useState(12);
  const [fov, setFov] = useState(Math.min(30, model.vfov));
  const [range, setRange] = useState(Math.min(35, model.maxRange));

  const pickModel = (id: string) => {
    const md = getModel(id);
    setModelId(id);
    setFov((v) => Math.min(v, md.vfov));
    setRange((r) => Math.min(Math.max(r, Math.ceil(md.minRange)), md.maxRange));
    setH((h) => Math.max(h, md.recMount[0]));
  };

  const cov = groundCoverage(H, tilt, fov, range);
  const spacingFar = pointSpacing(isFinite(cov.far) ? cov.far : range, fov, model.vLines);
  const spacingOk = spacingFar <= DETECTION.MAX_POINT_SPACING;
  const mountOk = H >= model.recMount[0] && H <= model.recMount[1];
  const verdict = spacingOk && mountOk ? "ผ่าน" : spacingOk || mountOk ? "ควรปรับ" : "ไม่เหมาะ";
  const verdictColor = verdict === "ผ่าน" ? "#22c55e" : verdict === "ควรปรับ" ? "#f59e0b" : "#ef4444";

  // ฉากสาธิตสดในตัวตรวจเช็ค: รถใกล้ + รถเตี้ยหลังรถสูง + รถไกล
  const demoObjs = [
    { x: 7, h: 1.5, label: "เก๋ง" as const },
    { x: 13, h: 2.0, label: "รถตู้" as const },
    { x: 18, h: 1.4, target: true },
  ];

  return (
    <div className="min-h-screen text-slate-200">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-white/10 bg-[#0d1726]/80 backdrop-blur sticky top-0 z-10">
        <a href="/" className="text-xs px-3 py-1.5 rounded-md bg-[#13243c] border border-white/10 text-slate-200 hover:bg-[#1a2f4d]">← กลับแดชบอร์ด</a>
        <div className="font-bold text-sm text-white">Logic การตรวจจับ & ขีดจำกัดเครื่องมือ LiDAR</div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6 space-y-6">
        <p className="text-sm text-slate-400">หน้านี้ใช้ไดอะแกรม “ยิงรังสีจริง” ให้เห็นว่าทำไมแต่ละมุมถึงเห็น/ไม่เห็น — <span className="text-slate-300">จุดสว่าง = จุดที่ LiDAR ได้รับกลับ (point cloud) · ช่วงที่ไม่มีจุด = เงา/จุดบอด</span></p>

        {/* 1 */}
        <Card title="1) LiDAR รู้ได้ยังไงว่าตรงไหนคือ “ช่องจอด”?">
          <div className="grid md:grid-cols-2 gap-4 items-center">
            <Diagram caption="ช่องจอด (กรอบเส้นประ) ถูกกำหนดเป็น “โซน” ตอนติดตั้งครั้งเดียว แล้ว LiDAR คอยดูจุดที่ตกในแต่ละโซน — ตัวเซนเซอร์ให้แค่จุด 3 มิติ ไม่รู้ความหมายเอง">
              <MiniScene H={4} tilt={14} fov={34} range={28} zones={[{ x0: 6, x1: 10, label: "ช่อง 1" }, { x0: 12, x1: 16, label: "ช่อง 2" }, { x0: 18, x1: 22, label: "ช่อง 3" }]} />
            </Diagram>
            <p className="text-sm leading-relaxed text-slate-300">
              ตัว LiDAR ส่งออกแค่ <b className="text-white">กลุ่มจุด 3 มิติ (point cloud)</b> ที่บอกระยะ+ความสูง
              ระบบ “รู้” ว่าโซนไหนคือช่อง 1, 2, 3… เพราะตอนติดตั้งมีการ <b className="text-white">วาดขอบเขตช่องจอด (ROI)</b> ลงไปเทียบกับตำแหน่ง/ความสูงของเซนเซอร์
              จากนั้นแค่เฝ้าดูว่าจุดที่ตกในแต่ละโซนเป็น “พื้น” หรือ “รถ”
            </p>
          </div>
        </Card>

        {/* 2 */}
        <Card title="2) ตัดสิน “ว่าง / เต็ม” อย่างไร?">
          <div className="grid md:grid-cols-2 gap-4">
            <Diagram caption="ช่องว่าง: จุดทั้งหมดอยู่ระดับพื้น (สูง ≈ 0) → ระบบสรุปว่า ‘ว่าง’ (เส้นเขียวคือจุดบนพื้น)">
              <MiniScene H={4} tilt={16} fov={30} range={22} zones={[{ x0: 8, x1: 12, label: "ว่าง" }]} />
            </Diagram>
            <Diagram caption="ช่องมีรถ: เกิดกลุ่มจุดยกตัวสูงเกินเกณฑ์ 0.3 m (จุดขาวบนตัวรถ) ขนาดเท่ารถ → สรุปว่า ‘เต็ม’">
              <MiniScene H={4} tilt={16} fov={30} range={22} objs={[{ x: 10, h: 1.6, target: true }]} />
            </Diagram>
          </div>
          <p className="text-sm leading-relaxed text-slate-300 mt-3">
            หัวใจคือดู <b className="text-white">ความสูงของจุดเหนือพื้น</b> ในโซน: รถทำให้เกิดกลุ่มจุดยกขึ้นมา ส่วนช่องว่างเห็นเพียงระนาบพื้นเรียบ ๆ
            ถ้าในโซนมีจุดน้อยกว่า <b>{DETECTION.MIN_POINTS}</b> จุด ถือว่าข้อมูลไม่พอ → เป็น “จุดบอด”
          </p>
        </Card>

        {/* 3 */}
        <Card title="3) “จุดบอด” เกิดได้ 4 แบบ — ดูภาพประกอบ">
          <div className="grid md:grid-cols-2 gap-4">
            <Diagram caption="ก) ถูกบดบัง: รถตู้สูงบังเส้นสายตา (เส้นเหลือง) รถเตี้ยข้างหลังตกอยู่ในเงา ไม่มีจุดไปถึง → มองไม่เห็น">
              <MiniScene H={3} tilt={9} fov={28} range={26} grazeIndex={1} objs={[{ x: 7, h: 1.5, label: "เก๋ง" }, { x: 12, h: 2.05, label: "รถตู้" }, { x: 17, h: 1.4, target: true }]} />
            </Diagram>
            <Diagram caption="ข) ใกล้เกินไป: ติดสูง+ก้มน้อย ลำแสงขอบล่างพุ่งข้ามหัวรถคันใกล้ รถจึงหลุดใต้ลำแสง → มองไม่เห็น">
              <MiniScene H={6} tilt={4} fov={20} range={34} objs={[{ x: 4, h: 1.5, target: true }, { x: 22, h: 1.6, label: "เก๋ง" }]} />
            </Diagram>
            <Diagram caption="ค) เกินระยะ: รถอยู่ไกลกว่าระยะตรวจจับของรุ่น (15 m) ลำแสงไปไม่ถึง → ไม่มีจุด">
              <MiniScene H={4} tilt={12} fov={30} range={15} xMax={26} objs={[{ x: 21, h: 1.6, target: true }]} />
            </Diagram>
            <Diagram caption="ง) จุดห่างที่ระยะไกล: ยิ่งไกล จุดยิ่งห่างกัน (สังเกตจุดบนรถไกลห่างกว่า) ถ้าห่างเกินไปได้จุดไม่พอจะยืนยัน">
              <MiniScene H={4.5} tilt={8} fov={24} range={45} objs={[{ x: 10, h: 1.6, label: "ใกล้" }, { x: 38, h: 1.6, target: true }]} />
            </Diagram>
          </div>
        </Card>

        {/* 4 */}
        <Card title="4) สูตรการคำนวณ (ดูตำแหน่งบนภาพ)">
          <div className="grid md:grid-cols-2 gap-4 items-center">
            <Diagram caption="x_near / x_far คือขอบโซนที่ลำแสงแตะพื้น · เงาหลังรถสูงยาว = d·H/(H−h) → ยกเสาสูง (H มาก) เงาสั้นลง รถข้างหลังจึงพ้นเงา">
              <MiniScene H={4.5} tilt={12} fov={30} range={30} grazeIndex={0} objs={[{ x: 10, h: 1.9, label: "รถสูง" }, { x: 16, h: 1.4, target: true }]} />
            </Diagram>
            <div className="space-y-2 text-sm text-slate-300 font-mono bg-[#0a1322] rounded-lg p-3 border border-white/10">
              <div>จุดตกพื้น: <span className="text-sky-300">x = H / tan(θ)</span></div>
              <div>โซนใกล้สุด: <span className="text-sky-300">H / tan(tilt + FOV/2)</span></div>
              <div>โซนไกลสุด: <span className="text-sky-300">H / tan(tilt − FOV/2)</span></div>
              <div>ปลายเงาหลังรถสูง h: <span className="text-sky-300">d · H / (H − h)</span></div>
              <div>ระยะห่างจุดที่ r: <span className="text-sky-300">r · (FOV / ชั้น)</span></div>
            </div>
          </div>
        </Card>

        {/* 5 — ตัวจำลองสด */}
        <section className="rounded-xl border border-sky-400/30 bg-[#0d1726] p-5">
          <h2 className="text-base font-bold text-sky-300 mb-1">5) ตัวจำลองสด — “แคปมุมนี้” แล้วดูว่าทำไมเห็น/ไม่เห็น</h2>
          <p className="text-xs text-slate-400 mb-3">เลือกรุ่น + ปรับความสูง/มุม แล้วดูภาพจำลองด้านล่างอัปเดตทันที (รถคันที่ 3 เป็นตัวทดสอบ ‘เห็น/ไม่เห็น’)</p>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <select value={modelId} onChange={(e) => pickModel(e.target.value)} className="w-full bg-[#13243c] border border-white/10 rounded-md text-sm px-2 py-2 text-white">
                {LIDAR_MODELS.map((md) => (<option key={md.id} value={md.id}>{md.brand} {md.model} — {md.tier}</option>))}
              </select>
              <Slider label="ความสูงติดตั้ง" val={H} unit=" m" min={2} max={Math.max(12, model.recMount[1] + 2)} step={0.1} onChange={setH} />
              <Slider label="องศาก้ม (tilt)" val={tilt} unit="°" min={0} max={45} step={1} onChange={setTilt} />
              <Slider label={`มุมเปิดแนวตั้ง (เพดาน ${model.vfov}°)`} val={fov} unit="°" min={8} max={model.vfov} step={1} onChange={(v) => setFov(Math.min(v, model.vfov))} />
              <Slider label={`ระยะตรวจจับ (เพดาน ${model.maxRange} m)`} val={range} unit=" m" min={Math.max(10, Math.ceil(model.minRange))} max={model.maxRange} step={1} onChange={(v) => setRange(Math.min(v, model.maxRange))} />
            </div>

            <div className="space-y-2">
              <MiniScene H={parseFloat(H.toFixed(1))} tilt={tilt} fov={fov} range={range} grazeIndex={1} objs={demoObjs} width={420} height={210} />
              <div className="rounded-lg p-2.5 flex items-center justify-between" style={{ background: `${verdictColor}1f`, border: `1px solid ${verdictColor}` }}>
                <span className="text-sm text-slate-300">ผลประเมินรุ่น {model.model}</span>
                <span className="text-lg font-bold" style={{ color: verdictColor }}>{verdict}</span>
              </div>
              <div className="rounded-lg bg-[#0a1322] border border-white/10 p-3 text-sm space-y-1.5">
                <Row k="โซนพื้นที่เห็น" v={`${isFinite(cov.near) ? cov.near.toFixed(1) : "0"} – ${isFinite(cov.far) ? cov.far.toFixed(1) : "∞"} m`} />
                <Row k="ระยะห่างจุดที่ขอบไกล" v={`${spacingFar.toFixed(2)} m`} ok={spacingOk} />
                <Row k="ความสูงติดตั้งแนะนำ" v={`${model.recMount[0]}–${model.recMount[1]} m`} ok={mountOk} />
              </div>
              <ul className="text-[12px] text-slate-300 space-y-1 leading-snug">
                {!mountOk && <li className="text-amber-300">• ความสูง {H.toFixed(1)} m นอกช่วงแนะนำของรุ่น ({model.recMount[0]}–{model.recMount[1]} m)</li>}
                {!spacingOk && <li className="text-amber-300">• ขอบไกลจุดห่าง {spacingFar.toFixed(2)} m (&gt; {DETECTION.MAX_POINT_SPACING} m) — รถไกลอาจได้จุดไม่พอ</li>}
                {isFinite(cov.near) && cov.near > 6 && <li className="text-amber-300">• โซนใกล้เริ่มที่ {cov.near.toFixed(1)} m — ใต้เสาเป็นจุดบอด เพิ่ม tilt/FOV</li>}
                {verdict === "ผ่าน" && <li className="text-emerald-300">• ตั้งค่าอยู่ในขีดจำกัดของรุ่นและจุดหนาแน่นพอ ✓</li>}
              </ul>
            </div>
          </div>
        </section>

        {/* 6 — ตาราง */}
        <Card title="6) ตารางขีดจำกัดของแต่ละรุ่น">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-white/10">
                  <th className="text-left py-2 px-2">รุ่น</th>
                  <th className="text-right py-2 px-2">ชั้น</th>
                  <th className="text-right py-2 px-2">ระยะสูงสุด</th>
                  <th className="text-right py-2 px-2">ใกล้สุด</th>
                  <th className="text-right py-2 px-2">vFOV</th>
                  <th className="text-right py-2 px-2">จุด/วิ</th>
                  <th className="text-right py-2 px-2">ติดตั้ง</th>
                  <th className="text-left py-2 px-2">เหมาะกับ</th>
                </tr>
              </thead>
              <tbody>
                {LIDAR_MODELS.map((md) => (
                  <tr key={md.id} className={`border-b border-white/5 ${md.id === modelId ? "bg-sky-500/10" : ""}`}>
                    <td className="py-2 px-2"><div className="flex items-center gap-2"><div className="shrink-0 rounded bg-[#0e1c30] p-0.5"><LidarVisual model={md} size={34} /></div><div><div className="font-semibold text-white">{md.brand} {md.model}</div><div className="text-[10px] text-slate-500">{md.tier}</div></div></div></td>
                    <td className="text-right px-2 font-mono">{md.channels || "—"}</td>
                    <td className="text-right px-2 font-mono text-sky-300">{md.maxRange} m</td>
                    <td className="text-right px-2 font-mono">{md.minRange} m</td>
                    <td className="text-right px-2 font-mono">{md.vfov}°</td>
                    <td className="text-right px-2 font-mono">{(md.ptsPerSec / 1000).toFixed(0)}k</td>
                    <td className="text-right px-2 font-mono">{md.recMount[0]}–{md.recMount[1]} m</td>
                    <td className="px-2 text-slate-400 max-w-[220px]">{md.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">หมายเหตุ: ระยะจริงขึ้นกับการสะท้อนแสง — รถสีเข้ม (~10%) ตรวจได้ใกล้กว่าค่าโฆษณา (มักวัดที่ 80%) · ตัวเลขอ้างอิงสเปกผู้ผลิตเพื่อออกแบบ/เทียบรุ่น</p>
        </Card>
      </main>
    </div>
  );
}

function Row({ k, v, ok }: { k: string; v: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{k}</span>
      <span className={`font-mono ${ok === undefined ? "text-slate-200" : ok ? "text-emerald-300" : "text-amber-300"}`}>{v}{ok === false ? " ⚠" : ok ? " ✓" : ""}</span>
    </div>
  );
}
