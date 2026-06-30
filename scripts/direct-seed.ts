import * as fs from "fs";
import * as path from "path";

// Load env variables manually from .env.local
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const lines = envContent.split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      process.env[key] = value;
    }
  }
}

// Now import the database and auth modules which rely on process.env
import { pool } from "../src/lib/db";
import { auth } from "../src/lib/auth";

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

async function run() {
  console.log("Connecting to database for seeding...");
  const client = await pool.connect();
  
  try {
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

    const schemaPath = path.resolve(__dirname, "../schema.sql");
    console.log("Running schema.sql...");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    const queries = schemaSql
      .split(";")
      .map((q) => q.trim())
      .filter((q) => q.length > 0);
      
    for (const q of queries) {
      await client.query(q);
    }
    console.log("Schema initialized successfully.");

    console.log("Seeding doctors and slots...");
    for (const doc of SEED_DOCTORS) {
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
        const existingUser = await client.query('SELECT id FROM "user" WHERE email = $1', [doc.email]);
        if (existingUser.rows.length > 0) {
          userId = existingUser.rows[0].id;
        }
      }

      const docInsert = await client.query(
        `INSERT INTO doctors (name, email, specialization, location, fee, photo_url, bio, years_experience) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id`,
        [doc.name, doc.email, doc.specialization, doc.location, doc.fee, doc.photo_url, doc.bio, doc.years_experience]
      );
      const doctorId = docInsert.rows[0].id;
      console.log(`Seeded doctor profile: ${doc.name} with ID: ${doctorId}`);

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
    }

    // Seed staff
    console.log("Seeding staff (nurses)...");
    await client.query(
      `INSERT INTO staff (name, phone, role) VALUES 
       ('Nurse Emily', '+919876543210', 'nurse'),
       ('Nurse John', '+919876543211', 'nurse')`
    );

    // Seed inventory
    console.log("Seeding inventory...");
    await client.query(
      `INSERT INTO inventory (item_name, current_stock, unit, threshold) VALUES 
       ('Paracetamol 650mg', 50, 'tablets', 10),
       ('Syringe 5ml', 8, 'pieces', 15),
       ('Bandages', 30, 'rolls', 5)`
    );

    console.log("Seeding completed successfully!");
  } catch (err) {
    console.error("❌ Seeding failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
