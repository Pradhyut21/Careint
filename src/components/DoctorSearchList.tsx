"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Calendar, Star, IndianRupee, ArrowRight, ShieldCheck, Users, Activity } from "lucide-react";

import { formatNextAvailable } from "@/lib/datetime";

interface Slot {
  id: string;
  date: string;
  start_time: string;
}

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  location: string;
  fee: number;
  photo_url: string;
  bio: string;
  years_experience: number;
  next_slot: Slot | null;
}

interface DoctorSearchListProps {
  initialDoctors: Doctor[];
}

const SPECIALIZATIONS = [
  "All",
  "General Physician",
  "Pediatrics",
  "Cardiology",
  "Dermatology",
  "Orthopedics",
  "Gynecology",
];

export default function DoctorSearchList({ initialDoctors }: DoctorSearchListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpec, setSelectedSpec] = useState("All");

  const filteredDoctors = useMemo(() => {
    return initialDoctors.filter((doc) => {
      const matchesSearch =
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.location.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSpec = selectedSpec === "All" || doc.specialization === selectedSpec;
      return matchesSearch && matchesSpec;
    });
  }, [initialDoctors, searchQuery, selectedSpec]);

  return (
    <div className="w-full">
      {/* Search & Filter Controls */}
      <div className="mx-auto -mt-8 mb-12 max-w-4xl px-4">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:flex-row md:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search doctors by name, clinic, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
            />
          </div>
        </div>

        {/* Specialization Filter Chips */}
        <div className="slot-grid mt-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {SPECIALIZATIONS.map((spec) => (
            <button
              key={spec}
              onClick={() => setSelectedSpec(spec)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                selectedSpec === spec
                  ? "bg-teal-600 text-white shadow-md shadow-teal-600/15"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {spec}
            </button>
          ))}
        </div>
      </div>

      {/* Main Listing Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {selectedSpec === "All" ? "All Verified Doctors" : `${selectedSpec} Specialists`}
            <span className="ml-2 text-sm font-medium text-slate-400">
              ({filteredDoctors.length} found)
            </span>
          </h2>
        </div>

        <AnimatePresence mode="popLayout">
          {filteredDoctors.length > 0 ? (
            <motion.div
              layout
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filteredDoctors.map((doc) => (
                <motion.div
                  key={doc.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className="premium-card flex flex-col justify-between overflow-hidden bg-white p-6"
                >
                  <div>
                    {/* Header: Photo, Name, Specialization */}
                    <div className="flex gap-4">
                      <img
                        src={doc.photo_url}
                        alt={doc.name}
                        className="h-16 w-16 rounded-xl object-cover border border-slate-100"
                        onError={(e) => {
                          // Fallback avatar
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${doc.name}`;
                        }}
                      />
                      <div>
                        <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
                          {doc.specialization}
                        </span>
                        <h3 className="mt-1 font-sans text-lg font-bold text-slate-900 leading-tight">
                          {doc.name}
                        </h3>
                        <div className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                          <Star className="h-3.5 w-3.5 fill-amber-400 stroke-amber-400" />
                          <span className="font-bold text-slate-700">4.9</span>
                          <span>•</span>
                          <span>{doc.years_experience} years exp</span>
                        </div>
                      </div>
                    </div>

                    {/* Location & Fee */}
                    <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="truncate">{doc.location}</span>
                      </div>
                      <div className="flex items-center gap-2 font-semibold text-slate-800">
                        <IndianRupee className="h-4 w-4 shrink-0 text-slate-500" />
                        <span>₹{doc.fee} Consultation Fee</span>
                      </div>
                    </div>

                    {/* Urgency Badge */}
                    <div className="mt-4 rounded-xl bg-slate-50 p-3 flex items-center gap-2">
                      <Calendar className={`h-4 w-4 shrink-0 ${doc.next_slot ? "text-teal-600" : "text-slate-400"}`} />
                      <span className={`text-xs font-bold ${doc.next_slot ? "text-teal-700 animate-pulse-soft" : "text-slate-500"}`}>
                        {formatNextAvailable(doc.next_slot)}
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="mt-6">
                    <Link
                      href={`/doctors/${doc.id}`}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-center text-sm font-bold text-white transition-all hover:bg-teal-700 hover:shadow-lg hover:shadow-teal-600/10 active:scale-98 group"
                    >
                      Book Consultation
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              {/* Custom SVG Empty State Illustration */}
              <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-teal-50">
                <Calendar className="h-12 w-12 text-teal-600" />
                <span className="absolute -right-1 -top-1 flex h-4 w-4 rounded-full bg-rose-400" />
              </div>
              <h3 className="font-sans text-xl font-bold text-slate-900">No Doctors Found</h3>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                We couldn&apos;t find any doctors matching &quot;{searchQuery}&quot; or in the selected specialization. Try adjusting your search.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedSpec("All");
                }}
                className="mt-6 text-sm font-bold text-teal-600 hover:text-teal-700"
              >
                Clear Filters
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
