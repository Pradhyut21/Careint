import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";

// GET: Fetch slots for the logged-in doctor on a specific date
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");

    if (!dateStr) {
      return NextResponse.json({ error: "Missing date parameter" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // Get doctor ID from email
      const docRes = await client.query("SELECT id FROM doctors WHERE email = $1", [session.user.email]);
      if (docRes.rows.length === 0) {
        return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
      }
      const doctorId = docRes.rows[0].id;

      // Fetch slots
      const slotsRes = await client.query(
        `SELECT id, date, start_time, end_time, status 
         FROM slots 
         WHERE doctor_id = $1 AND date = $2
         ORDER BY start_time ASC`,
        [doctorId, dateStr]
      );

      return NextResponse.json({ slots: slotsRes.rows }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Fetch slots API error:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

// POST: Toggle slot block status (available/blocked)
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { slot_id, status } = body;

    if (!slot_id || !status || !["available", "blocked"].includes(status)) {
      return NextResponse.json({ error: "Invalid slot_id or status" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // Get doctor ID from email
      const docRes = await client.query("SELECT id FROM doctors WHERE email = $1", [session.user.email]);
      if (docRes.rows.length === 0) {
        return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
      }
      const doctorId = docRes.rows[0].id;

      // Update slot status, but only if it belongs to this doctor and is not currently 'booked'
      const updateRes = await client.query(
        `UPDATE slots 
         SET status = $1 
         WHERE id = $2 AND doctor_id = $3 AND status != 'booked'
         RETURNING id, status`,
        [status, slot_id, doctorId]
      );

      if (updateRes.rows.length === 0) {
        return NextResponse.json(
          { error: "Slot not found, does not belong to you, or is already booked" },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, slot: updateRes.rows[0] }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Toggle slot API error:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
export const runtime = "nodejs";
