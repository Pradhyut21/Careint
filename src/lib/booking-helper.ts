import { pool } from "./db";
import { bookingSchema } from "./validation";
import sanitizeHtml from "sanitize-html";

export interface BookingResult {
  success: boolean;
  booking?: {
    id: string;
    booking_id: string;
    created_at: string;
    doctor_name: string;
    specialization: string;
    location: string;
    slot_id: string;
  };
  error?: string;
  message?: string;
  next_available_slot?: {
    id: string;
    date: string;
    start_time: string;
  } | null;
  status: number;
}

export async function bookAppointment(params: {
  slot_id: string;
  patient_name: string;
  patient_age: number;
  patient_phone: string;
  blood_group?: string | null;
  conditions?: string | null;
  medications?: string | null;
  session_token?: string | null; // Optional token for soft reservation validation
}): Promise<BookingResult> {
  // 1. Zod Input Validation
  const validation = bookingSchema.safeParse(params);
  if (!validation.success) {
    const firstError = validation.error.issues[0]?.message || "Invalid inputs";
    return {
      success: false,
      error: "validation_error",
      message: firstError,
      status: 400,
    };
  }

  const {
    slot_id,
    patient_name,
    patient_age,
    patient_phone,
    blood_group,
    conditions,
    medications,
  } = validation.data;

  const { session_token = null } = params;

  // 2. Input Sanitization & Empty String to Null Conversion
  const cleanConditions = conditions 
    ? sanitizeHtml(conditions, { allowedTags: [], allowedAttributes: {} }) 
    : null;
  const cleanMedications = medications 
    ? sanitizeHtml(medications, { allowedTags: [], allowedAttributes: {} }) 
    : null;

  const finalBloodGroup = blood_group && blood_group.trim() !== "" ? blood_group : null;
  const finalConditions = cleanConditions && cleanConditions.trim() !== "" ? cleanConditions : null;
  const finalMedications = cleanMedications && cleanMedications.trim() !== "" ? cleanMedications : null;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 3. Get slot details and verify availability & reservations
    const slotRes = await client.query(
      `SELECT doctor_id, date, start_time, status, reserved_until, reserved_by 
       FROM slots WHERE id = $1`,
      [slot_id]
    );

    if (slotRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: "Slot not found",
        status: 404,
      };
    }

    const { doctor_id, status: slotStatus, reserved_until, reserved_by } = slotRes.rows[0];

    if (slotStatus === "blocked" || slotStatus === "booked") {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: `This slot is no longer available (Status: ${slotStatus})`,
        status: 400,
      };
    }

    // Check soft reservation:
    // If the slot is reserved by someone else and the reservation hasn't expired yet, reject the booking.
    if (
      reserved_until &&
      new Date(reserved_until).getTime() > Date.now() &&
      reserved_by !== session_token
    ) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: "slot_temporarily_reserved",
        message: "This slot is temporarily reserved by another patient. Please choose another time.",
        status: 409,
      };
    }

    // 4. Insert or find patient by phone number (atomic UPSERT)
    const patientRes = await client.query(
      `INSERT INTO patients (name, age, phone, blood_group, conditions, medications) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (phone) DO UPDATE 
       SET name = EXCLUDED.name, 
           age = EXCLUDED.age, 
           blood_group = COALESCE(EXCLUDED.blood_group, patients.blood_group), 
           conditions = COALESCE(EXCLUDED.conditions, patients.conditions), 
           medications = COALESCE(EXCLUDED.medications, patients.medications) 
       RETURNING id`,
      [patient_name, patient_age, patient_phone, finalBloodGroup, finalConditions, finalMedications]
    );
    const patientId = patientRes.rows[0].id;

    // 5. Generate a unique short booking ID
    const booking_id = `CL-${Math.floor(100000 + Math.random() * 900000)}`;

    // 6. Insert the appointment (enforcing slot_id UNIQUE constraint)
    let appointmentRes;
    try {
      appointmentRes = await client.query(
        `INSERT INTO appointments (slot_id, patient_id, doctor_id, booking_id) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, booking_id, created_at`,
        [slot_id, patientId, doctor_id, booking_id]
      );
    } catch (err: any) {
      if (err.code === "23505") {
        await client.query("ROLLBACK");

        // ONLY handle as double-booking if the slot_id unique constraint specifically violated
        if (err.constraint === "appointments_slot_id_key") {
          // Find the next available slot for the doctor
          const nextSlotRes = await client.query(
            `SELECT id, date, start_time 
             FROM slots 
             WHERE doctor_id = $1 
               AND status = 'available' 
               AND (date > CURRENT_DATE OR (date = CURRENT_DATE AND start_time > CURRENT_TIME))
               AND (reserved_until IS NULL OR reserved_until < NOW())
             ORDER BY date ASC, start_time ASC 
             LIMIT 1`,
            [doctor_id]
          );

          const nextSlot = nextSlotRes.rows[0] || null;

          return {
            success: false,
            error: "slot no longer available",
            message: "This slot was just booked by another patient. Please choose another time.",
            next_available_slot: nextSlot
              ? {
                  id: nextSlot.id,
                  date: nextSlot.date,
                  start_time: nextSlot.start_time,
                }
              : null,
            status: 409,
          };
        }
      }
      // Rethrow other database errors
      throw err;
    }

    // 7. Update slot status to 'booked' and clear reservation info
    await client.query(
      `UPDATE slots 
       SET status = 'booked', reserved_until = null, reserved_by = null 
       WHERE id = $1`,
      [slot_id]
    );

    await client.query("COMMIT");

    // Retrieve doctor details for the response
    const docRes = await client.query("SELECT name, specialization, location FROM doctors WHERE id = $1", [doctor_id]);
    const doctor = docRes.rows[0];

    return {
      success: true,
      booking: {
        id: appointmentRes.rows[0].id,
        booking_id: appointmentRes.rows[0].booking_id,
        created_at: appointmentRes.rows[0].created_at,
        doctor_name: doctor.name,
        specialization: doctor.specialization,
        location: doctor.location,
        slot_id,
      },
      status: 200,
    };
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Internal booking helper error:", error);
    return {
      success: false,
      error: "Internal server error",
      message: error.message,
      status: 500,
    };
  } finally {
    client.release();
  }
}
