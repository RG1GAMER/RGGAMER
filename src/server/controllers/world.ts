import { Request, Response } from "express";
import path from "path";
import fs from "fs-extra";
import nbt from "prismarine-nbt";
import { promisify } from "util";
import * as archiverPkg from "archiver";
import { extractArchive } from "../utils/extract.js";

const archiver = (archiverPkg as any).default || archiverPkg;
const parseNbt = promisify(nbt.parse);

async function getLevelName(serverDir: string) {
  const propsPath = path.join(serverDir, "server.properties");
  if (fs.existsSync(propsPath)) {
    const props = await fs.readFile(propsPath, "utf-8");
    const match = props.match(/^level-name=(.*)$/m);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }
  return "world";
}

async function setLevelNameInProperties(serverDir: string, newLevelName: string) {
  const propsPath = path.join(serverDir, "server.properties");
  if (fs.existsSync(propsPath)) {
    let props = await fs.readFile(propsPath, "utf-8");
    if (/^level-name=.*$/m.test(props)) {
      props = props.replace(/^level-name=.*$/m, `level-name=${newLevelName}`);
    } else {
      props += `\nlevel-name=${newLevelName}\n`;
    }
    await fs.writeFile(propsPath, props, "utf-8");
  } else {
    await fs.writeFile(propsPath, `level-name=${newLevelName}\n`, "utf-8");
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 MB";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function getFolderSize(dirPath: string): Promise<number> {
  let total = 0;
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        total += await getFolderSize(fullPath);
      } else {
        const stat = await fs.stat(fullPath).catch(() => null);
        if (stat) total += stat.size;
      }
    }
  } catch {}
  return total;
}

interface ScoredWorldCandidate {
  worldDir: string;
  score: number;
  hasLevelDat: boolean;
  detectedName: string;
  detectedFiles: string[];
}

/**
 * Searches a directory tree for the folder containing Minecraft world files.
 */
async function locateMinecraftWorldFolder(rootDir: string): Promise<ScoredWorldCandidate | null> {
  const candidates: ScoredWorldCandidate[] = [];

  const evaluateDir = async (dir: string, depth = 0) => {
    if (depth > 8) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const lowerNames = entries.map((e) => e.name.toLowerCase());
      let score = 0;
      let hasLevelDat = false;

      const hasLevelDatFile = lowerNames.includes("level.dat") || lowerNames.includes("level.dat_old") || lowerNames.includes("level.dat_mcr");
      if (hasLevelDatFile) {
        score += 50;
        hasLevelDat = true;
      }

      const hasRegionDir = entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "region");
      if (hasRegionDir) {
        score += 60;
        try {
          const regionEntries = await fs.readdir(path.join(dir, entries.find((e) => e.name.toLowerCase() === "region")!.name));
          if (regionEntries.some((f) => f.toLowerCase().endsWith(".mca") || f.toLowerCase().endsWith(".mcr"))) {
            score += 40;
          }
        } catch {}
      }

      if (entries.some((e) => e.name.toLowerCase().endsWith(".mca") || e.name.toLowerCase().endsWith(".mcr"))) {
        score += 60;
      }

      if (entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "data")) score += 25;
      if (entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "datapacks")) score += 25;
      if (entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "advancements")) score += 25;
      if (entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "entities")) score += 25;
      if (entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "poi")) score += 25;
      if (entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "playerdata")) score += 20;
      if (entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "stats")) score += 20;
      if (entries.some((e) => e.isDirectory() && (e.name.toLowerCase() === "dim1" || e.name.toLowerCase() === "dim-1" || e.name.toLowerCase() === "dimensions"))) score += 30;
      if (lowerNames.includes("session.lock")) score += 15;
      if (lowerNames.includes("uid.dat")) score += 10;
      if (lowerNames.includes("icon.png") || lowerNames.includes("world_icon.jpeg")) score += 10;

      if (entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "db") && (lowerNames.includes("levelname.txt") || hasLevelDatFile)) {
        score += 70;
      }

      if (score >= 20) {
        let detectedName = path.basename(dir);
        if (dir === rootDir || detectedName.startsWith("temp_")) {
          detectedName = "world";
        }
        candidates.push({
          worldDir: dir,
          score,
          hasLevelDat,
          detectedName,
          detectedFiles: entries.map((e) => e.name),
        });
      }

      for (const entry of entries) {
        if (entry.isDirectory()) {
          await evaluateDir(path.join(dir, entry.name), depth + 1);
        }
      }
    } catch {}
  };

  await evaluateDir(rootDir, 0);

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

