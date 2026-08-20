/**
 * Standardized JVM Memory & Resource Allocation Engine
 * Dynamically computes JVM heap, off-heap headroom, and flags based on total allocated RAM
 * Guarantees consistent memory allocations across Docker, Local Process, and remote Wings runtimes.
 */

export interface JvmMemoryConfig {
  totalMb: number;
  totalBytes: number;
  heapMaxMb: number;            // Xmx
  heapInitMb: number;           // Xms (Aikar-matched)
  heapInitConservativeMb: number; // 50% conservative Xms
  offHeapMb: number;            // Off-heap reservation (Metaspace, native, GC buffers)
  formattedXmx: string;         // e.g. "3523M"
  formattedXms: string;         // e.g. "3523M"
  formattedXmsConservative: string; // e.g. "1762M"
}

/**
 * Calculates dynamic JVM heap allocation ensuring sufficient off-heap headroom
 * to prevent out-of-memory kernel/cgroup kills (Exit 137).
 *
 * @param ramGb Allocated RAM in GB (can be float, e.g. 1.5, 4, 8)
 */
export function calculateJvmMemory(ramGb: number | string): JvmMemoryConfig {
  const parsedGb = Math.max(0.5, parseFloat(String(ramGb)) || 2);
  const totalMb = Math.round(parsedGb * 1024);

  // Dynamic off-heap headroom calculation:
  // Smaller heaps need a higher percentage of headroom for JVM metadata & thread stacks.
  let offHeapMb: number;
  if (totalMb <= 1024) {
    // 1 GB RAM: reserve ~22% for off-heap (~225 MB)
    offHeapMb = Math.max(128, Math.round(totalMb * 0.22));
  } else if (totalMb <= 2048) {
    // 2 GB RAM: reserve ~18% for off-heap (~368 MB)
    offHeapMb = Math.max(256, Math.round(totalMb * 0.18));
  } else if (totalMb <= 4096) {
    // 4 GB RAM: reserve ~14% for off-heap (~573 MB)
    offHeapMb = Math.max(384, Math.round(totalMb * 0.14));
  } else if (totalMb <= 8192) {
    // 8 GB RAM: reserve ~10% for off-heap (~819 MB)
    offHeapMb = Math.max(512, Math.round(totalMb * 0.10));
  } else if (totalMb <= 16384) {
    // 16 GB RAM: reserve ~8% for off-heap (~1310 MB)
    offHeapMb = Math.max(768, Math.round(totalMb * 0.08));
  } else {
    // > 16 GB RAM: cap reservation at 2 GB or 6%
    offHeapMb = Math.min(2048, Math.round(totalMb * 0.06));
  }

  const heapMaxMb = Math.max(256, totalMb - offHeapMb);
  // Matching Xms to Xmx is the standard Paper/Purpur/Spigot/Velocity recommendation (Aikar's flags)
  const heapInitMb = heapMaxMb;
  const heapInitConservativeMb = Math.min(heapMaxMb, Math.max(256, Math.round(heapMaxMb * 0.5)));

  return {
    totalMb,
    totalBytes: totalMb * 1024 * 1024,
    heapMaxMb,
    heapInitMb,
    heapInitConservativeMb,
    offHeapMb,
    formattedXmx: `${heapMaxMb}M`,
    formattedXms: `${heapInitMb}M`,
    formattedXmsConservative: `${heapInitConservativeMb}M`
  };
}

/**
 * Standard optimized Aikar garbage collector flags for modern OpenJDK (Java 17 / 21 / 25)
 */
export function getStandardAikarFlags(): string[] {
  return [
    "-XX:+UseG1GC",
    "-XX:+ParallelRefProcEnabled",
    "-XX:MaxGCPauseMillis=200",
    "-XX:+UnlockExperimentalVMOptions",
    "-XX:+DisableExplicitGC",
    "-XX:+AlwaysPreTouch",
    "-XX:G1NewSizePercent=30",
    "-XX:G1MaxNewSizePercent=40",
    "-XX:G1ReservePercent=20",
    "-XX:G1HeapWastePercent=5",
    "-XX:G1MixedGCCountTarget=4",
    "-XX:InitiatingHeapOccupancyPercent=15",
    "-XX:G1MixedGCLiveThresholdPercent=90",
    "-XX:G1RSetUpdatingPauseTimePercent=5",
    "-XX:SurvivorRatio=32",
    "-XX:+PerfDisableSharedMem",
    "-XX:MaxTenuringThreshold=1",
    "-DPaper.IgnoreWorldDataVersion=true",
    "-Dpaper.ignoreWorldDataVersion=true",
    "-Dterminal.jline=false",
    "-Dterminal.ansi=true",
    "-Dfile.encoding=UTF-8"
  ];
}

/**
 * Resolves templated startup commands (e.g. from Pterodactyl egg or custom input)
 */
export function interpolateStartupCommand(
  commandTemplate: string,
  serverData: any,
  jvmConfig?: JvmMemoryConfig
): string {
  const config = jvmConfig || calculateJvmMemory(serverData.ram || 2);
  const jarName = serverData.serverJar || "server.jar";
  const port = String(serverData.port || 25565);

  return commandTemplate
    .replace(/\{\{\s*SERVER_MEMORY\s*\}\}/g, String(config.heapMaxMb))
    .replace(/\{\{\s*MEMORY\s*\}\}/g, String(config.heapMaxMb))
    .replace(/\{\{\s*XMX\s*\}\}/g, config.formattedXmx)
    .replace(/\{\{\s*XMS\s*\}\}/g, config.formattedXms)
    .replace(/\{\{\s*SERVER_JARFILE\s*\}\}/g, jarName)
    .replace(/\{\{\s*SERVER_PORT\s*\}\}/g, port)
    .replace(/\{\{\s*PORT\s*\}\}/g, port);
}
