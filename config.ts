import { config as dotConfig } from "dotenv";

dotConfig({ export: true });

const config = {
  // Messenger Platform API
  apiDomain: "https://graph.facebook.com",
  apiVersion: "v13.0",

  // Page and Application information
  appId: Deno.env.get("APP_ID")!,
  appSecret: Deno.env.get("APP_SECRET")!,
  appUrl: Deno.env.get("APP_URL")!,
  pageAccessToken: Deno.env.get("PAGE_ACCESS_TOKEN")!,
  verifyToken: Deno.env.get("VERIFY_TOKEN")!,

  // Preferred port (default to 3000)
  port: Deno.env.get("PORT")!,

  // Base URL for Messenger Platform API calls
  get apiUrl() {
    return `${this.apiDomain}/${this.apiVersion}`;
  },

  // URL of webhook endpoint
  get webhookUrl() {
    return `${this.appUrl}/webhook`;
  },
};

export default config;
