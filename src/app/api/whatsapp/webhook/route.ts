import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { pool } from "@/lib/db";
import { bookAppointment } from "@/lib/booking-helper";
import { sendWhatsAppText, sendWhatsAppButtons, sendWhatsAppList, clearMockReplies, getMockReplies } from "@/lib/whatsapp";
import { ratelimit } from "@/lib/ratelimit";
import { formatDateLong, formatSlotTime } from "@/lib/datetime";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Localized translations for English, Hindi, and Kannada
const TRANSLATIONS: Record<string, any> = {
  en: {
    welcome: "Welcome to CareLoop! Care, without the wait. 🏥\n\nHow can we help you today? You can describe your symptoms in plain text (e.g., 'My 5-year-old child has a high fever') or use the buttons below to start booking.",
    select_specialization: "Please select a medical specialization:",
    select_doctor: "Select a doctor for your appointment:",
    select_slot: "Choose an available time slot:",
    enter_name: "Please reply with the patient's full name:",
    enter_age: "Please reply with the patient's age:",
    confirm_details: (name: string, age: number, docName: string, date: string, time: string, fee: number) => 
      `Please confirm your booking details:\n\n👤 Patient: ${name} (${age} years)\n👨‍⚕️ Doctor: ${docName}\n📅 Date: ${date}\n⏰ Time: ${time}\n💵 Consultation Fee: ₹${fee}\n\nConfirm booking?`,
    booking_success: (id: string, docName: string, date: string, time: string, loc: string) =>
      `✅ Booking Confirmed! 🎉\n\n🎟️ Booking ID: *${id}*\n👨‍⚕️ Doctor: ${docName}\n📅 Date: ${date}\n⏰ Time: ${time}\n📍 Location: ${loc}\n\nThank you for choosing CareLoop!`,
    booking_conflict: (date: string, time: string) =>
      `⚠️ That slot was just booked by someone else.\n\nWould you like to book the next available slot on *${date}* at *${time}* instead?`,
    no_slots: "Sorry, there are no available slots for this doctor in the next 7 days. Please select another doctor or specialization.",
    invalid_age: "Please enter a valid age (a number between 1 and 120).",
    cancelled: "Booking cancelled. Reply with 'hi' or describe your symptoms to start a new booking.",
  },
  hi: {
    welcome: "CareLoop में स्वागत है! बिना इंतजार के इलाज। 🏥\n\nआज हम आपकी कैसे मदद कर सकते हैं? आप अपनी बीमारियों को सामान्य टेक्स्ट में लिख सकते हैं (जैसे, 'मेरे 5 साल के बच्चे को तेज बुखार है') या बुकिंग शुरू करने के लिए नीचे दिए गए बटनों का उपयोग कर सकते हैं।",
    select_specialization: "कृपया एक चिकित्सा विशेषता चुनें:",
    select_doctor: "अपनी नियुक्ति के लिए डॉक्टर चुनें:",
    select_slot: "एक उपलब्ध समय चुनें:",
    enter_name: "कृपया मरीज का पूरा नाम लिखकर उत्तर दें:",
    enter_age: "कृपया मरीज की उम्र लिखकर उत्तर दें:",
    confirm_details: (name: string, age: number, docName: string, date: string, time: string, fee: number) => 
      `कृपया अपनी बुकिंग के विवरण की पुष्टि करें:\n\n👤 मरीज: ${name} (${age} वर्ष)\n👨‍⚕️ डॉक्टर: ${docName}\n📅 तिथि: ${date}\n⏰ समय: ${time}\n💵 परामर्श शुल्क: ₹${fee}\n\nबुकिंग की पुष्टि करें?`,
    booking_success: (id: string, docName: string, date: string, time: string, loc: string) =>
      `✅ बुकिंग की पुष्टि हो गई है! 🎉\n\n🎟️ बुकिंग आईडी: *${id}*\n👨‍⚕️ डॉक्टर: ${docName}\n📅 तिथि: ${date}\n⏰ समय: ${time}\n📍 स्थान: ${loc}\n\nCareLoop चुनने के लिए धन्यवाद!`,
    booking_conflict: (date: string, time: string) =>
      `⚠️ वह समय अभी किसी अन्य मरीज द्वारा बुक कर लिया गया है।\n\nक्या आप इसके बजाय *${date}* को *${time}* पर उपलब्ध अगले समय को बुक करना चाहेंगे?`,
    no_slots: "क्षमा करें, अगले 7 दिनों में इस डॉक्टर के लिए कोई उपलब्ध समय नहीं है। कृपया दूसरा डॉक्टर या विशेषता चुनें।",
    invalid_age: "कृपया एक वैध उम्र दर्ज करें (1 और 120 के बीच की संख्या)।",
    cancelled: "बुकिंग रद्द कर दी गई। शुरू करने के लिए 'hi' लिखें या अपनी बीमारियों के बारे में बताएं।",
  },
  kn: {
    welcome: "CareLoop ಗೆ ಸುಸ್ವಾಗತ! ಕಾಯುವಿಕೆ ಇಲ್ಲದೆ ಆರೈಕೆ. 🏥\n\nಇಂದು ನಾವು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು? ನಿಮ್ಮ ರೋಗಲಕ್ಷಣಗಳನ್ನು ನೀವು ಬರೆಯಬಹುದು (ಉದಾಹರಣೆಗೆ, 'ನನ್ನ 5 ವರ್ಷದ ಮಗುವಿಗೆ ತೀವ್ರ ಜ್ವರವಿದೆ') ಅಥವಾ ಬುಕಿಂಗ್ ಪ್ರಾರಂಭಿಸಲು ಕೆಳಗಿನ ಬಟನ್‌ಗಳನ್ನು ಬಳಸಬಹುದು.",
    select_specialization: "ದಯವಿಟ್ಟು ವೈದ್ಯಕೀಯ ತಜ್ಞತೆಯನ್ನೇ ಆಯ್ಕೆಮಾಡಿ:",
    select_doctor: "ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್‌ಗಾಗಿ ವೈದ್ಯರನ್ನು ಆಯ್ಕೆಮಾಡಿ:",
    select_slot: "ಲಭ್ಯವಿರುವ ಸಮಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ:",
    enter_name: "ದಯವಿಟ್ಟು ರೋಗಿಯ ಪೂರ್ಣ ಹೆಸರನ್ನು ಬರೆದು ಉತ್ತರಿಸಿ:",
    enter_age: "ದಯವಿಟ್ಟು ರೋಗಿಯ ವಯಸ್ಸನ್ನು ಬರೆದು ಉತ್ತರಿಸಿ:",
    confirm_details: (name: string, age: number, docName: string, date: string, time: string, fee: number) => 
      `ದಯವಿಟ್ಟು ನಿಮ್ಮ ಬುಕಿಂಗ್ ವಿವರಗಳನ್ನು ಖಚಿತಪಡಿಸಿ:\n\n👤 ರೋಗಿ: ${name} (${age} ವರ್ಷ)\n👨‍⚕️ ವೈದ್ಯರು: ${docName}\n📅 ದಿನಾಂಕ: ${date}\n⏰ ಸಮಯ: ${time}\n💵 ಸಮಾಲೋಚನೆ ಶುಲ್ಕ: ₹${fee}\n\nಬುಕಿಂಗ್ ಖಚಿತಪಡಿಸಬೇಕೆ?`,
    booking_success: (id: string, docName: string, date: string, time: string, loc: string) =>
      `✅ ಬುಕಿಂಗ್ ಖಚಿತಪಟ್ಟಿದೆ! 🎉\n\n🎟️ ಬುಕಿಂಗ್ ಐಡಿ: *${id}*\n👨‍⚕️ ವೈದ್ಯರು: ${docName}\n📅 ದಿನಾಂಕ: ${date}\n⏰ ಸಮಯ: ${time}\n📍 ಸ್ಥಳ: ${loc}\n\nCareLoop ಆಯ್ಕೆ ಮಾಡಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು!`,
    booking_conflict: (date: string, time: string) =>
      `⚠️ ಆ ಸಮಯವು ಈಗಷ್ಟೇ ಬೇರೆಯವರಿಂದ ಬುಕ್ ಆಗಿದೆ.\n\nಬದಲಿಗೆ ನೀವು *${date}* ರಂದು *${time}* ಕ್ಕೆ ಲಭ್ಯವಿರುವ ಮುಂದಿನ ಸಮಯವನ್ನು ಬುಕ್ ಮಾಡಲು ಬಯಸುವಿರಾ?`,
    no_slots: "ಕ್ಷಮಿಸಿ, ಮುಂದಿನ 7 ದಿನಗಳಲ್ಲಿ ಈ ವೈದ್ಯರಿಗೆ ಯಾವುದೇ ಲಭ್ಯವಿರುವ ಸಮಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಬೇರೆ ವೈದ್ಯರನ್ನು ಅಥವಾ ತಜ್ಞತೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ.",
    invalid_age: "ದಯವಿಟ್ಟು ಸರಿಯಾದ ವಯಸ್ಸನ್ನು ನಮೂದಿಸಿ (1 ರಿಂದ 120 ರ ನಡುವಿನ ಸಂಖ್ಯೆ).",
    cancelled: "ಬುಕಿಂಗ್ ರದ್ದುಗೊಳಿಸಲಾಗಿದೆ. ಪ್ರಾರಂಭಿಸಲು 'hi' ಎಂದು ಉತ್ತರಿಸಿ ಅಥವಾ ನಿಮ್ಮ ರೋಗಲಕ್ಷಣಗಳನ್ನು ತಿಳಿಸಿ.",
  }
};

