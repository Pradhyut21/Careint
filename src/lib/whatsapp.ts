export interface WhatsAppButton {
  id: string;
  title: string;
}

export interface WhatsAppListRow {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppListSection {
  title?: string;
  rows: WhatsAppListRow[];
}

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const API_URL = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`;

let mockReplies: any[] = [];

export function clearMockReplies() {
  mockReplies = [];
}

export function getMockReplies() {
  return mockReplies;
}

async function sendMetaRequest(payload: any) {
  // Always log the outgoing message to the console for easy debugging
  console.log(`\n--- [OUTGOING WHATSAPP TO ${payload.to}] ---`);
  console.log(JSON.stringify(payload, null, 2));
  console.log("-------------------------------------------\n");

  // Save to mock replies for the simulator
  mockReplies.push(payload);

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    console.log("WhatsApp credentials not set. Message logged but not sent via API.");
    return { mock: true, success: true };
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Meta WhatsApp API Error:", data);
      return { success: false, error: data };
    }
    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to send WhatsApp message:", error);
    return { success: false, error: error.message };
  }
}

export async function sendWhatsAppText(to: string, text: string) {
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: text },
  };
  return sendMetaRequest(payload);
}

export async function sendWhatsAppButtons(to: string, text: string, buttons: WhatsAppButton[]) {
  // Meta allows max 3 buttons in quick replies
  const formattedButtons = buttons.slice(0, 3).map((btn) => ({
    type: "reply",
    reply: {
      id: btn.id,
      title: btn.title.slice(0, 20), // Meta limit is 20 chars
    },
  }));

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text },
      action: {
        buttons: formattedButtons,
      },
    },
  };
  return sendMetaRequest(payload);
}

export async function sendWhatsAppList(
  to: string,
  text: string,
  buttonText: string,
  sections: WhatsAppListSection[],
  headerText?: string
) {
  // Meta allows max 10 rows total in a list
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: headerText ? { type: "text", text: headerText } : undefined,
      body: { text },
      action: {
        button: buttonText.slice(0, 20), // Meta limit is 20 chars
        sections: sections.map((sec) => ({
          title: sec.title?.slice(0, 24), // Meta limit is 24 chars
          rows: sec.rows.slice(0, 10).map((row) => ({
            id: row.id,
            title: row.title.slice(0, 24), // Meta limit is 24 chars
            description: row.description?.slice(0, 72), // Meta limit is 72 chars
          })),
        })),
      },
    },
  };
  return sendMetaRequest(payload);
}
