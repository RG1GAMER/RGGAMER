import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Globe,
  Upload,
  Download,
  Flame,
  Sparkles,
  Zap,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  FileArchive,
  HardDrive,
  Check,
  X,
  Plus,
  SlidersHorizontal,
  Trash2,
  PlayCircle,
  Compass
} from "lucide-react";
import { LoadingOverlay } from "../components/LoadingOverlay";

interface WorldItem {
  id: string;
  name: string;
  dimension: "overworld" | "nether" | "end" | "custom";
  isDefault: boolean;
  size: string;
  rawSize: number;
  regionFiles: number;
  worldVersion: string;
  exists: boolean;
}

export default function WorldManager({
  serverId,
  server,
  onNavigateToFileManager,
}: {
  serverId: string;
  server: any;
  onNavigateToFileManager?: () => void;
}) {
  const [worlds, setWorlds] = useState<WorldItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Modals state
  const [uploadModalWorld, setUploadModalWorld] = useState<string | null>(null);
  const [optimizeModalWorld, setOptimizeModalWorld] = useState<string | null>(null);
  const [generateModalWorld, setGenerateModalWorld] = useState<string | null>(null);
  const [isNewWorldModal, setIsNewWorldModal] = useState(false);
  const [deleteConfirmWorld, setDeleteConfirmWorld] = useState<string | null>(null);

  // Upload modal inputs
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Generate / New World modal inputs
  const [newWorldName, setNewWorldName] = useState("");
  const [genSeed, setGenSeed] = useState("");
  const [genWorldType, setGenWorldType] = useState("default");
  const [genHardcore, setGenHardcore] = useState(false);
  const [genStructures, setGenStructures] = useState(true);
  const [setAsActiveWorld, setSetAsActiveWorld] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Optimize modal state
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<any>(null);

  // Help Accordions
  const [expandedDocs, setExpandedDocs] = useState<{ [key: string]: boolean }>({
    dimensions: true,
    upload: false,
    optimize: false,
  });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchWorlds = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(`/api/servers/${serverId}/world/list`);
      if (Array.isArray(res.data)) {
        setWorlds(res.data);
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to load worlds", "error");
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchWorlds();
  }, [fetchWorlds]);

  const isServerRunning =
    server?.status === "online" ||
    server?.status === "running" ||
    server?.status === "starting";

  // 1. UPLOAD HANDLER
  const handleUploadWorld = async () => {
    if (!uploadFile || !uploadModalWorld) return;

    try {
      setIsProcessingUpload(true);
      setUploadProgress(0);

      // Stop server if running
      if (isServerRunning) {
        try {
          await axios.post(`/api/servers/${serverId}/stop`);
          await new Promise((r) => setTimeout(r, 1200));
        } catch {}
      }

      // Upload file directly to server root
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("path", "/");

      await axios.post(`/api/servers/${serverId}/files/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (p) => {
          if (p.total) {
            setUploadProgress(Math.round((p.loaded * 100) / p.total));
          }
        },
      });

      setUploadProgress(null);

      // Automatic extraction & placement into target world folder
      const importRes = await axios.post(`/api/servers/${serverId}/world/import`, {
        zipPath: uploadFile.name,
        targetFolderName: uploadModalWorld,
        autoUpdateProperties: uploadModalWorld === "world",
      });

      showToast(importRes.data.message || `World uploaded and extracted to /${uploadModalWorld} successfully!`);
      setUploadModalWorld(null);
      setUploadFile(null);
      await fetchWorlds();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to upload world", "error");
    } finally {
      setIsProcessingUpload(false);
      setUploadProgress(null);
    }
  };

  // 2. DOWNLOAD HANDLER
  const handleDownloadWorld = (worldName: string) => {
    window.location.href = `/api/servers/${serverId}/world/download?world=${encodeURIComponent(worldName)}`;
    showToast(`Downloading '${worldName}.zip'...`);
  };

  // 3. OPTIMIZE HANDLER
  const handleOptimizeWorld = async (worldName: string) => {
    try {
      setIsOptimizing(true);
      setOptimizeResult(null);

      const res = await axios.post(`/api/servers/${serverId}/world/optimize`, {
        worldName,
      });

      setOptimizeResult(res.data);
      showToast(`Optimization complete! Freed ${res.data.freedSpace}`);
      await fetchWorlds();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to optimize world", "error");
    } finally {
      setIsOptimizing(false);
    }
  };

  // 4. GENERATE / RESET HANDLER
  const handleGenerateWorld = async () => {
    const targetName = isNewWorldModal ? newWorldName.trim() : (generateModalWorld || "world");
    if (!targetName) {
      showToast("Please enter a valid world name", "error");
      return;
    }

    try {
      setIsGenerating(true);

      if (isServerRunning) {
        try {
          await axios.post(`/api/servers/${serverId}/stop`);
          await new Promise((r) => setTimeout(r, 1200));
        } catch {}
      }

      const res = await axios.post(`/api/servers/${serverId}/world/generate`, {
        worldName: targetName,
        seed: genSeed,
        worldType: genWorldType,
        hardcore: genHardcore,
        generateStructures: genStructures,
        setAsActive: isNewWorldModal ? setAsActiveWorld : true
      });

      showToast(res.data.message || `World '${targetName}' configured successfully!`);
      setGenerateModalWorld(null);
      setIsNewWorldModal(false);
      setNewWorldName("");
      await fetchWorlds();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to generate world", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // 5. SET AS ACTIVE WORLD
  const handleSetActiveWorld = async (worldName: string) => {
    try {
      const res = await axios.post(`/api/servers/${serverId}/world/set-active`, { worldName });
      showToast(res.data.message || `Active world set to '${worldName}'!`);
      await fetchWorlds();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to set active world", "error");
    }
  };

  // 6. DELETE WORLD
  const handleDeleteWorld = async (worldName: string) => {
    try {
      const res = await axios.delete(`/api/servers/${serverId}/world`, { data: { worldName } });
      showToast(res.data.message || `World '${worldName}' deleted!`);
      setDeleteConfirmWorld(null);
      await fetchWorlds();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to delete world", "error");
    }
  };

  // Explicit Aternos-style dimension information
  const getDimensionMeta = (world: WorldItem) => {
    if (world.dimension === "overworld" || world.name === "world") {
      return {
        label: "World (Overworld)",
        dimensionName: "Overworld",
        description: "The primary surface world with regular terrain, biomes, and daylight cycle.",
        icon: <Globe className="w-6 h-6 text-emerald-400" />,
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        accentBorder: "border-emerald-500/20 hover:border-emerald-500/40",
      };
    }
    if (world.dimension === "nether" || world.name.includes("nether")) {
      return {
        label: "World Nether",
        dimensionName: "Nether",
        description: "The fiery underworld dimension containing nether fortresses and bastions.",
        icon: <Flame className="w-6 h-6 text-rose-500" />,
        badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30",
        accentBorder: "border-rose-500/20 hover:border-rose-500/40",
      };
    }
    if (world.dimension === "end" || world.name.includes("the_end") || world.name.includes("end")) {
      return {
        label: "World End",
        dimensionName: "The End",
        description: "The dark void dimension home to the Ender Dragon, End Cities, and Elytras.",
        icon: <Sparkles className="w-6 h-6 text-purple-400" />,
        badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30",
        accentBorder: "border-purple-500/20 hover:border-purple-500/40",
      };
    }
    return {
      label: world.name,
      dimensionName: "Custom World",
      description: "Additional world or map directory loaded on the server.",
      icon: <Compass className="w-6 h-6 text-cyan-400" />,
      badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
      accentBorder: "border-cyan-500/20 hover:border-cyan-500/40",
    };
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 text-foreground bg-transparent">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* ATERNOS-STYLE SIMPLE HEADER */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pb-2 border-b border-border-subtle">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
              <Globe className="w-7 h-7 text-theme-500" />
              Worlds
            </h2>
            <p className="text-xs font-mono text-zinc-400 mt-1">
              Manage your Minecraft server dimensions: Overworld, Nether, and The End.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsNewWorldModal(true);
                setNewWorldName("");
                setGenSeed("");
              }}
              className="px-4 py-2 bg-theme-600 hover:bg-theme-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-theme-600/20"
            >
              <Plus className="w-4 h-4" />
              Generate World
            </button>

            <button
              onClick={fetchWorlds}
              disabled={isLoading}
              className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white rounded-xl text-xs transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
              title="Refresh world status"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* TOAST ALERT */}
        {toast && (
          <div className={`p-4 rounded-2xl border text-sm flex items-center justify-between shadow-lg animate-in fade-in duration-200 ${
            toast.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" 
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}>
            <div className="flex items-center gap-2.5">
              {toast.type === "success" ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              <span>{toast.message}</span>
            </div>
            <button onClick={() => setToast(null)} className="text-xs font-mono opacity-70 hover:opacity-100 ml-3 px-2 py-1 bg-white/5 hover:bg-white/10 rounded cursor-pointer">Dismiss</button>
          </div>
        )}

        {/* DIRECT ATERNOS WORLD LIST */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-black/40 backdrop-blur-xl border border-border p-12 rounded-3xl text-center text-zinc-400 flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin mb-4 text-theme-500" />
              <p className="font-mono text-sm">Scanning server world files...</p>
            </div>
          ) : worlds.length === 0 ? (
            <div className="bg-black/40 backdrop-blur-xl border border-border p-12 rounded-3xl text-center text-zinc-400 flex flex-col items-center justify-center">
              <AlertCircle className="w-10 h-10 mb-3 text-zinc-500" />
              <h4 className="text-base font-bold text-zinc-200">No world folder found</h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                A world will be generated automatically when your server starts, or you can create one now.
              </p>
            </div>
          ) : (
            worlds.map((world) => {
              const meta = getDimensionMeta(world);
              return (
                <div
                  key={world.id}
                  className={`bg-black/40 dark:bg-black/40 backdrop-blur-xl border rounded-3xl p-5 md:p-6 shadow-xl transition-all ${meta.accentBorder}`}
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                    
                    {/* LEFT: EXPLICIT ATERNOS LABELS & WORLD INFO */}
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-zinc-900/90 border border-border flex items-center justify-center shrink-0 shadow-inner">
                        {meta.icon}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          {/* Explicit Aternos Label */}
                          <h3 className="text-lg md:text-xl font-black text-white tracking-tight">
                            {meta.label}
                          </h3>

                          {/* Explicit Dimension Badge */}
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${meta.badgeClass}`}>
                            {meta.dimensionName}
                          </span>

                          {/* Active Status Badge */}
                          {world.isDefault && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-theme-500/20 text-theme-400 border border-theme-500/40">
                              Active World
                            </span>
                          )}
                        </div>

                        {/* Description & Technical Metadata */}
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-1">
                          {meta.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-mono text-zinc-400">
                          <span className="text-zinc-500">Folder: <code className="text-zinc-300">/{world.name}</code></span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <HardDrive className="w-3.5 h-3.5 text-zinc-500" /> {world.size}
                          </span>
                          <span>•</span>
                          <span>{world.regionFiles} region files</span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: DIRECT ATERNOS ACTION BUTTONS */}
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-border-subtle">
                      {/* UPLOAD BUTTON */}
                      <button
                        onClick={() => {
                          setUploadModalWorld(world.name);
                          setUploadFile(null);
                        }}
                        className="px-4 py-2.5 bg-theme-600 hover:bg-theme-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-theme-600/20"
                        title="Upload world archive (.zip)"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload
                      </button>

                      {/* DOWNLOAD BUTTON */}
                      <button
                        onClick={() => handleDownloadWorld(world.name)}
                        disabled={!world.exists}
                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-200 hover:text-white border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                        title="Download complete world as .zip"
                      >
                        <Download className="w-3.5 h-3.5 text-zinc-400" />
                        Download
                      </button>

                      {/* GENERATE / RESET BUTTON */}
                      <button
                        onClick={() => {
                          setGenerateModalWorld(world.name);
                          setIsNewWorldModal(false);
                          setGenSeed("");
                        }}
                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Reset & Generate with new seed or settings"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
                        Generate
                      </button>

                      {/* OPTIMIZE BUTTON */}
                      <button
                        onClick={() => {
                          setOptimizeModalWorld(world.name);
                          setOptimizeResult(null);
                        }}
                        disabled={!world.exists}
                        className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                        title="Clean unused chunks & save disk space"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        Optimize
                      </button>

                      {/* EXTRA ACTIONS FOR CUSTOM WORLDS */}
                      {!world.isDefault && world.name !== "world" && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleSetActiveWorld(world.name)}
                            className="p-2.5 bg-white/5 hover:bg-theme-500/20 text-zinc-400 hover:text-theme-300 border border-white/10 rounded-xl text-xs transition-all flex items-center justify-center cursor-pointer"
                            title="Set as primary level-name in server.properties"
                          >
                            <PlayCircle className="w-3.5 h-3.5 text-theme-400" />
                          </button>
                          
                          <button
                            onClick={() => setDeleteConfirmWorld(world.name)}
                            className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs transition-all flex items-center justify-center cursor-pointer"
                            title="Delete custom world"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ATERNOS-STYLE CLEAN KNOWLEDGE BASE ACCORDION */}
        <div className="space-y-3 pt-4">
          <h3 className="text-xs font-bold font-mono tracking-wider text-zinc-400 uppercase flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-theme-500" /> Guides & Dimension Details
          </h3>

          {/* GUIDE 1: MINECRAFT DIMENSIONS EXPLAINED */}
          <div className="bg-black/40 backdrop-blur-xl border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpandedDocs(prev => ({ ...prev, dimensions: !prev.dimensions }))}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-white">How dimensions work in Minecraft</span>
              </div>
              {expandedDocs.dimensions ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>
            {expandedDocs.dimensions && (
              <div className="p-4 pt-0 text-xs text-zinc-400 space-y-3 border-t border-border-subtle leading-relaxed">
                <p>
                  Minecraft servers manage three distinct dimensions for every gameplay world:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-1">
                    <p className="font-bold text-emerald-300">1. World (Overworld)</p>
                    <p className="text-[11px] text-zinc-400">Stores surface terrain, oceans, villages, mineshafts, player homes, and spawn points.</p>
                  </div>
                  <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-1">
                    <p className="font-bold text-rose-300">2. World Nether</p>
                    <p className="text-[11px] text-zinc-400">Stores nether portals, lava lakes, fortresses, bastions, and piglin structures.</p>
                  </div>
                  <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-1">
                    <p className="font-bold text-purple-300">3. World End</p>
                    <p className="text-[11px] text-zinc-400">Stores the central dragon island, outer End islands, chorus plants, and End Cities.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* GUIDE 2: UPLOAD A WORLD */}
          <div className="bg-black/40 backdrop-blur-xl border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpandedDocs(prev => ({ ...prev, upload: !prev.upload }))}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Upload className="w-4 h-4 text-theme-400" />
                <span className="text-sm font-bold text-white">How to upload custom world maps</span>
              </div>
              {expandedDocs.upload ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>
            {expandedDocs.upload && (
              <div className="p-4 pt-0 text-xs text-zinc-400 space-y-2 border-t border-border-subtle leading-relaxed">
                <p>
                  Compress your world folder into a <code className="text-theme-400">.zip</code> file containing <code className="text-zinc-300">level.dat</code> and the <code className="text-zinc-300">region/</code> directory. Click <strong>Upload</strong> on the target dimension card; the panel will automatically extract and configure everything.
                </p>
              </div>
            )}
          </div>

          {/* GUIDE 3: OPTIMIZE OPTION */}
          <div className="bg-black/40 backdrop-blur-xl border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpandedDocs(prev => ({ ...prev, optimize: !prev.optimize }))}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-white">Optimize option (Disk Space Saver)</span>
              </div>
              {expandedDocs.optimize ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>
            {expandedDocs.optimize && (
              <div className="p-4 pt-0 text-xs text-zinc-400 space-y-2 border-t border-border-subtle leading-relaxed">
                <p>
                  As players explore, Minecraft generates chunk files that take up hundreds of megabytes. The <strong>Optimize</strong> button removes empty chunk headers and unneeded cache data while keeping all player builds and inventories completely safe.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 1. UPLOAD WORLD MODAL */}
      {/* ========================================================================= */}
      {uploadModalWorld && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-border rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Upload className="w-5 h-5 text-theme-500" />
                <h3 className="text-lg font-black text-white">Upload to '{uploadModalWorld}'</h3>
              </div>
              <button
                onClick={() => setUploadModalWorld(null)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Select a world archive (<code className="text-zinc-300">.zip, .tar, .gz</code>). The panel will automatically unpack the files into <code className="text-theme-400">/{uploadModalWorld}</code> and delete the temporary archive.
            </p>

            <div className="border-2 border-dashed border-zinc-700 hover:border-theme-500 rounded-2xl p-6 text-center transition-colors">
              <input
                type="file"
                id="world-file-input"
                accept=".zip,.tar,.gz,.tgz,.rar"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label htmlFor="world-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                <FileArchive className="w-10 h-10 text-theme-400" />
                <span className="text-sm font-bold text-white">
                  {uploadFile ? uploadFile.name : "Click or drag & drop world .zip archive"}
                </span>
                <span className="text-[11px] font-mono text-zinc-500">
                  {uploadFile ? `${(uploadFile.size / (1024 * 1024)).toFixed(2)} MB` : "Supports .zip containing region and level.dat"}
                </span>
              </label>
            </div>

            {uploadProgress !== null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-zinc-400">
                  <span>Uploading world...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-theme-500 transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUploadModalWorld(null)}
                disabled={isProcessingUpload}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadWorld}
                disabled={!uploadFile || isProcessingUpload}
                className="px-6 py-2.5 bg-theme-600 hover:bg-theme-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-theme-600/20 cursor-pointer disabled:opacity-50"
              >
                {isProcessingUpload ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Extracting...</>
                ) : (
                  <><Upload className="w-3.5 h-3.5" /> Upload & Extract</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. OPTIMIZE WORLD MODAL */}
      {/* ========================================================================= */}
      {optimizeModalWorld && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-border rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-black text-white">Optimize '{optimizeModalWorld}'</h3>
              </div>
              <button
                onClick={() => setOptimizeModalWorld(null)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Clean up stale chunk caches and empty region files to reclaim server disk space. Placed blocks, player homes, and chests remain untouched.
            </p>

            {optimizeResult && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold">
                  <Check className="w-4 h-4 text-amber-400" />
                  <span>{optimizeResult.message}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                  <div className="bg-black/30 p-2 rounded-lg text-center">
                    <div className="text-zinc-500">Before</div>
                    <div className="font-bold text-zinc-200">{optimizeResult.sizeBefore}</div>
                  </div>
                  <div className="bg-black/30 p-2 rounded-lg text-center">
                    <div className="text-zinc-500">After</div>
                    <div className="font-bold text-zinc-200">{optimizeResult.sizeAfter}</div>
                  </div>
                  <div className="bg-black/30 p-2 rounded-lg text-center">
                    <div className="text-zinc-500">Freed</div>
                    <div className="font-bold text-emerald-400">{optimizeResult.freedSpace}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOptimizeModalWorld(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {optimizeResult ? "Close" : "Cancel"}
              </button>
              {!optimizeResult && (
                <button
                  type="button"
                  onClick={() => handleOptimizeWorld(optimizeModalWorld)}
                  disabled={isOptimizing}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isOptimizing ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Optimizing...</>
                  ) : (
                    <><Zap className="w-3.5 h-3.5" /> Start Optimization</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. GENERATE / RESET WORLD MODAL */}
      {/* ========================================================================= */}
      {(generateModalWorld || isNewWorldModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-border rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-5 h-5 text-theme-500" />
                <h3 className="text-lg font-black text-white">
                  {isNewWorldModal ? "Generate New World" : `Generate / Reset '${generateModalWorld}'`}
                </h3>
              </div>
              <button
                onClick={() => {
                  setGenerateModalWorld(null);
                  setIsNewWorldModal(false);
                }}
                className="p-1 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Configure generation settings for this world. When the server boots up, Minecraft will create a brand new world matching these parameters.
            </p>

            <div className="space-y-3.5 text-xs">
              {isNewWorldModal && (
                <div>
                  <label className="block text-zinc-300 font-bold mb-1.5">World Folder Name</label>
                  <input
                    type="text"
                    placeholder="e.g. survival, lobby, skyblock"
                    value={newWorldName}
                    onChange={(e) => setNewWorldName(e.target.value)}
                    className="w-full bg-black/40 border border-zinc-700 rounded-xl p-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-theme-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-zinc-300 font-bold mb-1.5">World Seed (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave empty for a random seed"
                  value={genSeed}
                  onChange={(e) => setGenSeed(e.target.value)}
                  className="w-full bg-black/40 border border-zinc-700 rounded-xl p-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-theme-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-bold mb-1.5">World Type</label>
                <select
                  value={genWorldType}
                  onChange={(e) => setGenWorldType(e.target.value)}
                  className="w-full bg-black/40 border border-zinc-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-theme-500 cursor-pointer"
                >
                  <option value="default">Default</option>
                  <option value="flat">Superflat</option>
                  <option value="largeBiomes">Large Biomes</option>
                  <option value="amplified">Amplified</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-black/30 border border-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={genHardcore}
                    onChange={(e) => setGenHardcore(e.target.checked)}
                    className="rounded accent-theme-500"
                  />
                  <span className="text-zinc-200 font-medium">Hardcore Mode</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-black/30 border border-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={genStructures}
                    onChange={(e) => setGenStructures(e.target.checked)}
                    className="rounded accent-theme-500"
                  />
                  <span className="text-zinc-200 font-medium">Generate Structures</span>
                </label>
              </div>

              {isNewWorldModal && (
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-black/30 border border-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setAsActiveWorld}
                    onChange={(e) => setSetAsActiveWorld(e.target.checked)}
                    className="rounded accent-theme-500"
                  />
                  <span className="text-zinc-200 font-medium">Set as primary active world (server.properties)</span>
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setGenerateModalWorld(null);
                  setIsNewWorldModal(false);
                }}
                disabled={isGenerating}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateWorld}
                disabled={isGenerating || (isNewWorldModal && !newWorldName.trim())}
                className="px-6 py-2.5 bg-theme-600 hover:bg-theme-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-theme-600/20 cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Applying...</>
                ) : (
                  <><SlidersHorizontal className="w-3.5 h-3.5" /> {isNewWorldModal ? "Create World" : "Generate World"}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteConfirmWorld && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-rose-500/30 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-black text-white">Delete '{deleteConfirmWorld}'?</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Are you sure you want to permanently remove the world folder <code className="text-rose-400">/{deleteConfirmWorld}</code>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmWorld(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteWorld(deleteConfirmWorld)}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/20"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {isProcessingUpload && <LoadingOverlay message="Extracting world files and placing into server..." />}
    </div>
  );
}