const SPECIALIZATIONS = [
  "General Physician",
  "Pediatrics",
  "Cardiology",
  "Dermatology",
  "Orthopedics",
  "Gynecology"
];

// Gemini symptom extraction
async function extractDetailsWithGemini(userMessage: string) {
  try {
    const prompt = `
You are CareLoop AI, an intelligent medical triage assistant. The user is trying to book a doctor's appointment by describing their symptoms or needs.
Your task is to analyze the user's message and extract:
1. Specialization: Map their symptoms to one of the following exact specializations: 'Cardiology', 'Dermatology', 'Pediatrics', 'General Physician', 'Orthopedics', 'Gynecology'. 
   - Use 'Pediatrics' if the patient is clearly a child.
   - Use 'Gynecology' for pregnancy or female reproductive health.
   - Use 'Cardiology' for heart issues, chest pain, palpitations.
   - Use 'Dermatology' for skin, hair, nails, rashes, acne, itching.
   - Use 'Orthopedics' for bone, joint, back pain, muscle pain or fractures.
   - Use 'General Physician' for general symptoms like fever, cold, headache, stomach ache, viral infection, or if you cannot determine.
2. Patient Name: Extract the patient's name if they mentioned it (e.g. "my son Aarav" -> "Aarav").
3. Patient Age: Extract the patient's age if they mentioned it (as an integer).

Return ONLY a JSON object in the following format (no markdown, no extra text, just the raw JSON):
{
  "specialization": "Cardiology" | "Dermatology" | "Pediatrics" | "General Physician" | "Orthopedics" | "Gynecology" | null,
  "patient_name": "string" | null,
  "patient_age": number | null
}

User Message: "${userMessage}"
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonString = text.replace(/^```json/, "").replace(/```$/, "").trim();
    const data = JSON.parse(jsonString);
    return data;
  } catch (error) {
    console.error("Gemini extraction error:", error);
    return { specialization: null, patient_name: null, patient_age: null };
  }
}

// Handle staff flow (inventory updates)
async function handleStaffFlow(from: string, text: string, staffMember: any, client: any) {
  console.log(`Routing ${from} (${staffMember.name}) to Staff Flow`);
  
  try {
    const prompt = `
You are CareLoop Inventory AI. A clinic staff member is reporting an inventory update via text.
Analyze their message: "${text}"

Your task is to match their request against the list of known inventory items:
- Paracetamol 650mg
- Syringe 5ml
- COVID-19 Vaccine
- Amoxicillin

Extract:
1. Match: The exact matching item name from the list above. If no match is found, return null.
2. Change: The quantity change (integer). If they say "used 5" or "5 done" or "gave 2", return -5 or -2. If they say "restocked 10" or "added 20", return 10 or 20. If they just say "5 paracetamol", assume they mean they used it (so return -5).

Return ONLY a JSON object in the following format (no markdown, no extra text, just the raw JSON):
{
  "item_name": "Paracetamol 650mg" | "Syringe 5ml" | "COVID-19 Vaccine" | "Amoxicillin" | null,
  "change": number | null
}
`;

    const result = await model.generateContent(prompt);
    const resultText = result.response.text().trim();
    const jsonString = resultText.replace(/^```json/, "").replace(/```$/, "").trim();
    const data = JSON.parse(jsonString);

    if (data.item_name && data.change !== null && data.change !== 0) {
      // Update inventory
      const updateRes = await client.query(
        `UPDATE inventory 
         SET current_stock = current_stock + $1, 
             last_updated_by = $2, 
             last_updated_at = CURRENT_TIMESTAMP 
         WHERE item_name = $3 
         RETURNING *`,
        [data.change, staffMember.name, data.item_name]
      );

      if (updateRes.rows.length > 0) {
        const inv = updateRes.rows[0];
        const actionText = data.change > 0 ? "restocked" : "used";
        const quantityAbs = Math.abs(data.change);

        let replyMsg = `✅ *Inventory Updated!*\n\n👤 *Staff*: ${staffMember.name} (${staffMember.role})\n📦 *Item*: ${inv.item_name}\n🔄 *Action*: ${actionText} ${quantityAbs} ${inv.unit}\n📊 *Current Stock*: *${inv.current_stock}* ${inv.unit} remaining.`;

        // Check for low stock alert
        if (inv.current_stock <= inv.threshold) {
          replyMsg += `\n\n⚠️ *Warning*: Stock is below the threshold of ${inv.threshold} ${inv.unit}!`;

          // Send alert to all doctors in the staff table
          const docsRes = await client.query("SELECT phone, name FROM staff WHERE role = 'doctor'");
          for (const doc of docsRes.rows) {
            if (doc.phone !== from) { // Don't send to oneself
              const alertMsg = `⚠️ *Low Stock Alert* ⚠️\n\nClinic inventory for *${inv.item_name}* is running low.\n\n📉 *Current Stock*: *${inv.current_stock}* ${inv.unit} remaining (Threshold: ${inv.threshold}).\n👤 *Last Updated By*: ${staffMember.name}.`;
              await sendWhatsAppText(doc.phone, alertMsg);
            }
          }
        }

        await sendWhatsAppText(from, replyMsg);
      } else {
        await sendWhatsAppText(from, `❌ Failed to update inventory for "${data.item_name}". Please try again.`);
      }
    } else {
      // Could not match
      const helpMsg = `❓ *CareLoop Inventory Assistant*\n\nI couldn't understand your update. Please specify the item name and quantity.\n\n*Examples*:\n- "used 3 paracetamol"\n- "added 15 syringes"\n- "gave 1 covid vaccine"\n\n*Available Items*:\n- Paracetamol 650mg\n- Syringe 5ml\n- COVID-19 Vaccine\n- Amoxicillin`;
      await sendWhatsAppText(from, helpMsg);
    }
  } catch (error: any) {
    console.error("Staff flow error:", error);
    await sendWhatsAppText(from, `❌ An error occurred while processing your inventory update: ${error.message}`);
  }
}

