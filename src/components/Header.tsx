"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import { Menu, X, LogOut, LayoutDashboard, User, MessageSquare } from "lucide-react";

export default function Header() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/");
          router.refresh();
        },
      },
    });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-[#FAFAF9]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <svg
            className="h-8 w-8 text-teal-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 1 0 0-8c-2 0-4 1.33-6 4Z" />
          </svg>
          <span className="font-sans text-xl font-bold tracking-tight text-slate-900">
            Care<span className="text-teal-600">Loop</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-teal-600"
          >
            Find a Doctor
          </Link>
          <span className="h-4 w-px bg-slate-200" />
          <Link
            href="/whatsapp-simulator"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-teal-600 flex items-center gap-1.5"
          >
            <MessageSquare className="h-4.5 w-4.5 text-emerald-600" />
            WhatsApp AI
          </Link>
          <span className="h-4 w-px bg-slate-200" />
          
          {isPending ? (
            <div className="h-8 w-24 animate-pulse rounded-md bg-slate-100" />
          ) : session ? (
            <div className="flex items-center gap-4">
              <Link
                href="/doctor/dashboard"
                className="flex items-center gap-1.5 text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-3.5 py-1.5 rounded-full transition-all"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-rose-600 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/doctor/login"
              className="text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors flex items-center gap-1"
            >
              <User className="h-4 w-4" />
              Doctor Portal
            </Link>
          )}
        </nav>

        {/* Mobile menu button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="border-b border-slate-200 bg-[#FAFAF9] px-4 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            <Link
              href="/"
              onClick={() => setIsOpen(false)}
              className="text-base font-medium text-slate-700 hover:text-teal-600"
            >
              Find a Doctor
            </Link>
            
            <span className="h-px bg-slate-150 w-full block" />
            
            <Link
              href="/whatsapp-simulator"
              onClick={() => setIsOpen(false)}
              className="text-base font-medium text-slate-700 hover:text-teal-600 flex items-center gap-2"
            >
              <MessageSquare className="h-5 w-5 text-emerald-600" />
              WhatsApp AI Assistant
            </Link>
            
            <div className="h-px bg-slate-100" />
            
            {session ? (
              <>
                <div className="flex items-center gap-2 text-sm text-slate-500 px-1">
                  Logged in as <span className="font-semibold text-slate-700">{session.user.name}</span>
                </div>
                <Link
                  href="/doctor/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-teal-700"
                >
                  <LayoutDashboard className="h-4.5 w-4.5" />
                  Doctor Dashboard
                </Link>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="h-4.5 w-4.5" />
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/doctor/login"
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-teal-700"
              >
                <User className="h-4.5 w-4.5" />
                Doctor Portal Login
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
