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
          const accessCode = url.searchParams.get("accessCode") || "";
          const port = parseInt(url.searchParams.get("port") || (type === "bambu_lab" ? "8883" : "80"), 10);

          res.setHeader("Content-Type", "application/json");

          if (type === "bambu_lab" && accessCode) {
            import("mqtt").then(({ default: mqtt }) => {
              const client = mqtt.connect(`mqtts://${ip}:8883`, {
                username: "bblp",
                password: accessCode,
                rejectUnauthorized: false,
                connectTimeout: 3500,
                reconnectPeriod: 0,
              });
              let handled = false;
              const timeout = setTimeout(() => {
                if (!handled) {
                  handled = true;
                  try { client.end(true); } catch {}
                  res.end(JSON.stringify({ success: false, ip, port: 8883, error: "Tempo esgotado ao autenticar com a Bambu Lab" }));
                }
              }, 4000);
              client.on("connect", () => {
                if (!handled) {
                  handled = true;
                  clearTimeout(timeout);
                  try { client.end(true); } catch {}
                  res.end(JSON.stringify({ success: true, authenticated: true, ip, port: 8883, type: "bambu_lab", message: "Bambu Lab conectada e AUTENTICADA com sucesso!" }));
                }
              });
              client.on("error", (err) => {
                if (!handled) {
                  handled = true;
                  clearTimeout(timeout);
                  try { client.end(true); } catch {}
                  const isAuthError = err.message && (err.message.includes("Not authorized") || err.message.includes("Connection refused"));
                  res.end(JSON.stringify({
                    success: false,
                    authenticated: false,
                    ip,
                    port: 8883,
                    error: isAuthError ? "Código de Acesso incorreto ou recusado pela impressora (veja os 8 dígitos no visor da máquina em Modo LAN)" : err.message
                  }));
                }
              });
            }).catch(err => {
              res.end(JSON.stringify({ success: false, ip, port: 8883, error: err.message }));
            });
            return;
          }

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

        // ENDPOINT DE TELEMETRIA AO VIVO VIA MQTT (Bambu Lab)
        server.middlewares.use("/api/printer/telemetry", async (req, res) => {
          const url = new URL(req.url || "", `http://${req.headers.host}`);
          const ip = url.searchParams.get("ip") || "192.168.0.102";
          const serial = url.searchParams.get("serial") || "";
          const accessCode = url.searchParams.get("accessCode") || "";

          res.setHeader("Content-Type", "application/json");

          if (!ip || !accessCode) {
            res.end(JSON.stringify({ success: false, error: "IP e Código de Acesso são obrigatórios para telemetria." }));
            return;
          }

          try {
            const { default: mqtt } = await import("mqtt");
            const client = mqtt.connect(`mqtts://${ip}:8883`, {
              username: "bblp",
              password: accessCode,
              rejectUnauthorized: false,
              connectTimeout: 3500,
              reconnectPeriod: 0,
            });

            let answered = false;
            const timeout = setTimeout(() => {
              if (!answered) {
                answered = true;
                try { client.end(true); } catch {}
                res.end(JSON.stringify({ success: false, error: "Tempo esgotado aguardando resposta da impressora." }));
              }
            }, 4000);

            client.on("connect", () => {
              const topic = serial ? `device/${serial}/report` : "device/+/report";
              client.subscribe(topic, () => {
                const reqTopic = serial ? `device/${serial}/request` : "device/report";
                client.publish(reqTopic, JSON.stringify({ pushing: { sequence_id: "1", command: "pushall" } }));
              });
            });

            client.on("message", (_top, msg) => {
              try {
                const data = JSON.parse(msg.toString());
                const print = data.print || {};
                if (print.gcode_state !== undefined || print.nozzle_temper !== undefined) {
                  if (!answered) {
                    answered = true;
                    clearTimeout(timeout);
                    try { client.end(true); } catch {}
                    res.end(JSON.stringify({
                      success: true,
                      data: {
                        gcodeState: print.gcode_state || "IDLE",
                        nozzleTemp: print.nozzle_temper !== undefined ? Number(print.nozzle_temper) : null,
                        nozzleTargetTemp: print.nozzle_target_temper !== undefined ? Number(print.nozzle_target_temper) : null,
                        bedTemp: print.bed_temper !== undefined ? Number(print.bed_temper) : null,
                        bedTargetTemp: print.bed_target_temper !== undefined ? Number(print.bed_target_temper) : null,
                        progressPercent: print.mc_percent !== undefined ? Number(print.mc_percent) : null,
                        remainingTimeMinutes: print.mc_remaining_time !== undefined ? Number(print.mc_remaining_time) : null,
                        subtaskName: print.subtask_name || null,
                        layerNum: print.layer_num !== undefined ? Number(print.layer_num) : null,
                        totalLayerNum: print.total_layer_num !== undefined ? Number(print.total_layer_num) : null,
                        fanSpeed: print.cooling_fan_speed || null,
                      }
                    }));
                  }
                }
              } catch {}
            });

            client.on("error", (err) => {
              if (!answered) {
                answered = true;
                clearTimeout(timeout);
                try { client.end(true); } catch {}
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
          } catch (err: any) {
            res.end(JSON.stringify({ success: false, error: err?.message || "Erro interno de telemetria" }));
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
