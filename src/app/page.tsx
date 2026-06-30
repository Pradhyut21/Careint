import { pool } from "@/lib/db";
import DoctorSearchList from "@/components/DoctorSearchList";
import { ShieldCheck, Users, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

async function getDoctors() {
  let client;
  try {
    client = await pool.connect();
    const queryStr = `
      SELECT d.*, 
             (SELECT json_build_object('id', s.id, 'date', s.date, 'start_time', s.start_time) 
              FROM slots s 
              WHERE s.doctor_id = d.id 
                AND s.status = 'available' 
                AND (s.date > CURRENT_DATE OR (s.date = CURRENT_DATE AND s.start_time > CURRENT_TIME))
                AND (s.reserved_until IS NULL OR s.reserved_until < NOW())
              ORDER BY s.date ASC, s.start_time ASC 
              LIMIT 1) as next_slot
      FROM doctors d
      ORDER BY d.name ASC
    `;
    const res = await client.query(queryStr);
    return res.rows.map((row) => ({
      ...row,
      next_slot: row.next_slot || null,
    }));
  } catch (error) {
    console.error("Failed to fetch doctors for landing page:", error);
    return [];
  } finally {
    if (client) {
      client.release();
    }
  }
}

export default async function Home() {
  const doctors = await getDoctors();

  return (
    <div className="flex flex-col bg-[#FAFAF9]">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 px-4 py-16 text-white sm:px-6 lg:px-8 lg:py-24">
        {/* Background Decorative Circles */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -left-16 -top-16 h-80 w-80 rounded-full bg-teal-500 blur-3xl" />
          <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-rose-400 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left: Text Content */}
          <div className="relative z-10 lg:col-span-7">
            <span className="inline-flex items-center rounded-full bg-teal-500/20 px-3.5 py-1 text-sm font-semibold text-teal-300 backdrop-blur-sm">
              ✨ Introducing CareLoop 1.0
            </span>
            <h1 className="mt-6 font-sans text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-tight">
              Care, <br className="hidden sm:inline" />
              <span className="text-rose-400">without the wait.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base sm:text-lg text-slate-300 font-medium leading-relaxed">
              Skip the crowded waiting rooms. Browse verified specialists, select available slots, and book your appointment in under 2 minutes. Supported by double-booking prevention.
            </p>

            {/* Trust Badges */}
            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-teal-700/50 pt-8">
              <div className="flex flex-col">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-300">
                  <Users className="h-4 w-4 shrink-0 text-rose-400" />
                  Trust
                </span>
                <span className="mt-1 text-xl font-extrabold text-white sm:text-2xl">10,000+</span>
                <span className="text-xs text-slate-400">Appointments Booked</span>
              </div>
              <div className="flex flex-col">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-300">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-rose-400" />
                  Verified
                </span>
                <span className="mt-1 text-xl font-extrabold text-white sm:text-2xl">200+</span>
                <span className="text-xs text-slate-400">Expert Doctors</span>
              </div>
              <div className="flex flex-col">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-300">
                  <Activity className="h-4 w-4 shrink-0 text-rose-400" />
                  Speed
                </span>
                <span className="mt-1 text-xl font-extrabold text-white sm:text-2xl">99.8%</span>
                <span className="text-xs text-slate-400">On-time consultations</span>
              </div>
            </div>
          </div>

          {/* Right: Premium Hero Image */}
          <div className="relative lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md sm:max-w-lg lg:max-w-none overflow-hidden rounded-2xl border-4 border-white/10 shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=800"
                alt="Doctor consulting patient"
                className="w-full h-[300px] sm:h-[350px] lg:h-[400px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-teal-950/40 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Search & Doctor Listings */}
      <section className="relative z-20">
        <DoctorSearchList initialDoctors={doctors} />
      </section>
    </div>
  );
}
