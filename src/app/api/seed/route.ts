import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";
import fs from "fs";
import path from "path";

// 6 diverse, professional doctor profiles with Unsplash headshots
const SEED_DOCTORS = [
  {
    name: "Dr. Sarah Jenkins",
    email: "sarah.jenkins@careloop.com",
    specialization: "Pediatrics",
    location: "Koramangala, Bangalore",
    fee: 600,
    photo_url: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300&h=300",
    bio: "Dedicated pediatrician with over 12 years of experience. Specializes in childhood development, immunizations, and pediatric asthma management. Passionate about making healthcare a gentle experience for children.",
    years_experience: 12,
  },
  {
    name: "Dr. Rajesh Kumar",
    email: "rajesh.kumar@careloop.com",
    specialization: "Cardiology",
    location: "Connaught Place, Delhi",
    fee: 800,
    photo_url: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=300&h=300",
    bio: "Interventional cardiologist with 18+ years of experience. Expert in managing hypertension, coronary artery disease, and preventive cardiology. Completed his fellowship at the National Heart Institute.",
    years_experience: 18,
  },
  {
    name: "Dr. Amit Patel",
    email: "amit.patel@careloop.com",
    specialization: "General Physician",
    location: "Andheri West, Mumbai",
    fee: 400,
    photo_url: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=300&h=300",
    bio: "Compassionate family physician focusing on comprehensive primary care, lifestyle medicine, and chronic disease management (diabetes, thyroid disorders). Believes in patient-centric care.",
    years_experience: 8,
  },
  {
    name: "Dr. Priya Nair",
    email: "priya.nair@careloop.com",
    specialization: "Dermatology",
    location: "Adyar, Chennai",
    fee: 700,
    photo_url: "https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=300&h=300",
    bio: "Board-certified dermatologist specializing in medical and cosmetic dermatology. Expert in acne treatments, skin cancer screenings, anti-aging therapies, and hair loss management.",
    years_experience: 10,
  },
  {
    name: "Dr. Marcus Vance",
    email: "marcus.vance@careloop.com",
    specialization: "Orthopedics",
    location: "Gachibowli, Hyderabad",
    fee: 750,
    photo_url: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=300&h=300",
    bio: "Orthopedic surgeon specializing in sports medicine, joint replacements, and minimally invasive arthroscopic surgeries. Dedicated to helping patients regain mobility and live pain-free.",
    years_experience: 15,
  },
  {
    name: "Dr. Aisha Rahman",
    email: "aisha.rahman@careloop.com",
    specialization: "Gynecology",
    location: "Koregaon Park, Pune",
    fee: 650,
    photo_url: "https://images.unsplash.com/photo-1614608682850-e0d6ed316d47?auto=format&fit=crop&q=80&w=300&h=300",
    bio: "Experienced obstetrician and gynecologist specializing in high-risk pregnancies, reproductive endocrinology, and minimally invasive gynecological surgeries. Committed to women's wellness.",
    years_experience: 9,
  },
];

