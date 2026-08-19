import fs from "fs-extra";
import path from "path";

const diskCache = new Map<string, { sizeMB: number; lastChecked: number }>();
const CACHE_DURATION_MS = 10000; // 10 seconds cache

/**
 * Calculates the total disk space used by a server's directory in MB.
 * Cached for 10 seconds to avoid unnecessary filesystem overhead.
 */
export async function getServerDiskUsageMB(serverId: string): Promise<number> {
  const cached = diskCache.get(serverId);
  const now = Date.now();
  if (cached && now - cached.lastChecked < CACHE_DURATION_MS) {
    return cached.sizeMB;
  }

  const serverDir = path.join(process.cwd(), ".data", "servers", serverId);
  if (!await fs.pathExists(serverDir)) {
    return 0;
  }

  try {
    let totalBytes = 0;

    async function traverse(currentPath: string) {
      const items = await fs.readdir(currentPath, { withFileTypes: true }).catch(() => []);
      for (const item of items) {
        if (item.name.startsWith(".tmp") || item.name.endsWith(".tmp") || item.name === ".logs") continue;
        const itemPath = path.join(currentPath, item.name);
        try {
          if (item.isDirectory()) {
            await traverse(itemPath);
          } else if (item.isFile()) {
            const stat = await fs.stat(itemPath).catch(() => null);
            if (stat) {
              totalBytes += stat.size;
            }
          }
        } catch {
          // ignore permission or deleted file errors
        }
      }
    }

    await traverse(serverDir);
    const sizeMB = parseFloat((totalBytes / (1024 * 1024)).toFixed(2));
    diskCache.set(serverId, { sizeMB, lastChecked: now });
    return sizeMB;
  } catch {
    return cached ? cached.sizeMB : 0;
  }
}

/**
 * Clears or updates the disk cache for a specific server (e.g. after uploading or deleting files).
 */
export function invalidateServerDiskCache(serverId: string) {
  diskCache.delete(serverId);
}
