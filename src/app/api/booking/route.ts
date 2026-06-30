import { NextResponse } from "next/server";
import { bookAppointment } from "@/lib/booking-helper";
import { ratelimit } from "@/lib/ratelimit";

export async function POST(request: Request) {
  try {
    // Rate Limiting: 10 requests per minute per IP
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const { success, remaining, reset } = await ratelimit.booking.limit(ip);
    
    if (!success) {
      return NextResponse.json(
        { 
          error: "too_many_requests", 
          message: "Too many booking attempts. Please wait a minute before trying again." 
        },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          }
        }
      );
    }

    const body = await request.json();
    const result = await bookAppointment(body);
    return NextResponse.json(result, { status: result.status });
  } catch (error: any) {
    console.error("Booking API route error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
export const runtime = "nodejs";
