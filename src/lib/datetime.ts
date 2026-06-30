// Consolidated Date and Time formatting utilities for CareLoop

export function formatDateTab(date: Date) {
  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
  const dayNum = date.getDate();
  return {
    dayName,
    dayNum,
    dateStr: date.toISOString().split("T")[0],
  };
}

export function formatDateLong(dateStr: string | Date | null) {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatSlotTime(timeStr: string) {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

export function formatDateTime(dateStr: string | Date | null) {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatNextAvailable(slot: { date: string; start_time: string } | null) {
  if (!slot) return "No slots available";
  
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  
  const slotDate = new Date(slot.date).toISOString().split("T")[0];
  
  let dateStr = "";
  if (slotDate === today) {
    dateStr = "Today";
  } else if (slotDate === tomorrowStr) {
    dateStr = "Tomorrow";
  } else {
    dateStr = new Date(slot.date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  return `Next available: ${dateStr} ${formatSlotTime(slot.start_time)}`;
}
