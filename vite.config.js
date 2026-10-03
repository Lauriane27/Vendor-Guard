import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { discordBridge } from "./server/discord-bridge.js";
import { reviewBridge } from "./server/review-bridge.js";

export default defineConfig({
  plugins: [react(), tailwindcss(), discordBridge(), reviewBridge()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false,
  },
});
