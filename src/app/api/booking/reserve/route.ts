import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slot_id, session_token } = body;

    if (!slot_id || !session_token) {
      return NextResponse.json(
        { error: "Missing required fields: slot_id, session_token" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      // Attempt to reserve the slot. 
      // It must be status = 'available' and either:
      // 1. Never reserved (reserved_until IS NULL)
      // 2. Reservation expired (reserved_until < NOW())
      // 3. Already reserved by the SAME session token (allows updating/refreshing the timer)
      const reserveRes = await client.query(
        `UPDATE slots 
         SET reserved_until = NOW() + INTERVAL '5 minutes', 
             reserved_by = $1 
         WHERE id = $2 
           AND status = 'available' 
           AND (reserved_until IS NULL OR reserved_until < NOW() OR reserved_by = $1)
         RETURNING id, reserved_until`,
        [session_token, slot_id]
      );

      if (reserveRes.rows.length === 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: "This slot is temporarily reserved by another patient or is no longer available." 
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Slot reserved for 5 minutes.",
        reserved_until: reserveRes.rows[0].reserved_until,
      }, { status: 200 });

    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Slot reservation API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
export const runtime = "nodejs";
