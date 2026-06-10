"use client";

import { useState } from "react";
import { LIDAR_MODELS, getModel } from "@/lib/lidarModels";
import {
  IconLiDAR, IconEdge, IconSwitch, IconServer, IconCloud, IconCamera,
  IconSign, IconGate, IconKiosk, IconMonitor, IconMobile, IconUPS,
  IconPoleTop, IconCarTop, IconAnalytics, IconReport, IconBMS,
  IconZoneOcc, IconCountLine, IconNoPark, IconFlow,
} from "@/components/DeviceIcons";
import SiteTopologyEditor from "@/components/SiteTopologyEditor";
import NavDrawer from "@/components/NavDrawer";

const PANEL = "#252526";
const CARD = "#1a1a1a";
const INPUT = "#2d2d30";

/* ===== แหล่งอ้างอิง / Research ===== */
const REFS: { n: number; title: string; url: string; used: string }[] = [
  { n: 1, title: "Ouster OS0/OS1/OS2 — Overview & Datasheets", url: "https://ouster.com/os-overview", used: "สเปก LiDAR Ouster: ระยะ (50/120–200/240 m), vFOV (90/45/22.5°), 128 ชั้น" },
  { n: 2, title: "Hesai PandarXT32 — Product page", url: "https://www.hesaitech.com/product/xt16-32-32m/", used: "สเปก Hesai XT32: 32 ชั้น, ระยะ 120 m, vFOV ~31°, 640k จุด/วิ" },
  { n: 3, title: "Velodyne Puck (VLP-16) — Datasheet", url: "https://www.mapix.com/lidar-sensors/velodyne-lidar/velodyne-vlp-16/", used: "สเปก VLP-16: 16 ชั้น, ระยะ 100 m, vFOV 30° (±15°), 300k จุด/วิ" },
  { n: 4, title: "Livox Mid-360 — Specs", url: "https://www.livoxtech.com/mid-360/specs", used: "สเปก Mid-360: vFOV 59°, ระยะ ~40 m@10% / 70 m@80%, ใกล้สุด 0.1 m" },
  { n: 5, title: "NVIDIA Jetson Orin NX — Module Datasheet", url: "https://developer.nvidia.com/downloads/jetson-orin-nx-module-series-data-sheet", used: "Edge compute: สูงสุด 100–157 TOPS, กำลังไฟ 10–40W (เลือกเป็นตัวประมวล point cloud)" },
  { n: 6, title: "NVIDIA — Accelerating LiDAR with CUDA-based PCL", url: "https://developer.nvidia.com/blog/accelerating-lidar-for-robotics-with-cuda-based-pcl/", used: "วิธีประมวล point cloud บน Jetson (CUDA-PCL: filter/segmentation/ICP)" },
  { n: 7, title: "IEEE 802.3bt (PoE++) — Power over Ethernet", url: "https://en.wikipedia.org/wiki/Power_over_Ethernet", used: "มาตรฐานจ่ายไฟผ่านสาย LAN: Type 4 จ่าย 90W ที่ต้นทาง / 71.3W ที่อุปกรณ์" },
  { n: 8, title: "Smart Parking Architecture (LoRaWAN/MQTT, edge-cloud) — MDPI Appl. Sci.", url: "https://www.mdpi.com/2076-3417/10/13/4674", used: "สถาปัตยกรรมหลายชั้น sensor→edge→cloud และโปรโตคอล MQTT pub/sub" },
  { n: 9, title: "Ouster Gemini — AI Lidar Perception Software", url: "https://ouster.com/products/software/gemini", used: "Gemini: ตรวจ/ติดตามระดับ cm, รวมหลายเซนเซอร์, custom zones, WebGUI, OTA, cloud portal, รันบน Jetson AGX Orin/Orin NX (TensorRT)" },
  { n: 10, title: "Ouster BlueCity — AI-Driven Lidar Solution", url: "https://ouster.com/products/software/bluecity", used: "BlueCity: LiDAR + edge processor สำหรับลานจอด/แยก/ทางเดิน ตรวจจับ-จำแนกผู้ใช้ถนนแบบเรียลไทม์" },
];
const modelRef: Record<string, number> = { ouster: 1, hesai: 2, velodyne: 3, livox: 4 };

function Ref({ n }: { n: number }) {
  return <a href={`#ref-${n}`} className="text-sky-400 text-[9px] align-super hover:underline">[{n}]</a>;
}
function NumIn({ label, val, set, min = 0, max = 999, sub }: { label: string; val: number; set: (v: number) => void; min?: number; max?: number; sub?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-slate-400">{label}</span>
      <input type="number" min={min} max={max} value={val} onChange={(e) => set(Math.max(min, Math.min(max, parseInt(e.target.value) || 0)))} className="w-full border border-white/10 rounded-md text-sm px-2 py-1.5 text-white font-mono focus:outline-none focus:ring-1 focus:ring-sky-400" style={{ background: INPUT }} />
      {sub && <span className="text-[9px] text-slate-500">{sub}</span>}
    </label>
  );
}
function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (<label className="flex items-center gap-1.5 text-[12px] text-slate-300 cursor-pointer"><input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="accent-sky-400" /> {label}</label>);
}
function Card({ title, children, sub }: { title: string; children: React.ReactNode; sub?: string }) {
  return (<section className="rounded-xl border border-white/10 p-5" style={{ background: PANEL }}><h2 className="text-base font-bold text-sky-300 mb-0.5">{title}</h2>{sub && <p className="text-[12px] text-slate-400 mb-3">{sub}</p>}{!sub && <div className="mb-3" />}{children}</section>);
}

type Row = { item: string; qty: string; purpose: string; example: string; ref?: number[] };
type Group = { name: string; color: string; rows: Row[] };

