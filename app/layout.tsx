import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiDAR ParkManager — ระบบบริหารจัดการลานจอดรถอัจฉริยะ",
  description:
    "Prototype แดชบอร์ดบริหารลานจอดรถด้วย LiDAR — วาง/ลากเซนเซอร์เพื่อจำลองพื้นที่ตรวจจับ ดูสถานะช่องจอดและรถเข้า-ออกแบบเรียลไทม์",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
