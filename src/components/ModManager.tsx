import React, { useEffect, useState, useCallback } from "react";
import { LoadingOverlay } from "../components/LoadingOverlay";
import axios from "axios";
import {
  Search,
  Download,
  RefreshCw,
  AlertCircle,
  Box,
  Palette,
  Layers,
  Check,
  ExternalLink,
  Sparkles,
  Flame,
  Tag,
  Trash2,
  FolderArchive,
  Eye,
  X,
  SlidersHorizontal,
  ChevronRight,
  FileCode2,
  HardDrive,
  Info,
  Server,
  Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

export interface ModrinthHit {
  id: string;
  slug: string;
  name: string;
  tag: string;
  downloads: number;
  follows: number;
  icon: string | null;
  author: string;
  project_type: "mod" | "resourcepack" | "datapack" | "modpack";
  loaders: string[];
  versions: string[];
  categories: string[];
  gallery?: string[];
  date_modified?: string;
}

export interface InstalledAddon {
  name: string;
  size: number;
  modified: string;
  type: "mod" | "resourcepack" | "datapack";
  path: string;
}

interface ModManagerProps {
  serverId: string;
  server?: any;
  initialTab?: "mods" | "resourcepacks" | "datapacks" | "installed";
}

const MOD_PRESETS = [
  { name: "JEI (Just Enough Items)", query: "jei" },
  { name: "Sodium (High FPS Engine)", query: "sodium" },
  { name: "Iris Shaders", query: "iris" },
  { name: "Lithium (Server Optimization)", query: "lithium" },
  { name: "FerriteCore (RAM Reducer)", query: "ferritecore" },
  { name: "Create (Engineering)", query: "create" },
  { name: "Fabric API", query: "fabric-api" },
  { name: "Spark (Profiler)", query: "spark" },
  { name: "ModernFix (Fast Loading)", query: "modernfix" },
  { name: "ImmediatelyFast", query: "immediatelyfast" },
  { name: "Waystones (Teleportation)", query: "waystones" },
  { name: "AppleSkin (HUD Food Info)", query: "appleskin" },
  { name: "Simple Voice Chat", query: "simple-voice-chat" },
  { name: "Cloth Config", query: "cloth-config" },
  { name: "Xaero's Minimap", query: "xaeros-minimap" },
  { name: "Indium", query: "indium" },
  { name: "Chunky (Pre-generator)", query: "chunky" },
];

const RESOURCEPACK_PRESETS = [
  { name: "Faithful 32x", query: "faithful" },
  { name: "Bare Bones", query: "bare bones" },
  { name: "Fresh Animations", query: "fresh animations" },
  { name: "Stay True", query: "stay true" },
  { name: "Dramatic Skys", query: "dramatic skys" },
  { name: "Default 3D", query: "default 3d" },
  { name: "Better Leaves", query: "better leaves" },
  { name: "Fast Better Grass", query: "better grass" },
  { name: "Compliance 32x", query: "compliance" },
  { name: "Visual Workbench", query: "visual workbench" },
  { name: "3D Crops", query: "3d crops" },
  { name: "Complementary Shaders", query: "complementary" },
];

const DATAPACK_PRESETS = [
  { name: "Terralith (World Overhaul)", query: "terralith" },
  { name: "Incendium (Nether Expansion)", query: "incendium" },
  { name: "Nullscape (The End Overhaul)", query: "nullscape" },
  { name: "BlazeandCave's Advancements", query: "advancements" },
  { name: "Armor Statues", query: "armor statues" },
  { name: "Timber (Tree Capitator)", query: "timber" },
  { name: "Player Head Drops", query: "player head drops" },
  { name: "Coordinates HUD", query: "coordinates hud" },
  { name: "Graves / Keep Inventory", query: "graves" },
  { name: "Multiplayer Sleep", query: "multiplayer sleep" },
  { name: "Fast Leaf Decay", query: "fast leaf decay" },
  { name: "Vanilla Tweaks", query: "vanilla tweaks" },
];

const GAME_VERSIONS = [
  "All",
  "26.2",
  "26.1.2",
  "26.1",
  "26.0",
  "1.21.4",
  "1.21.3",
  "1.21.2",
  "1.21.1",
  "1.21",
  "1.20.6",
  "1.20.4",
  "1.20.2",
  "1.20.1",
  "1.19.4",
  "1.19.3",
  "1.19.2",
  "1.19.1",
  "1.19",
  "1.18.2",
  "1.18.1",
  "1.17.1",
  "1.16.5",
  "1.15.2",
  "1.14.4",
  "1.12.2",
  "1.8.9",
  "1.7.10",
];

const MOD_LOADERS = ["All", "fabric", "forge", "neoforge", "quilt"];

export default function ModManager({ serverId, server, initialTab = "mods" }: ModManagerProps) {
  const [activeTab, setActiveTab] = useState<"mods" | "resourcepacks" | "datapacks" | "installed">(initialTab);
  const [items, setItems] = useState<ModrinthHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInstalling, setIsInstalling] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedLoader, setSelectedLoader] = useState<string>(() => {
    const t = (server?.type || "").toLowerCase();
    if (["fabric", "forge", "neoforge", "quilt"].includes(t)) {
      return t;
    }
    return "All";
  });
  const [selectedVersion, setSelectedVersion] = useState<string>(() => {
    if (server?.version && GAME_VERSIONS.includes(server.version)) {
      return server.version;
    }
    return "All";
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"downloads" | "follows" | "updated" | "relevance">("downloads");
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [installedList, setInstalledList] = useState<{
    mods: InstalledAddon[];
    resourcepacks: InstalledAddon[];
    datapacks: InstalledAddon[];
  }>({ mods: [], resourcepacks: [], datapacks: [] });

  // Detail Modal
  const [selectedHit, setSelectedHit] = useState<ModrinthHit | null>(null);
  const [projectDetails, setProjectDetails] = useState<any | null>(null);
  const [projectVersions, setProjectVersions] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [applyToProperties, setApplyToProperties] = useState(true);

  // Sync tab with initialTab prop if changed
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Load installed addons from server
  const loadInstalledAddons = useCallback(async () => {
    try {
      const res = await axios.get(`/api/servers/${serverId}/installed-addons`);
      if (res.data) {
        setInstalledList({
          mods: res.data.mods || [],
          resourcepacks: res.data.resourcepacks || [],
          datapacks: res.data.datapacks || [],
        });
      }
    } catch {
      // Fallback
    }
  }, [serverId]);

  useEffect(() => {
    loadInstalledAddons();
  }, [loadInstalledAddons]);

  // Search Modrinth API
  const searchModrinth = useCallback(
    async (searchQuery: string = "", projectType: "mod" | "resourcepack" | "datapack") => {
      try {
        setLoading(true);
        const results: ModrinthHit[] = [];

        const facets: string[][] = [[`project_type:${projectType}`]];

        if (projectType === "mod" && selectedLoader !== "All") {
          facets.push([`categories:${selectedLoader.toLowerCase()}`]);
        }

        if (selectedVersion !== "All") {
          facets.push([`versions:${selectedVersion}`]);
        }

        if (selectedCategory !== "All") {
          facets.push([`categories:${selectedCategory.toLowerCase()}`]);
        }

        let indexSort = "downloads";
        if (sortBy === "follows") indexSort = "follows";
        if (sortBy === "updated") indexSort = "updated";
        if (sortBy === "relevance") indexSort = "relevance";

        const q = searchQuery.trim();
        const facetString = encodeURIComponent(JSON.stringify(facets));
        const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(
          q
        )}&facets=${facetString}&index=${indexSort}&limit=24`;

        const externalAxios = axios.create();
        delete externalAxios.defaults.headers.common["Authorization"];

        const res = await externalAxios.get(url);
        if (res.data && res.data.hits) {
          res.data.hits.forEach((hit: any) => {
            results.push({
              id: hit.project_id,
              slug: hit.slug,
              name: hit.title,
              tag: hit.description,
              downloads: hit.downloads,
              follows: hit.follows,
              icon: hit.icon_url,
              author: hit.author,
              project_type: hit.project_type,
              loaders: hit.loaders || [],
              versions: hit.versions || [],
              categories: hit.categories || [],
              gallery: hit.gallery || [],
              date_modified: hit.date_modified,
            });
          });
        }

        setItems(results);
      } catch (err: any) {
        console.error("Modrinth search error:", err);
      } finally {
        setLoading(false);
      }
    },
    [selectedLoader, selectedVersion, selectedCategory, sortBy]
  );

  // Trigger search on tab, query, or filter changes
  useEffect(() => {
    if (activeTab === "installed") {
      loadInstalledAddons();
      return;
    }

    const type = activeTab === "resourcepacks" ? "resourcepack" : activeTab === "datapacks" ? "datapack" : "mod";
    searchModrinth(query, type);
  }, [activeTab, selectedLoader, selectedVersion, selectedCategory, sortBy, searchModrinth, loadInstalledAddons]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === "installed") return;
    const type = activeTab === "resourcepacks" ? "resourcepack" : activeTab === "datapacks" ? "datapack" : "mod";
    searchModrinth(query, type);
  };

  const handlePresetClick = (presetQuery: string) => {
    setQuery(presetQuery);
    const type = activeTab === "resourcepacks" ? "resourcepack" : activeTab === "datapacks" ? "datapack" : "mod";
    searchModrinth(presetQuery, type);
  };

  // Open Details Modal
  const openDetails = async (hit: ModrinthHit) => {
    setSelectedHit(hit);
    setLoadingDetails(true);
    setProjectDetails(null);
    setProjectVersions([]);
    try {
      const externalAxios = axios.create();
      delete externalAxios.defaults.headers.common["Authorization"];

      const [projRes, versRes] = await Promise.all([
        externalAxios.get(`https://api.modrinth.com/v2/project/${hit.id}`),
        externalAxios.get(`https://api.modrinth.com/v2/project/${hit.id}/version`),
      ]);

      setProjectDetails(projRes.data);
      setProjectVersions(versRes.data || []);
    } catch (err) {
      console.error("Failed to load details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Install Handlers
  const handleInstall = async (hit: ModrinthHit, versionId?: string) => {
    setStatusMsg(null);
    try {
      setIsInstalling(hit.id);

      if (hit.project_type === "mod") {
        const res = await axios.post(`/api/servers/${serverId}/mods/install`, {
          pluginId: hit.id,
          pluginName: hit.name,
          versionId: versionId,
        });
        setStatusMsg({
          text: res.data.message || `${hit.name} installed successfully into /mods!`,
          type: "success",
        });
      } else if (hit.project_type === "resourcepack") {
        const res = await axios.post(`/api/servers/${serverId}/resourcepacks/install`, {
          projectId: hit.id,
          projectName: hit.name,
          versionId: versionId,
          applyToProperties: applyToProperties,
        });
        setStatusMsg({
          text: res.data.message || `${hit.name} installed successfully into /resourcepacks!`,
          type: "success",
        });
      } else if (hit.project_type === "datapack") {
        const res = await axios.post(`/api/servers/${serverId}/datapacks/install`, {
          projectId: hit.id,
          projectName: hit.name,
          versionId: versionId,
          targetWorld: "world",
        });
        setStatusMsg({
          text: res.data.message || `${hit.name} installed successfully into /world/datapacks!`,
          type: "success",
        });
      }

      await loadInstalledAddons();
    } catch (e: any) {
      setStatusMsg({
        text: e.response?.data?.error || "Failed to install item.",
        type: "error",
      });
    } finally {
      setIsInstalling(null);
    }
  };

  // Delete installed addon
  const handleDeleteAddon = async (addon: InstalledAddon) => {
    if (!confirm(`Are you sure you want to delete '${addon.name}'?`)) return;
    try {
      await axios.delete(`/api/servers/${serverId}/addon`, {
        data: { filePath: addon.path },
      });
      setStatusMsg({ text: `Removed ${addon.name} successfully.`, type: "success" });
      await loadInstalledAddons();
    } catch (e: any) {
      setStatusMsg({ text: e.response?.data?.error || "Failed to delete file", type: "error" });
    }
  };

  // Check if item is already installed
  const isInstalled = (name: string, type: string) => {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (type === "mod") {
      return installedList.mods.some((m) => m.name.toLowerCase().replace(/[^a-z0-9]/g, "").includes(cleanName));
    }
    if (type === "resourcepack") {
      return installedList.resourcepacks.some((r) =>
        r.name.toLowerCase().replace(/[^a-z0-9]/g, "").includes(cleanName)
      );
    }
    if (type === "datapack") {
      return installedList.datapacks.some((d) =>
        d.name.toLowerCase().replace(/[^a-z0-9]/g, "").includes(cleanName)
      );
    }
    return false;
  };

  const serverTypeUpper = (server?.type || "").toUpperCase();
  const isModServer = ["FORGE", "FABRIC", "NEOFORGE", "QUILT"].includes(serverTypeUpper);

  const presets =
    activeTab === "resourcepacks"
      ? RESOURCEPACK_PRESETS
      : activeTab === "datapacks"
      ? DATAPACK_PRESETS
      : MOD_PRESETS;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 text-foreground bg-transparent">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Title & Tab Switcher */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between pb-2 border-b border-border-subtle">
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground-muted flex items-center gap-2">
              {activeTab === "resourcepacks" ? (
                <>
                  <Palette className="w-6 h-6 text-theme-400" /> Resource Pack Installer
                </>
              ) : activeTab === "datapacks" ? (
                <>
                  <Layers className="w-6 h-6 text-theme-400" /> Datapack Installer
                </>
              ) : activeTab === "installed" ? (
                <>
                  <FolderArchive className="w-6 h-6 text-theme-400" /> Installed Add-ons
                </>
              ) : (
                <>
                  <Box className="w-6 h-6 text-theme-400" /> Mod & Addon Installer
                </>
              )}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              One-click installer powered by Modrinth. Discover thousands of community mods, texture packs, and datapacks.
            </p>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-black/40 backdrop-blur-md rounded-2xl border border-border-subtle self-stretch md:self-auto overflow-x-auto">
            <button
              onClick={() => {
                setActiveTab("mods");
                setQuery("");
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === "mods"
                  ? "bg-theme-600 text-white shadow-lg shadow-theme-600/20 font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted-subtle"
              }`}
            >
              <Box className="w-4 h-4" /> Mods
            </button>

            <button
              onClick={() => {
                setActiveTab("resourcepacks");
                setQuery("");
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === "resourcepacks"
                  ? "bg-theme-600 text-white shadow-lg shadow-theme-600/20 font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted-subtle"
              }`}
            >
              <Palette className="w-4 h-4" /> Resource Packs
            </button>

            <button
              onClick={() => {
                setActiveTab("datapacks");
                setQuery("");
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === "datapacks"
                  ? "bg-theme-600 text-white shadow-lg shadow-theme-600/20 font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted-subtle"
              }`}
            >
              <Layers className="w-4 h-4" /> Datapacks
            </button>

            <button
              onClick={() => {
                setActiveTab("installed");
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap relative ${
                activeTab === "installed"
                  ? "bg-theme-600 text-white shadow-lg shadow-theme-600/20 font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted-subtle"
              }`}
            >
              <FolderArchive className="w-4 h-4" />
              Installed
              {installedList.mods.length + installedList.resourcepacks.length + installedList.datapacks.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                  {installedList.mods.length + installedList.resourcepacks.length + installedList.datapacks.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Server Compatibility Notice for Mods */}
        {activeTab === "mods" && !isModServer && server && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3">
            <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-semibold mb-1">Modding Requirement Notice</p>
              <p className="text-amber-200/80 leading-relaxed">
                Your server software is currently set to <strong>{server.type || "Vanilla/Paper"}</strong>. Mods (.jar) require Fabric, Forge, NeoForge, or Quilt software. You can change your server version anytime in <strong>Settings &gt; Version</strong>. Resource Packs and Datapacks work on all server types!
              </p>
            </div>
          </div>
        )}

        {/* Status Message Notification */}
        {statusMsg && (
          <div
            className={`p-4 rounded-2xl border text-sm flex items-center justify-between shadow-lg ${
              statusMsg.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {statusMsg.type === "success" ? <Check className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-rose-400" />}
              <span>{statusMsg.text}</span>
            </div>
            <button
              onClick={() => setStatusMsg(null)}
              className="text-xs px-2 py-1 rounded-lg bg-black/20 hover:bg-black/40 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: INSTALLED ADDONS MANAGEMENT */}
        {/* ========================================================================= */}
        {activeTab === "installed" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Installed Files on Server</h3>
                <p className="text-xs text-muted-foreground">Manage active mods, resource packs, and datapacks.</p>
              </div>
              <button
                onClick={loadInstalledAddons}
                className="px-3.5 py-1.5 bg-muted hover:bg-muted-hover border border-border-subtle rounded-xl text-xs font-semibold flex items-center gap-1.5 text-foreground transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5 text-theme-400" /> Refresh
              </button>
            </div>

            {/* Mods Section */}
            <div className="bg-black/40 backdrop-blur-xl border border-border-subtle rounded-3xl p-5 shadow-xl">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                <Box className="w-4 h-4 text-theme-400" /> Installed Mods ({installedList.mods.length})
                <span className="text-[11px] font-mono text-muted-foreground font-normal">/mods</span>
              </h4>

              {installedList.mods.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border-subtle rounded-2xl">
                  No mods currently installed in /mods. Switch to the <strong>Mods</strong> tab above to browse and install!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {installedList.mods.map((mod) => (
                    <div
                      key={mod.path}
                      className="p-3.5 rounded-2xl bg-muted/40 border border-border-subtle flex items-center justify-between gap-3 hover:border-theme-500/30 transition-all"
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-theme-500/10 border border-theme-500/20 flex items-center justify-center shrink-0">
                          <FileCode2 className="w-4 h-4 text-theme-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-foreground truncate">{mod.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {(mod.size / (1024 * 1024)).toFixed(2)} MB • {new Date(mod.modified).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteAddon(mod)}
                        title="Delete Mod"
                        className="p-2 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resource Packs Section */}
            <div className="bg-black/40 backdrop-blur-xl border border-border-subtle rounded-3xl p-5 shadow-xl">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                <Palette className="w-4 h-4 text-theme-400" /> Installed Resource Packs ({installedList.resourcepacks.length})
                <span className="text-[11px] font-mono text-muted-foreground font-normal">/resourcepacks</span>
              </h4>

              {installedList.resourcepacks.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border-subtle rounded-2xl">
                  No resource packs installed in /resourcepacks.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {installedList.resourcepacks.map((rp) => (
                    <div
                      key={rp.path}
                      className="p-3.5 rounded-2xl bg-muted/40 border border-border-subtle flex items-center justify-between gap-3 hover:border-theme-500/30 transition-all"
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                          <Palette className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-foreground truncate">{rp.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {(rp.size / (1024 * 1024)).toFixed(2)} MB • {new Date(rp.modified).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteAddon(rp)}
                        title="Delete Resource Pack"
                        className="p-2 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Datapacks Section */}
            <div className="bg-black/40 backdrop-blur-xl border border-border-subtle rounded-3xl p-5 shadow-xl">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-theme-400" /> Installed Datapacks ({installedList.datapacks.length})
                <span className="text-[11px] font-mono text-muted-foreground font-normal">/world/datapacks</span>
              </h4>

              {installedList.datapacks.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border-subtle rounded-2xl">
                  No datapacks installed in /world/datapacks.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {installedList.datapacks.map((dp) => (
                    <div
                      key={dp.path}
                      className="p-3.5 rounded-2xl bg-muted/40 border border-border-subtle flex items-center justify-between gap-3 hover:border-theme-500/30 transition-all"
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                          <Layers className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-foreground truncate">{dp.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {(dp.size / (1024 * 1024)).toFixed(2)} MB • {new Date(dp.modified).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteAddon(dp)}
                        title="Delete Datapack"
                        className="p-2 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* TAB: BROWSE & INSTALL MODS / RESOURCE PACKS / DATAPACKS */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* Search & Filter Bar */}
            <div className="bg-black/40 backdrop-blur-xl border border-border-subtle rounded-3xl p-4 md:p-6 shadow-xl space-y-4">
              <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={`Search ${
                      activeTab === "resourcepacks"
                        ? "resource & texture packs (e.g. Faithful, Bare Bones)..."
                        : activeTab === "datapacks"
                        ? "datapacks (e.g. Terralith, Incendium, Timber)..."
                        : "mods (e.g. JEI, Sodium, Iris, Create)..."
                    }`}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-muted/60 border border-border-subtle rounded-2xl py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-zinc-500 focus:outline-none focus:border-theme-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-theme-600 hover:bg-theme-500 text-white rounded-2xl text-sm font-semibold transition-all shadow-lg shadow-theme-600/20 shrink-0"
                >
                  Search
                </button>
              </form>

              {/* Filters Row */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border-subtle/60 text-xs">
                {/* Loader Filter (Mods only) */}
                {activeTab === "mods" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground font-medium">Loader:</span>
                    <select
                      value={selectedLoader}
                      onChange={(e) => setSelectedLoader(e.target.value)}
                      className="bg-muted/80 border border-border-subtle text-foreground rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-theme-500"
                    >
                      {MOD_LOADERS.map((ldr) => (
                        <option key={ldr} value={ldr}>
                          {ldr.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Minecraft Version Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground font-medium">MC Version:</span>
                  <select
                    value={selectedVersion}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    className="bg-muted/80 border border-border-subtle text-foreground rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-theme-500"
                  >
                    {GAME_VERSIONS.map((v) => (
                      <option key={v} value={v}>
                        {v === "All" ? "All Versions" : `v${v}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground font-medium">Sort By:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-muted/80 border border-border-subtle text-foreground rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-theme-500"
                  >
                    <option value="downloads">Most Downloaded</option>
                    <option value="follows">Most Followed</option>
                    <option value="updated">Recently Updated</option>
                    <option value="relevance">Relevance</option>
                  </select>
                </div>

                {/* Resource Pack server.properties toggle */}
                {activeTab === "resourcepacks" && (
                  <label className="flex items-center gap-2 ml-auto cursor-pointer text-muted-foreground hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={applyToProperties}
                      onChange={(e) => setApplyToProperties(e.target.checked)}
                      className="rounded text-theme-600 focus:ring-0"
                    />
                    <span>Set in server.properties</span>
                  </label>
                )}
              </div>

              {/* Popular Quick-Select Presets */}
              <div className="flex items-center gap-2 pt-2 overflow-x-auto pb-1 custom-scrollbar">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-theme-400" /> Popular:
                </span>
                {presets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handlePresetClick(preset.query)}
                    className="px-2.5 py-1 rounded-xl bg-muted/60 hover:bg-theme-500/15 hover:border-theme-500/30 border border-border-subtle text-[11px] font-medium text-foreground-muted hover:text-theme-300 transition-all whitespace-nowrap shrink-0"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Grid */}
            {loading ? (
              <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center bg-black/20 rounded-3xl border border-border-subtle">
                <RefreshCw className="w-8 h-8 animate-spin mb-4 text-theme-400" />
                <p className="text-sm font-semibold">Searching Modrinth repositories...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center bg-black/20 rounded-3xl border border-border-subtle">
                <AlertCircle className="w-10 h-10 mb-3 text-muted-foreground opacity-60" />
                <p className="text-sm font-semibold">No results found for your query.</p>
                <p className="text-xs text-muted-foreground mt-1">Try clearing filters or searching for popular names above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => {
                  const installed = isInstalled(item.name, item.project_type);

                  return (
                    <div
                      key={item.id}
                      className="p-5 rounded-3xl bg-black/40 backdrop-blur-xl border border-border-subtle hover:border-theme-500/40 transition-all flex flex-col justify-between shadow-lg group relative overflow-hidden"
                    >
                      <div>
                        {/* Top: Icon + Title */}
                        <div className="flex items-start gap-3.5 mb-3">
                          <div className="w-12 h-12 rounded-2xl bg-muted/80 border border-border-subtle flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                            {item.icon ? (
                              <img src={item.icon} alt={item.name} className="w-full h-full object-cover" />
                            ) : item.project_type === "resourcepack" ? (
                              <Palette className="w-6 h-6 text-purple-400" />
                            ) : item.project_type === "datapack" ? (
                              <Layers className="w-6 h-6 text-emerald-400" />
                            ) : (
                              <Box className="w-6 h-6 text-theme-400" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-bold text-sm text-foreground truncate group-hover:text-theme-400 transition-colors">
                                {item.name}
                              </h4>
                              {installed && (
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[9px] font-bold text-emerald-400 flex items-center gap-0.5">
                                  <Check className="w-2.5 h-2.5" /> Installed
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">by {item.author}</p>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4">
                          {item.tag || "No description provided."}
                        </p>

                        {/* Badges / Loaders */}
                        <div className="flex flex-wrap items-center gap-1 mb-4">
                          {item.loaders?.slice(0, 3).map((l) => (
                            <span
                              key={l}
                              className="px-1.5 py-0.5 rounded-md bg-muted text-[10px] uppercase font-mono font-bold text-muted-foreground"
                            >
                              {l}
                            </span>
                          ))}
                          {item.categories?.slice(0, 2).map((c) => (
                            <span
                              key={c}
                              className="px-1.5 py-0.5 rounded-md bg-theme-500/10 text-[10px] font-medium text-theme-300"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Bottom Action Footer */}
                      <div className="pt-3 border-t border-border-subtle/60 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                          <span className="flex items-center gap-1" title="Total Downloads">
                            <Download className="w-3.5 h-3.5" /> {item.downloads > 1000 ? `${(item.downloads / 1000).toFixed(1)}k` : item.downloads}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openDetails(item)}
                            className="p-2 rounded-xl bg-muted hover:bg-muted-hover text-muted-foreground hover:text-foreground transition-colors"
                            title="View Screenshots & Versions"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleInstall(item)}
                            disabled={isInstalling !== null}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md ${
                              installed
                                ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40"
                                : "bg-theme-600 hover:bg-theme-500 text-white shadow-theme-600/20"
                            } disabled:opacity-50`}
                          >
                            {isInstalling === item.id ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Installing
                              </>
                            ) : installed ? (
                              <>
                                <Check className="w-3.5 h-3.5" /> Reinstall
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" /> Install
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DETAILS / SCREENSHOTS / VERSION PICKER MODAL */}
      {/* ========================================================================= */}
      {selectedHit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-[#121214] border border-border-subtle rounded-3xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden relative">
            {/* Modal Header */}
            <div className="p-5 border-b border-border-subtle flex items-center justify-between shrink-0 bg-black/40">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden border border-border-subtle">
                  {selectedHit.icon ? (
                    <img src={selectedHit.icon} alt={selectedHit.name} className="w-full h-full object-cover" />
                  ) : (
                    <Box className="w-5 h-5 text-theme-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base text-foreground truncate">{selectedHit.name}</h3>
                  <p className="text-xs text-muted-foreground">by {selectedHit.author}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`https://modrinth.com/${selectedHit.project_type}/${selectedHit.slug || selectedHit.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-muted hover:bg-muted-hover text-muted-foreground hover:text-foreground transition-colors"
                  title="Open on Modrinth"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setSelectedHit(null)}
                  className="p-2 rounded-xl bg-muted hover:bg-muted-hover text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {loadingDetails ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                  <RefreshCw className="w-6 h-6 animate-spin mb-3 text-theme-400" />
                  Loading project details...
                </div>
              ) : (
                <>
                  {/* Gallery Screenshots if available */}
                  {projectDetails?.gallery && projectDetails.gallery.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-theme-400" /> Preview Gallery
                      </h4>
                      <div className="grid grid-cols-2 gap-2 overflow-hidden rounded-2xl">
                        {projectDetails.gallery.slice(0, 4).map((img: any, idx: number) => (
                          <div key={idx} className="h-32 rounded-xl overflow-hidden bg-black/40 border border-border-subtle">
                            <img src={img.url} alt={img.title || "Screenshot"} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary / Body */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">About</h4>
                    <p className="text-xs text-foreground-muted leading-relaxed whitespace-pre-line bg-muted/30 p-4 rounded-2xl border border-border-subtle">
                      {projectDetails?.body || selectedHit.tag}
                    </p>
                  </div>

                  {/* Version List Selector */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center justify-between">
                      <span>Available Releases ({projectVersions.length})</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Select specific version</span>
                    </h4>

                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                      {projectVersions.slice(0, 10).map((v: any) => (
                        <div
                          key={v.id}
                          className="p-3 rounded-2xl bg-muted/40 border border-border-subtle flex items-center justify-between gap-3 hover:border-theme-500/40 transition-all"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-foreground truncate">{v.name || v.version_number}</span>
                              <span
                                className={`px-1.5 py-0.2 text-[9px] rounded font-bold uppercase ${
                                  v.version_type === "release"
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : v.version_type === "beta"
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-rose-500/20 text-rose-400"
                                }`}
                              >
                                {v.version_type}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground font-mono">
                              <span>MC: {v.game_versions?.join(", ")}</span>
                              <span>•</span>
                              <span>{v.loaders?.join(", ")}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              handleInstall(selectedHit, v.id);
                              setSelectedHit(null);
                            }}
                            disabled={isInstalling !== null}
                            className="px-3 py-1.5 bg-theme-600 hover:bg-theme-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all shrink-0 shadow-md shadow-theme-600/10"
                          >
                            <Download className="w-3 h-3" /> Install
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isInstalling !== null && <LoadingOverlay message="Downloading and installing package to server..." />}
    </div>
  );
}
