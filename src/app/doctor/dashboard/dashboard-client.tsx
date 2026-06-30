"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, Clock, User, Phone, Clipboard, FileText, 
  Settings, ChevronDown, ChevronUp, Plus, Check, X, ShieldAlert, Ban, Unlock,
  Package, AlertTriangle, Radio, Bell, RefreshCw
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { formatSlotTime, formatDateTime } from "@/lib/datetime";

interface Appointment {
  appointment_id: string;
  booking_id: string;
  diagnosis_notes: string | null;
  prescription: string | null;
  patient_name: string;
  patient_age: number;
  patient_phone: string;
  blood_group: string | null;
  conditions: string | null;
  medications: string | null;
  slot_id: string;
  date: string;
  start_time: string;
  end_time: string;
  slot_status: string;
}

interface Slot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
}

interface InventoryItem {
  id: string;
  item_name: string;
  current_stock: number;
  unit: string;
  threshold: number;
  last_updated_by: string | null;
  last_updated_at: string | null;
}

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  location: string;
  fee: number;
  photo_url: string;
}

interface DashboardClientProps {
  doctor: Doctor;
  initialAppointments: Appointment[];
  initialSlots: Slot[];
  initialInventory: InventoryItem[];
}

export default function DashboardClient({
  doctor,
  initialAppointments,
  initialSlots,
  initialInventory,
}: DashboardClientProps) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"agenda" | "slots" | "inventory">("agenda");
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  
  // Slot Management State
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [togglingSlotIds, setTogglingSlotIds] = useState<string[]>([]);

  // Inventory State
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [loadingInventory, setLoadingInventory] = useState(false);

  // Expandable Patient Detail State
  const [expandedApptId, setExpandedApptId] = useState<string | null>(null);

  // Clinical Notes Drawer State
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [notesForm, setNotesForm] = useState({
    diagnosis_notes: "",
    prescription: "",
  });
  const [savingNotes, setSavingNotes] = useState(false);

  // Broadcast Delay Modal State
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [delayAmount, setDelayAmount] = useState<number>(30); // default 30 mins
  const [broadcasting, setBroadcasting] = useState(false);

  // Fetch slots when date changes
  useEffect(() => {
    const fetchSlots = async () => {
      setLoadingSlots(true);
      try {
        const res = await fetch(`/api/doctor/slots?date=${selectedDate}`);
        const data = await res.json();
        if (res.ok) {
          setSlots(data.slots || []);
        } else {
          toast.error(data.error || "Failed to load slots");
        }
      } catch (err) {
        toast.error("Failed to fetch slots");
      } finally {
        setLoadingSlots(false);
      }
    };

    const isToday = selectedDate === new Date().toISOString().split("T")[0];
    if (!isToday) {
      fetchSlots();
    } else {
      setSlots(initialSlots);
    }
  }, [selectedDate, initialSlots]);

  // Fetch inventory
  const handleRefreshInventory = async () => {
    setLoadingInventory(true);
    try {
      const res = await fetch("/api/doctor/inventory");
      const data = await res.json();
      if (res.ok) {
        setInventory(data.inventory || []);
        toast.success("Inventory refreshed");
      } else {
        toast.error(data.error || "Failed to refresh inventory");
      }
    } catch (err) {
      toast.error("Failed to fetch inventory");
    } finally {
      setLoadingInventory(false);
    }
  };

  // Toggle slot block status
  const handleToggleSlot = async (slotId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "available" ? "blocked" : "available";
    
    setTogglingSlotIds((prev) => [...prev, slotId]);
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, status: nextStatus } : s))
    );

    try {
      const res = await fetch("/api/doctor/slots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slot_id: slotId,
          status: nextStatus,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSlots((prev) =>
          prev.map((s) => (s.id === slotId ? { ...s, status: currentStatus } : s))
        );
        toast.error(data.error || "Failed to update slot status");
      } else {
        toast.success(
          nextStatus === "blocked" 
            ? "Slot blocked successfully" 
            : "Slot is now available for patients"
        );
      }
    } catch (err) {
      setSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, status: currentStatus } : s))
      );
      toast.error("Failed to update slot status");
    } finally {
      setTogglingSlotIds((prev) => prev.filter((id) => id !== slotId));
    }
  };

  // Open Notes Drawer
  const openNotesDrawer = (appt: Appointment) => {
    setSelectedAppt(appt);
    setNotesForm({
      diagnosis_notes: appt.diagnosis_notes || "",
      prescription: appt.prescription || "",
    });
  };

  // Save Clinical Notes
  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppt) return;

    setSavingNotes(true);
    try {
      const res = await fetch("/api/doctor/appointments/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appointment_id: selectedAppt.appointment_id,
          ...notesForm,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAppointments((prev) =>
          prev.map((a) =>
            a.appointment_id === selectedAppt.appointment_id
              ? { 
                  ...a, 
                  diagnosis_notes: notesForm.diagnosis_notes, 
                  prescription: notesForm.prescription 
                }
              : a
          )
        );
        setSelectedAppt(null);
        toast.success("Clinical notes updated successfully!");
      } else {
        toast.error(data.error || "Failed to save clinical notes");
      }
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSavingNotes(false);
    }
  };

  // Send Broadcast Delay
  const handleSendBroadcast = async () => {
    setBroadcasting(true);
    try {
      const res = await fetch("/api/doctor/broadcast-delay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          delay: delayAmount,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message || `Notified patients of a ${delayAmount}-minute delay.`);
        setIsBroadcastModalOpen(false);
      } else {
        toast.error(data.error || "Failed to send broadcast");
      }
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBroadcasting(false);
    }
  };

  // Local datetime formatting helpers removed; using imports from src/lib/datetime.ts

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-6 mb-8 gap-4">
        <div className="flex items-center gap-4">
          <img
            src={doctor.photo_url}
            alt={doctor.name}
            className="h-14 w-14 rounded-full object-cover border-2 border-teal-600/10"
          />
          <div>
            <h1 className="font-sans text-2xl font-extrabold text-slate-900">
              Welcome back, {doctor.name}
            </h1>
            <p className="text-sm font-medium text-slate-500">
              {doctor.specialization} • Provider Dashboard
            </p>
          </div>
        </div>

        {/* Header Actions: Broadcast & Tabs */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Broadcast Delay Button */}
          <button
            onClick={() => setIsBroadcastModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-500/10 hover:bg-rose-600 transition-all active:scale-97"
          >
            <Bell className="h-4.5 w-4.5 animate-pulse" />
            Broadcast Delay
          </button>

          {/* Tab Controls */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setActiveTab("agenda")}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                activeTab === "agenda"
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              Today&apos;s Agenda
            </button>
            <button
              onClick={() => setActiveTab("slots")}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                activeTab === "slots"
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              Slots
            </button>
            <button
              onClick={() => setActiveTab("inventory")}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                activeTab === "inventory"
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              Inventory
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid gap-8">
        {activeTab === "agenda" && (
          /* Today's Agenda Tab */
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-teal-600" />
              Today&apos;s Appointments
              <span className="text-sm font-medium text-slate-400">
                ({appointments.length})
              </span>
            </h2>

            {appointments.length > 0 ? (
              <div className="space-y-4 max-w-4xl">
                {appointments.map((appt) => {
                  const isExpanded = expandedApptId === appt.appointment_id;

                  return (
                    <div
                      key={appt.appointment_id}
                      className="premium-card bg-white overflow-hidden border border-slate-200"
                    >
                      {/* Appointment Brief */}
                      <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="rounded-xl bg-teal-50 p-3 flex flex-col items-center justify-center shrink-0 min-w-[70px]">
                            <Clock className="h-4.5 w-4.5 text-teal-600" />
                            <span className="text-xs font-extrabold text-teal-800 mt-1">
                              {formatSlotTime(appt.start_time)}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-sans text-base font-bold text-slate-900">
                              {appt.patient_name}
                            </h3>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
                              <span>Age: {appt.patient_age} yrs</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5" />
                                {appt.patient_phone}
                              </span>
                              <span>•</span>
                              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold">
                                {appt.booking_id}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <button
                            onClick={() => openNotesDrawer(appt)}
                            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-98"
                          >
                            <FileText className="h-4 w-4" />
                            {appt.diagnosis_notes || appt.prescription ? "Edit Notes" : "Add Notes"}
                          </button>
                          <button
                            onClick={() => setExpandedApptId(isExpanded ? null : appt.appointment_id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                          >
                            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Health Summary & Notes */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            className="overflow-hidden bg-slate-50/50 border-t border-slate-100"
                          >
                            <div className="p-5 grid gap-6 sm:grid-cols-2">
                              {/* Left: Health Summary */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
                                  <Clipboard className="h-4 w-4" />
                                  Patient Health Summary
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="font-semibold text-slate-500">Blood Group:</span>{" "}
                                    <span className="font-bold text-slate-800">{appt.blood_group || "Not provided"}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-500 block">Medical Conditions:</span>
                                    <span className="text-slate-700 mt-0.5 block bg-white p-2.5 rounded-lg border border-slate-200/60 min-h-[45px] text-xs">
                                      {appt.conditions || "None reported"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-500 block">Current Medications:</span>
                                    <span className="text-slate-700 mt-0.5 block bg-white p-2.5 rounded-lg border border-slate-200/60 min-h-[45px] text-xs">
                                      {appt.medications || "None reported"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Right: Clinical Records */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
                                  <FileText className="h-4 w-4" />
                                  Diagnosis & Prescription
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="font-semibold text-slate-500 block">Diagnosis Notes:</span>
                                    <span className="text-slate-700 mt-0.5 block bg-white p-2.5 rounded-lg border border-slate-200/60 min-h-[45px] text-xs">
                                      {appt.diagnosis_notes || "No diagnosis notes yet."}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-500 block">Prescription:</span>
                                    <span className="text-slate-700 mt-0.5 block bg-white p-2.5 rounded-lg border border-slate-200/60 min-h-[45px] text-xs font-mono">
                                      {appt.prescription || "No prescription issued yet."}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="premium-card bg-white p-12 text-center max-w-4xl border border-slate-200">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
                  <Clock className="h-8 w-8 text-teal-600" />
                </div>
                <h3 className="font-sans text-lg font-bold text-slate-900">No Appointments Today</h3>
                <p className="mt-1 text-sm text-slate-500">
                  You don&apos;t have any scheduled appointments for today.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "slots" && (
          /* Slot Management Tab */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-teal-600" />
                Manage Calendar Slots
              </h2>

              {/* Date Picker */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-500">Select Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {loadingSlots ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 max-w-5xl">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : slots.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 max-w-5xl">
                {slots.map((slot) => {
                  const isBooked = slot.status === "booked";
                  const isBlocked = slot.status === "blocked";

                  return (
                    <div
                      key={slot.id}
                      className={`relative flex flex-col justify-between rounded-xl border p-4 transition-all ${
                        isBooked
                          ? "bg-teal-50/40 border-teal-100 text-teal-800"
                          : isBlocked
                            ? "bg-slate-50 border-slate-200 text-slate-400"
                            : "bg-white border-slate-200 text-slate-700"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-extrabold">
                            {formatSlotTime(slot.start_time)}
                          </span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isBooked
                              ? "bg-teal-100 text-teal-700"
                              : isBlocked
                                ? "bg-slate-200 text-slate-500"
                                : "bg-emerald-50 text-emerald-700"
                          }`}>
                            {slot.status}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-3">
                        {isBooked ? (
                          <span className="text-[11px] font-bold text-teal-600 block text-center py-1">
                            Reserved by Patient
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleSlot(slot.id, slot.status)}
                            disabled={togglingSlotIds.includes(slot.id)}
                            aria-label={isBlocked ? "Unblock Slot" : "Block Slot"}
                            className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all border active:scale-97 outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                              isBlocked
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                            } ${togglingSlotIds.includes(slot.id) ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            {togglingSlotIds.includes(slot.id) ? (
                              <>
                                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Updating...
                              </>
                            ) : isBlocked ? (
                              <>
                                <Unlock className="h-3.5 w-3.5" />
                                Unblock Slot
                              </>
                            ) : (
                              <>
                                <Ban className="h-3.5 w-3.5" />
                                Block Slot
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="premium-card bg-white p-12 text-center max-w-5xl border border-slate-200">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                  <Calendar className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="font-sans text-lg font-bold text-slate-900">No Slots Generated</h3>
                <p className="mt-1 text-sm text-slate-500">
                  There are no slots generated for this date in the database.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "inventory" && (
          /* Clinic Inventory Tab */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-teal-600" />
                Clinic Inventory
                <span className="text-xs text-slate-400 font-medium">(Updated live via staff WhatsApp)</span>
              </h2>

              {/* Refresh Button */}
              <button
                onClick={handleRefreshInventory}
                disabled={loadingInventory}
                className="flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loadingInventory ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            {loadingInventory ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-36 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : inventory.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl">
                {inventory.map((item) => {
                  const isLow = item.current_stock <= item.threshold;

                  return (
                    <div
                      key={item.id}
                      className={`premium-card bg-white p-5 border ${
                        isLow ? "border-rose-200 shadow-rose-100/50" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-sans text-sm font-bold text-slate-900 leading-tight">
                          {item.item_name}
                        </span>
                        {isLow && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-extrabold text-rose-700 border border-rose-100">
                            <AlertTriangle className="h-3 w-3" />
                            LOW STOCK
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span className={`text-3xl font-extrabold tracking-tight ${isLow ? "text-rose-600" : "text-slate-900"}`}>
                          {item.current_stock}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 uppercase">
                          {item.unit}
                        </span>
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-3 text-[10px] text-slate-400 font-medium">
                        <div>
                          Threshold: <span className="font-bold text-slate-500">{item.threshold} {item.unit}</span>
                        </div>
                        <div className="mt-1">
                          Updated: {item.last_updated_by ? `${item.last_updated_by} (${formatDateTime(item.last_updated_at)})` : "Never"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="premium-card bg-white p-12 text-center max-w-5xl border border-slate-200">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                  <Package className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="font-sans text-lg font-bold text-slate-900">Inventory Empty</h3>
                <p className="mt-1 text-sm text-slate-500">
                  There are no inventory items seeded.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clinical Notes Slide-Over Drawer */}
      <AnimatePresence>
        {selectedAppt && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!savingNotes) setSelectedAppt(null);
              }}
              className="absolute inset-0 bg-slate-900/30 backdrop-blur-xs"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="relative z-10 w-full max-w-md bg-white shadow-2xl flex flex-col h-full border-l border-slate-200"
            >
              <div className="border-b border-slate-100 p-6 flex items-center justify-between">
                <div>
                  <h3 className="font-sans text-lg font-bold text-slate-900">
                    Clinical Consultation
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Patient: {selectedAppt.patient_name} ({selectedAppt.patient_age} yrs)
                  </p>
                </div>
                <button
                  disabled={savingNotes}
                  onClick={() => setSelectedAppt(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSaveNotes} className="flex-1 flex flex-col justify-between overflow-hidden">
                <div className="p-6 space-y-5 flex-1 overflow-y-auto slot-grid">
                  <div>
                    <label htmlFor="diagnosis_notes" className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                      Diagnosis Notes
                    </label>
                    <textarea
                      id="diagnosis_notes"
                      name="diagnosis_notes"
                      rows={5}
                      required
                      aria-required="true"
                      aria-label="Diagnosis Notes"
                      placeholder="Describe symptoms, clinical findings, and diagnosis..."
                      value={notesForm.diagnosis_notes}
                      onChange={(e) => setNotesForm((prev) => ({ ...prev, diagnosis_notes: e.target.value }))}
                      disabled={savingNotes}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-teal-500 focus:bg-white resize-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="prescription" className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                      Prescription
                    </label>
                    <textarea
                      id="prescription"
                      name="prescription"
                      rows={5}
                      required
                      aria-required="true"
                      aria-label="Prescription"
                      aria-describedby="prescription-helper"
                      placeholder="e.g.&#10;1. Tab. Paracetamol 650mg — 1-0-1 (After Food) — 3 days&#10;2. Syr. Benadryl 10ml — 0-0-1 (Before Bed) — 5 days"
                      value={notesForm.prescription}
                      onChange={(e) => setNotesForm((prev) => ({ ...prev, prescription: e.target.value }))}
                      disabled={savingNotes}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-teal-500 focus:bg-white font-mono resize-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    />
                    <span id="prescription-helper" className="text-[10px] text-slate-400 mt-1.5 block">
                      Format: Specify dosage and duration (e.g. Tab. Paracetamol 650mg — 1-0-1 — 3 days)
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-100 p-6 bg-slate-50/50 flex gap-3">
                  <button
                    type="button"
                    disabled={savingNotes}
                    onClick={() => setSelectedAppt(null)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-50"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={savingNotes}
                    className="flex-1 rounded-xl bg-teal-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-600/10 hover:bg-teal-700 disabled:bg-teal-500/80 flex items-center justify-center gap-1.5"
                  >
                    {savingNotes ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Saving...
                      </>
                    ) : (
                      "Save Records"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Broadcast Delay Modal */}
      <AnimatePresence>
        {isBroadcastModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!broadcasting) setIsBroadcastModalOpen(false);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl p-6"
            >
              <h3 className="font-sans text-lg font-bold text-slate-900 flex items-center gap-2">
                <Bell className="h-5 w-5 text-rose-500 shrink-0" />
                Broadcast Appointment Delay
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                Running behind schedule? Notify all patients who have booked remaining appointments today. They will receive a WhatsApp message with their revised appointment times.
              </p>

              {/* Delay Selector */}
              <div className="mt-6 space-y-4">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Select Delay Time:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 45, 60].map((min) => (
                    <button
                      key={min}
                      type="button"
                      onClick={() => setDelayAmount(min)}
                      className={`rounded-xl py-3 text-center text-sm font-bold border transition-all ${
                        delayAmount === min
                          ? "bg-rose-50 text-rose-700 border-rose-400 ring-1 ring-rose-400"
                          : "bg-white text-slate-700 border-slate-200 hover:border-rose-400/30 hover:bg-rose-50/10"
                      }`}
                    >
                      {min}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 border-t border-slate-100 pt-5 flex gap-3">
                <button
                  type="button"
                  disabled={broadcasting}
                  onClick={() => setIsBroadcastModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendBroadcast}
                  disabled={broadcasting}
                  className="flex-1 rounded-xl bg-rose-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-500/10 hover:bg-rose-600 disabled:bg-rose-400 flex items-center justify-center gap-1.5"
                >
                  {broadcasting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Sending...
                    </>
                  ) : (
                    "Send Broadcast"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
