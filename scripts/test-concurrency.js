const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// 1. Manually parse .env.local to avoid external dependency issues
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

const dbUrl = process.env.DATABASE_URL;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

if (!dbUrl) {
  console.error("Error: DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function runTest() {
  console.log("=== CareLoop Concurrency Test ===");
  console.log(`Connecting to database...`);
  
  const client = await pool.connect();
  
  try {
    // 1. Clean up previous test data if any
    console.log("Cleaning up previous test data...");
    await client.query("DELETE FROM appointments WHERE booking_id LIKE 'TEST-%'");
    await client.query("DELETE FROM slots WHERE doctor_id IN (SELECT id FROM doctors WHERE name = 'Dr. Concurrency Test')");
    await client.query("DELETE FROM doctors WHERE name = 'Dr. Concurrency Test'");

    // 2. Seed a test doctor
    console.log("Seeding test doctor...");
    const docRes = await client.query(
      `INSERT INTO doctors (name, email, specialization, location, fee, bio, years_experience) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id`,
      [
        "Dr. Concurrency Test",
        "concurrency.test@careloop.com",
        "Cardiology",
        "Test Clinic, Bangalore",
        500,
        "An AI-generated doctor profile for testing concurrent booking requests.",
        10,
      ]
    );
    const doctorId = docRes.rows[0].id;

    // 3. Seed two slots
    console.log("Seeding slots...");
    // Slot 1: The target slot for double booking
    const slot1Res = await client.query(
      `INSERT INTO slots (doctor_id, date, start_time, end_time, status) 
       VALUES ($1, CURRENT_DATE + INTERVAL '1 day', '10:00:00', '10:30:00', 'available') 
       RETURNING id`,
      [doctorId]
    );
    const slotId1 = slot1Res.rows[0].id;

    // Slot 2: The next available slot that should be suggested when Slot 1 is booked
    const slot2Res = await client.query(
      `INSERT INTO slots (doctor_id, date, start_time, end_time, status) 
       VALUES ($1, CURRENT_DATE + INTERVAL '1 day', '10:30:00', '11:00:00', 'available') 
       RETURNING id`,
      [doctorId]
    );
    const slotId2 = slot2Res.rows[0].id;

    console.log(`Created Test Doctor ID: ${doctorId}`);
    console.log(`Created Target Slot (Slot 1) ID: ${slotId1} (Time: 10:00 AM)`);
    console.log(`Created Backup Slot (Slot 2) ID: ${slotId2} (Time: 10:30 AM)`);
    console.log(`\nStarting concurrent requests to ${appUrl}/api/booking...`);
    console.log("Make sure your Next.js server is running! (npm run dev)");

    // Define the booking payloads
    const payload1 = {
      slot_id: slotId1,
      patient_name: "Alice Smith",
      patient_age: 28,
      patient_phone: "+919876543210",
      blood_group: "O+",
      conditions: "None",
      medications: "None",
    };

    const payload2 = {
      slot_id: slotId1, // Same slot ID!
      patient_name: "Bob Jones",
      patient_age: 35,
      patient_phone: "+919876543211",
      blood_group: "A-",
      conditions: "Hypertension",
      medications: "Lisinopril",
    };

    // Helper to send a booking request
    const sendBooking = async (name, payload) => {
      try {
        const res = await fetch(`${appUrl}/api/booking`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        return { name, status: res.status, data };
      } catch (err) {
        return { name, error: err.message };
      }
    };

    // Fire both requests in parallel
    const [res1, res2] = await Promise.all([
      sendBooking("Request 1 (Alice)", payload1),
      sendBooking("Request 2 (Bob)", payload2),
    ]);

    console.log("\n=== CONCURRENCY TEST RESULTS ===");
    console.log("--------------------------------");
    [res1, res2].forEach((res) => {
      if (res.error) {
        console.error(`[${res.name}] Failed to send request:`, res.error);
        return;
      }
      console.log(`[${res.name}] HTTP Status: ${res.status}`);
      console.log(`[${res.name}] Response:`, JSON.stringify(res.data, null, 2));
      console.log("--------------------------------");
    });

    // Validation
    const success = [res1, res2].filter((r) => r.status === 200);
    const conflict = [res1, res2].filter((r) => r.status === 409);

    if (success.length === 1 && conflict.length === 1) {
      console.log("\n✅ SUCCESS: Double-booking prevented successfully!");
      console.log(`- ${success[0].name} successfully booked the slot.`);
      console.log(`- ${conflict[0].name} was rejected with 409 Conflict.`);
      console.log(`- Suggested next slot ID: ${conflict[0].data.next_available_slot?.id} (Time: ${conflict[0].data.next_available_slot?.start_time})`);
    } else {
      console.log("\n❌ FAILURE: Concurrency check failed.");
      console.log(`Success count: ${success.length} (expected 1)`);
      console.log(`Conflict count: ${conflict.length} (expected 1)`);
    }

  } catch (error) {
    console.error("Test execution error:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

runTest();
