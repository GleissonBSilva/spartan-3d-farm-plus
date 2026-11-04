import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import tls from "tls";
import net from "net";

export default defineConfig(() => ({
  // Only expose the public Supabase URL and anon key to browser code.
  // Never add SUPABASE_SERVICE_ROLE_KEY here.
  envPrefix: ["VITE_", "SUPABASE_URL", "SUPABASE_ANON_KEY"],
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    dyadComponentTagger(),
    react(),
    {
      name: "printer-bridge-api",
      configureServer(server) {
        server.middlewares.use("/api/printer/ping", (req, res) => {
          const url = new URL(req.url || "", `http://${req.headers.host}`);
          const ip = url.searchParams.get("ip") || "192.168.0.102";
          const type = url.searchParams.get("type") || "bambu_lab";
          const port = parseInt(url.searchParams.get("port") || (type === "bambu_lab" ? "8883" : "80"), 10);

          res.setHeader("Content-Type", "application/json");

          if (type === "bambu_lab" || port === 8883) {
            const socket = tls.connect(port, ip, { rejectUnauthorized: false, timeout: 3500 }, () => {
              socket.end();
              res.end(JSON.stringify({ success: true, ip, port, type: "bambu_lab", message: "Bambu Lab online e respondendo na porta 8883" }));
            });
            socket.on("error", (err) => {
              res.end(JSON.stringify({ success: false, ip, port, error: err.message }));
            });
            socket.on("timeout", () => {
              socket.destroy();
              res.end(JSON.stringify({ success: false, ip, port, error: "Tempo esgotado ao tentar alcançar o IP da impressora" }));
            });
          } else {
            const socket = net.createConnection({ host: ip, port, timeout: 3500 }, () => {
              socket.end();
              res.end(JSON.stringify({ success: true, ip, port, type, message: "Impressora online na rede local" }));
            });
            socket.on("error", (err) => {
              res.end(JSON.stringify({ success: false, ip, port, error: err.message }));
            });
            socket.on("timeout", () => {
              socket.destroy();
              res.end(JSON.stringify({ success: false, ip, port, error: "Tempo esgotado ao tentar alcançar o IP" }));
            });
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
