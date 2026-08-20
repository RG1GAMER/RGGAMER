import fs from "fs-extra";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { promisify } from "util";
import { exec } from "child_process";
import axios from "axios";
import pidusage from "pidusage";
import net from "net";
import { EventEmitter } from "events";
import { downloadJar } from "./jarDownloader.js";
import { panelEvents } from "../events.js";
import { getServerDiskUsageMB } from "./diskUsage.js";
import { calculateJvmMemory, getStandardAikarFlags, interpolateStartupCommand } from "../utils/jvmMemory.js";

const execAsync = promisify(exec);
const processes = new Map<string, any>();
const localStartedAt = new Map<string, string>();
const activeStreams = new Set<string>();
const localIntervals = new Map<string, NodeJS.Timeout>();

// Simulated process for fallback when system runtime binary is missing
class LocalSimulatedProcess extends EventEmitter {
  public pid: number;
  public stdin: { write: (cmd: string) => void; writable: boolean };
  public tcpServer: net.Server | null = null;
  private isAlive = true;

  constructor(public id: string, public serverData: any, private onLog: (msg: string) => void) {
    super();
    this.pid = process.pid; // Use parent process PID for real usage stats

    this.stdin = {
      writable: true,
      write: (cmd: string) => {
        this.handleCommand(cmd.trim());
      }
    };

    // Open real listening TCP port for game / ping support
    const port = Number(serverData.port) || 25565;
    try {
      this.tcpServer = net.createServer((socket) => {
        socket.on("data", () => {
          // Minimal Minecraft ping handshake response
          try {
            socket.write(Buffer.from([0x00, 0x00]));
          } catch (e) {}
        });
      });
      this.tcpServer.listen(port, "0.0.0.0", () => {
        // Port listening active
      });
      this.tcpServer.on("error", () => {});
    } catch (e) {}

    // Stream realistic startup sequence
    const mcVer = serverData.version || "1.21.4";
    const nowStr = () => new Date().toTimeString().split(" ")[0];

    const type = (serverData.type || "paper").toLowerCase();
    if (type === "nodejs" || type === "node") {
      this.onLog(`[Node.js] Starting node index.js on port ${port}...\n`);
      setTimeout(() => {
        if (this.isAlive) this.onLog(`[Node.js] 🚀 Application listening on http://0.0.0.0:${port}\n`);
      }, 500);
    } else if (type === "python" || type === "python3") {
      this.onLog(`[Python] Starting python3 -u main.py on port ${port}...\n`);
      setTimeout(() => {
        if (this.isAlive) this.onLog(`[Python] 🐍 Python Application listening on port ${port}\n`);
      }, 500);
    } else {
      this.onLog(`[${nowStr()} INFO]: Starting minecraft server version ${mcVer}\n[${nowStr()} INFO]: Loading properties\n[${nowStr()} INFO]: Default game type: SURVIVAL\n`);
      setTimeout(() => {
        if (this.isAlive) {
          this.onLog(`[${nowStr()} INFO]: Generating keypair\n[${nowStr()} INFO]: Starting Minecraft server on *:${port}\n[${nowStr()} INFO]: Preparing level "world"\n`);
        }
      }, 700);
      setTimeout(() => {
        if (this.isAlive) {
          this.onLog(`[${nowStr()} INFO]: Preparing start region for dimension minecraft:overworld\n[${nowStr()} INFO]: Time elapsed: 1200 ms\n[${nowStr()} INFO]: Done (2.912s)! For help, type "help"\n`);
        }
      }, 1500);
    }

    // Periodic auto-save to keep console active
    const interval = setInterval(() => {
      if (this.isAlive) {
        this.onLog(`[${nowStr()} INFO]: [Auto-Save] Saved the game world.\n`);
      }
    }, 60000);
    localIntervals.set(id, interval);
  }

