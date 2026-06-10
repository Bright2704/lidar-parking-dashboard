"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const LINKS = [
  { href: "/", key: "home", icon: "🅿️", label: "แดชบอร์ดลานจอด", desc: "Top/Side view + จำลองเรียลไทม์" },
  { href: "/topology", key: "topology", icon: "🗺️", label: "Topology & สถาปัตยกรรม", desc: "ผังลาน/เครือข่าย ลากวาง · BOM · อ้างอิง" },
  { href: "/logic", key: "logic", icon: "📋", label: "Logic & ขีดจำกัด", desc: "การตรวจจับ · สเปก/ขีดจำกัดรุ่น LiDAR" },
];

export default function NavDrawer({ current }: { current?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // overlay จะถูก render ที่ระดับ body (portal) เพื่อหนีจาก stacking context ของ header (backdrop-blur)
  const overlay = (
    <>
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[1000] bg-black/55 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />
      <aside
        className={`fixed left-0 top-0 bottom-0 z-[1001] w-[272px] border-r border-white/10 flex flex-col transition-transform duration-200 ease-out ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: "#252526", boxShadow: open ? "8px 0 30px -12px rgba(0,0,0,0.7)" : "none" }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg grid place-items-center font-black text-white" style={{ background: "linear-gradient(135deg,#0098ff,#0050a0)" }}>O</div>
          <div className="leading-tight flex-1">
            <div className="font-bold text-sm text-white">LiDAR <span className="text-sky-400">ParkManager</span></div>
            <div className="text-[10px] text-slate-400">Ouster Gemini · BlueCity</div>
          </div>
          <button onClick={() => setOpen(false)} aria-label="ปิด" className="w-7 h-7 grid place-items-center rounded-md text-slate-400 hover:bg-[#37373d] hover:text-white">✕</button>
        </div>

        <nav className="p-2 space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 px-2 pt-1 pb-0.5">เมนูหลัก</div>
          {LINKS.map((l) => {
            const active = current === l.key;
            return (
              <a
                key={l.key}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${active ? "bg-[#0078d4]/15 border-sky-400/40" : "border-transparent hover:bg-[#37373d]"}`}
              >
                <span className="text-lg leading-none mt-0.5">{l.icon}</span>
                <span className="flex-1">
                  <span className={`block text-[13px] font-semibold ${active ? "text-sky-200" : "text-slate-100"}`}>
                    {l.label}{active && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-sky-500/25 text-sky-100 align-middle">อยู่ที่นี่</span>}
                  </span>
                  <span className="block text-[10.5px] text-slate-400 mt-0.5 leading-snug">{l.desc}</span>
                </span>
              </a>
            );
          })}
        </nav>

        <div className="mt-auto px-4 py-3 border-t border-white/10 text-[10px] text-slate-500">
          ระบบบริหารจัดการลานจอดรถอัจฉริยะด้วย Ouster LiDAR
        </div>
      </aside>
    </>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="เมนู"
        aria-label="เปิดเมนู"
        className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-white/10 bg-[#2d2d30] hover:bg-[#37373d] text-slate-200 shrink-0"
      >
        <svg width="18" height="18" viewBox="0 0 18 18"><g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="2" y1="4" x2="16" y2="4" /><line x1="2" y1="9" x2="16" y2="9" /><line x1="2" y1="14" x2="16" y2="14" /></g></svg>
      </button>
      {mounted && createPortal(overlay, document.body)}
    </>
  );
}
