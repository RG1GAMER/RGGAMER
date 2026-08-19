import fs from "fs-extra";
import path from "path";
import axios from "axios";
import { pipeline } from "stream/promises";

const DEFAULT_HEADERS = {
  "User-Agent": "JTGPanel/3.0.0 (https://github.com/jishnu; support@jtgpanel.net)",
  "Accept": "*/*"
};

const pipeDownloadToFile = async (url: string, tempPath: string): Promise<boolean> => {
  try {
    const response = await axios({
      method: "GET",
      url,
      responseType: "stream",
      headers: DEFAULT_HEADERS,
      timeout: 60000,
      maxRedirects: 8
    });

    if (response.status !== 200) {
      return false;
    }

    const writer = fs.createWriteStream(tempPath);
    await pipeline(response.data, writer);

    const stat = await fs.stat(tempPath);
    // Ensure the downloaded jar is a valid binary (> 500 KB)
    if (stat.size > 500 * 1024) {
      return true;
    } else {
      await fs.remove(tempPath).catch(() => {});
      return false;
    }
  } catch (err: any) {
    await fs.remove(tempPath).catch(() => {});
    return false;
  }
};

export const downloadJar = async (type: string, version: string, destPath: string): Promise<void> => {
  const normType = (type || "paper").toLowerCase().trim();
  let normVersion = (version || "latest").trim();

  // If version 26.2 or 26.x series is specified, normalize for Minecraft core download
  let mcCompatVersion = normVersion;
  if (normVersion.startsWith("26.") || normVersion.startsWith(".26.") || normVersion === "26.2" || normVersion === "26.1.2" || normVersion === ".26.1.2") {
    mcCompatVersion = "1.21.4";
  }

  // If "latest", attempt to dynamically discover the latest release
  if (normVersion === "latest" || normVersion === "" || normVersion === "default") {
    try {
      if (normType === "paper" || normType === "folia") {
        const proj = normType === "folia" ? "folia" : "paper";
        const paperProj = await axios.get(`https://api.papermc.io/v2/projects/${proj}`, { headers: DEFAULT_HEADERS, timeout: 5000 });
        if (paperProj.data?.versions && Array.isArray(paperProj.data.versions)) {
          normVersion = paperProj.data.versions[paperProj.data.versions.length - 1];
        } else {
          normVersion = "1.21.4";
        }
      } else if (normType === "purpur") {
        const purpurProj = await axios.get("https://api.purpurmc.org/v2/purpur", { headers: DEFAULT_HEADERS, timeout: 5000 });
        if (purpurProj.data?.versions && Array.isArray(purpurProj.data.versions)) {
          normVersion = purpurProj.data.versions[purpurProj.data.versions.length - 1];
        } else {
          normVersion = "1.21.4";
        }
      } else if (normType === "vanilla") {
        const mojangManifest = await axios.get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json", { headers: DEFAULT_HEADERS, timeout: 5000 });
        normVersion = mojangManifest.data?.latest?.release || "1.21.4";
      } else {
        normVersion = "1.21.4";
      }
    } catch {
      normVersion = "1.21.4";
    }
    mcCompatVersion = normVersion;
  }

  const tempPath = `${destPath}.tmp.${Date.now()}`;
  console.log(`[JarDownloader] Request to download ${normType} (${normVersion} / MC ${mcCompatVersion}) -> ${destPath}`);

  // Build ordered list of candidate download URLs
  const urls: string[] = [];

  if (normType === "folia") {
    try {
      const foliaVerRes = await axios.get(`https://api.papermc.io/v2/projects/folia/versions/${mcCompatVersion}`, { headers: DEFAULT_HEADERS, timeout: 6000 });
      const builds = foliaVerRes.data?.builds;
      if (Array.isArray(builds) && builds.length > 0) {
        const latestBuild = builds[builds.length - 1];
        urls.push(`https://api.papermc.io/v2/projects/folia/versions/${mcCompatVersion}/builds/${latestBuild}/downloads/folia-${mcCompatVersion}-${latestBuild}.jar`);
      }
    } catch (e) {}
  } else if (normType === "bungeecord" || normType === "waterfall") {
    urls.push(
      "https://ci.md-5.net/job/BungeeCord/lastSuccessfulBuild/artifact/bootstrap/target/BungeeCord.jar",
      "https://hub.spigotmc.org/jenkins/job/BungeeCord/lastSuccessfulBuild/artifact/bootstrap/target/BungeeCord.jar"
    );
  } else if (normType === "velocity") {
    // PaperMC v2 API for Velocity
    try {
      const veloVerRes = await axios.get("https://api.papermc.io/v2/projects/velocity/versions/3.4.0-SNAPSHOT", { headers: DEFAULT_HEADERS, timeout: 6000 });
      const builds = veloVerRes.data?.builds;
      if (Array.isArray(builds) && builds.length > 0) {
        const latestBuild = builds[builds.length - 1];
        urls.push(`https://api.papermc.io/v2/projects/velocity/versions/3.4.0-SNAPSHOT/builds/${latestBuild}/downloads/velocity-3.4.0-SNAPSHOT-${latestBuild}.jar`);
      }
    } catch (e) {}
    try {
      const veloMeta = await axios.get(`https://fill.papermc.io/v3/projects/velocity/versions/3.4.0-SNAPSHOT/builds/latest`, {
        headers: DEFAULT_HEADERS,
        timeout: 6000
      });
      const dlUrl = veloMeta.data?.downloads?.["server:default"]?.url || veloMeta.data?.downloads?.application?.url;
      if (dlUrl) urls.push(dlUrl);
    } catch (e) {}
    urls.push("https://ci.md-5.net/job/BungeeCord/lastSuccessfulBuild/artifact/bootstrap/target/BungeeCord.jar");
  } else if (normType === "purpur") {
    urls.push(
      `https://api.purpurmc.org/v2/purpur/${normVersion}/latest/download`,
      `https://api.purpurmc.org/v2/purpur/1.21.4/latest/download`
    );
  } else if (normType === "forge") {
    // Official Forge maven links & fallback
    const forgePromoVer = normVersion === "1.21.4" ? "54.0.2" : (normVersion === "1.21.1" ? "52.0.0" : (normVersion === "1.20.4" ? "49.1.0" : (normVersion === "1.20.1" ? "47.3.0" : (normVersion === "1.19.2" ? "43.3.0" : (normVersion === "1.18.2" ? "40.2.0" : (normVersion === "1.16.5" ? "36.2.39" : (normVersion === "1.12.2" ? "14.23.5.2860" : "latest")))))));
    urls.push(
      `https://maven.minecraftforge.net/net/minecraftforge/forge/${normVersion}-${forgePromoVer}/forge-${normVersion}-${forgePromoVer}-installer.jar`,
      `https://maven.minecraftforge.net/net/minecraftforge/forge/${normVersion}-${forgePromoVer}/forge-${normVersion}-${forgePromoVer}-universal.jar`
    );
  } else if (normType === "fabric") {
    try {
      const metaRes = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${normVersion}`, {
        headers: DEFAULT_HEADERS,
        timeout: 8000
      });
      if (Array.isArray(metaRes.data) && metaRes.data.length > 0) {
        const loaderVer = metaRes.data[0].loader?.version || "0.16.10";
        const installerVer = "1.0.1";
        urls.push(`https://meta.fabricmc.net/v2/versions/loader/${normVersion}/${loaderVer}/${installerVer}/server/jar`);
      }
    } catch (e) {
      urls.push(`https://meta.fabricmc.net/v2/versions/loader/${normVersion}/0.16.10/1.0.1/server/jar`);
    }
  } else if (normType === "vanilla") {
    try {
      const manifestRes = await axios.get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json", {
        headers: DEFAULT_HEADERS,
        timeout: 8000
      });
      const versionsList = manifestRes.data?.versions;
      if (Array.isArray(versionsList)) {
        const targetEntry = versionsList.find((v: any) => v.id === normVersion) || versionsList.find((v: any) => v.id === "1.21.4");
        if (targetEntry?.url) {
          const versionPackage = await axios.get(targetEntry.url, { headers: DEFAULT_HEADERS, timeout: 8000 });
          const serverUrl = versionPackage.data?.downloads?.server?.url;
          if (serverUrl) {
            urls.push(serverUrl);
          }
        }
      }
    } catch (e) {}
  } else if (normType === "spigot") {
    urls.push(
      `https://download.getbukkit.org/spigot/spigot-${normVersion}.jar`,
      `https://download.getbukkit.org/spigot/spigot-1.21.4.jar`
    );
  }

  // Primary for Paper: PaperMC API v2
  try {
    const paperVerRes = await axios.get(`https://api.papermc.io/v2/projects/paper/versions/${normVersion}`, {
      headers: DEFAULT_HEADERS,
      timeout: 6000
    });
    const builds = paperVerRes.data?.builds;
    if (Array.isArray(builds) && builds.length > 0) {
      const latestBuild = builds[builds.length - 1];
      const directUrl = `https://api.papermc.io/v2/projects/paper/versions/${normVersion}/builds/${latestBuild}/downloads/paper-${normVersion}-${latestBuild}.jar`;
      urls.unshift(directUrl);
    }
  } catch (e) {}

  // Secondary for Paper: Fill v3 API
  try {
    const paperMeta = await axios.get(`https://fill.papermc.io/v3/projects/paper/versions/${normVersion}/builds/latest`, {
      headers: DEFAULT_HEADERS,
      timeout: 6000
    });
    const dlUrl = paperMeta.data?.downloads?.["server:default"]?.url || paperMeta.data?.downloads?.application?.url;
    if (dlUrl && !urls.includes(dlUrl)) {
      urls.push(dlUrl);
    }
  } catch (e) {}

  // Fallback: 1.21.4 latest Paper build
  if (normVersion !== "1.21.4") {
    try {
      const fbVerRes = await axios.get(`https://api.papermc.io/v2/projects/paper/versions/1.21.4`, {
        headers: DEFAULT_HEADERS,
        timeout: 6000
      });
      const builds = fbVerRes.data?.builds;
      if (Array.isArray(builds) && builds.length > 0) {
        const latestBuild = builds[builds.length - 1];
        const directUrl = `https://api.papermc.io/v2/projects/paper/versions/1.21.4/builds/${latestBuild}/downloads/paper-1.21.4-${latestBuild}.jar`;
        if (!urls.includes(directUrl)) urls.push(directUrl);
      }
    } catch (e) {}
  }

  let success = false;
  let lastErr = "";
  for (const candidateUrl of urls) {
    try {
      console.log(`[JarDownloader] Attempting candidate URL: ${candidateUrl}`);
      const ok = await pipeDownloadToFile(candidateUrl, tempPath);
      if (ok) {
        await fs.ensureDir(path.dirname(destPath));
        await fs.move(tempPath, destPath, { overwrite: true });
        await fs.chmod(destPath, 0o777).catch(() => {});
        const finalStat = await fs.stat(destPath);
        console.log(`[JarDownloader] Successfully downloaded ${normType} (${(finalStat.size / (1024 * 1024)).toFixed(2)} MB)`);
        success = true;
        break;
      }
    } catch (err: any) {
      lastErr = err?.message || String(err);
      console.warn(`[JarDownloader] URL failed: ${candidateUrl} - ${lastErr}`);
    }
  }

  if (!success) {
    await fs.remove(tempPath).catch(() => {});
    throw new Error(`Failed to download server JAR for ${normType} ${normVersion}. ${lastErr || "All download mirrors failed"}`);
  }
};


