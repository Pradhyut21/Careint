"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Star, MapPin, IndianRupee, Calendar, Clock, 
  ChevronRight, Phone, User, CalendarDays, ClipboardList, CheckCircle, AlertTriangle 
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { formatDateTab, formatDateLong, formatSlotTime } from "@/lib/datetime";
import confetti from "canvas-confetti";

interface Slot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  reserved_until?: string | null;
  reserved_by?: string | null;
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
}

interface DoctorProfileClientProps {
  doctor: Doctor;
  initialSlots: Slot[];
}

export default function DoctorProfileClient({ doctor, initialSlots }: DoctorProfileClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);
  const [sessionToken, setSessionToken] = useState<string>("");
  
  // Double-booking conflict state
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [suggestedSlot, setSuggestedSlot] = useState<any | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    patient_name: "",
    patient_age: "",
    patient_phone: "",
    blood_group: "",
    conditions: "",
    medications: "",
  });

  // Generate session token on mount
  useEffect(() => {
    let token = sessionStorage.getItem("careloop_session_token");
    if (!token) {
      token = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2);
      sessionStorage.setItem("careloop_session_token", token);
    }
    setSessionToken(token);
  }, []);

  // Update local slots if initialSlots changes from server component
  useEffect(() => {
    setSlots(initialSlots);
  }, [initialSlots]);

  // Generate next 7 days starting from today
  const next7Days = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push(date);
    }
    return days;
  }, []);

  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    next7Days[0].toISOString().split("T")[0]
  );

  // Filter slots for selected date
  const slotsForSelectedDate = useMemo(() => {
    return slots.filter(
      (s) => new Date(s.date).toISOString().split("T")[0] === selectedDateStr
    );
  }, [slots, selectedDateStr]);

  const handleSlotClick = (slot: Slot) => {
    if (slot.status === "blocked" || slot.status === "booked") return;
    setSelectedSlot(slot);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Open booking modal after verifying soft slot reservation
  const handleOpenBookingModal = async () => {
    if (!selectedSlot) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/booking/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slot_id: selectedSlot.id,
          session_token: sessionToken,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsModalOpen(true);
      } else {
        toast.error(data.error || "This slot is temporarily reserved by another patient. Please choose another time.");
        setSelectedSlot(null);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to reserve slot. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setIsSubmitting(true);
    setConflictError(null);
    setSuggestedSlot(null);

    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slot_id: selectedSlot.id,
          session_token: sessionToken,
          ...formData,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setBookingSuccess(data.booking);
        setIsModalOpen(false);
        toast.success("Appointment booked successfully!");
        
        // Trigger Confetti
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#0F766E", "#FB7185", "#38BDF8"],
        });
      } else if (res.status === 409) {
        // Concurrency error
        setConflictError(data.message);
        setSuggestedSlot(data.next_available_slot);
        toast.error(data.message || "This slot is no longer available.");
      } else {
        toast.error(data.message || "Failed to book appointment");
      }
    } catch (error: any) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Book the suggested slot directly
  const handleBookSuggestedSlot = async () => {
    if (!suggestedSlot) return;
    setIsSubmitting(true);
    setConflictError(null);
    
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slot_id: suggestedSlot.id,
          session_token: sessionToken,
          ...formData,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setBookingSuccess(data.booking);
        setIsModalOpen(false);
        toast.success("Appointment booked successfully!");
        
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#0F766E", "#FB7185", "#38BDF8"],
        });
      } else {
        toast.error(data.message || "Failed to book appointment");
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add to Calendar (.ics download)
  const handleAddToCalendar = () => {
    if (!bookingSuccess || !selectedSlot) return;
    
    const [hours, minutes] = selectedSlot.start_time.split(":");
    const eventDate = new Date(selectedSlot.date);
    eventDate.setHours(parseInt(hours), parseInt(minutes), 0);
    
    const endDate = new Date(eventDate);
    endDate.setMinutes(endDate.getMinutes() + 30); // 30 mins

    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `DTSTART:${formatICSDate(eventDate)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:Consultation with ${doctor.name}`,
      `DESCRIPTION:Appointment ID: ${bookingSuccess.booking_id}. Specialization: ${doctor.specialization}. Fee: Rs. ${doctor.fee}.`,
      `LOCATION:${doctor.location}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `appointment_${doctor.name.replace(/\s+/g, "_")}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 pb-32">
      {/* Back Button */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-teal-600 transition-colors mb-6 outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-lg"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to search
      </Link>

      <AnimatePresence mode="wait">
        {!bookingSuccess ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Doctor Profile Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row gap-6">
              <img
                src={doctor.photo_url}
                alt={doctor.name}
                className="h-28 w-28 rounded-2xl object-cover border border-slate-100 mx-auto md:mx-0"
              />
              <div className="flex-1 text-center md:text-left">
                <span className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                  {doctor.specialization}
                </span>
                <h1 className="mt-2 font-sans text-2xl font-extrabold text-slate-900 leading-tight">
                  {doctor.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-medium text-slate-500">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 stroke-amber-400" />
                    <span className="font-bold text-slate-700">4.9 (48 reviews)</span>
                  </div>
                  <span>•</span>
                  <span>{doctor.years_experience} years experience</span>
                </div>
                <p className="mt-4 text-sm text-slate-600 leading-relaxed max-w-2xl">
                  {doctor.bio}
                </p>
                
                <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-6 border-t border-slate-100 pt-6">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <MapPin className="h-5 w-5 text-slate-400" />
                    <span>{doctor.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <IndianRupee className="h-5 w-5 text-slate-500" />
                    <span>₹{doctor.fee} Consultation Fee</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Slot Picker Section */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-teal-600" />
                Select Appointment Time
              </h2>

              {/* 7-Day Tabs */}
              <div className="slot-grid flex gap-2 overflow-x-auto border-b border-slate-100 pb-4 scrollbar-none">
                {next7Days.map((day) => {
                  const { dayName, dayNum, dateStr } = formatDateTab(day);
                  const isSelected = selectedDateStr === dateStr;
                  const daySlots = slots.filter(
                    (s) => new Date(s.date).toISOString().split("T")[0] === dateStr
                  );
                  const availableCount = daySlots.filter((s) => {
                    const isReservedByOther = !!(s.reserved_until && new Date(s.reserved_until).getTime() > Date.now() && s.reserved_by !== sessionToken);
                    return s.status === "available" && !isReservedByOther;
                  }).length;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => {
                        setSelectedDateStr(dateStr);
                        setSelectedSlot(null); // Reset slot selection on date change
                      }}
                      aria-label={`${dayName} ${dayNum}, ${availableCount} slots available`}
                      className={`flex min-w-[72px] flex-col items-center rounded-xl p-3 border transition-all outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                        isSelected
                          ? "bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/15 scale-102"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-xs font-semibold uppercase opacity-80">{dayName}</span>
                      <span className="text-lg font-extrabold mt-1">{dayNum}</span>
                      <span className={`text-[10px] font-bold mt-1.5 px-1.5 py-0.5 rounded-full ${
                        isSelected 
                          ? "bg-teal-700 text-teal-100" 
                          : availableCount > 0 
                            ? "bg-teal-50 text-teal-700" 
                            : "bg-slate-100 text-slate-400"
                      }`}>
                        {availableCount} left
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Time Slots Grid */}
              <div className="mt-6">
                {slotsForSelectedDate.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {slotsForSelectedDate.map((slot) => {
                      const isSelected = selectedSlot?.id === slot.id;
                      const isReservedByOther = !!(slot.reserved_until && new Date(slot.reserved_until).getTime() > Date.now() && slot.reserved_by !== sessionToken);
                      const isBlocked = slot.status === "blocked" || slot.status === "booked" || isReservedByOther;

                      return (
                        <button
                          key={slot.id}
                          disabled={isBlocked}
                          onClick={() => handleSlotClick(slot)}
                          aria-label={`${formatSlotTime(slot.start_time)}${isBlocked ? ' - Unavailable' : ''}`}
                          className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold border transition-all outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                            isBlocked
                              ? "bg-slate-100 text-slate-400 border-slate-100 cursor-not-allowed opacity-50"
                              : isSelected
                                ? "bg-teal-50 text-teal-700 border-teal-500 ring-1 ring-teal-500"
                                : "bg-white text-slate-700 border-slate-200 hover:border-teal-500/30 hover:bg-teal-50/20"
                          }`}
                        >
                          <Clock className="h-4 w-4 opacity-70" />
                          {formatSlotTime(slot.start_time)}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-500">
                    No slots available for this day. Please select another date.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          /* Confirmation / Success Screen */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-auto max-w-md text-center py-10"
          >
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-teal-50 p-4 shadow-inner">
                <CheckCircle className="h-16 w-16 text-teal-600 animate-bounce" />
              </div>
            </div>

            <h1 className="font-sans text-2xl font-extrabold text-slate-900 leading-tight">
              Booking Confirmed!
            </h1>
            <p className="mt-2 text-sm text-slate-500 font-medium">
              Your appointment has been successfully scheduled.
            </p>

            {/* Booking Card */}
            <div className="premium-card mt-8 bg-white p-6 text-left border border-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Appointment Details
              </span>
              <h3 className="mt-2 font-sans text-lg font-bold text-slate-900">
                {doctor.name}
              </h3>
              <p className="text-sm font-semibold text-teal-700 mt-0.5">
                {doctor.specialization}
              </p>

              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-4.5 w-4.5 text-slate-400" />
                  <span className="font-semibold text-slate-800">
                    {formatDateLong(selectedSlot!.date)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock className="h-4.5 w-4.5 text-slate-400" />
                  <span className="font-semibold text-slate-800">
                    {formatSlotTime(selectedSlot!.start_time)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <MapPin className="h-4.5 w-4.5 text-slate-400" />
                  <span className="truncate">{doctor.location}</span>
                </div>
              </div>

              {/* Booking ID Highlight */}
              <div className="mt-6 rounded-xl bg-teal-50/50 border border-teal-100 p-4 text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-850">
                  Booking ID
                </span>
                <div className="mt-1 text-2xl font-mono font-extrabold tracking-wide text-teal-900">
                  {bookingSuccess.booking_id}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={handleAddToCalendar}
                className="w-full rounded-xl bg-teal-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-600/10 hover:bg-teal-700 transition-all active:scale-98 outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                Add to Calendar
              </button>
              <Link
                href="/"
                className="w-full rounded-xl border border-slate-200 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-98 text-center outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                Return to Home
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Bottom Booking Bar (Mobile only) */}
      {!bookingSuccess && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white p-4 shadow-lg md:hidden flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Selected Slot
            </span>
            <div className="text-sm font-bold text-slate-800">
              {selectedSlot 
                ? `${formatSlotTime(selectedSlot.start_time)} • ${formatDateLong(selectedSlot.date).split(',')[1]?.trim() || ''}`
                : "No slot selected"
              }
            </div>
          </div>
          <button
            disabled={!selectedSlot || isSubmitting}
            onClick={handleOpenBookingModal}
            className="rounded-xl bg-teal-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-teal-600/10 hover:bg-teal-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-100 transition-all active:scale-98 flex items-center gap-1.5"
          >
            {isSubmitting && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            Book Now
          </button>
        </div>
      )}

      {/* Desktop Booking Bar (Sticky at bottom, but fits max-w-4xl) */}
      {!bookingSuccess && (
        <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-4xl px-4">
          <div className="w-full flex items-center justify-between rounded-2xl border border-teal-600/10 bg-white/90 p-4 shadow-xl backdrop-blur-md">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Selected Slot
              </span>
              <div className="text-base font-bold text-slate-800">
                {selectedSlot 
                  ? `${formatDateLong(selectedSlot.date)} at ${formatSlotTime(selectedSlot.start_time)}`
                  : "Please select a time slot to proceed"
                }
              </div>
            </div>
            <button
              disabled={!selectedSlot || isSubmitting}
              onClick={handleOpenBookingModal}
              className="rounded-xl bg-teal-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-600/15 hover:bg-teal-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-100 transition-all active:scale-98 flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              {isSubmitting && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              Book Appointment
            </button>
          </div>
        </div>
      )}

      {/* Booking Form Modal (Custom Dialog) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isSubmitting) setIsModalOpen(false);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              {/* Modal Header */}
              <div className="border-b border-slate-100 p-5">
                <h3 className="font-sans text-lg font-bold text-slate-900">
                  Complete Booking
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Consultation with <span className="font-bold text-slate-700">{doctor.name}</span> on {selectedSlot && formatDateLong(selectedSlot.date)} at {selectedSlot && formatSlotTime(selectedSlot.start_time)}
                </p>
              </div>

              {/* Concurrency Error Message */}
              {conflictError && (
                <div className="bg-rose-50 border-b border-rose-100 p-4 text-sm text-rose-800 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-rose-700">{conflictError}</p>
                    {suggestedSlot ? (
                      <div className="mt-3">
                        <p className="text-xs text-rose-600">We found the next available slot for you:</p>
                        <button
                          type="button"
                          onClick={handleBookSuggestedSlot}
                          disabled={isSubmitting}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition-all disabled:bg-rose-400"
                        >
                          Book Next Slot ({formatDateTab(new Date(suggestedSlot.date)).dayName} {new Date(suggestedSlot.date).getDate()} at {formatSlotTime(suggestedSlot.start_time)})
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-rose-600 mt-1">No other slots are available in the next 7 days.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Modal Form */}
              <form onSubmit={handleBookingSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto slot-grid">
                {/* Patient Name */}
                <div>
                  <label htmlFor="patient_name" className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Patient Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      id="patient_name"
                      name="patient_name"
                      required
                      aria-required="true"
                      placeholder="Enter patient's full name"
                      value={formData.patient_name}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-teal-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Patient Age */}
                  <div>
                    <label htmlFor="patient_age" className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Patient Age *
                    </label>
                    <input
                      type="number"
                      id="patient_age"
                      name="patient_age"
                      required
                      aria-required="true"
                      min="1"
                      max="120"
                      placeholder="Age"
                      value={formData.patient_age}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-teal-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-teal-500"
                    />
                  </div>

                  {/* Blood Group */}
                  <div>
                    <label htmlFor="blood_group" className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Blood Group
                    </label>
                    <select
                      id="blood_group"
                      name="blood_group"
                      value={formData.blood_group}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-teal-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      <option value="">Select Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                </div>

                {/* Patient Phone */}
                <div>
                  <label htmlFor="patient_phone" className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Phone Number *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      id="patient_phone"
                      name="patient_phone"
                      required
                      aria-required="true"
                      aria-describedby="phone-helper"
                      placeholder="Enter mobile number"
                      value={formData.patient_phone}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-teal-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-teal-500"
                    />
                  </div>
                  <span id="phone-helper" className="text-[10px] text-slate-400 mt-1 block">
                    Format: 10-digit mobile number (e.g. 9876543210)
                  </span>
                </div>

                {/* Health Summary Section */}
                <div className="border-t border-slate-100 pt-4 mt-6">
                  <span className="text-xs font-bold text-teal-700 uppercase tracking-wider block mb-3 flex items-center gap-1.5">
                    <ClipboardList className="h-4.5 w-4.5" />
                    Health Summary (Optional)
                  </span>
                  
                  <div className="space-y-4">
                    {/* Existing Conditions */}
                    <div>
                      <label htmlFor="conditions" className="text-xs font-bold text-slate-600 block mb-1">
                        Existing Medical Conditions
                      </label>
                      <textarea
                        id="conditions"
                        name="conditions"
                        rows={2}
                        placeholder="e.g. Hypertension, Diabetes, Asthma, None"
                        value={formData.conditions}
                        onChange={handleInputChange}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-teal-500 focus:bg-white resize-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      />
                    </div>

                    {/* Current Medications */}
                    <div>
                      <label htmlFor="medications" className="text-xs font-bold text-slate-600 block mb-1">
                        Current Medications
                      </label>
                      <textarea
                        id="medications"
                        name="medications"
                        rows={2}
                        placeholder="e.g. Metformin 500mg, None"
                        value={formData.medications}
                        onChange={handleInputChange}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-teal-500 focus:bg-white resize-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer Buttons */}
                <div className="border-t border-slate-100 pt-5 mt-6 flex gap-3">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 rounded-xl bg-teal-600 py-3 text-sm font-bold text-white shadow-md shadow-teal-600/10 hover:bg-teal-700 disabled:bg-teal-500/80 flex items-center justify-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Booking...
                      </>
                    ) : (
                      "Confirm Booking"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
