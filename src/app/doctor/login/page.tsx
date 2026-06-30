"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/components/ui/toast";
import { KeyRound, Mail, Lock, ArrowRight, HeartPulse } from "lucide-react";

export default function DoctorLoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) {
        toast.error(error.message || "Invalid email or password");
      } else {
        toast.success("Welcome back, Doctor!");
        router.push("/doctor/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      toast.error("An error occurred during login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col md:flex-row bg-[#FAFAF9]">
      {/* Left: Brand Panel */}
      <div className="relative flex flex-col justify-between bg-gradient-to-br from-teal-900 to-slate-900 p-8 text-white md:w-1/2 lg:p-16">
        {/* Background Gradients */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -left-16 -top-16 h-80 w-80 rounded-full bg-teal-500 blur-3xl" />
          <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-rose-400 blur-3xl" />
        </div>

        {/* Brand Header */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2">
            <svg
              className="h-8 w-8 text-teal-400"
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
            <span className="font-sans text-xl font-bold tracking-tight text-white">
              Care<span className="text-teal-400">Loop</span>
            </span>
          </Link>
        </div>

        {/* Tagline & Image */}
        <div className="relative z-10 my-auto py-12 md:py-0">
          <h2 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl leading-tight text-white">
            Designed for <br />
            <span className="text-teal-300">modern healthcare.</span>
          </h2>
          <p className="mt-4 max-w-md text-sm text-slate-300 font-medium leading-relaxed">
            Manage your schedule, update patient records, and write prescriptions with an interface that feels like a premium SaaS product.
          </p>

          {/* Doctor Image */}
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
            <img
              src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=600"
              alt="Male doctor smiling"
              className="w-full h-[220px] object-cover"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-slate-400">
          CareLoop Provider Portal &copy; {new Date().getFullYear()}
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex items-center justify-center p-8 md:w-1/2 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h1 className="font-sans text-2xl font-extrabold text-slate-900">
              Welcome back, Doctor
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 font-medium">
              Please enter your credentials to access your dashboard.
            </p>
          </div>

          {/* Demo Credentials Alert */}
          <div className="rounded-xl border border-teal-600/20 bg-teal-50/50 p-4 text-xs text-teal-800">
            <p className="font-bold flex items-center gap-1.5">
              <HeartPulse className="h-4.5 w-4.5 text-teal-600 shrink-0" />
              Demo Accounts Available:
            </p>
            <ul className="mt-2 space-y-1 font-medium list-disc list-inside text-teal-700">
              <li>Dr. Sarah Jenkins: <code className="bg-teal-100/60 px-1 py-0.5 rounded">sarah.jenkins@careloop.com</code></li>
              <li>Dr. Rajesh Kumar: <code className="bg-teal-100/60 px-1 py-0.5 rounded">rajesh.kumar@careloop.com</code></li>
              <li>Password: <code className="bg-teal-100/60 px-1 py-0.5 rounded">password123</code></li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Address */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="doctor@careloop.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3.5 text-center text-sm font-bold text-white transition-all hover:bg-teal-700 hover:shadow-lg hover:shadow-teal-600/10 active:scale-98 disabled:bg-teal-500/80"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Logging in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
