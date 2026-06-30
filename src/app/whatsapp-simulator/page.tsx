"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Send, Smartphone, User, Check, CheckCheck, 
  MessageSquare, Info, ShieldAlert, RefreshCw, ChevronRight
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  type?: "text" | "buttons" | "list";
  buttons?: Array<{ id: string; title: string }>;
  listRows?: Array<{ id: string; title: string; description?: string }>;
  listButtonText?: string;
}

export default function WhatsAppSimulator() {
  const [role, setRole] = useState<"patient" | "nurse">("patient");
  const [phoneNumber, setPhoneNumber] = useState("+919876543219"); // Default patient
  const { error } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "👋 Welcome to the CareLoop WhatsApp Simulator!\n\nThis simulator allows you to test the AI booking assistant and nurse inventory flows without configuring Meta's API.\n\nType 'hi' or click one of the Quick Actions on the left to start!",
      timestamp: "10:00 AM",
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Automatically update phone number when role changes
  useEffect(() => {
    if (role === "patient") {
      setPhoneNumber("+919876543219");
    } else {
      setPhoneNumber("+919876543210"); // Nurse Emily phone number in seed data
    }
    // Clear chat when switching roles
    setMessages([
      {
        id: "welcome-" + role,
        sender: "bot",
        text: role === "patient" 
          ? "🏥 *CareLoop Assistant (Patient Mode)*\n\nSend 'hi' or describe your symptoms (e.g., 'My 5-year-old child has a high fever') to book an appointment."
          : "📦 *CareLoop Inventory (Staff Mode)*\n\nSend an inventory update (e.g., 'used 5 paracetamol' or 'added 10 syringes') to update the clinic stock.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }
    ]);
  }, [role]);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (textToSend: string, interactiveId?: string) => {
    if (!textToSend.trim()) return;

    const userMsgId = Math.random().toString();
    const newMsg: Message = {
      id: userMsgId,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText("");
    setLoading(true);

    try {
      // Construct Meta Webhook Payload
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "123456789",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "15555555555",
                    phone_number_id: "123456789"
                  },
                  contacts: [
                    {
                      profile: {
                        name: role === "patient" ? "Test Patient" : "Nurse Emily"
                      },
                      wa_id: phoneNumber.replace("+", "")
                    }
                  ],
                  messages: [
                    {
                      from: phoneNumber.replace("+", ""),
                      id: "wamid." + Math.random().toString(36).substring(2),
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      type: interactiveId ? "interactive" : "text",
                      text: interactiveId ? undefined : { body: textToSend },
                      interactive: interactiveId 
                        ? {
                            type: interactiveId.startsWith("spec_") || interactiveId.startsWith("doc_") || interactiveId.startsWith("slot_") ? "list_reply" : "button_reply",
                            button_reply: interactiveId.startsWith("lang_") || interactiveId.startsWith("btn_")
                              ? { id: interactiveId, title: textToSend }
                              : undefined,
                            list_reply: interactiveId.startsWith("spec_") || interactiveId.startsWith("doc_") || interactiveId.startsWith("slot_")
                              ? { id: interactiveId, title: textToSend }
                              : undefined
                          }
                        : undefined
                    }
                  ]
                },
                field: "messages"
              }
            ]
          }
        ]
      };

      const res = await fetch("/api/whatsapp/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      // Add bot replies
      if (data.replies && data.replies.length > 0) {
        const botReplies: Message[] = data.replies.map((reply: any, index: number) => {
          let text = "";
          let type: "text" | "buttons" | "list" = "text";
          let buttons: any[] = [];
          let listRows: any[] = [];
          let listButtonText = "";

          if (reply.type === "text") {
            text = reply.text.body;
          } else if (reply.type === "interactive") {
            const inter = reply.interactive;
            text = inter.body.text;
            
            if (inter.type === "button") {
              type = "buttons";
              buttons = inter.action.buttons.map((b: any) => ({
                id: b.reply.id,
                title: b.reply.title,
              }));
            } else if (inter.type === "list") {
              type = "list";
              listButtonText = inter.action.button;
              listRows = inter.action.sections[0].rows.map((r: any) => ({
                id: r.id,
                title: r.title,
                description: r.description,
              }));
            }
          }

          return {
            id: `bot-reply-${Date.now()}-${index}`,
            sender: "bot",
            text,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            type,
            buttons,
            listRows,
            listButtonText,
          };
        });

        setMessages((prev) => [...prev, ...botReplies]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-empty-${Date.now()}`,
            sender: "bot",
            text: "⚠️ Webhook received the message, but did not generate any mock replies. (Check if your GEMINI_API_KEY is configured).",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }
        ]);
      }
    } catch (err: any) {
      error(err.message || "Failed to communicate with webhook");
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-error-${Date.now()}`,
          sender: "bot",
          text: `❌ Error: ${err.message || "Could not connect to the server."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (text: string) => {
    handleSendMessage(text);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-800">
      {/* Sidebar - Quick Actions */}
      <div className="hidden w-80 flex-col border-r border-slate-200 bg-white p-6 md:flex">
        <div className="flex items-center gap-2 mb-6">
          <MessageSquare className="h-6 w-6 text-teal-600" />
          <h1 className="text-lg font-bold text-slate-900">WhatsApp Simulator</h1>
        </div>

        <div className="mb-6">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Select Testing Role
          </label>
          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setRole("patient")}
              className={`py-2 px-3 text-sm font-semibold rounded-lg transition-all ${
                role === "patient"
                  ? "bg-white text-teal-600 shadow-sm border border-slate-200/50"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Patient
            </button>
            <button
              onClick={() => setRole("nurse")}
              className={`py-2 px-3 text-sm font-semibold rounded-lg transition-all ${
                role === "nurse"
                  ? "bg-white text-teal-600 shadow-sm border border-slate-200/50"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Nurse Staff
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Active Simulation Phone
            </label>
            <div className="text-xs font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-600">
              {phoneNumber}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
              Quick Actions
            </label>
            <div className="space-y-2">
              {role === "patient" ? (
                <>
                  <button
                    onClick={() => handleQuickAction("hi")}
                    className="w-full text-left text-xs font-medium bg-slate-50 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 hover:border-teal-200 py-2.5 px-3 rounded-lg transition-all flex items-center justify-between"
                  >
                    <span>Send "hi" (Start booking)</span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                  </button>
                  <button
                    onClick={() => handleQuickAction("My 5-year-old child has a high fever")}
                    className="w-full text-left text-xs font-medium bg-slate-50 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 hover:border-teal-200 py-2.5 px-3 rounded-lg transition-all flex items-center justify-between"
                  >
                    <span>Symptom: Fever (Pediatrics)</span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                  </button>
                  <button
                    onClick={() => handleQuickAction("I am experiencing chest pain and palpitations")}
                    className="w-full text-left text-xs font-medium bg-slate-50 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 hover:border-teal-200 py-2.5 px-3 rounded-lg transition-all flex items-center justify-between"
                  >
                    <span>Symptom: Chest Pain (Cardiology)</span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleQuickAction("used 5 paracetamol")}
                    className="w-full text-left text-xs font-medium bg-slate-50 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 hover:border-teal-200 py-2.5 px-3 rounded-lg transition-all flex items-center justify-between"
                  >
                    <span>"used 5 paracetamol"</span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                  </button>
                  <button
                    onClick={() => handleQuickAction("added 10 syringe")}
                    className="w-full text-left text-xs font-medium bg-slate-50 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 hover:border-teal-200 py-2.5 px-3 rounded-lg transition-all flex items-center justify-between"
                  >
                    <span>"added 10 syringe"</span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                  </button>
                  <button
                    onClick={() => handleQuickAction("covid vaccine 1 bottle used")}
                    className="w-full text-left text-xs font-medium bg-slate-50 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 hover:border-teal-200 py-2.5 px-3 rounded-lg transition-all flex items-center justify-between"
                  >
                    <span>"covid vaccine 1 bottle used"</span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-2.5">
            <Info className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="text-xs text-amber-800 leading-normal">
              <strong>How it works</strong>: Webhook payloads are compiled client-side and sent directly to <code>/api/whatsapp/webhook</code>. Outgoing bot actions are intercepted and returned in the HTTP response.
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex flex-1 flex-col h-full bg-[#E5DDD5]">
        {/* Chat Header */}
        <div className="flex items-center justify-between bg-[#075E54] py-3 px-5 text-white shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-full bg-teal-800 border border-teal-700 flex items-center justify-center font-bold text-white shadow-sm">
              CL
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base leading-none">CareLoop Assistant</h2>
              <span className="text-[10px] sm:text-xs opacity-80 flex items-center gap-1 mt-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                Online (Simulated)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Mobile role selector */}
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="md:hidden bg-[#128C7E] text-xs font-bold py-1.5 px-2.5 rounded-lg border border-[#075E54] outline-none"
            >
              <option value="patient">Patient Mode</option>
              <option value="nurse">Nurse Mode</option>
            </select>
          </div>
        </div>

        {/* Chat Bubbles */}
        <div className="flex-1 overflow-y-auto py-4 px-4 sm:px-6 space-y-4">
          {messages.map((msg) => {
            const isBot = msg.sender === "bot";
            return (
              <div
                key={msg.id}
                className={`flex w-full ${isBot ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3.5 shadow-sm relative ${
                    isBot
                      ? "bg-white text-slate-800 rounded-tl-none"
                      : "bg-[#DCF8C6] text-slate-800 rounded-tr-none"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
                    {msg.text}
                  </p>

                  {/* Render Interactive Buttons */}
                  {isBot && msg.type === "buttons" && msg.buttons && (
                    <div className="mt-3.5 space-y-1.5 pt-3 border-t border-slate-100">
                      {msg.buttons.map((btn) => (
                        <button
                          key={btn.id}
                          disabled={loading}
                          onClick={() => handleSendMessage(btn.title, btn.id)}
                          className="w-full bg-slate-50 hover:bg-teal-50 text-teal-700 hover:text-teal-800 border border-slate-200 hover:border-teal-200 py-2 px-3 text-xs font-bold rounded-lg transition-all active:scale-[0.99] disabled:opacity-50"
                        >
                          {btn.title}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Render Interactive List Options */}
                  {isBot && msg.type === "list" && msg.listRows && (
                    <div className="mt-3.5 pt-3 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        {msg.listButtonText || "Select an Option"}
                      </span>
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {msg.listRows.map((row) => (
                          <button
                            key={row.id}
                            disabled={loading}
                            onClick={() => handleSendMessage(row.title, row.id)}
                            className="w-full text-left bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-200 p-2 rounded-lg transition-all flex flex-col disabled:opacity-50"
                          >
                            <span className="text-xs font-bold text-teal-700">{row.title}</span>
                            {row.description && (
                              <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                                {row.description}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end items-center gap-1 mt-1.5">
                    <span className="text-[9px] text-slate-400 font-medium">{msg.timestamp}</span>
                    {!isBot && (
                      <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white text-slate-800 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-2">
                <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputText);
          }}
          className="flex items-center gap-2 bg-[#F0F0F0] py-2.5 px-4 border-t border-slate-200"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1 rounded-full py-2.5 px-5 text-sm font-medium bg-white border border-slate-200 outline-none focus:border-teal-500/30 transition-all disabled:opacity-75"
          />
          <button
            type="submit"
            disabled={loading || !inputText.trim()}
            className="h-10 w-10 rounded-full bg-[#128C7E] hover:bg-[#075E54] text-white flex items-center justify-center shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