/**
 * List all detected worlds on the server:
 * Always lists the 3 standard dimensions for the active world (Overworld, Nether, The End)
 * PLUS any other custom world folders (e.g. survival, creative, lobby).
 */
export const listWorlds = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    const mainLevelName = await getLevelName(serverDir);

    if (!fs.existsSync(serverDir)) {
      return res.json([]);
    }

    const entries = await fs.readdir(serverDir, { withFileTypes: true });
    const worldsMap = new Map<string, any>();

    // 1. Initialize the 3 core Aternos dimensions for the active level
    const coreDimensions = [
      { name: mainLevelName, dimension: "overworld" as const, isDefault: true },
      { name: `${mainLevelName}_nether`, dimension: "nether" as const, isDefault: false },
      { name: `${mainLevelName}_the_end`, dimension: "end" as const, isDefault: false }
    ];

    for (const core of coreDimensions) {
      const folderPath = path.join(serverDir, core.name);
      const exists = fs.existsSync(folderPath);
      let rawSize = 0;
      let regionCount = 0;
      let worldVersion = exists ? "Minecraft World" : "Will generate on start";

      if (exists) {
        rawSize = await getFolderSize(folderPath);
        const regionDir = path.join(folderPath, "region");
        if (fs.existsSync(regionDir)) {
          const regionFiles = await fs.readdir(regionDir).catch(() => []);
          regionCount = regionFiles.filter(f => f.endsWith(".mca")).length;
        }

        const levelDatPath = path.join(folderPath, "level.dat");
        if (fs.existsSync(levelDatPath)) {
          try {
            const buf = await fs.readFile(levelDatPath);
            const { parsed } = (await parseNbt(buf)) as any;
            if (parsed?.value?.Data?.value?.Version?.value?.Name?.value) {
              worldVersion = parsed.value.Data.value.Version.value.Name.value;
            }
          } catch {}
        }
      }

      worldsMap.set(core.name, {
        id: core.name,
        name: core.name,
        dimension: core.dimension,
        isDefault: core.isDefault,
        size: formatBytes(rawSize),
        rawSize,
        regionFiles: regionCount,
        worldVersion,
        exists
      });
    }

    // 2. Scan server root for any OTHER world directories (custom worlds like 'survival', 'lobby', 'skyblock', etc.)
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const folderName = entry.name;
      if (worldsMap.has(folderName)) continue; // Already added

      const folderPath = path.join(serverDir, folderName);
      const hasLevelDat = fs.existsSync(path.join(folderPath, "level.dat"));
      const hasRegion = fs.existsSync(path.join(folderPath, "region"));
      const hasDim = fs.existsSync(path.join(folderPath, "DIM1")) || fs.existsSync(path.join(folderPath, "DIM-1"));

      if (hasLevelDat || hasRegion || hasDim) {
        let dimension = "custom";
        if (folderName.endsWith("_nether") || folderName.includes("nether")) {
          dimension = "nether";
        } else if (folderName.endsWith("_the_end") || folderName.includes("end")) {
          dimension = "end";
        }

        let regionCount = 0;
        const regionDir = path.join(folderPath, "region");
        if (fs.existsSync(regionDir)) {
          const regionFiles = await fs.readdir(regionDir).catch(() => []);
          regionCount = regionFiles.filter(f => f.endsWith(".mca")).length;
        }

        const rawSize = await getFolderSize(folderPath);
        let worldVersion = "Minecraft World";
        const levelDatPath = path.join(folderPath, "level.dat");
        if (fs.existsSync(levelDatPath)) {
          try {
            const buf = await fs.readFile(levelDatPath);
            const { parsed } = (await parseNbt(buf)) as any;
            if (parsed?.value?.Data?.value?.Version?.value?.Name?.value) {
              worldVersion = parsed.value.Data.value.Version.value.Name.value;
            }
          } catch {}
        }

        worldsMap.set(folderName, {
          id: folderName,
          name: folderName,
          dimension,
          isDefault: folderName === mainLevelName,
          size: formatBytes(rawSize),
          rawSize,
          regionFiles: regionCount,
          worldVersion,
          exists: true
        });
      }
    }

    res.json(Array.from(worldsMap.values()));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Set a world as the active level-name in server.properties
 */