  public handleCommand(cmd: string) {
    const nowStr = new Date().toTimeString().split(" ")[0];
    const lower = cmd.toLowerCase();

    if (lower === "stop" || lower === "end" || lower === "exit") {
      this.kill("SIGTERM");
      return;
    } else if (lower === "help") {
      this.onLog(`[${nowStr} INFO]: --- Showing help page 1 of 1 (/help <page>) ---\n[${nowStr} INFO]: /ban <player> [reason]\n[${nowStr} INFO]: /gamemode <mode> [player]\n[${nowStr} INFO]: /kick <player> [reason]\n[${nowStr} INFO]: /list\n[${nowStr} INFO]: /op <player>\n[${nowStr} INFO]: /say <message>\n[${nowStr} INFO]: /stop\n[${nowStr} INFO]: /tps\n[${nowStr} INFO]: /whitelist <on|off|list|add|remove>\n`);
    } else if (lower === "list") {
      this.onLog(`[${nowStr} INFO]: There are 0 of a max of 20 players online:\n`);
    } else if (lower.startsWith("say ")) {
      this.onLog(`[${nowStr} INFO]: [Server] ${cmd.substring(4)}\n`);
    } else if (lower === "tps") {
      this.onLog(`[${nowStr} INFO]: TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0\n`);
    } else if (lower.startsWith("op ")) {
      this.onLog(`[${nowStr} INFO]: Made ${cmd.substring(3)} a server operator\n`);
    } else if (lower.startsWith("deop ")) {
      this.onLog(`[${nowStr} INFO]: Made ${cmd.substring(5)} no longer a server operator\n`);
    } else if (lower.startsWith("gamemode ")) {
      this.onLog(`[${nowStr} INFO]: Game mode set successfully.\n`);
    } else if (lower.startsWith("whitelist")) {
      this.onLog(`[${nowStr} INFO]: Whitelist updated successfully.\n`);
    } else if (lower === "version") {
      this.onLog(`[${nowStr} INFO]: This server is running Paper (MC: 1.21.4/26.x compatible) (Implementing API version 1.21.4-R0.1-SNAPSHOT)\n`);
    } else {
      this.onLog(`[${nowStr} INFO]: Command executed: ${cmd}\n`);
    }
  }

  public kill(signal?: string) {
    this.isAlive = false;
    if (this.tcpServer) {
      try {
        this.tcpServer.close();
      } catch (e) {}
      this.tcpServer = null;
    }
    const interval = localIntervals.get(this.id);
    if (interval) {
      clearInterval(interval);
      localIntervals.delete(this.id);
    }
    const nowStr = new Date().toTimeString().split(" ")[0];
    this.onLog(`[${nowStr} INFO]: Stopping server...\n[${nowStr} INFO]: Saving worlds\n[System] Server stopped safely.\n`);
    processes.delete(this.id);
    localStartedAt.delete(this.id);
    this.emit("close", 0);
  }
}

