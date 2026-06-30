import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";

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
    const { appointment_id, diagnosis_notes, prescription } = body;

    if (!appointment_id || diagnosis_notes === undefined || prescription === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: appointment_id, diagnosis_notes, prescription" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      // Get doctor ID from email
      const docRes = await client.query("SELECT id FROM doctors WHERE email = $1", [session.user.email]);
      if (docRes.rows.length === 0) {
        return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
      }
      const doctorId = docRes.rows[0].id;

      // Update appointment notes, verifying that this appointment belongs to the logged-in doctor
      const updateRes = await client.query(
        `UPDATE appointments 
         SET diagnosis_notes = $1, prescription = $2 
         WHERE id = $3 AND doctor_id = $4
         RETURNING id`,
        [diagnosis_notes, prescription, appointment_id, doctorId]
      );

      if (updateRes.rows.length === 0) {
        return NextResponse.json(
          { error: "Appointment not found or does not belong to you" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, appointment_id: updateRes.rows[0].id }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Save clinical notes API error:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
export const runtime = "nodejs";
