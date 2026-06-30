# CareLoop — Care, without the wait.

CareLoop is a premium, mobile-first healthcare booking platform built for the Ambula '26 Hackathon. It features a transaction-safe, double-booking prevention mechanism enforced at the database layer, a responsive Next.js web application, and a conversational WhatsApp booking assistant powered by the Gemini 1.5 Flash API.

---

## Tech Stack
- **Framework**: Next.js 14 (App Router) + TypeScript
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Better Auth (credentials provider)
- **Styling**: Tailwind CSS + custom premium card styling (Inter & Sora typography)
- **Animations**: Framer Motion for micro-interactions
- **AI Triage**: Gemini 1.5 Flash (for symptom mapping and details extraction)

---

## Database Concurrency Guarantee
Double-booking is prevented via a `UNIQUE` constraint on `appointments.slot_id` at the database level. When two parallel booking requests are fired for the same slot, PostgreSQL handles the transaction atomically. One succeeds, and the other is rejected with error code `23505`. The application catches this error, rolls back the transaction, and suggests the next available slot. 

An annotated Mermaid ER diagram is available in [docs/db_diagram.md](file:///d:/careint/docs/db_diagram.md).

---

## Environment Variables Setup

Create a `.env.local` file in the root directory and add the following variables:

```env
# Database Connection (Direct Connection for Better Auth pg adapter)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres"

# Next.js App configuration
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Better Auth Secret (Generate a random 32-character string)
BETTER_AUTH_SECRET="your_random_secret_here"

# Gemini API Key (For WhatsApp AI Triage)
GEMINI_API_KEY="your_gemini_api_key_here"

# Seeding Secret (Required to run npm run seed)
SEED_SECRET="careloop_seed_secret"

# Upstash Redis (Optional for rate limiting, falls back to in-memory if not set)
UPSTASH_REDIS_REST_URL="your_upstash_redis_url_here"
UPSTASH_REDIS_REST_TOKEN="your_upstash_redis_token_here"

# Meta WhatsApp Cloud API (Optional for Webhook, logs locally if not set)
WHATSAPP_TOKEN="your_whatsapp_temporary_or_permanent_token"
WHATSAPP_PHONE_ID="your_whatsapp_phone_number_id"
WHATSAPP_VERIFY_TOKEN="careloop_verify_token"
```

---

## Quick Start Instructions

### 1. Install Dependencies
Ensure you have Node.js installed, then run:
```bash
npm install
```

### 2. Set Up Database Schema & Seed Data
We have built an automated setup script that initializes the database schema and seeds sample data.
1. Start the Next.js development server:
   ```bash
   npm run dev
   ```
2. In a separate terminal, run the seeding script:
   ```bash
   npm run seed
   ```
   
This script will call the secured `/api/seed` endpoint, automatically execute `schema.sql`, create all necessary tables, seed 6 doctors, generate 7 days of slots for each, and populate sample appointments and inventory.

### 3. Seeded Doctor Credentials (for login)
You can log in to the Doctor Portal using any of the following credentials:
- **Dr. Sarah Jenkins** (Pediatrics):
  - Email: `sarah.jenkins@careloop.com`
  - Password: `password123`
- **Dr. Rajesh Kumar** (Cardiology):
  - Email: `rajesh.kumar@careloop.com`
  - Password: `password123`

---

## Running the Concurrency Test

We have provided a script to prove our double-booking prevention mechanism under parallel requests.

1. Ensure the Next.js server is running:
   ```bash
   npm run dev
   ```
2. In a new terminal window, execute the test script:
   ```bash
   npm run test:concurrency
   ```

### Sample Output:
```text
=== CareLoop Concurrency Test ===
Connecting to database...
Cleaning up previous test data...
Seeding test doctor...
Seeding slots...
Created Test Doctor ID: 1729b8cc-ccdf-4fa3-971c-a9b0a72bc6b6
Created Target Slot (Slot 1) ID: e9a2c3a5-df0a-48d8-be9f-b984620df9bf (Time: 10:00 AM)
Created Backup Slot (Slot 2) ID: a3cbbe44-4822-482a-adff-88cb9219bc03 (Time: 10:30 AM)

Starting concurrent requests to http://localhost:3000/api/booking...
Make sure your Next.js server is running! (npm run dev)

=== CONCURRENCY TEST RESULTS ===
--------------------------------
[Request 1 (Alice)] HTTP Status: 200
[Request 1 (Alice)] Response: {
  "success": true,
  "booking": {
    "id": "7dc14782-b7b5-4a67-b50a-b31c26b6df52",
    "booking_id": "CL-817624",
    "created_at": "2026-06-30T14:26:00.000Z",
    "doctor_name": "Dr. Concurrency Test",
    "specialization": "Cardiology",
    "location": "Test Clinic, Bangalore",
    "slot_id": "e9a2c3a5-df0a-48d8-be9f-b984620df9bf"
  }
}
--------------------------------
[Request 2 (Bob)] HTTP Status: 409
[Request 2 (Bob)] Response: {
  "error": "slot no longer available",
  "message": "This slot was just booked by another patient. Please choose another time.",
  "next_available_slot": {
    "id": "a3cbbe44-4822-482a-adff-88cb9219bc03",
    "date": "2026-07-01T00:00:00.000Z",
    "start_time": "10:30:00"
  }
}
--------------------------------

✅ SUCCESS: Double-booking prevented successfully!
- Request 1 (Alice) successfully booked the slot.
- Request 2 (Bob) was rejected with 409 Conflict.
- Suggested next slot ID: a3cbbe44-4822-482a-adff-88cb9219bc03 (Time: 10:30:00)
```

---

## WhatsApp Booking Webhook
The conversational booking assistant is located at `/api/whatsapp/webhook`.
- **Symptom Triage**: When a patient describes symptoms in plain text, Gemini 1.5 Flash maps them to a specialization (e.g., "My chest feels tight" -> Cardiology) and extracts patient name and age.
- **Interactive Flow**: Uses Meta's quick-reply buttons and list messages in **English, Hindi, or Kannada** to guide patients through selecting a doctor, date, and slot.
- **Local Testing**: If `WHATSAPP_TOKEN` is not set, the webhook will print all outgoing WhatsApp payloads directly to the server console in a beautiful formatted box for review.
