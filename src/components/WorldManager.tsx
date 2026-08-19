import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Globe,
  Upload,
  Download,
  Flame,
  Sparkles,
  Zap,
  FolderTree,
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
  PlayCircle
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

  // Documentation Accordion expanded states
  const [expandedDocs, setExpandedDocs] = useState<{ [key: string]: boolean }>({
    upload: true,
    optimize: false,
    download: false
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

      // Trigger automatic extraction & placement into target world folder
      const importRes = await axios.post(`/api/servers/${serverId}/world/import`, {
        zipPath: uploadFile.name,
        targetFolderName: uploadModalWorld,
        autoUpdateProperties: uploadModalWorld === "world",
      });

      showToast(importRes.data.message || `World uploaded and placed into /${uploadModalWorld} successfully!`);
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

      // Stop server if running
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

  const getDimensionIcon = (dim: string) => {
    switch (dim) {
      case "nether":
        return <Flame className="w-6 h-6 text-rose-500" />;
      case "end":
        return <Sparkles className="w-6 h-6 text-purple-400" />;
      case "custom":
        return <Globe className="w-6 h-6 text-cyan-400" />;
      default:
        return <Globe className="w-6 h-6 text-emerald-400" />;
    }
  };

  const getDimensionBadge = (dim: string, worldName: string) => {
    switch (dim) {
      case "nether":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">Nether</span>;
      case "end":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">The End</span>;
      case "custom":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">Custom World</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Overworld</span>;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 text-foreground bg-transparent">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
              <Globe className="w-8 h-8 text-theme-500" />
              Worlds
            </h2>
            <p className="text-xs font-mono text-zinc-400 mt-1">
              Manage Overworld, Nether, The End, and custom worlds (e.g. survival, lobby) for your server.
            </p>
          </div>
          
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setIsNewWorldModal(true);
                setNewWorldName("");
                setGenSeed("");
              }}
              className="px-4 py-2 bg-theme-600 hover:bg-theme-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-theme-600/20"
            >
              <Plus className="w-4 h-4" />
              Create New World
            </button>

            <button
              onClick={fetchWorlds}
              disabled={isLoading}
              className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white rounded-xl text-xs font-mono transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
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
            <button onClick={() => setToast(null)} className="text-xs font-mono opacity-70 hover:opacity-100 ml-3 px-2 py-1 bg-white/5 hover:bg-white/10 rounded">Dismiss</button>
          </div>
        )}

        {/* WORLDS LIST (ATERNOS STYLE CARDS) */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-black/40 backdrop-blur-xl border border-border p-12 rounded-3xl text-center text-zinc-400 flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin mb-4 text-theme-500" />
              <p className="font-mono text-sm">Scanning world files...</p>
            </div>
          ) : worlds.length === 0 ? (
            <div className="bg-black/40 backdrop-blur-xl border border-border p-12 rounded-3xl text-center text-zinc-400 flex flex-col items-center justify-center">
              <AlertCircle className="w-10 h-10 mb-3 text-zinc-500" />
              <h4 className="text-base font-bold text-zinc-200">No world folder found</h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                A world will be generated automatically when you start your server, or you can create one now.
              </p>
            </div>
          ) : (
            worlds.map((world) => (
              <div
                key={world.id}
                className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border rounded-3xl p-5 md:p-6 shadow-xl ring-1 ring-border-subtle hover:border-theme-500/30 transition-all space-y-4"
              >
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  {/* WORLD INFO */}
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-border flex items-center justify-center shrink-0 shadow-inner">
                      {getDimensionIcon(world.dimension)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-xl font-black text-white tracking-tight">{world.name}</h3>
                        {getDimensionBadge(world.dimension, world.name)}
                        {world.isDefault ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-theme-500/20 text-theme-400 border border-theme-500/40">
                            Active Server World
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSetActiveWorld(world.name)}
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/5 hover:bg-theme-500/20 text-zinc-400 hover:text-theme-300 border border-white/10 hover:border-theme-500/30 transition-all flex items-center gap-1 cursor-pointer"
                            title="Set this world as the primary server world"
                          >
                            <PlayCircle className="w-3 h-3 text-theme-400" /> Set as Active
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs font-mono text-zinc-400">
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3.5 h-3.5 text-zinc-500" /> {world.size}
                        </span>
                        <span>•</span>
                        <span>{world.regionFiles} region files</span>
                        <span>•</span>
                        <span className="text-zinc-300">{world.worldVersion}</span>
                      </div>
                    </div>
                  </div>

                  {/* ATERNOS ACTION BUTTONS (HORIZONTAL GRID / PILLS) */}
                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    {/* OPTIMIZE BUTTON */}
                    <button
                      onClick={() => {
                        setOptimizeModalWorld(world.name);
                        setOptimizeResult(null);
                      }}
                      disabled={!world.exists}
                      className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40"
                      title="Optimize world & remove unused chunks"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Optimize
                    </button>

                    {/* UPLOAD BUTTON */}
                    <button
                      onClick={() => {
                        setUploadModalWorld(world.name);
                        setUploadFile(null);
                      }}
                      className="px-4 py-2.5 bg-theme-600 hover:bg-theme-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-theme-600/20"
                      title="Upload world .zip or folder"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload
                    </button>

                    {/* DOWNLOAD BUTTON */}
                    <button
                      onClick={() => handleDownloadWorld(world.name)}
                      disabled={!world.exists}
                      className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-200 hover:text-white border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                      title="Download world as .zip"
                    >
                      <Download className="w-3.5 h-3.5 text-zinc-400" />
                      Download
                    </button>

                    {/* FILES BUTTON */}
                    {onNavigateToFileManager && (
                      <button
                        onClick={onNavigateToFileManager}
                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Browse world folder in File Manager"
                      >
                        <FolderTree className="w-3.5 h-3.5 text-zinc-400" />
                        Files
                      </button>
                    )}

                    {/* GENERATE BUTTON */}
                    <button
                      onClick={() => {
                        setGenerateModalWorld(world.name);
                        setIsNewWorldModal(false);
                        setGenSeed("");
                      }}
                      className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Generate new world with custom seed"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
                      Generate
                    </button>

                    {/* DELETE BUTTON (For non-default worlds) */}
                    {!world.isDefault && world.name !== "world" && (
                      <button
                        onClick={() => setDeleteConfirmWorld(world.name)}
                        className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer"
                        title="Delete world"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ATERNOS-STYLE KNOWLEDGE BASE & HELP ARTICLES ACCORDION */}
        <div className="space-y-3 pt-4">
          <h3 className="text-sm font-bold font-mono tracking-wider text-zinc-400 uppercase flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-theme-500" /> Help & Guides
          </h3>

          {/* ARTICLE 1: UPLOAD A WORLD */}
          <div className="bg-black/40 backdrop-blur-xl border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpandedDocs(prev => ({ ...prev, upload: !prev.upload }))}
              className="w-full p-4.5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Upload className="w-4 h-4 text-theme-400" />
                <span className="text-sm font-bold text-white">Upload a world</span>
              </div>
              {expandedDocs.upload ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>
            {expandedDocs.upload && (
              <div className="p-4.5 pt-0 text-xs text-zinc-400 space-y-3 border-t border-border-subtle leading-relaxed">
                <p>
                  You can easily upload any Minecraft world map directly to your server, whether it's a pre-made adventure map or your custom-built world, so you can explore it with friends in just a few simple steps!
                </p>
                <div className="bg-zinc-900/60 p-3.5 rounded-xl border border-border space-y-2">
                  <p className="font-bold text-zinc-200">Prepare your world:</p>
                  <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                    <li><strong className="text-zinc-300">As a .zip file:</strong> Compress the entire world folder into a <code className="text-theme-400">.zip</code> archive. Ensure it contains standard folders like <code className="text-zinc-300">region</code>, <code className="text-zinc-300">data</code>, <code className="text-zinc-300">datapacks</code> and <code className="text-zinc-300">level.dat</code>.</li>
                    <li><strong className="text-zinc-300">Auto-Extraction:</strong> The panel will automatically unpack the contents directly into the server's root world folder and remove the uploaded zip file cleanly.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* ARTICLE 2: OPTIMIZE OPTION */}
          <div className="bg-black/40 backdrop-blur-xl border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpandedDocs(prev => ({ ...prev, optimize: !prev.optimize }))}
              className="w-full p-4.5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-white">World option: Optimize</span>
              </div>
              {expandedDocs.optimize ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>
            {expandedDocs.optimize && (
              <div className="p-4.5 pt-0 text-xs text-zinc-400 space-y-3 border-t border-border-subtle leading-relaxed">
                <p>
                  A large portion of server storage is often occupied by world files. Minecraft generates thousands of chunks around players and saves them even if players never returned. To make sure your server stays fast and within limits, the <strong className="text-zinc-200">Optimize</strong> option cleans unused chunks and empty region files.
                </p>
                <div className="bg-zinc-900/60 p-3.5 rounded-xl border border-border space-y-1">
                  <p className="font-bold text-zinc-200">When should I use it?</p>
                  <p>World optimization is 100% compatible with all Minecraft worlds (Vanilla, Paper, Spigot, Fabric, Forge). Custom structures, blocks, and inventories remain completely untouched.</p>
                </div>
              </div>
            )}
          </div>

          {/* ARTICLE 3: DOWNLOAD YOUR WORLD */}
          <div className="bg-black/40 backdrop-blur-xl border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpandedDocs(prev => ({ ...prev, download: !prev.download }))}
              className="w-full p-4.5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Download className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-white">Download your world</span>
              </div>
              {expandedDocs.download ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>
            {expandedDocs.download && (
              <div className="p-4.5 pt-0 text-xs text-zinc-400 space-y-3 border-t border-border-subtle leading-relaxed">
                <p>
                  Click the <strong className="text-zinc-200">Download</strong> button on any world card to instantly stream a complete <code className="text-theme-400">.zip</code> archive of your world. You can extract this folder directly into your local <code className="text-zinc-300">.minecraft/saves</code> directory to play in singleplayer mode!
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
              Select a world archive (<code className="text-zinc-300">.zip, .tar, .gz</code>). The system will automatically detect the world structure, extract it directly to <code className="text-theme-400">/{uploadModalWorld}</code>, and clean the zip archive.
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
                  {uploadFile ? `${(uploadFile.size / (1024 * 1024)).toFixed(2)} MB` : "Supports .zip, .tar, .gz containing region & level.dat"}
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
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Uploading & Placing...</>
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
              Minecraft creates thousands of empty or unused chunk region files that consume storage. Optimizing the world cleans stale chunk data and empty MCA headers without altering your placed blocks, player inventories or builds.
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
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Optimizing Chunks...</>
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
      {/* 3. GENERATE / CREATE WORLD MODAL */}
      {/* ========================================================================= */}
      {(generateModalWorld || isNewWorldModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-border rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-5 h-5 text-theme-500" />
                <h3 className="text-lg font-black text-white">
                  {isNewWorldModal ? "Create New World" : `Generate / Reset '${generateModalWorld}'`}
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
              {isNewWorldModal 
                ? "Create a new Minecraft world (e.g. survival, creative, skyblock). The world will generate fresh when the server starts."
                : `Generating a new world will reset existing files for '/${generateModalWorld}' and prepare a fresh generation upon server start.`}
            </p>

            <div className="space-y-3.5 text-xs">
              {isNewWorldModal && (
                <div>
                  <label className="block text-zinc-300 font-bold mb-1.5">World Folder Name</label>
                  <input
                    type="text"
                    placeholder="e.g. survival, lobby, minigames"
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
                  placeholder="e.g. 19284729384 or leave blank for random"
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
                  <option value="flat">Flat</option>
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
                  <span className="text-zinc-200 font-medium">Structures</span>
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
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Configuring World...</>
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
              Are you sure you want to permanently delete the world folder <code className="text-rose-400">/{deleteConfirmWorld}</code>? This action cannot be undone.
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

      {isProcessingUpload && <LoadingOverlay message="Extracting world files and configuring server..." />}
    </div>
  );
}
