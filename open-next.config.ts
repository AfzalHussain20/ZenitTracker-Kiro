import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Use direct queue (no durable objects needed)
  queue: "direct",
});
