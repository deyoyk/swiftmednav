import "./globals.css";
import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Nav from "@/components/Nav";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap", variable: "--font-inter" });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap", variable: "--font-grotesk" });

export const metadata: Metadata = { title: "SwiftMedNav (Simulation Demo)", description: "Academic emergency response coordination demo. Not connected to 108." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body>
        <Nav />
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</div>
        <footer className="mx-auto max-w-7xl px-4 pb-6 text-center text-[11px] text-slate-600">
          Academic simulation demo — not connected to 108 and cannot dispatch a real ambulance.
        </footer>
      </body>
    </html>
  );
}