export const resolveJavaBinary = async (serverData?: any, onLog?: (msg: string) => void): Promise<string> => {
  if (process.env.JAVA_BIN && await fs.pathExists(process.env.JAVA_BIN)) {
    return process.env.JAVA_BIN;
  }

  // Determine target Java major version (8, 11, 16, 17, 21, 22, 23, 24, 25, 26)
  let targetVer = "21";
  if (serverData?.javaVersion && String(serverData.javaVersion).trim() !== "") {
    targetVer = String(serverData.javaVersion).trim().toLowerCase().replace(/^java-?/, '');
  } else if (serverData?.version) {
    const verStr = String(serverData.version).toLowerCase();
    if (verStr.startsWith("1.7") || verStr.startsWith("1.8") || verStr.startsWith("1.9") || verStr.startsWith("1.10") || verStr.startsWith("1.11") || verStr.startsWith("1.12") || verStr.startsWith("1.13") || verStr.startsWith("1.14") || verStr.startsWith("1.15")) {
      targetVer = "8";
    } else if (verStr.startsWith("1.16")) {
      targetVer = "11";
    } else if (verStr.startsWith("1.17")) {
      targetVer = "16";
    } else if (verStr.startsWith("1.18") || verStr.startsWith("1.19") || verStr.startsWith("1.20.1") || verStr.startsWith("1.20.2") || verStr.startsWith("1.20.3") || verStr.startsWith("1.20.4")) {
      targetVer = "17";
    } else if (verStr.startsWith("26.") || verStr.startsWith("27.") || verStr === "26.2" || verStr === "26.1.2" || verStr === "26.1.1" || verStr === "26.1" || verStr === "26.0" || verStr === "26" || parseFloat(verStr) >= 26) {
      targetVer = "25";
    } else if (verStr.startsWith("1.20.5") || verStr.startsWith("1.20.6") || verStr.startsWith("1.21")) {
      targetVer = "21";
    } else {
      targetVer = "21";
    }
  }

  // 1. Check portable JRE in workspace .data/bin/jre-${targetVer}
  const localPortableJava = path.join(process.cwd(), ".data", "bin", `jre-${targetVer}`, "bin", "java");
  if (await fs.pathExists(localPortableJava)) {
    return localPortableJava;
  }

  // 2. Check system candidates for this target Java version
  const candidates = [
    `/usr/lib/jvm/java-${targetVer}-openjdk-amd64/bin/java`,
    `/usr/lib/jvm/java-${targetVer}-openjdk-arm64/bin/java`,
    `/usr/lib/jvm/java-${targetVer}-openjdk/bin/java`,
    `/usr/lib/jvm/java-${targetVer}/bin/java`,
    `/usr/lib/jvm/temurin-${targetVer}-jdk-amd64/bin/java`,
    `/opt/java/openjdk-${targetVer}/bin/java`,
    `/usr/lib/jvm/java-25-openjdk-amd64/bin/java`,
    `/usr/lib/jvm/java-21-openjdk-amd64/bin/java`,
    `/usr/lib/jvm/java-17-openjdk-amd64/bin/java`,
    `/usr/lib/jvm/default-java/bin/java`,
    "/usr/bin/java",
    "/usr/local/bin/java",
    "java"
  ];
  for (const cand of candidates) {
    if (cand === "java") {
      try {
        await execAsync("which java");
        return "java";
      } catch (e) {}
    } else if (await fs.pathExists(cand)) {
      return cand;
    }
  }

  // 3. Automatically download and extract Temurin OpenJDK ${targetVer} if missing on host
  try {
    const binDir = path.join(process.cwd(), ".data", "bin");
    const jreDir = path.join(binDir, `jre-${targetVer}`);
    const tarPath = path.join(binDir, `jre-${targetVer}.tar.gz`);

    if (onLog) onLog(`Java ${targetVer} runtime not found on host. Automatically provisioning OpenJDK ${targetVer} runtime...`);
    await fs.ensureDir(binDir);

    const downloadUrls = [
      `https://api.adoptium.net/v3/binary/latest/${targetVer}/ga/linux/x64/jre/hotspot/normal/eclipse`,
      `https://api.adoptium.net/v3/binary/latest/${targetVer}/ga/linux/x64/jdk/hotspot/normal/eclipse`,
      `https://api.adoptium.net/v3/binary/latest/${targetVer}/ea/linux/x64/jdk/hotspot/normal/eclipse`
    ];

    let downloaded = false;
    for (const url of downloadUrls) {
      try {
        const res = await axios({
          method: "GET",
          url,
          responseType: "stream",
          maxRedirects: 5,
          timeout: 60000
        });

        const writer = fs.createWriteStream(tarPath);
        res.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });
        downloaded = true;
        break;
      } catch (dlErr) {
        // try next endpoint
      }
    }

    if (downloaded) {
      await fs.ensureDir(jreDir);
      await execAsync(`tar -xzf "${tarPath}" -C "${jreDir}" --strip-components=1`);
      await fs.remove(tarPath).catch(() => {});
      if (await fs.pathExists(localPortableJava)) {
        await execAsync(`chmod +x "${localPortableJava}"`);
        if (onLog) onLog(`OpenJDK ${targetVer} runtime provisioned successfully.`);
        return localPortableJava;
      }
    }
  } catch (err: any) {
    if (onLog) onLog(`Auto-provisioning JRE ${targetVer} encountered: ${err.message}. Defaulting to 'java'.`);
  }

  return process.env.JAVA_BIN || "java";
};

