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

        // GERENCIADOR DE SESSÕES PERSISTENTES MQTT PARA BAMBU LAB
        // Mantém 1 única conexão aberta por impressora, evitando que a impressora caia ou desconecte o Bambu Studio
        interface BambuSession {
          client: any;
          ip: string;
          serial: string;
          accessCode: string;
          lastData: any;
          lastUpdated: number;
          lastPushall: number;
          status: "connecting" | "connected" | "disconnected" | "error";
          lastError?: string;
          waiters: Array<(data: any) => void>;
        }

        const bambuSessions = new Map<string, BambuSession>();

        function parseTelemetry(print: any, prev: any = null) {
          const amsUnits = print.ams?.ams
            ? (print.ams.ams || []).map((unit: any) => ({
                id: String(unit.id),
                humidity: unit.humidity,
                temp: unit.temp,
                trays: (unit.tray || []).map((t: any) => {
                  const rawColor = String(t.tray_color || "FFFFFF");
                  const hexColor = rawColor.length === 8 ? `#${rawColor.slice(0, 6)}` : rawColor.startsWith("#") ? rawColor : `#${rawColor}`;
                  return {
                    id: String(t.id),
                    color: hexColor,
                    type: t.tray_type || "Vazio",
                    subBrand: t.tray_sub_brands || "",
                    remain: t.remain !== undefined ? Number(t.remain) : 100,
                    active: String(print.ams?.tray_now) === String(t.id),
                    loaded: Boolean(t.tray_type && t.tray_type !== ""),
                  };
                }),
              }))
            : prev?.ams || [];

          const activeTray = print.ams?.tray_now !== undefined
            ? String(print.ams.tray_now)
            : prev?.activeTray || null;

          return {
            gcodeState: print.gcode_state ?? prev?.gcodeState ?? "IDLE",
            nozzleTemp: print.nozzle_temper !== undefined ? Number(print.nozzle_temper) : (prev?.nozzleTemp ?? null),
            nozzleTargetTemp: print.nozzle_target_temper !== undefined ? Number(print.nozzle_target_temper) : (prev?.nozzleTargetTemp ?? null),
            bedTemp: print.bed_temper !== undefined ? Number(print.bed_temper) : (prev?.bedTemp ?? null),
            bedTargetTemp: print.bed_target_temper !== undefined ? Number(print.bed_target_temper) : (prev?.bedTargetTemp ?? null),
            progressPercent: print.mc_percent !== undefined ? Number(print.mc_percent) : (prev?.progressPercent ?? null),
            remainingTimeMinutes: print.mc_remaining_time !== undefined ? Number(print.mc_remaining_time) : (prev?.remainingTimeMinutes ?? null),
            subtaskName: print.subtask_name ?? prev?.subtaskName ?? null,
            layerNum: print.layer_num !== undefined ? Number(print.layer_num) : (prev?.layerNum ?? null),
            totalLayerNum: print.total_layer_num !== undefined ? Number(print.total_layer_num) : (prev?.totalLayerNum ?? null),
            fanSpeed: print.cooling_fan_speed ?? prev?.fanSpeed ?? null,
            ams: amsUnits,
            activeTray: activeTray,
          };
        }

        // ENDPOINT DE TELEMETRIA AO VIVO VIA MQTT PERSISTENTE (Bambu Lab)
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

          const sessionKey = ip;
          let session = bambuSessions.get(sessionKey);

          // Se a sessão não existir ou o código de acesso mudou, inicia a conexão persistente única
          if (!session || session.accessCode !== accessCode) {
            if (session?.client) {
              try { session.client.end(true); } catch {}
            }

            session = {
              client: null,
              ip,
              serial,
              accessCode,
              lastData: session?.lastData || null,
              lastUpdated: 0,
              lastPushall: 0,
              status: "connecting",
              waiters: [],
            };
            bambuSessions.set(sessionKey, session);

            try {
              const { default: mqtt } = await import("mqtt");
              const clientId = `spartan_farm_${(serial || ip).replace(/[^a-zA-Z0-9]/g, "_")}`;
              const client = mqtt.connect(`mqtts://${ip}:8883`, {
                username: "bblp",
                password: accessCode,
                clientId,
                rejectUnauthorized: false,
                connectTimeout: 5000,
                keepalive: 30, // Padrão MQTT para manter socket vivo sem reconectar
                reconnectPeriod: 4000, // Reconecta em background sem abortar outros clientes
                clean: true,
              });

              session.client = client;

              client.on("connect", () => {
                session.status = "connected";
                const topic = serial ? `device/${serial}/report` : "device/+/report";
                client.subscribe(topic, () => {
                  const reqTopic = serial ? `device/${serial}/request` : "device/report";
                  client.publish(reqTopic, JSON.stringify({ pushing: { sequence_id: "1", command: "pushall" } }));
                  session.lastPushall = Date.now();
                });
              });

              client.on("message", (_top, msg) => {
                try {
                  const data = JSON.parse(msg.toString());
                  const print = data.print || {};
                  if (print.gcode_state !== undefined || print.nozzle_temper !== undefined || print.mc_percent !== undefined) {
                    const telemetryData = parseTelemetry(print, session.lastData);
                    session.lastData = telemetryData;
                    session.lastUpdated = Date.now();
                    session.status = "connected";

                    // Notifica requisições HTTP aguardando primeiro pacote
                    if (session.waiters.length > 0) {
                      const pending = session.waiters.splice(0, session.waiters.length);
                      for (const cb of pending) {
                        cb(telemetryData);
                      }
                    }
                  }
                } catch {}
              });

              client.on("error", (err: any) => {
                session.status = "error";
                session.lastError = err.message;
              });

              client.on("close", () => {
                session.status = "disconnected";
              });
            } catch (err: any) {
              res.end(JSON.stringify({ success: false, error: err.message }));
              return;
            }
          }

          // Se já temos telemetria em cache, devolve instantaneamente (<1ms)
          if (session.lastData) {
            // Mantém os dados frescos requisitando pushall a cada 30 segundos
            if (Date.now() - session.lastPushall > 30000 && session.client) {
              const reqTopic = serial ? `device/${serial}/request` : "device/report";
              try {
                session.client.publish(reqTopic, JSON.stringify({ pushing: { sequence_id: "1", command: "pushall" } }));
                session.lastPushall = Date.now();
              } catch {}
            }

            res.end(JSON.stringify({ success: true, data: session.lastData, cached: true }));
            return;
          }

          // Primeira conexão: aguarda até 4 segundos pelo primeiro pacote da máquina
          let answered = false;
          const timer = setTimeout(() => {
            if (!answered) {
              answered = true;
              const idx = session.waiters.indexOf(waiterCb);
              if (idx !== -1) session.waiters.splice(idx, 1);
              res.end(JSON.stringify({
                success: false,
                error: session.lastError || "Conectando à Bambu Lab... aguardando primeiro relatório."
              }));
            }
          }, 4000);

          const waiterCb = (data: any) => {
            if (!answered) {
              answered = true;
              clearTimeout(timer);
              res.end(JSON.stringify({ success: true, data }));
            }
          };

          session.waiters.push(waiterCb);
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