// GET: Webhook verification for Meta
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "careloop_verify_token";

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WhatsApp Webhook Verified.");
      return new Response(challenge, { status: 200 });
    } else {
      return new Response("Forbidden", { status: 403 });
    }
  }
  return new Response("Bad Request", { status: 400 });
}

// POST: Handle incoming WhatsApp messages
export async function POST(request: Request) {
  clearMockReplies();
  try {
    const result = await handleIncomingWebhook(request);
    return NextResponse.json(
      { ...result, replies: getMockReplies() },
      { status: result.statusCode || 200 }
    );
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleIncomingWebhook(request: Request) {
  try {
    const body = await request.json();
    
    // Extract message details
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) {
      return { status: "success", message: "no message to process" };
    }

    const from = message.from;
    const type = message.type;
    
    // Check if the message is interactive or text
    let inputText = "";
    let interactiveId = "";
    
    if (type === "text") {
      inputText = message.text.body.trim();
    } else if (type === "interactive") {
      const interactive = message.interactive;
      if (interactive.type === "button_reply") {
        interactiveId = interactive.button_reply.id;
        inputText = interactive.button_reply.title;
      } else if (interactive.type === "list_reply") {
        interactiveId = interactive.list_reply.id;
        inputText = interactive.list_reply.title;
      }
    }

    console.log(`Received message from ${from}: Type=${type}, InputText="${inputText}", InteractiveId="${interactiveId}"`);

    // 1. Rate Limiting: 20 requests per minute per phone number
    const { success } = await ratelimit.whatsapp.limit(from);
    if (!success) {
      console.warn(`Rate limit exceeded for WhatsApp user ${from}`);
      await sendWhatsAppText(from, "⚠️ Rate limit exceeded. Please wait a minute before messaging again.");
      return { status: "success", message: "rate limited" };
    }

    // Fetch session
    const client = await pool.connect();
    try {
      // Check if the sender is a staff member
      const staffRes = await client.query("SELECT * FROM staff WHERE phone = $1", [from]);
      if (staffRes.rows.length > 0) {
        const staffMember = staffRes.rows[0];
        await handleStaffFlow(from, inputText, staffMember, client);
        return { status: "success", role: "staff" };
      }

      let session;
      const sessionRes = await client.query("SELECT * FROM whatsapp_sessions WHERE phone = $1", [from]);
      session = sessionRes.rows[0];

      // Check for session expiry (30 minutes timeout)
      const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
      const isExpired = session && (Date.now() - new Date(session.updated_at).getTime() > SESSION_TIMEOUT_MS);

      // Reset command or expired session
      const isReset = type === "text" && ["reset", "restart", "hi", "hello", "hey", "hola", "start", "book"].includes(inputText.toLowerCase());
      
      if (!session || isReset || isExpired) {
        // Initialize or reset session
        const step = "select_language";
        if (!session) {
          await client.query("INSERT INTO whatsapp_sessions (phone, step) VALUES ($1, $2)", [from, step]);
        } else {
          await client.query(
            `UPDATE whatsapp_sessions 
             SET step = $2, language = null, specialization = null, doctor_id = null, 
                 slot_id = null, patient_name = null, patient_age = null, updated_at = CURRENT_TIMESTAMP 
             WHERE phone = $1`,
            [from, step]
          );
        }

        // Send language selection buttons
        await sendWhatsAppButtons(from, "Welcome to CareLoop! Please select your preferred language / अपनी भाषा चुनें / ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ:", [
          { id: "lang_en", title: "English" },
          { id: "lang_hi", title: "Hindi (हिंदी)" },
          { id: "lang_kn", title: "Kannada (ಕನ್ನಡ)" }
        ]);

        return { status: "success" };
      }

      const lang = session.language || "en";
      const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

      // Handle symptom description (Free text when we expect structured input)
      const structuredSteps = ["select_language", "select_specialization", "select_doctor", "select_slot"];
      if (type === "text" && structuredSteps.includes(session.step)) {
        // Run Gemini to extract symptoms
        await sendWhatsAppText(from, lang === "hi" ? "आपकी बीमारी का विश्लेषण किया जा रहा है... 🤖" : lang === "kn" ? "ನಿಮ್ಮ ರೋಗಲಕ್ಷಣಗಳನ್ನು ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ... 🤖" : "Analyzing your symptoms... 🤖");
        
        const extracted = await extractDetailsWithGemini(inputText);
        
        if (extracted.specialization) {
          const spec = extracted.specialization;
          const pName = extracted.patient_name;
          const pAge = extracted.patient_age;
          
          await client.query(
            `UPDATE whatsapp_sessions 
             SET step = 'select_doctor', specialization = $2, patient_name = COALESCE($3, patient_name), 
                 patient_age = COALESCE($4, patient_age), updated_at = CURRENT_TIMESTAMP 
             WHERE phone = $1`,
            [from, spec, pName, pAge]
          );

          // Get doctors in this specialization
          const docsRes = await client.query(
            "SELECT id, name, location, fee, years_experience FROM doctors WHERE specialization = $1",
            [spec]
          );

          if (docsRes.rows.length === 0) {
            await sendWhatsAppText(from, lang === "hi" ? `क्षमा करें, इस समय ${spec} में कोई doctor उपलब्ध नहीं है।` : lang === "kn" ? `ಕ್ಷಮಿಸಿ, ${spec} ನಲ್ಲಿ ಯಾವುದೇ ವೈದ್ಯರು ಲಭ್ಯವಿಲ್ಲ.` : `Sorry, no doctors found in ${spec}.`);
            // Go back to select specialization
            await client.query("UPDATE whatsapp_sessions SET step = 'select_specialization' WHERE phone = $1", [from]);
            // Send specialization list
            await sendSpecializationList(from, lang);
            return { status: "success" };
          }

          // Send doctor list
          const rows = docsRes.rows.map((d) => ({
            id: `doc_${d.id}`,
            title: d.name,
            description: `${d.years_experience} yrs exp | Fee: ₹${d.fee} | ${d.location.split(",")[0]}`
          }));

          const textMsg = lang === "hi" 
            ? `हमने आपकी बीमारी को *${spec}* के रूप में वर्गीकृत किया है। कृपया एक डॉक्टर चुनें:` 
            : lang === "kn" 
            ? `ನಿಮ್ಮ ರೋಗಲಕ್ಷಣಗಳನ್ನು *${spec}* ಎಂದು ಗುರುತಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ವೈದ್ಯರನ್ನು ಆಯ್ಕೆಮಾಡಿ:` 
            : `We mapped your symptoms to *${spec}*. Please select a doctor:`;

          await sendWhatsAppList(from, textMsg, lang === "hi" ? "डॉक्टर चुनें" : lang === "kn" ? "ವೈದ್ಯರನ್ನು ಆರಿಸಿ" : "Select Doctor", [
            { title: "Available Doctors", rows }
          ]);
          
          return { status: "success" };
        } else {
          // Could not map
          await sendWhatsAppText(from, lang === "hi" ? "क्षमा करें, हम आपकी बीमारी को किसी विशेष विभाग से नहीं जोड़ सके। कृपया नीचे दिए गए विशेषज्ञताओं में से एक को चुनें:" : lang === "kn" ? "ಕ್ಷಮಿಸಿ, ನಿಮ್ಮ ರೋಗಲಕ್ಷಣಗಳನ್ನು ವರ್ಗೀಕರಿಸಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲ. ದಯವಿಟ್ಟು ತಜ್ಞತೆಯನ್ನು ಆರಿಸಿ:" : "We couldn't determine the exact specialization. Please select one of the following:");
          await client.query("UPDATE whatsapp_sessions SET step = 'select_specialization' WHERE phone = $1", [from]);
          await sendSpecializationList(from, lang);
          return { status: "success" };
        }
      }

      // Process State Machine
      switch (session.step) {
        case "select_language": {
          if (interactiveId.startsWith("lang_")) {
            const selectedLang = interactiveId.split("_")[1];
            await client.query(
              "UPDATE whatsapp_sessions SET language = $2, step = 'select_specialization', updated_at = CURRENT_TIMESTAMP WHERE phone = $1",
              [from, selectedLang]
            );
            await sendSpecializationList(from, selectedLang);
          }
          break;
        }

        case "select_specialization": {
          if (interactiveId.startsWith("spec_")) {
            const spec = interactiveId.split("_")[1];
            await client.query(
              "UPDATE whatsapp_sessions SET specialization = $2, step = 'select_doctor', updated_at = CURRENT_TIMESTAMP WHERE phone = $1",
              [from, spec]
            );

            // Fetch doctors
            const docsRes = await client.query(
              "SELECT id, name, location, fee, years_experience FROM doctors WHERE specialization = $1",
              [spec]
            );

            const rows = docsRes.rows.map((d) => ({
              id: `doc_${d.id}`,
              title: d.name,
              description: `${d.years_experience} yrs exp | Fee: ₹${d.fee} | ${d.location.split(",")[0]}`
            }));

            const selectDocText = TRANSLATIONS[lang].select_doctor;
            await sendWhatsAppList(from, selectDocText, lang === "hi" ? "डॉक्टर चुनें" : lang === "kn" ? "ವೈದ್ಯರನ್ನು ಆರಿಸಿ" : "Select Doctor", [
              { title: "Doctors", rows }
            ]);
          }
          break;
        }

        case "select_doctor": {
          if (interactiveId.startsWith("doc_")) {
            const docId = interactiveId.split("_")[1];
            await client.query(
              "UPDATE whatsapp_sessions SET doctor_id = $2, step = 'select_slot', updated_at = CURRENT_TIMESTAMP WHERE phone = $1",
              [from, docId]
            );

            // Fetch available slots (next 8)
            // Hardened: Filter out slots currently held by active soft reservations
            const slotsRes = await client.query(
              `SELECT id, date, start_time 
               FROM slots 
               WHERE doctor_id = $1 
                 AND status = 'available' 
                 AND (date > CURRENT_DATE OR (date = CURRENT_DATE AND start_time > CURRENT_TIME))
                 AND (reserved_until IS NULL OR reserved_until < NOW())
               ORDER BY date ASC, start_time ASC 
               LIMIT 8`,
              [docId]
            );

            if (slotsRes.rows.length === 0) {
              await sendWhatsAppText(from, t.no_slots);
              await client.query("UPDATE whatsapp_sessions SET step = 'select_doctor' WHERE phone = $1", [from]);
              return { status: "success" };
            }

            const rows = slotsRes.rows.map((s) => ({
              id: `slot_${s.id}`,
              title: `${formatDateLong(s.date)}`,
              description: `${formatSlotTime(s.start_time)}`
            }));

            await sendWhatsAppList(from, t.select_slot, lang === "hi" ? "समय स्लॉट चुनें" : lang === "kn" ? "ಸಮಯವನ್ನು ಆರಿಸಿ" : "Select Slot", [
              { title: "Available Slots", rows }
            ]);
          }
          break;
        }

        case "select_slot": {
          if (interactiveId.startsWith("slot_")) {
            const slotId = interactiveId.split("_")[1];
            await client.query(
              "UPDATE whatsapp_sessions SET slot_id = $2, step = 'enter_name', updated_at = CURRENT_TIMESTAMP WHERE phone = $1",
              [from, slotId]
            );

            // If Gemini already extracted a name, skip to age
            if (session.patient_name) {
              await sendWhatsAppText(from, `${t.enter_age} (We found name: "${session.patient_name}". Reply with age, or send 'reset' to restart)`);
              await client.query("UPDATE whatsapp_sessions SET step = 'enter_age' WHERE phone = $1", [from]);
            } else {
              await sendWhatsAppText(from, t.enter_name);
            }
          }
          break;
        }

        case "enter_name": {
          if (type === "text") {
            const name = inputText;
            await client.query(
              "UPDATE whatsapp_sessions SET patient_name = $2, step = 'enter_age', updated_at = CURRENT_TIMESTAMP WHERE phone = $1",
              [from, name]
            );
            await sendWhatsAppText(from, t.enter_age);
          }
          break;
        }

        case "enter_age": {
          if (type === "text") {
            const ageVal = parseInt(inputText);
            if (isNaN(ageVal) || ageVal <= 0 || ageVal > 120) {
              await sendWhatsAppText(from, t.invalid_age);
              return { status: "success" };
            }

            await client.query(
              "UPDATE whatsapp_sessions SET patient_age = $2, step = 'confirm_booking', updated_at = CURRENT_TIMESTAMP WHERE phone = $1",
              [from, ageVal]
            );

            // Fetch details for confirmation summary
            const docRes = await client.query("SELECT name, fee FROM doctors WHERE id = $1", [session.doctor_id]);
            const slotRes = await client.query("SELECT date, start_time FROM slots WHERE id = $1", [session.slot_id]);

            const doctor = docRes.rows[0];
            const slot = slotRes.rows[0];

            const summaryText = t.confirm_details(
              session.patient_name,
              ageVal,
              doctor.name,
              formatDateLong(slot.date),
              formatSlotTime(slot.start_time),
              doctor.fee
            );

            await sendWhatsAppButtons(from, summaryText, [
              { id: "confirm_yes", title: lang === "hi" ? "पुष्टि करें" : lang === "kn" ? "ಖಚಿತಪಡಿಸಿ" : "Confirm" },
              { id: "confirm_no", title: lang === "hi" ? "रद्द करें" : lang === "kn" ? "ರದ್ದುಮಾಡಿ" : "Cancel" }
            ]);
          }
          break;
        }

        case "confirm_booking": {
          if (interactiveId === "confirm_no") {
            await client.query("DELETE FROM whatsapp_sessions WHERE phone = $1", [from]);
            await sendWhatsAppText(from, t.cancelled);
          } else if (interactiveId === "confirm_yes") {
            // Book the appointment using the shared helper (passing a session token to bypass reservation)
            const result = await bookAppointment({
              slot_id: session.slot_id,
              patient_name: session.patient_name,
              patient_age: session.patient_age,
              patient_phone: from,
              session_token: "whatsapp_" + from,
            });

            if (result.success && result.booking) {
              const b = result.booking;
              
              // Get the slot details to show in the final message
              const slotInfo = await client.query("SELECT date, start_time FROM slots WHERE id = $1", [session.slot_id]);
              const s = slotInfo.rows[0];
              
              const finalSuccessMsg = t.booking_success(
                b.booking_id,
                b.doctor_name,
                formatDateLong(s.date),
                formatSlotTime(s.start_time),
                b.location
              );

              await sendWhatsAppText(from, finalSuccessMsg);
              await client.query("DELETE FROM whatsapp_sessions WHERE phone = $1", [from]);
            } else if (result.status === 409) {
              // Double booking conflict!
              const nextSlot = result.next_available_slot;
              if (nextSlot) {
                // Update session slot_id to the next available slot and change step
                await client.query(
                  "UPDATE whatsapp_sessions SET slot_id = $2, step = 'confirm_next_slot', updated_at = CURRENT_TIMESTAMP WHERE phone = $1",
                  [from, nextSlot.id]
                );

                const conflictMsg = t.booking_conflict(
                  formatDateLong(nextSlot.date),
                  formatSlotTime(nextSlot.start_time)
                );

                await sendWhatsAppButtons(from, conflictMsg, [
                  { id: "next_yes", title: lang === "hi" ? "हाँ, बुक करें" : lang === "kn" ? "ಹೌದು, ಬುಕ್ ಮಾಡಿ" : "Book Next Slot" },
                  { id: "next_no", title: lang === "hi" ? "रद्द करें" : lang === "kn" ? "ರದ್ದುಮಾಡಿ" : "Cancel" }
                ]);
              } else {
                await sendWhatsAppText(from, lang === "hi" ? "क्षमा करें, वह समय पहले ही बुक हो चुका है और कोई अन्य समय उपलब्ध नहीं है।" : lang === "kn" ? "ಕ್ಷಮಿಸಿ, ಆ ಸಮಯ ಬುಕ್ ಆಗಿದೆ ಮತ್ತು ಬೇರೆ ಯಾವುದೇ ಸಮಯ ಲಭ್ಯವಿಲ್ಲ." : "Sorry, that slot was booked and no other slots are available.");
                await client.query("DELETE FROM whatsapp_sessions WHERE phone = $1", [from]);
              }
            } else {
              await sendWhatsAppText(from, `Error: ${result.error || "Failed to book"}`);
            }
          }
          break;
        }

        case "confirm_next_slot": {
          if (interactiveId === "next_no") {
            await client.query("DELETE FROM whatsapp_sessions WHERE phone = $1", [from]);
            await sendWhatsAppText(from, t.cancelled);
          } else if (interactiveId === "next_yes") {
            // Book the next slot!
            const result = await bookAppointment({
              slot_id: session.slot_id, // This is now the next_slot.id
              patient_name: session.patient_name,
              patient_age: session.patient_age,
              patient_phone: from,
              session_token: "whatsapp_" + from,
            });

            if (result.success && result.booking) {
              const b = result.booking;
              const slotInfo = await client.query("SELECT date, start_time FROM slots WHERE id = $1", [session.slot_id]);
              const s = slotInfo.rows[0];

              const finalSuccessMsg = t.booking_success(
                b.booking_id,
                b.doctor_name,
                formatDateLong(s.date),
                formatSlotTime(s.start_time),
                b.location
              );

              await sendWhatsAppText(from, finalSuccessMsg);
              await client.query("DELETE FROM whatsapp_sessions WHERE phone = $1", [from]);
            } else {
              await sendWhatsAppText(from, `Error: ${result.error || "Failed to book"}`);
              await client.query("DELETE FROM whatsapp_sessions WHERE phone = $1", [from]);
            }
          }
          break;
        }
      }
    } finally {
      client.release();
    }

    return { status: "success" };
  } catch (error: any) {
    console.error("WhatsApp webhook POST error:", error);
    return { error: "Internal server error", details: error.message, statusCode: 500 };
  }
}

// Helper to send specialization list
async function sendSpecializationList(to: string, lang: string) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  
  const rows = SPECIALIZATIONS.map((spec) => {
    let desc = "";
    if (lang === "hi") {
      if (spec === "General Physician") desc = "सामान्य सर्दी, खांसी, बुखार का इलाज";
      if (spec === "Pediatrics") desc = "बच्चों की बीमारियां और विकास";
      if (spec === "Cardiology") desc = "हृदय और रक्तचाप से संबंधित";
      if (spec === "Dermatology") desc = "त्वचा, बाल और मुँहासे";
      if (spec === "Orthopedics") desc = "हड्डियों और जोड़ों का दर्द";
      if (spec === "Gynecology") desc = "महिला स्वास्थ्य और गर्भावस्था";
    } else if (lang === "kn") {
      if (spec === "General Physician") desc = "ಸಾಮಾನ್ಯ ಶೀತ, ಜ್ವರ, ತಲೆನೋವು ಚಿಕಿತ್ಸೆ";
      if (spec === "Pediatrics") desc = "ಮಕ್ಕಳ ಆರೋಗ್ಯ ಮತ್ತು ಲಸಿಕೆ";
      if (spec === "Cardiology") desc = "ಹೃದಯಕ್ಕೆ ಸಂಬಂಧಿಸಿದ ತೊಂದರೆಗಳು";
      if (spec === "Dermatology") desc = "ಚರ್ಮ, ಕೂದಲು ಮತ್ತು ಮೊಡವೆ ಚಿಕಿತ್ಸೆ";
      if (spec === "Orthopedics") desc = "ಮೂಳೆ ಮತ್ತು ಕೀಲು ನೋವು";
      if (spec === "Gynecology") desc = "ಮಹಿಳಾ ಆರೋಗ್ಯ ಮತ್ತು ಗರ್ಭಧಾರಣೆ";
    } else {
      if (spec === "General Physician") desc = "Fever, cold, general health issues";
      if (spec === "Pediatrics") desc = "Child health and development";
      if (spec === "Cardiology") desc = "Heart conditions and hypertension";
      if (spec === "Dermatology") desc = "Skin rash, hair fall, acne";
      if (spec === "Orthopedics") desc = "Bone fractures, joint pain";
      if (spec === "Gynecology") desc = "Women's health and pregnancy";
    }

    return {
      id: `spec_${spec}`,
      title: spec,
      description: desc
    };
  });

  await sendWhatsAppList(
    to,
    t.select_specialization,
    lang === "hi" ? "विशेषज्ञता चुनें" : lang === "kn" ? "ತಜ್ಞತೆಯನ್ನೇ ಆರಿಸಿ" : "Select Specialization",
    [{ title: "Specializations", rows }]
  );
}