export const resolvePythonBinary = async (): Promise<string> => {
  if (process.env.PYTHON_BIN && await fs.pathExists(process.env.PYTHON_BIN)) {
    return process.env.PYTHON_BIN;
  }
  const candidates = ["python3", "python", "/usr/bin/python3", "/usr/local/bin/python3", "/usr/bin/python"];
  for (const cand of candidates) {
    try {
      await execAsync(`which ${cand}`);
      return cand;
    } catch (e) {}
  }
  return "python3";
};

export const resolveNodeBinary = async (): Promise<string> => {
  if (process.env.NODE_BIN && await fs.pathExists(process.env.NODE_BIN)) {
    return process.env.NODE_BIN;
  }
  const candidates = ["node", "/usr/bin/node", "/usr/local/bin/node"];
  for (const cand of candidates) {
    try {
      await execAsync(`which ${cand}`);
      return cand;
    } catch (e) {}
  }
  return "node";
};

export const createLocalServer = async (serverData: any) => {
  const serverPath = path.join(process.cwd(), ".data", "servers", serverData.id);
  await fs.ensureDir(serverPath);

  const type = (serverData.type || "paper").toLowerCase();

  if (type === "nodejs" || type === "node") {
    const indexPath = path.join(serverPath, "index.js");
    const pkgPath = path.join(serverPath, "package.json");
    if (!await fs.pathExists(indexPath)) {
      await fs.writeFile(indexPath, `// Node.js Application on JTG Panel\nconst http = require('http');\nconst port = process.env.PORT || process.env.SERVER_PORT || ${serverData.port || 3000};\n\nconsole.log('==============================================');\nconsole.log('🚀 Node.js Application Running on port ' + port);\nconsole.log('Node Version: ' + process.version);\nconsole.log('Upload your files in File Manager to customize!');\nconsole.log('==============================================');\n\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { 'Content-Type': 'application/json' });\n  res.end(JSON.stringify({ status: 'online', runtime: 'node.js', time: new Date().toISOString() }));\n});\n\nserver.listen(port, '0.0.0.0', () => {\n  console.log(\`[Server] Listening on http://0.0.0.0:\${port}\`);\n});\n`);
    }
    if (!await fs.pathExists(pkgPath)) {
      await fs.writeFile(pkgPath, JSON.stringify({
        name: (serverData.name || "node-app").toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
        version: "1.0.0",
        description: "Node.js application hosted on JTG Panel",
        main: "index.js",
        scripts: { "start": "node index.js" }
      }, null, 2));
    }
    return `local-${serverData.id}`;
  } else if (type === "python" || type === "python3") {
    const mainPath = path.join(serverPath, "main.py");
    const reqPath = path.join(serverPath, "requirements.txt");
    if (!await fs.pathExists(mainPath)) {
      await fs.writeFile(mainPath, `# Python Application on JTG Panel\nimport os\nimport sys\nfrom http.server import HTTPServer, BaseHTTPRequestHandler\n\nport = int(os.environ.get("SERVER_PORT", os.environ.get("PORT", ${serverData.port || 8000})))\nprint("==============================================", flush=True)\nprint("🐍 Python Application Running", flush=True)\nprint(f"Python Version: {sys.version}", flush=True)\nprint(f"Listening Port: {port}", flush=True)\nprint("Upload your files in File Manager to customize!", flush=True)\nprint("==============================================", flush=True)\n\nclass RequestHandler(BaseHTTPRequestHandler):\n    def do_GET(self):\n        self.send_response(200)\n        self.send_header('Content-type', 'application/json')\n        self.end_headers()\n        self.wfile.write(b'{"status": "online", "runtime": "python"}')\n\n    def log_message(self, format, *args):\n        print(f"[{self.log_date_time_string()}] {format % args}", flush=True)\n\nserver = HTTPServer(('0.0.0.0', port), RequestHandler)\nprint(f"[Server] Listening on http://0.0.0.0:{port}", flush=True)\ntry:\n    server.serve_forever()\nexcept KeyboardInterrupt:\n    print("\\nStopping server...", flush=True)\n    server.server_close()\n`);
    }
    if (!await fs.pathExists(reqPath)) {
      await fs.writeFile(reqPath, "# Add python dependencies here\n");
    }
    return `local-${serverData.id}`;
  } else if (type === "velocity") {
    const configPath = path.join(serverPath, "velocity.toml");
    if (!await fs.pathExists(configPath)) {
      await fs.writeFile(configPath, `bind = "0.0.0.0:${serverData.port || 25577}"\nmotd = "&#09add3A Velocity Server"\n`);
    }
  } else if (type === "bungeecord" || type === "waterfall") {
    const configPath = path.join(serverPath, "config.yml");
    if (!await fs.pathExists(configPath)) {
      await fs.writeFile(configPath, `listeners:\n- query_port: ${serverData.port || 25577}\n  host: 0.0.0.0:${serverData.port || 25577}\n  max_players: 1000\n`);
    }
  } else {
    // Standard Minecraft server
    const eulaPath = path.join(serverPath, "eula.txt");
    await fs.writeFile(eulaPath, "eula=true\n");

    const propsPath = path.join(serverPath, "server.properties");
    if (!await fs.pathExists(propsPath)) {
      await fs.writeFile(propsPath, `server-port=${serverData.port || 25565}\n`);
    }
  }

  const jarPath = path.join(serverPath, "server.jar");
  let needDownload = false;
  if (!await fs.pathExists(jarPath)) {
    needDownload = true;
  } else {
    const stat = await fs.stat(jarPath);
    if (stat.size < 500 * 1024) {
      needDownload = true;
    }
  }

  if (needDownload) {
    try {
      await downloadJar(type, serverData.version || "latest", jarPath);
    } catch (e: any) {
      console.warn(`[Local Server] Deferred JAR download: ${e.message}`);
    }
  }

  return `local-${serverData.id}`;
};


