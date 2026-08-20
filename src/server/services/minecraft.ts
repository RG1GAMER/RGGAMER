import axios from 'axios';
import fs from 'fs-extra';

export const getJavaVersionForMinecraft = (version: string, software: string) => {
  // Minecraft 26.x (Paper 26.1+, 26.2+): Java 25
  // Minecraft 1.20.5 - 1.21.x: Java 21
  // Minecraft 1.18.x - 1.20.4: Java 17
  // Minecraft 1.17: Java 16
  // Minecraft 1.16: Java 11
  // Minecraft 1.15 and older: Java 8
  const verStr = String(version || "").toLowerCase();
  if (verStr.startsWith("26.") || verStr.startsWith("27.") || verStr === "26.2" || verStr === "26.1.2" || verStr === "26.1.1" || verStr === "26.1" || verStr === "26.0" || verStr === "26" || parseFloat(verStr) >= 26) {
    return "25";
  }
  if (verStr.startsWith("1.21") || verStr.startsWith("1.20.6") || verStr.startsWith("1.20.5")) {
    return "21";
  }
  if (verStr.startsWith("1.18") || verStr.startsWith("1.19") || verStr.startsWith("1.20")) {
    return "17";
  }
  if (verStr.startsWith("1.17")) {
    return "16";
  }
  if (verStr.startsWith("1.16")) {
    return "11";
  }
  return "8";
};

export const getDockerImageForJava = (javaVersion: string) => {
  if (javaVersion === "26") return "ghcr.io/pterodactyl/yolks:java_26";
  if (javaVersion === "25") return "ghcr.io/pterodactyl/yolks:java_25";
  if (javaVersion === "21") return "ghcr.io/pterodactyl/yolks:java_21";
  if (javaVersion === "17") return "ghcr.io/pterodactyl/yolks:java_17";
  if (javaVersion === "16") return "ghcr.io/pterodactyl/yolks:java_16";
  if (javaVersion === "11") return "ghcr.io/pterodactyl/yolks:java_11";
  if (javaVersion === "8") return "ghcr.io/pterodactyl/yolks:java_8";
  return "ghcr.io/pterodactyl/yolks:java_25";
};

export const getStartupCommand = (software: string, memory: number, jarName: string) => {
  return `java -Xms128M -Xmx${memory}G -jar ${jarName} --nogui`;
};
