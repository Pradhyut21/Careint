import { pool } from "@/lib/db";
import { notFound } from "next/navigation";
import DoctorProfileClient from "./doctor-profile-client";

export const dynamic = "force-dynamic";

async function getDoctorData(id: string) {
  let client;
  try {
    client = await pool.connect();
    // Fetch Doctor Profile
    const docRes = await client.query("SELECT * FROM doctors WHERE id = $1", [id]);
    if (docRes.rows.length === 0) {
      return null;
    }

    // Fetch Slots for the next 7 days (including today)
    const slotsRes = await client.query(
      `SELECT id, date, start_time, end_time, status, reserved_until, reserved_by 
       FROM slots 
       WHERE doctor_id = $1 
         AND date >= CURRENT_DATE 
         AND (date > CURRENT_DATE OR start_time > CURRENT_TIME)
       ORDER BY date ASC, start_time ASC`,
      [id]
    );

    return {
      doctor: docRes.rows[0],
      slots: slotsRes.rows,
    };
  } catch (error) {
    console.error(`Failed to fetch doctor profile for ID ${id}:`, error);
    return null;
  } finally {
    if (client) {
      client.release();
    }
  }
}

export default async function DoctorProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const data = await getDoctorData(params.id);

  if (!data) {
    notFound();
  }

  return <DoctorProfileClient doctor={data.doctor} initialSlots={data.slots} />;
}