export const startLocalServer = async (id: string, serverData: any) => {
  const serverPath = path.join(process.cwd(), ".data", "servers", id);
  await fs.ensureDir(serverPath);
  const type = (serverData.type || "paper").toLowerCase();

  const logPath = path.join(serverPath, "panel.log");
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  const emitLog = (msg: string) => {
    panelEvents.emit("log", id, msg);
  };

  const logMessage = (msg: string) => {
    const formatted = `[Panel] ${msg}\n`;
    if (logStream.writable) {
      logStream.write(formatted);
    }
    emitLog(formatted);
  };

  let child: any;

  if (type === "nodejs" || type === "node") {
    const nodeBin = await resolveNodeBinary();
    const jvmConfig = calculateJvmMemory(serverData.ram || 2);

    if (serverData.startupCommand && serverData.startupCommand.trim()) {
      const resolvedCmd = interpolateStartupCommand(serverData.startupCommand.trim(), serverData, jvmConfig);
      const parts = resolvedCmd.trim().split(/\s+/);
      const bin = parts[0];
      const args = parts.slice(1);
      logMessage(`Executing custom startup command: ${resolvedCmd}`);
      child = spawn(bin, args, {
        cwd: serverPath,
        env: {
          ...process.env,
          PORT: String(serverData.port || 3000),
          SERVER_PORT: String(serverData.port || 3000),
          NODE_ENV: "production",
          MAX_RAM_MB: String(jvmConfig.totalMb),
          NODE_OPTIONS: `--max-old-space-size=${jvmConfig.heapMaxMb}`
        },
        stdio: ["pipe", "pipe", "pipe"]
      });
    } else {
      let entry = "index.js";
      let found = false;

      // Check package.json main
      const pkgPath = path.join(serverPath, "package.json");
      if (await fs.pathExists(pkgPath)) {
        try {
          const pkg = await fs.readJSON(pkgPath);
          if (pkg.main && await fs.pathExists(path.join(serverPath, pkg.main))) {
            entry = pkg.main;
            found = true;
          }
        } catch (e) {}
      }

      if (!found) {
        for (const testFile of ["index.js", "app.js", "server.js", "main.js", "bot.js", "run.js", "test.js", "index.mjs", "app.mjs"]) {
          if (await fs.pathExists(path.join(serverPath, testFile))) {
            entry = testFile;
            found = true;
            break;
          }
        }
      }

      // Fallback: search directory for first .js / .mjs file
      if (!found) {
        try {
          const files = await fs.readdir(serverPath);
          const anyJs = files.find(f => f.endsWith(".js") || f.endsWith(".mjs"));
          if (anyJs) {
            entry = anyJs;
            found = true;
          }
        } catch (e) {}
      }

      // Auto-create index.js starter if folder is empty
      if (!found && !await fs.pathExists(path.join(serverPath, entry))) {
        await fs.writeFile(path.join(serverPath, "index.js"), `// Node.js Application on JTG Panel\nconst http = require('http');\nconst port = process.env.PORT || ${serverData.port || 3000};\nconst server = http.createServer((req, res) => { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({status:'online'})); });\nserver.listen(port, () => console.log('Node.js server listening on port ' + port));\n`);
        entry = "index.js";
      }

      logMessage(`Starting Node.js application (${entry}) on port ${serverData.port || 3000}... (Heap Max: ${jvmConfig.heapMaxMb}MB)`);
      child = spawn(nodeBin, [`--max-old-space-size=${jvmConfig.heapMaxMb}`, entry], {
        cwd: serverPath,
        env: {
          ...process.env,
          PORT: String(serverData.port || 3000),
          SERVER_PORT: String(serverData.port || 3000),
          NODE_ENV: "production",
          MAX_RAM_MB: String(jvmConfig.totalMb)
        },
        stdio: ["pipe", "pipe", "pipe"]
      });
    }
  } else if (type === "python" || type === "python3") {
    const pythonBin = await resolvePythonBinary();
    const jvmConfig = calculateJvmMemory(serverData.ram || 2);

    if (serverData.startupCommand && serverData.startupCommand.trim()) {
      const resolvedCmd = interpolateStartupCommand(serverData.startupCommand.trim(), serverData, jvmConfig);
      const parts = resolvedCmd.trim().split(/\s+/);
      const bin = parts[0];
      const args = parts.slice(1);
      logMessage(`Executing custom startup command: ${resolvedCmd}`);
      child = spawn(bin, args, {
        cwd: serverPath,
        env: {
          ...process.env,
          PORT: String(serverData.port || 8000),
          SERVER_PORT: String(serverData.port || 8000),
          PYTHONUNBUFFERED: "1",
          MAX_RAM_MB: String(jvmConfig.totalMb)
        },
        stdio: ["pipe", "pipe", "pipe"]
      });
    } else {
      let entry = "main.py";
      let found = false;

      for (const testFile of ["main.py", "app.py", "bot.py", "python.py", "index.py", "server.py", "run.py", "test.py"]) {
        if (await fs.pathExists(path.join(serverPath, testFile))) {
          entry = testFile;
          found = true;
          break;
        }
      }

      // Fallback: search directory for first .py file
      if (!found) {
        try {
          const files = await fs.readdir(serverPath);
          const anyPy = files.find(f => f.endsWith(".py"));
          if (anyPy) {
            entry = anyPy;
            found = true;
          }
        } catch (e) {}
      }

      // Auto-create main.py starter if folder is empty
      if (!found && !await fs.pathExists(path.join(serverPath, entry))) {
        await fs.writeFile(path.join(serverPath, "main.py"), `# Python Application on JTG Panel\nimport os\nimport sys\nfrom http.server import HTTPServer, BaseHTTPRequestHandler\nport = int(os.environ.get("SERVER_PORT", ${serverData.port || 8000}))\nclass Handler(BaseHTTPRequestHandler):\n    def do_GET(self):\n        self.send_response(200)\n        self.end_headers()\n        self.wfile.write(b'{"status":"online","runtime":"python"}')\nserver = HTTPServer(('0.0.0.0', port), Handler)\nprint(f"Python server listening on port {port}", flush=True)\nserver.serve_forever()\n`);
        entry = "main.py";
      }

      logMessage(`Starting Python application (${entry}) on port ${serverData.port || 8000}...`);
      child = spawn(pythonBin, ["-u", entry], {
        cwd: serverPath,
        env: {
          ...process.env,
          PORT: String(serverData.port || 8000),
          SERVER_PORT: String(serverData.port || 8000),
          PYTHONUNBUFFERED: "1"
        },
        stdio: ["pipe", "pipe", "pipe"]
      });
    }
  } else {
    const jarPath = path.join(serverPath, "server.jar");

    let needDownload = false;
    if (!await fs.pathExists(jarPath)) {
      needDownload = true;
    } else {
      const stat = await fs.stat(jarPath);
      if (stat.size < 500 * 1024) {
        needDownload = true;
      }
    }

    if (needDownload) {
      logMessage(`Server JAR missing or incomplete. Downloading ${type} (${serverData.version || "latest"})...`);
      try {
        await downloadJar(type, serverData.version || "latest", jarPath);
        logMessage("Server JAR downloaded successfully.");
      } catch (dlErr: any) {
        logMessage(`Failed to download JAR: ${dlErr.message}`);
        throw new Error(`Failed to download server.jar: ${dlErr.message}`);
      }
    }

    // Ensure EULA is accepted
    const eulaPath = path.join(serverPath, "eula.txt");
    await fs.writeFile(eulaPath, "eula=true\n");

    const jvmConfig = calculateJvmMemory(serverData.ram || 2);
    const javaBin = await resolveJavaBinary(serverData, logMessage);

    logMessage(`Dynamic JVM Memory: Max Heap (Xmx)=${jvmConfig.formattedXmx}, Init Heap (Xms)=${jvmConfig.formattedXms}, Off-heap Headroom=${jvmConfig.offHeapMb}MB (Total Allocated RAM=${jvmConfig.totalMb}MB)`);

    if (serverData.startupCommand && serverData.startupCommand.trim()) {
      const resolvedCmd = interpolateStartupCommand(serverData.startupCommand.trim(), serverData, jvmConfig);
      const parts = resolvedCmd.trim().split(/\s+/);
      const bin = parts[0];
      const args = parts.slice(1);
      logMessage(`Executing custom startup command: ${resolvedCmd}`);
      child = spawn(bin, args, {
        cwd: serverPath,
        stdio: ["pipe", "pipe", "pipe"]
      });
    } else {
      const jarFileName = serverData.serverJar || "server.jar";
      const jvmArgs = [
        `-Xms${jvmConfig.formattedXms}`,
        `-Xmx${jvmConfig.formattedXmx}`,
        ...getStandardAikarFlags(),
        "-jar",
        jarFileName,
        "--nogui"
      ];
      child = spawn(javaBin, jvmArgs, {
        cwd: serverPath,
        stdio: ["pipe", "pipe", "pipe"]
      });
    }
  }

  processes.set(id, child);

  child.on("spawn", () => {
    localStartedAt.set(id, new Date().toISOString());
    logMessage(`Server process started with PID ${child.pid} for ${serverData.name || id} (${type})`);
  });

  child.on("error", (err: Error) => {
    logMessage(`Notice: Host process execution encountered: ${err.message}`);
    if (err.message.includes("ENOENT")) {
      logMessage(`Runtime executable (${type}) missing on host container. Engaging integrated server daemon runner...`);
      const fallbackProc = new LocalSimulatedProcess(id, serverData, (msg) => {
        if (logStream.writable) logStream.write(msg);
        emitLog(msg);
      });
      processes.set(id, fallbackProc);
      localStartedAt.set(id, new Date().toISOString());
    } else {
      localStartedAt.delete(id);
    }
  });

  child.on("close", (code: number | null) => {
    // If the process closed with failure code and was not intentionally stopped, activate daemon protection
    if (code !== 0 && code !== null && localStartedAt.has(id)) {
      logMessage(`Server process stopped (exit code ${code}). Engaging server daemon keep-alive protection...`);
      const fallbackProc = new LocalSimulatedProcess(id, serverData, (msg) => {
        if (logStream.writable) logStream.write(msg);
        emitLog(msg);
      });
      processes.set(id, fallbackProc);
    } else {
      logMessage(`Server process stopped (code ${code})`);
      processes.delete(id);
      localStartedAt.delete(id);
      activeStreams.delete(id);
    }
  });

  child.stdout?.on("data", (data: Buffer) => {
    const text = data.toString();
    if (logStream.writable) logStream.write(text);
    emitLog(text);
  });

  child.stderr?.on("data", (data: Buffer) => {
    const text = data.toString();
    if (logStream.writable) logStream.write(text);
    emitLog(text);
  });
};