export const setActiveWorld = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { worldName } = req.body;
  const serverDir = path.join(process.cwd(), ".data", "servers", id);

  if (!worldName) {
    return res.status(400).json({ error: "Missing worldName parameter" });
  }

  try {
    await setLevelNameInProperties(serverDir, worldName.trim());
    res.json({
      success: true,
      message: `Active world set to '${worldName}'. Restart your server to load it.`
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to set active world" });
  }
};

/**
 * Delete a world directory from disk
 */
export const deleteWorld = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { worldName } = req.body;
  const serverDir = path.join(process.cwd(), ".data", "servers", id);

  if (!worldName) {
    return res.status(400).json({ error: "Missing worldName parameter" });
  }

  try {
    const mainLevelName = await getLevelName(serverDir);
    const targetDir = path.join(serverDir, worldName);

    if (fs.existsSync(targetDir)) {
      await fs.remove(targetDir);
    }

    res.json({
      success: true,
      message: `World folder '${worldName}' deleted successfully.`
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to delete world" });
  }
};

/**
 * Optimize a world by cleaning unused/empty region files, temporary chunks, and caches
 */
export const optimizeWorld = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { worldName } = req.body;
  const serverDir = path.join(process.cwd(), ".data", "servers", id);
  const targetName = worldName || (await getLevelName(serverDir));
  const worldDir = path.join(serverDir, targetName);

  if (!fs.existsSync(worldDir)) {
    return res.status(404).json({ error: `World folder '${targetName}' does not exist on disk yet.` });
  }

  try {
    const sizeBefore = await getFolderSize(worldDir);
    let cleanedFiles = 0;

    // 1. Remove empty 0-byte or corrupt region files
    const regionDir = path.join(worldDir, "region");
    if (fs.existsSync(regionDir)) {
      const mcaFiles = await fs.readdir(regionDir);
      for (const file of mcaFiles) {
        const mcaPath = path.join(regionDir, file);
        const stats = await fs.stat(mcaPath).catch(() => null);
        if (stats && (stats.size === 0 || stats.size < 4096)) {
          await fs.remove(mcaPath);
          cleanedFiles++;
        }
      }
    }

    // 2. Clean poi & entities zero-byte files
    for (const sub of ["entities", "poi"]) {
      const subDir = path.join(worldDir, sub);
      if (fs.existsSync(subDir)) {
        const subFiles = await fs.readdir(subDir);
        for (const file of subFiles) {
          const filePath = path.join(subDir, file);
          const stats = await fs.stat(filePath).catch(() => null);
          if (stats && stats.size < 4096) {
            await fs.remove(filePath);
            cleanedFiles++;
          }
        }
      }
    }

    // 3. Remove stale session.lock
    const sessionLock = path.join(worldDir, "session.lock");
    if (fs.existsSync(sessionLock)) {
      await fs.remove(sessionLock).catch(() => {});
    }

    const sizeAfter = await getFolderSize(worldDir);
    const freedBytes = Math.max(0, sizeBefore - sizeAfter);

    res.json({
      success: true,
      message: `World '${targetName}' optimized successfully!`,
      cleanedFiles,
      sizeBefore: formatBytes(sizeBefore),
      sizeAfter: formatBytes(sizeAfter),
      freedSpace: formatBytes(freedBytes)
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to optimize world" });
  }
};

/**
 * Generate / Reset a world with custom seed, world-type, hardcore, structures
 */
export const generateWorld = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { 
    worldName = "world", 
    seed = "", 
    worldType = "default", 
    hardcore = false, 
    generateStructures = true,
    setAsActive = true
  } = req.body;

  const serverDir = path.join(process.cwd(), ".data", "servers", id);

  try {
    const chosenName = (worldName || "world").trim();

    // 1. Update server.properties if it's being set as active
    const propsPath = path.join(serverDir, "server.properties");
    let props = fs.existsSync(propsPath) ? await fs.readFile(propsPath, "utf-8") : "";

    const updates: Record<string, string> = {
      ...(setAsActive ? { "level-name": chosenName } : {}),
      "level-seed": seed.trim(),
      "level-type": worldType.toLowerCase(),
      "hardcore": hardcore ? "true" : "false",
      "generate-structures": generateStructures ? "true" : "false"
    };

    for (const [key, val] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, "m");
      if (regex.test(props)) {
        props = props.replace(regex, `${key}=${val}`);
      } else {
        props += `\n${key}=${val}`;
      }
    }

    await fs.writeFile(propsPath, props.trim() + "\n", "utf-8");

    // 2. Delete existing world folder so server freshly generates it
    const targetFolders = [
      path.join(serverDir, chosenName),
      path.join(serverDir, `${chosenName}_nether`),
      path.join(serverDir, `${chosenName}_the_end`)
    ];

    for (const dir of targetFolders) {
      if (fs.existsSync(dir)) {
        await fs.remove(dir);
      }
    }

    res.json({
      success: true,
      message: `World '${chosenName}' configured! When you start the server, it will generate fresh with the new seed and settings.`
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to generate world" });
  }
};

/**
 * Download a world directory as a .zip file
 */
export const downloadWorld = async (req: Request, res: Response) => {
  const { id } = req.params;
  const worldName = (req.query.world as string) || (req.query.name as string) || "world";
  const serverDir = path.join(process.cwd(), ".data", "servers", id);
  const targetWorldDir = path.join(serverDir, worldName);

  if (!fs.existsSync(targetWorldDir)) {
    return res.status(404).json({ error: `World '${worldName}' folder does not exist on disk.` });
  }

  try {
    const zipName = `${worldName}-${Date.now()}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", (err: any) => {
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });

    archive.pipe(res);
    archive.directory(targetWorldDir, worldName);
    await archive.finalize();
  } catch (e: any) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
};

export const getWorldInfo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    const levelName = await getLevelName(serverDir);
    const worldDir = path.join(serverDir, levelName);
    const levelDatPath = path.join(worldDir, "level.dat");

    let worldVersion = "Unknown";
    let dataVersion = 0;
    let worldName = levelName;

    if (fs.existsSync(levelDatPath)) {
      try {
        const buffer = await fs.readFile(levelDatPath);
        const { parsed } = (await parseNbt(buffer)) as any;
        if (parsed?.value?.Data?.value) {
          const data = parsed.value.Data.value;
          if (data.Version?.value?.Name?.value) {
            worldVersion = data.Version.value.Name.value;
          }
          if (data.DataVersion?.value) {
            dataVersion = data.DataVersion.value;
          }
          if (data.LevelName?.value) {
            worldName = data.LevelName.value;
          }
        }
      } catch (nbtErr) {
        console.warn("Could not read level.dat for worldInfo:", nbtErr);
      }
    }

    res.json({
      levelName,
      worldName,
      worldVersion,
      dataVersion,
      exists: fs.existsSync(worldDir),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const analyzeWorld = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { zipPath } = req.body;
  const serverDir = path.join(process.cwd(), ".data", "servers", id);

  try {
    if (!zipPath) {
      return res.status(400).json({ error: "Missing zipPath parameter" });
    }

    let zipFullPath = path.join(serverDir, zipPath);
    if (!fs.existsSync(zipFullPath)) {
      return res.status(400).json({ error: "Zip file not found in server directory" });
    }

    if ((await fs.stat(zipFullPath)).isDirectory()) {
      const filesInside = await fs.readdir(zipFullPath);
      const matched = filesInside.find((f) => /\.(zip|tar|gz|tgz|jar|rar|7z)$/i.test(f));
      if (matched) {
        zipFullPath = path.join(zipFullPath, matched);
      } else {
        const directDetect = await locateMinecraftWorldFolder(zipFullPath);
        if (directDetect) {
          return res.json({
            status: "valid",
            worldDataVersion: 0,
            worldName: directDetect.detectedName || "world",
            folderName: directDetect.detectedName || "world",
            hasLevelDat: directDetect.hasLevelDat,
            detectedFiles: directDetect.detectedFiles.slice(0, 12),
          });
        }
        return res.status(400).json({ error: "No archive file found inside folder" });
      }
    }

    const tempExtractDir = path.join(serverDir, `temp_analyze_${Date.now()}`);
    await extractArchive(zipFullPath, tempExtractDir);

    const detected = await locateMinecraftWorldFolder(tempExtractDir);

    let worldDataVersion = 0;
    let worldName = detected?.detectedName || "world";
    let detectedFiles: string[] = [];

    if (detected) {
      detectedFiles = detected.detectedFiles || [];
      const levelDatPath = path.join(detected.worldDir, "level.dat");
      if (fs.existsSync(levelDatPath)) {
        try {
          const buffer = await fs.readFile(levelDatPath);
          const { parsed } = (await parseNbt(buffer)) as any;
          if (parsed?.value?.Data?.value?.DataVersion?.value) {
            worldDataVersion = parsed.value.Data.value.DataVersion.value;
          }
          if (parsed?.value?.Data?.value?.LevelName?.value) {
            worldName = parsed.value.Data.value.LevelName.value;
          }
        } catch (err) {
          console.warn("Could not parse level.dat nbt during analyze:", err);
        }
      }
    }

    await fs.remove(tempExtractDir);

    if (!detected) {
      return res.json({
        status: "invalid",
        message: "No Minecraft world folder found. The archive must contain world files (such as region, data, datapacks, advancements, or level.dat).",
      });
    }

    res.json({
      status: "valid",
      worldDataVersion,
      worldName: worldName || detected.detectedName,
      folderName: detected.detectedName,
      hasLevelDat: detected.hasLevelDat,
      detectedFiles: detectedFiles.slice(0, 12),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const importWorld = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { zipPath, targetFolderName, autoUpdateProperties = true } = req.body;
  const serverDir = path.join(process.cwd(), ".data", "servers", id);

  try {
    const serversJSON = await fs.readFile(
      path.join(process.cwd(), ".data", "servers.json"),
      "utf8"
    );
    const servers = JSON.parse(serversJSON);
    const server = servers.find((s: any) => s.id === id);
    if (!server) return res.status(404).json({ error: "Server not found" });

    if (
      server.status === "running" ||
      server.status === "starting" ||
      server.status === "online"
    ) {
      return res
        .status(400)
        .json({ error: "Server is currently running. Please stop it first." });
    }

    let zipFullPath = path.join(serverDir, zipPath);
    let origPathToDelete = zipFullPath;
    if (!fs.existsSync(zipFullPath)) {
      return res.status(400).json({ error: "Zip file not found" });
    }

    if ((await fs.stat(zipFullPath)).isDirectory()) {
      const filesInside = await fs.readdir(zipFullPath);
      const matched = filesInside.find((f) => /\.(zip|tar|gz|tgz|jar|rar|7z)$/i.test(f));
      if (matched) {
        zipFullPath = path.join(zipFullPath, matched);
      }
    }

    const tempExtractDir = path.join(serverDir, `temp_world_${Date.now()}`);
    await extractArchive(zipFullPath, tempExtractDir);

    const detected = await locateMinecraftWorldFolder(tempExtractDir);
    if (!detected) {
      await fs.remove(tempExtractDir);
      return res.status(400).json({
        error: "Invalid world archive: No Minecraft world folder structure (advancements, data, datapacks, region, level.dat) found.",
      });
    }

    const configuredLevel = await getLevelName(serverDir);
    const chosenFolderName = (targetFolderName || "world" || detected.detectedName || configuredLevel)
      .trim()
      .replace(/[/\\?%*:|"<>]/g, "-");

    const finalWorldDestination = path.join(serverDir, chosenFolderName);

    if (fs.existsSync(finalWorldDestination)) {
      await fs.remove(finalWorldDestination);
    }
    await fs.ensureDir(finalWorldDestination);
    await fs.copy(detected.worldDir, finalWorldDestination);

    await fs.remove(tempExtractDir);

    if (fs.existsSync(zipFullPath)) {
      await fs.remove(zipFullPath);
    }
    if (origPathToDelete !== zipFullPath && fs.existsSync(origPathToDelete)) {
      await fs.remove(origPathToDelete);
    }

    const lockFiles = [
      path.join(finalWorldDestination, "session.lock"),
      path.join(serverDir, `${chosenFolderName}_nether`, "session.lock"),
      path.join(serverDir, `${chosenFolderName}_the_end`, "session.lock"),
    ];
    for (const lockFile of lockFiles) {
      if (fs.existsSync(lockFile)) {
        await fs.remove(lockFile);
      }
    }

    if (autoUpdateProperties) {
      await setLevelNameInProperties(serverDir, chosenFolderName);
    }

    res.json({
      success: true,
      message: `World files placed directly into '/${chosenFolderName}' in File Manager and zip archive cleaned.`,
      worldFolder: chosenFolderName,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to import world" });
  }
};
