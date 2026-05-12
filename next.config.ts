import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// טוען .env.local לפני בדיקת הדגל — כך גם תהליכי Turbopack יורשים TLS מעוקף בפיתוח (נטפרי וכו׳)
loadEnvConfig(process.cwd());

if (process.env.ALLOW_INSECURE_DEV_TLS === "true") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