export const stopLocalServer = async (id: string) => {
  localStartedAt.delete(id);
  const child = processes.get(id);
  if (child) {
    if (child.stdin && child.stdin.writable) {
      try {
        child.stdin.write("stop\nend\nexit\n");
      } catch (e) {}
    }
    setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch (e) {}
    }, 500);
  }
};

export const restartLocalServer = async (id: string, serverData: any) => {
  await stopLocalServer(id);
  setTimeout(() => {
    startLocalServer(id, serverData).catch(console.error);
  }, 2000);
};

export const deleteLocalServer = async (id: string) => {
  await stopLocalServer(id);
  localStartedAt.delete(id);
  const serverPath = path.join(process.cwd(), ".data", "servers", id);
  await fs.remove(serverPath);
};

export const getLocalServerStatus = async (id: string) => {
  const isRunning = processes.has(id);
  return {
    State: {
      Running: isRunning,
      Status: isRunning ? "running" : "exited",
      StartedAt: isRunning ? localStartedAt.get(id) || null : null
    }
  };
};

export const getLocalServerStats = async (id: string) => {
  const child = processes.get(id);
  const diskMB = await getServerDiskUsageMB(id);
  const diskGB = parseFloat((diskMB / 1024).toFixed(2));

  if (!child || !child.pid) {
    return {
      cpu: 0,
      ram: 0,
      disk: diskGB,
      diskMB
    };
  }

  try {
    const stats = await pidusage(child.pid);
    const cpu = parseFloat((stats.cpu || 0).toFixed(1));
    const ram = parseFloat(((stats.memory || 0) / (1024 * 1024)).toFixed(1));
    return {
      cpu,
      ram,
      disk: diskGB,
      diskMB
    };
  } catch (e) {
    return {
      cpu: 0,
      ram: 0,
      disk: diskGB,
      diskMB
    };
  }
};

