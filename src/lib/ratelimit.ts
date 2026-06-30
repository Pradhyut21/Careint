import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let ratelimit: {
  booking: { limit: (key: string) => Promise<{ success: boolean; limit: number; remaining: number; reset: number }> };
  whatsapp: { limit: (key: string) => Promise<{ success: boolean; limit: number; remaining: number; reset: number }> };
};

if (redisUrl && redisToken) {
  console.log("Upstash Redis configured. Initializing rate limiting...");
  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  ratelimit = {
    booking: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "60 s"), // 10 requests per minute per IP
      analytics: true,
      prefix: "careloop_ratelimit_booking",
    }),
    whatsapp: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "60 s"), // 20 requests per minute per phone number
      analytics: true,
      prefix: "careloop_ratelimit_whatsapp",
    }),
  };
} else {
  console.warn("WARNING: Upstash Redis is not configured. Local development will use mock rate limiting.");
  
  // Defer the production check to request-time so it doesn't crash the build phase
  const handleLimit = async () => {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "WARNING: Upstash Redis environment variables (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN) are missing in production. Rate limiting is currently bypassed."
      );
    }
    return {
      success: true,
      limit: 999,
      remaining: 999,
      reset: Date.now() + 60000,
    };
  };

  ratelimit = {
    booking: { limit: handleLimit },
    whatsapp: { limit: handleLimit },
  };
}

export { ratelimit };
