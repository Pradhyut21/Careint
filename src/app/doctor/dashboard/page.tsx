import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

async function getDashboardData(email: string) {
  const client = await pool.connect();
  try {
    // 1. Get Doctor Profile
    const docRes = await client.query("SELECT * FROM doctors WHERE email = $1", [email]);
    if (docRes.rows.length === 0) {
      return null;
    }
    const doctor = docRes.rows[0];

    const todayStr = new Date().toISOString().split("T")[0];

    // 2. Get Today's Appointments
    const appointmentsRes = await client.query(
      `SELECT a.id as appointment_id, a.booking_id, a.diagnosis_notes, a.prescription,
              p.name as patient_name, p.age as patient_age, p.phone as patient_phone, 
              p.blood_group, p.conditions, p.medications,
              s.id as slot_id, s.date, s.start_time, s.end_time, s.status as slot_status
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN slots s ON a.slot_id = s.id
       WHERE a.doctor_id = $1 AND s.date = $2
       ORDER BY s.start_time ASC`,
      [doctor.id, todayStr]
    );

    // 3. Get Today's Slots
    const slotsRes = await client.query(
      `SELECT id, date, start_time, end_time, status 
       FROM slots 
       WHERE doctor_id = $1 AND date = $2
       ORDER BY start_time ASC`,
      [doctor.id, todayStr]
    );

    // 4. Get Inventory Data
    const inventoryRes = await client.query(
      `SELECT * FROM inventory ORDER BY item_name ASC`
    );

    return {
      doctor,
      initialAppointments: appointmentsRes.rows,
      initialSlots: slotsRes.rows,
      initialInventory: inventoryRes.rows,
    };
  } catch (error) {
    console.error("Failed to fetch doctor dashboard data:", error);
    return null;
  } finally {
    client.release();
  }
}

export default async function DoctorDashboardPage() {
  const session = await auth.api.getSession({
    headers: headers(),
  });

  if (!session) {
    redirect("/doctor/login");
  }

  const data = await getDashboardData(session.user.email);

  if (!data) {
    redirect("/");
  }

  return (
    <DashboardClient
      doctor={data.doctor}
      initialAppointments={data.initialAppointments}
      initialSlots={data.initialSlots}
      initialInventory={data.initialInventory}
    />
  );
}