export default function TopologyPage() {
  const [spots, setSpots] = useState(120);
  const [zOut, setZOut] = useState(3);
  const [zIn, setZIn] = useState(2);
  const [entr, setEntr] = useState(2);
  const [modelId, setModelId] = useState("ouster-os1-128");
  const [onprem, setOnprem] = useState(true);
  const [cloud, setCloud] = useState(true);
  const [signage, setSignage] = useState(true);
  const [gates, setGates] = useState(true);
  const [anpr, setAnpr] = useState(true);
  const [vms, setVms] = useState(true);
  const [spotLights, setSpotLights] = useState(false);

  const model = getModel(modelId);
  const mref = modelRef[model.brand.toLowerCase().split(" ")[0]] ?? 1;
  const zones = zOut + zIn;
  const sensors = zones;
  const spares = Math.max(1, Math.ceil(sensors * 0.1));
  const edgeUnits = Math.max(1, Math.ceil(zones / 2));
  const cameras = anpr ? entr * 2 : 0;
  const signs = signage ? zones + 1 : 0;
  const gateUnits = gates ? entr * 2 : 0;
  const kiosks = anpr ? entr : 0;
  const lights = spotLights ? spots : 0;
  const poeNodes = sensors + cameras + signs;
  const switches = Math.max(1, Math.ceil(poeNodes / 8));
  const fiberRuns = zOut + (zIn > 2 ? 1 : 0);
  const cat6a = sensors * 40 + cameras * 30 + signs * 25;
  const fiberM = fiberRuns * 150;
  const ups = switches + (onprem ? 1 : 0);

  const groups: Group[] = [
    { name: "1 · ชั้นเซนเซอร์ (Sensing)", color: "#38bdf8", rows: [
      { item: `LiDAR ${model.brand} ${model.model}`, qty: `${sensors} (+สำรอง ${spares})`, purpose: "สแกน point cloud ตรวจช่องว่าง/มีรถ 1 ตัว/โซน", example: `ระยะ ${model.maxRange}m · vFOV ${model.vfov}° · ${model.channels || "non-rep"} ชั้น`, ref: [mref] },
      { item: "เสา 4–6 m / ขายึดเพดาน", qty: `${zOut} ต้น · ${zIn} ชุด`, purpose: "ยกเซนเซอร์ให้พ้นหลังคารถ ลดจุดบอด", example: "เสาเหล็กกัลวาไนซ์ + ฐานคอนกรีต / ceiling mount" },
      { item: "กล่อง IP67 + ที่บังแดด", qty: `${zOut} ชุด`, purpose: "กันฝน/แดด/ฝุ่น จุดกลางแจ้ง", example: "Enclosure IP67 + sunshade + ซิลิกาเจล" },
      { item: "กล้อง ANPR เข้า-ออก", qty: cameras ? `${cameras} ตัว` : "—", purpose: "อ่านป้ายทะเบียน คู่ไม้กั้น/จ่ายเงิน", example: cameras ? "ANPR IR 1080p + เลนส์ varifocal" : "ปิด" },
    ]},
    { name: "2 · Edge Compute", color: "#a78bfa", rows: [
      { item: "NVIDIA Jetson Orin NX/AGX", qty: `${edgeUnits} เครื่อง`, purpose: "ประมวล point cloud (CUDA-PCL) → สถานะช่อง, ส่ง MQTT", example: "Orin NX สูงสุด ~100–157 TOPS, 10–40W · รัน Ouster Gemini", ref: [5, 6, 9] },
      { item: "NVMe + ฮีตซิงก์ + ตู้ edge", qty: `${edgeUnits} ชุด`, purpose: "OS/บัฟเฟอร์ + ระบายความร้อน ใกล้เสา", example: "NVMe 256GB + พัดลม + ตู้ IP54" },
    ]},
    { name: "3 · Network", color: "#22c55e", rows: [
      { item: "สวิตช์ PoE++ 8 พอร์ต (managed)", qty: `${switches} ตัว`, purpose: `จ่ายไฟ+ข้อมูลให้ ${poeNodes} อุปกรณ์`, example: "802.3bt Type 4: 90W/พอร์ต · L2 + VLAN", ref: [7] },
      { item: "Core/Aggregation switch", qty: "1 ตัว", purpose: "รวมทราฟฟิกเข้าเซิร์ฟเวอร์ แยก VLAN", example: "L2/L3 managed + SFP+ uplink" },
      { item: "Cat6A STP / ไฟเบอร์ + SFP", qty: `~${cat6a.toLocaleString()}m / ${fiberRuns} เส้น`, purpose: "เชื่อมอุปกรณ์ใกล้ + backbone ไกล", example: `ไฟเบอร์ ~${fiberM.toLocaleString()}m single-mode` },
    ]},
    { name: "4 · Power", color: "#f59e0b", rows: [
      { item: "UPS + Surge + ตู้เบรกเกอร์", qty: `${ups} UPS`, purpose: "สำรองไฟ + กันฟ้าผ่า/ไฟกระชาก", example: "Online UPS 1–3kVA + surge AC/PoE + กราวด์" },
    ]},
    { name: "5 · Backend (On-prem + Cloud)", color: "#60a5fa", rows: [
      { item: "เซิร์ฟเวอร์ on-prem", qty: onprem ? "1 เครื่อง" : "—", purpose: "MQTT broker + DB + API + แดชบอร์ด (ทำงานต่อแม้เน็ตหลุด)", example: onprem ? "8-core, 32GB, 1TB SSD · BlueCity backend" : "ใช้ cloud", ref: [8, 10] },
      { item: "NVR/VMS server", qty: vms ? "1 เครื่อง" : "—", purpose: "บันทึก/บริหารวิดีโอ ANPR+CCTV", example: vms ? "VMS + RAID storage" : "ปิด" },
      { item: "Cloud VM + object storage", qty: cloud ? "1 VM" : "—", purpose: "ซิงก์, แอปมือถือ, รายงาน, สำรอง, OTA", example: cloud ? "4 vCPU/8GB + S3/Blob" : "on-prem อย่างเดียว" },
    ]},
    { name: "6 · Guidance / Control", color: "#f472b6", rows: [
      { item: "ป้าย LED นำทาง", qty: signs ? `${signs} ป้าย` : "—", purpose: "แสดงช่องว่างแต่ละโซน + รวมทางเข้า", example: signs ? "LED matrix + controller (MQTT/Modbus)" : "ปิด" },
      { item: "ไม้กั้น + controller", qty: gateUnits ? `${gateUnits} ชุด` : "—", purpose: "คุมเข้า-ออก เชื่อม ANPR/ตั๋ว", example: gateUnits ? "Barrier arm + relay/Modbus" : "ปิด" },
      { item: "ตู้จ่ายเงิน + ไฟชี้ช่อง", qty: `${kiosks || "—"} ตู้ · ${lights || "—"} ดวง`, purpose: "ชำระเงิน + ไฟเขียว/แดงรายช่อง (ออปชัน)", example: kiosks ? "Payment kiosk + LED ต่อช่อง" : "ปิด" },
    ]},
  ];

  return (
    <div className="min-h-screen text-slate-200">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-white/10 sticky top-0 z-10" style={{ background: `${PANEL}cc`, backdropFilter: "blur(6px)" }}>
        <NavDrawer current="topology" />
        <div className="font-bold text-sm text-white">Topology & สถาปัตยกรรมระบบ — LiDAR Smart Parking</div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6 space-y-6">
        {/* แบนเนอร์โซลูชัน */}
        <div className="rounded-xl border border-sky-400/30 p-5 glow-accent" style={{ background: "linear-gradient(135deg, #18324f 0%, #1a1a1a 60%)" }}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-lg grid place-items-center font-black text-white" style={{ background: "linear-gradient(135deg,#0098ff,#0050a0)" }}>O</div>
            <div>
              <div className="text-lg font-bold text-white">ระบบบริหารจัดการลานจอดรถอัจฉริยะด้วย Ouster LiDAR</div>
              <div className="text-[12px] text-sky-200">โซลูชัน <b>Ouster Gemini Edge AI</b> + <b>BlueCity</b> — perception AI บน NVIDIA Jetson Orin สำหรับการจัดการพื้นที่จอดรถยุคใหม่</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
            {["Gemini: ตรวจ/ติดตามวัตถุระดับเซนติเมตร","รวมหลายเซนเซอร์อัตโนมัติ (multi-sensor merge)","Custom event zones + WebGUI 2D/3D","OTA + Cloud portal","รันบน Jetson AGX Orin / Orin NX (TensorRT)"].map((t,i)=>(
              <span key={i} className="px-2 py-1 rounded-md border border-sky-400/30 text-sky-100" style={{background:"#0e2a44"}}>{t}</span>
            ))}
          </div>
        </div>

        <Card title="กำหนดขนาดงาน — ภาพและตารางด้านล่างคำนวณให้อัตโนมัติ" sub="ปรับจำนวน/ออปชัน แล้วผัง ไดอะแกรม และรายการอุปกรณ์ (BOM) อัปเดตทันที">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <NumIn label="ช่องจอด" val={spots} set={setSpots} min={1} max={5000} />
            <NumIn label="โซนกลางแจ้ง" val={zOut} set={setZOut} min={0} max={50} sub="1 LiDAR/โซน" />
            <NumIn label="โซนในร่ม" val={zIn} set={setZIn} min={0} max={50} sub="1 LiDAR/โซน" />
            <NumIn label="ทางเข้า-ออก" val={entr} set={setEntr} min={0} max={20} />
            <label className="flex flex-col gap-1"><span className="text-[11px] text-slate-400">รุ่น LiDAR</span>
              <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="w-full border border-white/10 rounded-md text-xs px-2 py-2 text-white" style={{ background: INPUT }}>{LIDAR_MODELS.map((md) => (<option key={md.id} value={md.id}>{md.brand} {md.model}</option>))}</select>
            </label>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Toggle label="On-prem" on={onprem} set={setOnprem} /><Toggle label="Cloud" on={cloud} set={setCloud} /><Toggle label="ป้าย LED" on={signage} set={setSignage} /><Toggle label="ไม้กั้น" on={gates} set={setGates} /><Toggle label="ANPR+จ่ายเงิน" on={anpr} set={setAnpr} /><Toggle label="VMS" on={vms} set={setVms} /><Toggle label="ไฟชี้ช่อง" on={spotLights} set={setSpotLights} />
          </div>
        </Card>

        <Card title="ผังจริง & ตัวสร้าง Topology — ลากวางได้เอง" sub="หยิบอุปกรณ์จากพาเลตขวา → ลากวางบนผังลาน · ลากเพื่อย้าย · เชื่อมสาย · เปลี่ยนชื่อ · ลบ · บันทึกอัตโนมัติ">
          <SiteTopologyEditor />
        </Card>

        <CapabilitiesSection />

        <Card title="ไปป์ไลน์ข้อมูล — Sensing → Gemini Event Zones → Protocols → ปลายทาง" sub="สะท้อนความสามารถจริง: occupancy (1 โซน/ช่อง) · counting line (เข้า/ออกแยกทิศ) · ห้ามจอด/จอดแช่ · วิเคราะห์การไหล + เอาต์พุตมาตรฐาน gRPC·MQTT·REST">
          <PipelineDiagram onprem={onprem} cloud={cloud} vms={vms} gates={gates} signage={signage} anpr={anpr} />
        </Card>
        <Card title="ผังเครือข่าย (Network Topology) — แก้ไขได้" sub="วางอุปกรณ์ตามชั้น (Field / Edge / Network / Backend / Users) จากพาเลตขวา · ลากย้าย · เชื่อมสายตาม requirement · บันทึกอัตโนมัติ">
          <SiteTopologyEditor variant="network" />
        </Card>

        <Card title="รายการอุปกรณ์ที่ต้องจัดหา (BOM)" sub="จำนวนคำนวณจากขนาดงาน · ตัวเลข [n] = ที่มาสเปก (ดูส่วนอ้างอิงท้ายหน้า)">
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.name}>
                <div className="flex items-center gap-2 mb-2"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: g.color }} /><h3 className="text-sm font-bold text-white">{g.name}</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px] border-collapse">
                    <thead><tr className="text-slate-400 border-b border-white/10"><th className="text-left py-1.5 px-2 w-[27%]">อุปกรณ์</th><th className="text-left py-1.5 px-2 w-[15%]">จำนวน</th><th className="text-left py-1.5 px-2 w-[30%]">หน้าที่</th><th className="text-left py-1.5 px-2 w-[28%]">ตัวอย่าง/สเปก</th></tr></thead>
                    <tbody>{g.rows.map((r, i) => (
                      <tr key={i} className="border-b border-white/5 align-top">
                        <td className="py-1.5 px-2 text-white font-medium">{r.item}{r.ref?.map((n) => <Ref key={n} n={n} />)}</td>
                        <td className="py-1.5 px-2 font-mono text-sky-300">{r.qty}</td>
                        <td className="py-1.5 px-2 text-slate-300">{r.purpose}</td>
                        <td className="py-1.5 px-2 text-slate-400">{r.example}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="การไหลของข้อมูล (Data Flow)"><DataFlow /></Card>

        {/* อ้างอิง / Research */}
        <CompletenessSection />

        <Card title="อ้างอิง & ที่มาข้อมูล (Research / References)" sub="สเปกและตัวเลขในหน้านี้อ้างอิงจากเอกสารผู้ผลิตและมาตรฐานสากลด้านล่าง">
          <ol className="space-y-2">
            {REFS.map((r) => (
              <li key={r.n} id={`ref-${r.n}`} className="text-[12px] text-slate-300 flex gap-2 scroll-mt-16">
                <span className="text-sky-400 font-mono shrink-0">[{r.n}]</span>
                <span>
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline font-medium">{r.title}</a>
                  <span className="text-slate-500 block text-[11px] mt-0.5">ใช้: {r.used}</span>
                  <span className="text-slate-600 block text-[10px] break-all">{r.url}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">มาตรฐานที่ใช้: IP67 (IEC 60529) สำหรับเซนเซอร์กลางแจ้ง · PoE++ IEEE 802.3bt Type 4 · สาย Cat6A · ไฟเบอร์ single-mode · จำนวนเป็นค่าประเมินเชิงออกแบบเพื่อตั้งต้นจัดหา ควรให้ผู้ขาย/ผู้รับเหมาสำรวจหน้างานยืนยันอีกครั้ง</p>
        </Card>
      </main>
    </div>
  );
}

/* ================= ผังจริง (top-down) ================= */
function SiteLayout({ zones, zonesAll, anpr, gates, signage, vms, coverM }: { zones: number; zonesAll: number; anpr: boolean; gates: boolean; signage: boolean; vms: boolean; coverM: number }) {
  const W = 1000, H = 520;
  const lotX = 120, lotY = 40, lotW = 820, lotH = 440;
  const poleXs = Array.from({ length: zones }, (_, i) => lotX + 120 + i * ((lotW - 180) / Math.max(zones, 1)));
  const poleY = lotY + lotH / 2;
  const cover = 92; // รัศมีครอบคลุมเชิงภาพ
  // แถวจอด
  const stallTop = lotY + 36, stallBot = lotY + lotH - 88;
  const stalls = Math.min(Math.floor((lotW - 220) / 26), 22);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-white/10" style={{ background: CARD }}>
      {/* lot */}
      <rect x={lotX} y={lotY} width={lotW} height={lotH} rx={8} fill="#202024" stroke="#3c3c3c" />
      <rect x={lotX} y={lotY} width={lotW} height={lotH} rx={8} fill="rgba(56,189,248,0.04)" />
      {/* zone tints */}
      <rect x={lotX} y={lotY} width={lotW * 0.55} height={lotH} fill="rgba(56,189,248,0.05)" />
      <rect x={lotX + lotW * 0.55} y={lotY} width={lotW * 0.45} height={lotH} fill="rgba(167,139,250,0.07)" />
      <text x={lotX + 14} y={lotY + 20} fontSize={11} fill="#7dd3fc">โซนกลางแจ้ง</text>
      <text x={lotX + lotW * 0.55 + 14} y={lotY + 20} fontSize={11} fill="#c4b5fd">โซนในร่ม (อาคาร)</text>

      {/* coverage + poles + fiber */}
      {poleXs.map((px, i) => (
        <g key={i}>
          <circle cx={px} cy={poleY} r={cover} fill="rgba(56,189,248,0.10)" stroke="#38bdf8" strokeOpacity={0.4} strokeWidth={1} strokeDasharray="5 4" />
          <line x1={px} y1={poleY} x2={905} y2={lotY + 14} stroke="#0078d4" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
          <IconPoleTop x={px} y={poleY} />
          <text x={px} y={poleY + 22} textAnchor="middle" fontSize={9} fill="#7dd3fc" fontWeight="bold">LiDAR {i + 1}</text>
        </g>
      ))}
      {zonesAll > zones && <text x={poleXs[zones - 1] + 40} y={poleY} fontSize={10} fill="#94a3b8">+{zonesAll - zones} โซน…</text>}

      {/* parked cars (บน/ล่าง) */}
      {Array.from({ length: stalls }).map((_, i) => {
        const x = lotX + 110 + i * 26;
        const occT = (i * 7) % 3 !== 0;
        const occB = (i * 5) % 3 === 0;
        return (
          <g key={i}>
            <rect x={x - 9} y={stallTop - 13} width={18} height={26} fill="none" stroke="#3c3c3c" strokeWidth={0.8} />
            <rect x={x - 9} y={stallBot - 13} width={18} height={26} fill="none" stroke="#3c3c3c" strokeWidth={0.8} />
            {occT && <IconCarTop x={x} y={stallTop} c={i % 4 ? "#475569" : "#5a6b86"} />}
            {occB && <IconCarTop x={x} y={stallBot} c={i % 3 ? "#475569" : "#5a6b86"} />}
          </g>
        );
      })}

      {/* entrance (ซ้าย): กล้อง + ไม้กั้น + ตู้จ่าย + ป้าย */}
      <rect x={lotX - 60} y={poleY - 34} width={60} height={68} fill="#181818" stroke="#3c3c3c" />
      <text x={lotX - 30} y={poleY - 40} textAnchor="middle" fontSize={9} fill="#94a3b8">ทางเข้า-ออก</text>
      {anpr && <g transform="scale(0.62)"><IconCamera x={(lotX - 56) / 0.62} y={(poleY - 30) / 0.62} /></g>}
      {gates && <g transform="scale(0.62)"><IconGate x={(lotX - 52) / 0.62} y={(poleY + 6) / 0.62} /></g>}
      {/* server room (ขวาบน) */}
      <rect x={880} y={lotY - 6} width={66} height={52} rx={4} fill="#16243a" stroke="#60a5fa" />
      <g transform="scale(0.62)"><IconServer x={(890) / 0.62} y={(lotY) / 0.62} /></g>
      <text x={913} y={lotY + 50} textAnchor="middle" fontSize={8.5} fill="#93c5fd">ห้องเซิร์ฟเวอร์</text>
      <text x={913} y={lotY + 60} textAnchor="middle" fontSize={7.5} fill="#64748b">{vms ? "MQTT·DB·VMS" : "MQTT·DB"}</text>

      {/* ป้าย LED ที่ทางเข้า */}
      {signage && <g transform="scale(0.6)"><IconSign x={(lotX + 8) / 0.6} y={(lotY + 8) / 0.6} /></g>}

      {/* legend */}
      <g transform={`translate(${lotX}, ${lotY + lotH + 6})`}>
        <circle cx={6} cy={6} r={5} fill="#0ea5e9" /><text x={16} y={9} fontSize={9} fill="#94a3b8">LiDAR</text>
        <circle cx={70} cy={6} r={6} fill="rgba(56,189,248,0.15)" stroke="#38bdf8" strokeDasharray="3 2" /><text x={82} y={9} fontSize={9} fill="#94a3b8">พื้นที่ครอบคลุม</text>
        <line x1={180} y1={6} x2={200} y2={6} stroke="#0078d4" strokeDasharray="4 3" /><text x={206} y={9} fontSize={9} fill="#94a3b8">ไฟเบอร์ → เซิร์ฟเวอร์</text>
      </g>
    </svg>
  );
}

/* ================= สถาปัตยกรรม (มีไอคอน) ================= */
function ArchDiagram({ onprem, cloud, signage, gates, anpr, vms }: { onprem: boolean; cloud: boolean; signage: boolean; gates: boolean; anpr: boolean; vms: boolean }) {
  const W = 520, H = 620;
  const layers: { y: number; c: string; t: string; proto: string; icons: ((p: { x: number; y: number }) => React.ReactElement)[] }[] = [
    { y: 16, c: "#38bdf8", t: "Sensing", proto: "UDP point cloud", icons: anpr ? [IconLiDAR, IconCamera] : [IconLiDAR] },
    { y: 116, c: "#a78bfa", t: "Edge (CUDA-PCL)", proto: "MQTT", icons: [IconEdge] },
    { y: 216, c: "#22c55e", t: "Network PoE++/Fiber", proto: "MQTT/REST", icons: [IconSwitch] },
    { y: 316, c: "#60a5fa", t: "Backend", proto: "WebSocket", icons: [...(onprem ? [IconServer] : []), ...(cloud ? [IconCloud] : []), ...(vms ? [IconCamera] : [])] },
    { y: 424, c: "#f472b6", t: "Guidance/Control", proto: "", icons: [...(signage ? [IconSign] : []), ...(gates ? [IconGate] : []), ...(anpr ? [IconKiosk] : [])] },
    { y: 524, c: "#fbbf24", t: "ผู้ใช้", proto: "", icons: [IconMonitor, IconMobile] },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-white/10" style={{ background: CARD }}>
      {layers.map((L, li) => (
        <g key={li}>
          {li < layers.length - 1 && (<>
            <line x1={W / 2} y1={L.y + 76} x2={W / 2} y2={layers[li + 1].y} stroke="#3c3c3c" strokeWidth={2} markerEnd="url(#ah)" />
            {L.proto && <text x={W / 2 + 8} y={L.y + 92} fontSize={9} fill="#7dd3fc" className="font-mono">{L.proto}</text>}
          </>)}
          <rect x={10} y={L.y} width={120} height={76} rx={6} fill={`${L.c}1f`} stroke={L.c} strokeWidth={1.3} />
          <text x={70} y={L.y + 16} textAnchor="middle" fontSize={11} fill={L.c} fontWeight="bold">{li + 1}</text>
          <text x={70} y={L.y + 44} textAnchor="middle" fontSize={9.5} fill="#cbd5e1">{L.t.length > 18 ? L.t.slice(0, 17) + "…" : L.t}</text>
          {L.icons.map((Ic, ii) => <g key={ii}>{Ic({ x: 150 + ii * 120, y: L.y + 16 })}</g>)}
        </g>
      ))}
      <defs><marker id="ah" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#3c3c3c" /></marker></defs>
    </svg>
  );
}

/* ================= เครือข่าย (มีไอคอน) ================= */
function NetDiagram({ switches, onprem, cloud }: { switches: number; onprem: boolean; cloud: boolean }) {
  const W = 520, H = 620;
  const zoneXs = [60, 200, 340];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-white/10" style={{ background: CARD }}>
      {zoneXs.map((x, i) => (
        <g key={i}>
          <g>{IconLiDAR({ x: x, y: 16 })}</g>
          <g>{IconEdge({ x: x - 4, y: 64 })}</g>
          <text x={x + 22} y={120} textAnchor="middle" fontSize={9} fill="#94a3b8">โซน {i + 1}</text>
          <line x1={x + 22} y1={104} x2={W / 2} y2={170} stroke="#3c3c3c" strokeWidth={1.3} />
        </g>
      ))}
      <text x={W - 60} y={70} fontSize={10} fill="#64748b">…โซนอื่น ๆ</text>

      <g>{IconSwitch({ x: W / 2 - 26, y: 170 })}</g>
      <text x={W / 2 + 70} y={188} fontSize={10} fill="#22c55e">PoE++ ×{switches} · VLAN</text>
      <line x1={W / 2} y1={205} x2={W / 2} y2={250} stroke="#3c3c3c" strokeWidth={2} />

      <rect x={W / 2 - 70} y={250} width={140} height={30} rx={5} fill="#15331f22" stroke="#22c55e" />
      <text x={W / 2} y={269} textAnchor="middle" fontSize={10} fill="#cbd5e1">Core / Fiber backbone</text>
      <line x1={W / 2} y1={280} x2={W / 2} y2={330} stroke="#3c3c3c" strokeWidth={2} />

      {onprem && <g>{IconServer({ x: 150, y: 330 })}</g>}
      {onprem && <text x={176} y={392} textAnchor="middle" fontSize={9} fill="#93c5fd">On-prem server</text>}
      {cloud && <g>{IconCloud({ x: 300, y: 336 })}</g>}
      {cloud && <text x={325} y={392} textAnchor="middle" fontSize={9} fill="#93c5fd">Cloud</text>}
      {onprem && <line x1={176} y1={330} x2={W / 2} y2={280} stroke="#3c3c3c" strokeWidth={2} />}
      {cloud && <line x1={325} y1={336} x2={W / 2} y2={280} stroke="#0078d4" strokeWidth={2} strokeDasharray="5 4" />}
      {onprem && cloud && <line x1={195} y1={355} x2={300} y2={355} stroke="#0078d4" strokeWidth={1.5} strokeDasharray="4 3" />}

      <g>{IconMonitor({ x: 150, y: 430 })}</g><text x={176} y={478} textAnchor="middle" fontSize={9} fill="#94a3b8">แดชบอร์ด</text>
      <g>{IconMobile({ x: 310, y: 430 })}</g><text x={336} y={478} textAnchor="middle" fontSize={9} fill="#94a3b8">แอปมือถือ</text>
      {onprem && <line x1={176} y1={392} x2={176} y2={430} stroke="#3c3c3c" strokeWidth={1.5} />}
      {cloud && <line x1={325} y1={392} x2={336} y2={430} stroke="#3c3c3c" strokeWidth={1.5} />}

      <text x={W / 2} y={H - 10} textAnchor="middle" fontSize={9} fill="#64748b">เส้นทึบ = LAN/ไฟเบอร์ในสถานที่ · เส้นประน้ำเงิน = อินเทอร์เน็ต (hybrid)</text>
    </svg>
  );
}

/* ================= data flow strip ================= */
function DataFlow() {
  const steps = [
    { t: "LiDAR", p: "UDP", c: "#38bdf8", Ic: IconLiDAR },
    { t: "Edge (CUDA-PCL)", p: "MQTT", c: "#a78bfa", Ic: IconEdge },
    { t: "Broker/Server", p: "REST/WS", c: "#60a5fa", Ic: IconServer },
    { t: "แดชบอร์ด/ป้าย/ไม้กั้น", p: "", c: "#22c55e", Ic: IconSign },
  ];
  const W = 1000, H = 130;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-white/10" style={{ background: CARD }}>
      {steps.map((s, i) => {
        const x = 40 + i * 250;
        return (
          <g key={i}>
            <rect x={x} y={26} width={170} height={72} rx={8} fill={`${s.c}1a`} stroke={s.c} strokeWidth={1.3} />
            <g>{s.Ic({ x: x + 12, y: 40 })}</g>
            <text x={x + 130} y={58} textAnchor="middle" fontSize={11} fill="#e2e8f0" fontWeight="bold">{s.t.length > 12 ? "" : s.t}</text>
            <text x={x + 85} y={90} textAnchor="middle" fontSize={9.5} fill="#cbd5e1">{s.t}</text>
            {i < steps.length - 1 && (<>
              <line x1={x + 170} y1={62} x2={x + 250} y2={62} stroke="#3c3c3c" strokeWidth={2} markerEnd="url(#df)" />
              <text x={x + 210} y={54} textAnchor="middle" fontSize={9} fill="#7dd3fc" className="font-mono">{steps[i].p}</text>
            </>)}
          </g>
        );
      })}
      <defs><marker id="df" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#3c3c3c" /></marker></defs>
    </svg>
  );
}


/* ================= ความสามารถระบบ (Event Zones) ================= */
function CapabilitiesSection() {
  const caps = [
    { c: "#22c55e", Icon: IconZoneOcc, title: "ตรวจช่องจอด (Occupancy)", items: ["1 โซนต่อ 1 ช่องจอด", "ตรวจสถานะ “ว่าง” / “เต็ม”", "แจ้งเตือนเรียลไทม์ → แดชบอร์ด + ป้ายนำทาง", "กรองวัตถุที่ไม่ใช่รถ (คน/รถเข็น/เงา)"] },
    { c: "#f59e0b", Icon: IconCountLine, title: "นับรถ (Counting Lines)", items: ["เส้นนับรถข้ามทางเข้า-ออก", "นับจำนวนรถในระบบแบบเรียลไทม์", "นับทิศทางเข้า/ออกแยกกัน", "ใช้คำนวณอัตราการหมุนเวียน (turnover)"] },
    { c: "#ef4444", Icon: IconNoPark, title: "โซนพิเศษ & จอดแช่ (Dwell)", items: ["โซนห้ามจอด / จุดรับส่ง (PUDO)", "แจ้งเตือนเมื่อจอดเกินเวลาที่กำหนด", "ตรวจจับการจอดแช่ (dwell)", "ส่งการแจ้งเตือนไปยังเจ้าหน้าที่"] },
    { c: "#38bdf8", Icon: IconFlow, title: "วิเคราะห์การไหล (Flow)", items: ["โซนวิเคราะห์การไหลของรถ", "ตรวจจับจุดคอขวด (bottleneck)", "วิเคราะห์ความหนาแน่นของการจราจร", "ใช้ปรับปรุงการจัดการลานจอด"] },
  ];
  return (
    <Card title="ความสามารถของระบบ (Event Zones ของ Gemini)" sub="โซน/เส้นทั้งหมดสร้างบนซอฟต์แวร์ perception — ปรับแก้ได้โดยไม่ต้องย้ายฮาร์ดแวร์">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
        {caps.map((cap, i) => (
          <div key={i} className="rounded-lg border p-3" style={{ background: CARD, borderColor: `${cap.c}55` }}>
            <div className="flex items-center gap-2 mb-2">
              <svg viewBox="0 0 52 40" width={30} height={23}>{cap.Icon({ x: 0, y: 0 })}</svg>
              <div className="text-[12.5px] font-bold" style={{ color: cap.c }}>{cap.title}</div>
            </div>
            <ul className="space-y-1">{cap.items.map((t, k) => (<li key={k} className="text-[11px] text-slate-300 leading-snug flex gap-1.5"><span style={{ color: cap.c }}>•</span>{t}</li>))}</ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ================= ความครบถ้วน + เพิ่มเพื่อสมจริง ================= */
function CompletenessSection() {
  const have = [
    "ช่องจอด: 1 โซน/ช่อง · ว่าง/เต็ม · กรองวัตถุไม่ใช่รถ",
    "นับรถ: เส้นนับเข้า-ออก · แยกทิศ · จำนวนในระบบ · turnover",
    "จอดแช่: ห้ามจอด/รับส่ง · เกินเวลา · dwell · แจ้งเจ้าหน้าที่",
    "การไหล: คอขวด · ความหนาแน่น · ปรับปรุงการจัดการ",
    "ปลายทางใช้ข้อมูล: แดชบอร์ดผู้บริหาร · แอปมือถือ · analytics · รายงานอัตโนมัติ",
    "ปลายทางควบคุม: VMS · BMS อาคาร · ป้ายนำทาง · ไม้กั้นอัตโนมัติ",
    "โปรโตคอล: gRPC · MQTT · REST API · Standardized Data Outputs",
  ];
  const add = [
    "Time sync (PTP/NTP) — ให้หลายเซนเซอร์ตรงเวลา จำเป็นต่อการ merge/นับให้แม่น",
    "Calibration & ROI mapping ต่อเซนเซอร์ — วางโซนช่องจอดให้ตรงพื้นจริง",
    "Multi-sensor fusion/merge + tracking ข้ามเซนเซอร์ (กันนับซ้ำที่รอยต่อ)",
    "Object classification — แยกชนิด รถเก๋ง/กระบะ/มอเตอร์ไซค์/คน",
    "Alert/Notification service — push/LINE/Email ถึงเจ้าหน้าที่ + ระดับความรุนแรง",
    "Analytics DB / Data lake (TimescaleDB/InfluxDB) — เก็บประวัติเพื่อรายงาน/AI",
    "Security — TLS, Auth/RBAC, VLAN แยกวง, audit log",
    "Redundancy/Failover + edge store-and-forward — เน็ตหลุดข้อมูลไม่หาย",
    "OTA update + Health monitoring (Grafana) — ดูแลทั้งระบบจากศูนย์กลาง",
    "Data retention & Privacy (PDPA) — เบลอ/นโยบายเก็บข้อมูลทะเบียน-วิดีโอ",
    "API Gateway + rate limiting — คุมการเข้าถึง REST/gRPC/MQTT",
  ];
  return (
    <Card title="ตรวจความครบถ้วน + สิ่งที่เพิ่มให้สมจริง" sub="ซ้าย = ตรงตามสเปกที่ให้มา · ขวา = ส่วนที่ระบบจริงต้องมีเพิ่มเพื่อให้ใช้งานได้สมบูรณ์">
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <div className="text-[12px] font-bold text-emerald-300 mb-2">ครบตามสเปกที่ให้มา ✓</div>
          <ul className="space-y-1.5">{have.map((t, i) => (<li key={i} className="text-[11.5px] text-slate-300 leading-snug flex gap-2"><span className="text-emerald-400 shrink-0">✓</span>{t}</li>))}</ul>
        </div>
        <div>
          <div className="text-[12px] font-bold text-sky-300 mb-2">เพิ่มเข้าไปเพื่อความสมจริง +</div>
          <ul className="space-y-1.5">{add.map((t, i) => (<li key={i} className="text-[11.5px] text-slate-300 leading-snug flex gap-2"><span className="text-sky-400 shrink-0">+</span>{t}</li>))}</ul>
        </div>
      </div>
    </Card>
  );
}

/* ================= Pipeline (ไปป์ไลน์ข้อมูลจริง) ================= */
function PipelineDiagram({ onprem, cloud, vms, gates, signage, anpr }: { onprem: boolean; cloud: boolean; vms: boolean; gates: boolean; signage: boolean; anpr: boolean }) {
  const W = 1040, H = 760;
  type IFn = (p: { x: number; y: number }) => React.ReactElement;
  const cell = (Icon: IFn, cx: number, cyTop: number, label: string, c = "#e2e8f0") => (
    <g><g transform={`translate(${cx - 26},${cyTop})`}>{Icon({ x: 0, y: 0 })}</g><text x={cx} y={cyTop + 50} textAnchor="middle" fontSize={10} fill={c}>{label}</text></g>
  );
  const chip = (x: number, y: number, w: number, h: number, c: string, lines: string[]) => (
    <g><rect x={x} y={y} width={w} height={h} rx={6} fill={`${c}1f`} stroke={c} strokeWidth={1.3} />{lines.map((t, i) => (<text key={i} x={x + w / 2} y={y + 16 + i * 12} textAnchor="middle" fontSize={9} fill={i === 0 ? c : "#cbd5e1"} fontWeight={i === 0 ? "bold" : "normal"}>{t}</text>))}</g>
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-white/10" style={{ background: CARD }}>
      {/* Sensing */}
      {cell(IconLiDAR, 470, 12, "Ouster LiDAR", "#38bdf8")}
      {anpr && cell(IconCamera, 590, 12, "ANPR Camera", "#f472b6")}
      <line x1={W / 2} y1={70} x2={W / 2} y2={92} stroke="#3c3c3c" strokeWidth={2} markerEnd="url(#pa)" />
      <text x={W / 2 + 10} y={86} fontSize={9} fill="#7dd3fc" className="font-mono">UDP point cloud</text>

      {/* Gemini */}
      <rect x={60} y={92} width={920} height={172} rx={10} fill="#1b1530" stroke="#a78bfa" strokeWidth={1.4} />
      <text x={80} y={114} fontSize={13} fill="#c4b5fd" fontWeight="bold">Ouster Gemini — Perception AI (NVIDIA Jetson Orin · TensorRT)</text>
      {chip(80, 124, 270, 30, "#a78bfa", ["ตรวจจับ + จำแนกวัตถุ"])}
      {chip(385, 124, 270, 30, "#a78bfa", ["กรองวัตถุที่ไม่ใช่รถ"])}
      {chip(690, 124, 270, 30, "#a78bfa", ["รวมหลายเซนเซอร์ (merge) + tracking"])}
      <text x={84} y={172} fontSize={9.5} fill="#94a3b8">Event Zones →</text>
      {chip(80, 178, 215, 76, "#22c55e", ["Occupancy", "1 โซน/ช่อง", "ว่าง / เต็ม"])}
      {chip(305, 178, 215, 76, "#f59e0b", ["Counting Line", "เข้า/ออกแยกทิศ", "จำนวน · turnover"])}
      {chip(530, 178, 215, 76, "#ef4444", ["ห้ามจอด / Dwell", "เกินเวลา · จอดแช่", "→ แจ้งเจ้าหน้าที่"])}
      {chip(755, 178, 205, 76, "#38bdf8", ["Flow Analytics", "คอขวด · ความหนาแน่น", "ปรับปรุงการจัดการ"])}
      <line x1={W / 2} y1={264} x2={W / 2} y2={292} stroke="#3c3c3c" strokeWidth={2} markerEnd="url(#pa)" />

      {/* Protocol bus */}
      <rect x={60} y={292} width={920} height={50} rx={10} fill="#10283f" stroke="#0ea5e9" strokeWidth={1.4} />
      <text x={80} y={322} fontSize={11} fill="#7dd3fc" fontWeight="bold">Standardized Data Outputs</text>
      {["gRPC", "MQTT", "REST API", "WebSocket"].map((t, i) => (<g key={i}><rect x={330 + i * 150} y={305} width={130} height={24} rx={12} fill="#0e3a52" stroke="#38bdf8" /><text x={395 + i * 150} y={321} textAnchor="middle" fontSize={10} fill="#bae6fd" className="font-mono">{t}</text></g>))}
      <line x1={300} y1={342} x2={250} y2={388} stroke="#3c3c3c" strokeWidth={2} markerEnd="url(#pa)" />
      <line x1={740} y1={342} x2={790} y2={388} stroke="#3c3c3c" strokeWidth={2} markerEnd="url(#pa)" />

      {/* Consumers */}
      <rect x={60} y={388} width={440} height={344} rx={10} fill="#13202f" stroke="#3c3c3c" />
      <text x={80} y={410} fontSize={12} fill="#7dd3fc" fontWeight="bold">ปลายทางที่ใช้ข้อมูล (Consumers)</text>
      {cell(IconMonitor, 160, 430, "แดชบอร์ดผู้บริหาร")}
      {cell(IconMobile, 380, 430, "แอปมือถือ")}
      {cell(IconAnalytics, 160, 560, "Advanced Analytics")}
      {cell(IconReport, 380, 560, "รายงานอัตโนมัติ")}

      {/* Controlled endpoints */}
      <rect x={540} y={388} width={440} height={344} rx={10} fill="#221324" stroke="#3c3c3c" />
      <text x={560} y={410} fontSize={12} fill="#f9a8d4" fontWeight="bold">ปลายทางที่ควบคุมได้ (Controlled)</text>
      {cell(IconCamera, 640, 430, vms ? "ระบบ VMS" : "VMS (ปิด)")}
      {cell(IconBMS, 880, 430, "ระบบควบคุมอาคาร (BMS)")}
      {cell(IconSign, 640, 560, signage ? "ป้ายนำทางหาที่จอด" : "ป้าย (ปิด)")}
      {cell(IconGate, 880, 560, gates ? "ไม้กั้นอัตโนมัติ" : "ไม้กั้น (ปิด)")}

      <text x={W / 2} y={H - 8} textAnchor="middle" fontSize={9} fill="#64748b">{onprem && cloud ? "ประมวลที่ edge (Gemini) · เก็บ/กระจายผ่าน server on-prem + ซิงก์ cloud (hybrid)" : onprem ? "ประมวลที่ edge · เก็บที่ server on-prem" : "ประมวลที่ edge · ส่งขึ้น cloud"}</text>
      <defs><marker id="pa" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#3c3c3c" /></marker></defs>
    </svg>
  );
}