const TIME_SLOTS = [
  "09:00:00",
  "09:30:00",
  "10:00:00",
  "10:30:00",
  "11:00:00",
  "11:30:00",
  "14:00:00",
  "14:30:00",
  "15:00:00",
  "15:30:00",
  "16:00:00",
  "16:30:00",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const SEED_SECRET = process.env.SEED_SECRET;

  if (!SEED_SECRET || secret !== SEED_SECRET) {
    return NextResponse.json(
      { error: "Forbidden. Seeding is only allowed with the correct SEED_SECRET." },
      { status: 403 }
    );
  }

  const reset = searchParams.get("reset") === "true";
  const client = await pool.connect();
  try {
    console.log("Starting database seeding...");

    if (reset) {
      console.log("Resetting database (dropping all tables)...");
      await client.query(`
        DROP TABLE IF EXISTS appointments CASCADE;
        DROP TABLE IF EXISTS slots CASCADE;
        DROP TABLE IF EXISTS patients CASCADE;
        DROP TABLE IF EXISTS doctors CASCADE;
        DROP TABLE IF EXISTS whatsapp_sessions CASCADE;
        DROP TABLE IF EXISTS staff CASCADE;
        DROP TABLE IF EXISTS inventory CASCADE;
        DROP TABLE IF EXISTS session CASCADE;
        DROP TABLE IF EXISTS account CASCADE;
        DROP TABLE IF EXISTS "user" CASCADE;
        DROP TABLE IF EXISTS verification CASCADE;
      `);
      console.log("All tables dropped.");
    }

    // 1. Run schema.sql to ensure tables exist
    const schemaPath = path.resolve(process.cwd(), "schema.sql");
    if (fs.existsSync(schemaPath)) {
      console.log("Running schema.sql...");
      const schemaSql = fs.readFileSync(schemaPath, "utf8");
      // Split by semicolon, but be careful with functions/triggers if any (we don't have any, so simple split is fine)
      const queries = schemaSql
        .split(";")
        .map((q) => q.trim())
        .filter((q) => q.length > 0);
      for (const q of queries) {
        await client.query(q);
      }
      console.log("Schema initialized successfully.");
    }

    // 2. Check if doctors are already seeded
    const docCheck = await client.query("SELECT COUNT(*) FROM doctors");
    const docCount = parseInt(docCheck.rows[0].count);

    if (docCount > 0) {
      return NextResponse.json({
        message: "Database already seeded.",
        doctors_count: docCount,
      });
    }

    console.log("Seeding doctors and slots...");

    // Seed doctors
    for (const doc of SEED_DOCTORS) {
      // 2a. Create Better Auth User
      let userId = "";
      try {
        const authUser = await auth.api.signUpEmail({
          body: {
            email: doc.email,
            password: "password123",
            name: doc.name,
          },
        });
        userId = authUser.user.id;
        console.log(`Created Better Auth user for ${doc.name} (${userId})`);
      } catch (authErr: any) {
        console.warn(`Better Auth user creation warning for ${doc.email}:`, authErr.message);
        // If user already exists, retrieve ID
        const existingUser = await client.query('SELECT id FROM "user" WHERE email = $1', [doc.email]);
        if (existingUser.rows.length > 0) {
          userId = existingUser.rows[0].id;
        }
      }

      // 2b. Insert Doctor Profile
      const docInsert = await client.query(
        `INSERT INTO doctors (name, email, specialization, location, fee, photo_url, bio, years_experience) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id`,
        [
          doc.name,
          doc.email,
          doc.specialization,
          doc.location,
          doc.fee,
          doc.photo_url,
          doc.bio,
          doc.years_experience,
        ]
      );
      const doctorId = docInsert.rows[0].id;
      console.log(`Seeded doctor profile: ${doc.name} with ID: ${doctorId}`);

      // 2c. Generate slots for next 7 days
      // Today is Day 0, up to Day 6
      for (let day = 0; day < 7; day++) {
        const date = new Date();
        date.setDate(date.getDate() + day);
        const dateString = date.toISOString().split("T")[0];

        for (const time of TIME_SLOTS) {
          const endHour = parseInt(time.split(":")[0]);
          const endMin = parseInt(time.split(":")[1]) + 30;
          const endTimeStr = endMin === 60 
            ? `${String(endHour + 1).padStart(2, "0")}:00:00` 
            : `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}:00`;

          await client.query(
            `INSERT INTO slots (doctor_id, date, start_time, end_time, status) 
             VALUES ($1, $2, $3, $4, 'available')`,
            [doctorId, dateString, time, endTimeStr]
          );
        }
      }
      console.log(`Generated 7 days of slots for ${doc.name}`);
    }

    // 3. Seed a few appointments for today for "Dr. Sarah Jenkins" and "Dr. Rajesh Kumar" to populate the dashboard
    console.log("Seeding sample patients and appointments...");
    
    // Get seeded doctors
    const sarahRes = await client.query("SELECT id FROM doctors WHERE email = 'sarah.jenkins@careloop.com'");
    const rajeshRes = await client.query("SELECT id FROM doctors WHERE email = 'rajesh.kumar@careloop.com'");
    
    const todayStr = new Date().toISOString().split("T")[0];

    if (sarahRes.rows.length > 0) {
      const sarahId = sarahRes.rows[0].id;
      
      // Get some slots for Sarah for today
      const slotsSarah = await client.query(
        "SELECT id FROM slots WHERE doctor_id = $1 AND date = $2 ORDER BY start_time ASC LIMIT 3",
        [sarahId, todayStr]
      );

      const patients = [
        { name: "Aarav Sharma", age: 6, phone: "+919911223344", blood: "O+", cond: "Mild fever and cough", meds: "Paracetamol syrup" },
        { name: "Diya Patel", age: 10, phone: "+918822334455", blood: "A+", cond: "Asthma checkup", meds: "Montelukast 5mg, Budecort inhaler" },
        { name: "Kabir Singh", age: 4, phone: "+917733445566", blood: "B-", cond: "Allergic skin rash", meds: "Cetirizine drops" }
      ];

      for (let i = 0; i < Math.min(slotsSarah.rows.length, patients.length); i++) {
        const slotId = slotsSarah.rows[i].id;
        const p = patients[i];
        
        // Insert patient
        const pRes = await client.query(
          `INSERT INTO patients (name, age, phone, blood_group, conditions, medications) 
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [p.name, p.age, p.phone, p.blood, p.cond, p.meds]
        );
        const patientId = pRes.rows[0].id;

        // Book slot
        await client.query("UPDATE slots SET status = 'booked' WHERE id = $1", [slotId]);

        // Create appointment
        const bookingId = `CL-${100000 + i * 23512}`;
        await client.query(
          `INSERT INTO appointments (slot_id, patient_id, doctor_id, booking_id) 
           VALUES ($1, $2, $3, $4)`,
          [slotId, patientId, sarahId, bookingId]
        );
      }
    }

    if (rajeshRes.rows.length > 0) {
      const rajeshId = rajeshRes.rows[0].id;
      const slotsRajesh = await client.query(
        "SELECT id FROM slots WHERE doctor_id = $1 AND date = $2 ORDER BY start_time ASC LIMIT 2",
        [rajeshId, todayStr]
      );

      const patients = [
        { name: "Ramesh Kumar", age: 54, phone: "+919988776655", blood: "AB+", cond: "Hypertension follow-up", meds: "Amlodipine 5mg" },
        { name: "Savitri Devi", age: 62, phone: "+918899001122", blood: "O-", cond: "Post-angioplasty recovery, mild chest tightness", meds: "Aspirin 75mg, Clopidogrel 75mg, Atorvastatin 40mg" }
      ];

      for (let i = 0; i < Math.min(slotsRajesh.rows.length, patients.length); i++) {
        const slotId = slotsRajesh.rows[i].id;
        const p = patients[i];
        
        // Insert patient
        const pRes = await client.query(
          `INSERT INTO patients (name, age, phone, blood_group, conditions, medications) 
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [p.name, p.age, p.phone, p.blood, p.cond, p.meds]
        );
        const patientId = pRes.rows[0].id;

        // Book slot
        await client.query("UPDATE slots SET status = 'booked' WHERE id = $1", [slotId]);

        // Create appointment
        const bookingId = `CL-${200000 + i * 14892}`;
        await client.query(
          `INSERT INTO appointments (slot_id, patient_id, doctor_id, booking_id) 
           VALUES ($1, $2, $3, $4)`,
          [slotId, patientId, rajeshId, bookingId]
        );
      }
    }

    // 4. Seed Staff members
    console.log("Seeding staff...");
    await client.query(
      `INSERT INTO staff (name, phone, role) VALUES 
       ('Nurse Emily', '+919876543210', 'nurse'),
       ('Dr. Sarah Jenkins', '+919900990099', 'doctor'),
       ('Dr. Rajesh Kumar', '+918822334455', 'doctor')
       ON CONFLICT (phone) DO NOTHING`
    );

    // 5. Seed Inventory
    console.log("Seeding inventory...");
    await client.query(
      `INSERT INTO inventory (item_name, current_stock, unit, threshold, last_updated_by) VALUES 
       ('Paracetamol 650mg', 50, 'tablets', 10, 'System Seed'),
       ('Syringe 5ml', 30, 'pieces', 5, 'System Seed'),
       ('COVID-19 Vaccine', 15, 'vials', 3, 'System Seed'),
       ('Amoxicillin', 8, 'capsules', 5, 'System Seed')
       ON CONFLICT (item_name) DO NOTHING`
    );

    console.log("Seeding completed successfully.");
    return NextResponse.json({
      success: true,
      message: "Database seeded successfully with doctors, slots, sample appointments, staff, and inventory.",
      doctors: SEED_DOCTORS.map((d) => ({ name: d.name, email: d.email, specialization: d.specialization })),
    });
  } catch (error: any) {
    console.error("Seeding error:", error);
    return NextResponse.json(
      { error: "Seeding failed", details: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
