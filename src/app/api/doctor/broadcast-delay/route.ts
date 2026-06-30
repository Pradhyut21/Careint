import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { sendWhatsAppText } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { delay } = body; // Delay in minutes (e.g. 15, 30, 45, 60)

    if (!delay || typeof delay !== "number" || delay <= 0) {
      return NextResponse.json({ error: "Invalid delay amount" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // Get doctor profile
      const docRes = await client.query("SELECT id, name FROM doctors WHERE email = $1", [session.user.email]);
      if (docRes.rows.length === 0) {
        return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
      }
      const doctor = docRes.rows[0];

      // Fetch all remaining booked appointments for today
      const appointmentsRes = await client.query(
        `SELECT a.id, p.name as patient_name, p.phone as patient_phone, s.start_time
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         JOIN slots s ON a.slot_id = s.id
         WHERE a.doctor_id = $1 
           AND s.date = CURRENT_DATE 
           AND s.start_time > CURRENT_TIME
         ORDER BY s.start_time ASC`,
        [doctor.id]
      );

      const appointments = appointmentsRes.rows;

      if (appointments.length === 0) {
        return NextResponse.json({ success: true, count: 0, message: "No upcoming appointments today to notify." }, { status: 200 });
      }

      // Send WhatsApp notifications to each patient
      let successCount = 0;
      for (const appt of appointments) {
        const [hours, minutes] = appt.start_time.split(":");
        const time = new Date();
        time.setHours(parseInt(hours), parseInt(minutes) + delay, 0);
        
        const revisedTimeStr = time.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

        const msg = `Dear ${appt.patient_name}, Dr. ${doctor.name} is running approximately ${delay} minutes late today. Your revised appointment time is around *${revisedTimeStr}*. Thank you for your patience! — CareLoop 🏥`;
        
        const res = await sendWhatsAppText(appt.patient_phone, msg);
        if (res.success) {
          successCount++;
        }
      }

      return NextResponse.json({
        success: true,
        count: successCount,
        message: `Successfully notified ${successCount} patients about the ${delay}-minute delay.`,
      }, { status: 200 });

    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Broadcast delay API error:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
export const runtime = "nodejs";