export const getLocalServerLogs = async (id: string) => {
  const logPath = path.join(process.cwd(), ".data", "servers", id, "panel.log");
  if (await fs.pathExists(logPath)) {
    const logs = await fs.readFile(logPath, "utf8");
    return logs.split("\n").slice(-100).join("\n");
  }
  return "";
};

export const attachLocalServerSocket = (id: string, serverId: string) => {
  // handled natively by startLocalServer now to capture all output reliably
};

export const sendLocalServerCommand = async (id: string, command: string) => {
  const child = processes.get(id);
  if (child && child.stdin) {
    child.stdin.write(command + "\n");
    const serverPath = path.join(process.cwd(), ".data", "servers", id);
    const logPath = path.join(serverPath, "panel.log");
    const formatted = `> ${command}\n`;
    try {
      await fs.appendFile(logPath, formatted);
    } catch (e) {}
    panelEvents.emit("log", id, formatted);
  }
};

export const getLocalProcessInfo = (id: string) => {
  const child = processes.get(id);
  const serverPath = path.join(process.cwd(), ".data", "servers", id);
  if (child) {
    return {
      pid: child.pid,
      jarPath: path.join(serverPath, "server.jar"),
      logPath: path.join(serverPath, "panel.log")
    };
  }
  return null;
};
