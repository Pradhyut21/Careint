import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      const inventoryRes = await client.query(
        "SELECT * FROM inventory ORDER BY item_name ASC"
      );
      return NextResponse.json({ inventory: inventoryRes.rows }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Fetch inventory API error:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
export const runtime = "nodejs";
