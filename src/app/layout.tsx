import type { Metadata } from "next";
import Header from "@/components/Header";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareLoop — Care, without the wait",
  description: "Book instant, hassle-free doctor consultations. Mobile-first healthcare booking platform with real-time slot selection and zero wait times.",
  keywords: ["healthcare", "doctor booking", "appointment scheduling", "instant care", "CareLoop"],
  authors: [{ name: "CareLoop Team" }],
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="flex min-h-screen flex-col bg-[#FAFAF9] text-slate-800 antialiased">
        <ToastProvider>
          <Header />
          
          <main className="flex-1">
            {children}
          </main>

          <footer className="border-t border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <p className="font-sans">
                &copy; {new Date().getFullYear()} CareLoop. All rights reserved.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Care, without the wait. Built for Ambula &apos;26.
              </p>
            </div>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
