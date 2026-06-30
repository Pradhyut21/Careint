import { z } from "zod";

// Phone number regex supporting:
// 1. 10-digit Indian numbers (e.g. 9876543210)
// 2. International E.164 format (e.g. +919876543210, +12345678901)
const phoneRegex = /^(\+\d{1,3})?\d{10,14}$/;

export const bookingSchema = z.object({
  slot_id: z.string().uuid("Invalid slot ID format. Must be a valid UUID."),
  patient_name: z
    .string()
    .min(1, "Patient name is required.")
    .max(100, "Patient name cannot exceed 100 characters.")
    .trim(),
  patient_age: z
    .coerce
    .number()
    .int("Age must be an integer.")
    .min(1, "Age must be at least 1 year.")
    .max(120, "Age cannot exceed 120 years."),
  patient_phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits.")
    .max(15, "Phone number cannot exceed 15 digits.")
    .regex(phoneRegex, "Invalid phone number format. Must be a 10-digit Indian number or in E.164 format."),
  blood_group: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", ""])
    .optional()
    .nullable(),
  conditions: z
    .string()
    .max(500, "Conditions description cannot exceed 500 characters.")
    .optional()
    .nullable(),
  medications: z
    .string()
    .max(500, "Medications description cannot exceed 500 characters.")
    .optional()
    .nullable(),
});

export type BookingInput = z.infer<typeof bookingSchema>;
