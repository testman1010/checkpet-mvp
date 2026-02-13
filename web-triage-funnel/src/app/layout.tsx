import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CSPostHogProvider } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CheckPet - AI Pet Symptom Analysis",
  description: "Immediate AI symptom analysis for your pet. No sign-up required.",
  // itunes: ... (keep existing)
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <CSPostHogProvider>
          <main className="flex-grow">
            {children}
          </main>
        </CSPostHogProvider>

        {/* GLOBAL FOOTER */}
        <footer className="bg-slate-900 text-slate-400 py-8 px-4 text-center text-xs">
          <div className="max-w-md mx-auto space-y-4">
            <p className="font-semibold text-slate-300">
              This tool provides information for educational purposes only and is not a substitute for professional veterinary advice, diagnosis, or treatment. Always seek the advice of your veterinarian with any questions you may have regarding a medical condition.
            </p>
            <div className="flex justify-center gap-4 text-slate-500">
              <a href="/about" className="hover:text-white transition-colors">About Us</a>
              <span className="text-slate-700">•</span>
              <span className="cursor-not-allowed">Privacy Policy</span>
              <span className="text-slate-700">•</span>
              <span className="cursor-not-allowed">Terms</span>
            </div>
            <p className="text-[10px] text-slate-600 mt-4">
              © {new Date().getFullYear()} CheckPet. All rights reserved.
            </p>
          </div>
        </footer>
      </body>
    </html >
  );
}
