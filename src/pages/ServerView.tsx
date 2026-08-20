// @ts-nocheck
import React, { useEffect, useState, useMemo } from "react"; 
import { LoadingOverlay } from "../components/LoadingOverlay";
import { useParams, Link, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  Terminal, Folder, Play, Square, RefreshCw, ArrowLeft, Sliders, 
  Archive, AlertTriangle, AlertOctagon, Copy, Check, Menu, X, 
  Users, LogOut, Lock, Activity, HeartPulse, Zap, Clock, ShieldCheck,
  Map, Palette, Puzzle, Box, Network, Settings, Globe, ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import ServerConsole from "../components/ServerConsole";
import FileManager from "../components/FileManager";
import ServerSettings from "../components/ServerSettings";
import ServerProperties from "../components/ServerProperties";
import ServerBackups from "../components/ServerBackups";
import PluginManager from "../components/PluginManager";
import ModManager from "../components/ModManager";
import PlayerManager from "../components/PlayerManager";
import SubUsersManager from "../components/SubUsersManager";
import ServerSFTP from "../components/ServerSFTP";
import PlayitTunnel from "./PlayitTunnel";
import WorldManager from "../components/WorldManager";
import { useSettings } from "../context/SettingsContext";

// Format total seconds into standard digital HH:MM:SS or Dd HH:MM:SS
function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0 || isNaN(totalSeconds)) return "00:00:00";
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// Format total seconds into compact human duration (e.g. 5m 12s)
function formatHumanDuration(totalSeconds: number): string {
  if (totalSeconds <= 0 || isNaN(totalSeconds)) return "0s";
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

export default function ServerView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { enablePlayit } = useSettings();
  const [server, setServer] = useState<any>(null);
  const [totalSystemRam, setTotalSystemRam] = useState<number>(0);
  const [showRamWarning, setShowRamWarning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string>("");
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uptimeSeconds, setUptimeSeconds] = useState<number>(0);

  const handleCopyIp = () => {
    if (!server) return;
    const textToCopy = server.ipAlias ? `${server.ipAlias}:${server.port}` : `${window.location.hostname}:${server.port}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchServer = async () => {
    try {
      const res = await axios.get(`/api/servers/${id}`);
      setServer(res.data);
    } catch(e) {}
  };

  useEffect(() => {
    fetchServer();
    axios.get("/api/system/stats").then(res => {
      setTotalSystemRam(res.data.totalMemory / (1024 * 1024 * 1024));
    }).catch(() => {});
    const interval = setInterval(fetchServer, 4000);
    return () => clearInterval(interval);
  }, [id]);

  // Real-time ticking 1-second interval for live uptime
  useEffect(() => {
    const updateTick = () => {
      if (server?.status === "online" && server?.startedAt) {
        const startMs = new Date(server.startedAt).getTime();
        if (!isNaN(startMs) && startMs > 0) {
          const diff = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
          setUptimeSeconds(diff);
          return;
        }
      }
      setUptimeSeconds(0);
    };

    updateTick();
    const ticker = setInterval(updateTick, 1000);
    return () => clearInterval(ticker);
  }, [server?.status, server?.startedAt]);

  // Derive Process Health status
  const processHealth: "healthy" | "starting" | "crashed" | "offline" = useMemo(() => {
    if (!server) return "offline";
    if (server.crashed || server.health === "crashed") return "crashed";
    if (server.status !== "online") return "offline";
    if (server.health === "starting" || uptimeSeconds < 15) return "starting";
    return "healthy";
  }, [server, uptimeSeconds]);

  const executeAction = async (action: string) => {
    setIsProcessing(true);
    if (action === "force-restart") {
      setActionMessage("Force-terminating process and rebuilding runtime...");
    } else if (action === "restart") {
      setActionMessage("Restarting server...");
    } else if (action === "start") {
      setActionMessage("Starting server...");
    } else if (action === "stop") {
      setActionMessage("Stopping server...");
    }

    try {
      await axios.post(`/api/servers/${id}/${action}`);
      await fetchServer();
    } catch(e) {} finally {
      setIsProcessing(false);
      setActionMessage("");
    }
  };

  const handleAction = async (action: string) => {
    if (action === 'start' && totalSystemRam > 0 && server?.ram > totalSystemRam && !showRamWarning) {
      setShowRamWarning(true);
      return;
    }
    executeAction(action);
  };

  if (!server) return (
    <div className="h-full flex items-center justify-center p-8">
      <motion.div
        animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 border-2 border-theme-600 border-t-transparent rounded-full"
      />
    </div>
  );

  if (server.suspended) return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-md w-full rounded-2xl border border-theme-500/20 bg-black/40 dark:bg-black/40 backdrop-blur-md p-8 text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-theme-500/10 flex items-center justify-center border border-theme-500/20 mb-4">
          <Lock className="w-8 h-8 text-theme-400" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Server Suspended</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          This server has been suspended by an administrator. You cannot access or manage this server until the suspension is removed.
        </p>
        <Link 
          to="/servers" 
          className="inline-flex items-center justify-center px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-foreground text-sm font-medium rounded-lg transition-colors border border-border-subtle"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );

  const serverTypeUpper = server?.type?.toUpperCase() || "";
  const isGenericApp = ["NODEJS", "NODE", "PYTHON", "PYTHON3"].includes(serverTypeUpper);
  const isProxy = ["VELOCITY", "BUNGEECORD", "WATERFALL"].includes(serverTypeUpper);

  let tabs: any[] = [];
  if (isGenericApp) {
    tabs = [
      { name: "Console", path: `/servers/${id}`, exactPath: "", icon: <Terminal size={18} /> },
      { name: "File Manager", path: `/servers/${id}/files`, exactPath: "files", icon: <Folder size={18} /> },
      { name: "SFTP Details", path: `/servers/${id}/sftp`, exactPath: "sftp", icon: <Network size={18} /> },
      { name: "Backup", path: `/servers/${id}/backup`, exactPath: "backup", icon: <Archive size={18} /> },
      { name: "Sub-Users", path: `/servers/${id}/subusers`, exactPath: "subusers", icon: <Users size={18} /> },
      { name: "Settings", path: `/servers/${id}/settings`, exactPath: "settings", icon: <Settings size={18} /> },
    ];
  } else {
    tabs = [
      { name: "Terminal", path: `/servers/${id}`, exactPath: "", icon: <Terminal size={18} /> },
      { name: "Players", path: `/servers/${id}/players`, exactPath: "players", icon: <Users size={18} /> },
      { name: "File Manager", path: `/servers/${id}/files`, exactPath: "files", icon: <Folder size={18} /> },
      { name: "SFTP Details", path: `/servers/${id}/sftp`, exactPath: "sftp", icon: <Network size={18} /> },
      { name: "Sub-Users", path: `/servers/${id}/subusers`, exactPath: "subusers", icon: <Users size={18} /> },
    ];

    if (!isProxy) {
      tabs.splice(1, 0, { name: "Properties", path: `/servers/${id}/properties`, exactPath: "properties", icon: <Sliders size={18} /> });
      tabs.splice(2, 0, { name: "World", path: `/servers/${id}/world`, exactPath: "world", icon: <Map size={18} /> });
    }

    if (["PAPER", "SPIGOT", "PURPUR", "BUNGEECORD", "VELOCITY", "WATERFALL"].includes(serverTypeUpper)) {
      tabs.push({ name: "Plugins", path: `/servers/${id}/plugins`, exactPath: "plugins", icon: <Puzzle size={18} /> });
    }

    if (["FORGE", "FABRIC", "NEOFORGE", "QUILT"].includes(serverTypeUpper)) {
      tabs.push({ name: "Mods", path: `/servers/${id}/mods`, exactPath: "mods", icon: <Box size={18} /> });
    }

    if (!isProxy) {
      tabs.push({ name: "Resource Packs", path: `/servers/${id}/resourcepacks`, exactPath: "resourcepacks", icon: <Palette size={18} /> });
    }

    tabs.push(
      { name: "Settings", path: `/servers/${id}/settings`, exactPath: "settings", icon: <Settings size={18} /> },
      { name: "Backup", path: `/servers/${id}/backup`, exactPath: "backup", icon: <Archive size={18} /> }
    );

    if (enablePlayit) {
      tabs.push(
        { name: "Playit Tunnel", path: `/servers/${id}/playit`, exactPath: "playit", icon: <Globe size={18} /> }
      );
    }
  }

  const navTabs: any[] = [
    { name: "Back to Dashboard", path: `/servers`, exactPath: "back", icon: <LogOut size={18} /> }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex h-full bg-transparent overflow-hidden"
    >
      {/* Drawer Overlay */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-black/90 md:bg-black/80 backdrop-blur-3xl border-r border-theme-500/20 flex flex-col shadow-2xl shadow-theme-900/50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 shrink-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-theme-500/20 shrink-0 bg-black/60">
          <div className="flex items-center gap-3 min-w-0">
             <Link to="/servers" className="p-1.5 bg-theme-900/40 hover:bg-theme-500/20 border border-theme-500/30 shadow-sm rounded-lg text-theme-400 hover:text-theme-100 transition-all shrink-0">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-theme-300 via-theme-200 to-theme-400 bg-clip-text text-transparent truncate pr-2">{server.name}</h1>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 text-zinc-400 hover:text-white bg-zinc-900 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1 custom-scrollbar">
          {/* Status & Quick Actions */}
          <div className="mb-4 p-3 bg-black/60 rounded-xl border border-theme-500/20 shadow-inner">
             
             {/* Process Health & Status in Sidebar */}
             <div className="space-y-2 mb-3">
               <div className="flex items-center justify-between">
                 <div className="flex items-center space-x-1.5">
                   <span className="flex h-2.5 w-2.5 relative shrink-0">
                     {server.status === 'online' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-theme-400 opacity-75"></span>}
                     <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${server.status === 'online' ? 'bg-theme-500' : 'bg-red-500'}`}></span>
                   </span>
                   <span className={`text-xs font-semibold capitalize ${server.status === 'online' ? 'text-theme-400' : 'text-zinc-400'}`}>{server.status}</span>
                 </div>
                 
                 <button onClick={handleCopyIp} className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-theme-900/40 hover:bg-theme-500/20 border border-theme-500/30 transition-colors group cursor-pointer" title="Copy Connection Info">
                   <span className="text-[10px] font-mono text-theme-300 group-hover:text-theme-200 truncate max-w-[90px]">
                     :{server.port}
                   </span>
                   {copied ? <Check size={11} className="text-theme-400 shrink-0" /> : <Copy size={11} className="text-theme-400 shrink-0" />}
                 </button>
               </div>

               {/* Process Health Pill */}
               <div className="p-2 rounded-lg bg-black/40 border border-white/5 flex flex-col gap-1 text-[11px] font-mono">
                 <div className="flex items-center justify-between text-zinc-400">
                   <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                     <Activity size={12} className="text-theme-400" /> Process Health
                   </span>
                   
                   {processHealth === 'healthy' && (
                     <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Healthy
                     </span>
                   )}
                   {processHealth === 'starting' && (
                     <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                       <RefreshCw size={10} className="animate-spin text-amber-400" /> Starting
                     </span>
                   )}
                   {processHealth === 'crashed' && (
                     <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                       <AlertOctagon size={10} className="text-rose-400" /> Crashed
                     </span>
                   )}
                   {processHealth === 'offline' && (
                     <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
                       Offline
                     </span>
                   )}
                 </div>

                 <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px] text-theme-300">
                   <span className="flex items-center gap-1 text-zinc-400 text-[10px]">
                     <Clock size={11} className="text-theme-400" /> Uptime
                   </span>
                   <span className="font-bold tabular-nums">
                     {server.status === 'online' ? formatDuration(uptimeSeconds) : "00:00:00"}
                   </span>
                 </div>
               </div>
             </div>

             {/* Power Controls Grid */}
             <div className="grid grid-cols-2 gap-2">
                {server.status !== 'online' ? (
                  <button disabled={isProcessing} onClick={() => { handleAction('start'); setSidebarOpen(false); }} className="col-span-2 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold rounded-lg transition-all border border-emerald-500/40 flex items-center justify-center text-xs shadow-md shadow-emerald-500/10 disabled:opacity-50">
                    {isProcessing ? <div className="w-3.5 h-3.5 border-2 border-emerald-400/50 border-t-emerald-400 rounded-full animate-spin mr-1.5" /> : <Play className="w-3.5 h-3.5 mr-1.5 fill-emerald-400/20" />} Start
                  </button>
                ) : (
                  <button disabled={isProcessing} onClick={() => { handleAction('stop'); setSidebarOpen(false); }} className="col-span-2 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold rounded-lg transition-all border border-red-500/40 flex items-center justify-center text-xs shadow-md shadow-red-500/10 disabled:opacity-50">
                    {isProcessing ? <div className="w-3.5 h-3.5 border-2 border-red-400/50 border-t-red-400 rounded-full animate-spin mr-1.5" /> : <Square className="w-3.5 h-3.5 mr-1.5 fill-red-400/20" />} Stop
                  </button>
                )}
                
                <button disabled={isProcessing} onClick={() => { handleAction('restart'); setSidebarOpen(false); }} className="py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium rounded-lg transition-all border border-amber-500/40 flex items-center justify-center text-xs shadow-md shadow-amber-500/10 disabled:opacity-50">
                  {isProcessing ? <div className="w-3.5 h-3.5 border-2 border-amber-400/50 border-t-amber-400 rounded-full animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />} Restart
                </button>

                {/* Sidebar Force Restart Button */}
                <button 
                  disabled={isProcessing} 
                  onClick={() => { handleAction('force-restart'); setSidebarOpen(false); }} 
                  className="py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-medium rounded-lg transition-all border border-rose-500/40 flex items-center justify-center text-xs shadow-md shadow-rose-500/10 disabled:opacity-50"
                  title="Kill stuck process, clear deadlock, and force restart"
                >
                  <Zap className="w-3.5 h-3.5 mr-1 text-rose-400 fill-rose-400/20" /> Force
                </button>
             </div>
          </div>
          
          <div className="h-px bg-gradient-to-r from-transparent via-theme-500/20 to-transparent mb-3" />
          
          <div className="text-xs font-semibold text-theme-400/70 mb-2 px-3 tracking-wider uppercase">Menu</div>
          
          {tabs.map(tab => {
             const isActive = location.pathname === tab.path || location.pathname === `${tab.path}/`;
             return (
              <Link 
                key={tab.name}
                to={tab.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2.5 text-sm font-medium transition-all rounded-lg ${isActive ? 'bg-gradient-to-r from-theme-500/20 to-theme-500/10 text-theme-200 shadow-md shadow-theme-500/10 border border-theme-500/40' : 'text-zinc-400 hover:text-theme-300 hover:bg-theme-900/30 border border-transparent'}`}
              >
                <div className={`${isActive ? 'text-theme-400' : 'text-zinc-400'} transition-colors`}>
                  {React.cloneElement(tab.icon, { className: "w-4 h-4" })}
                </div>
                <span>{tab.name}</span>
              </Link>
            );
          })}
          
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-4" />
          
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-3 tracking-wider uppercase">Navigation</div>

          {navTabs.map(tab => {
             return (
              <Link 
                key={tab.name}
                to={tab.path}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center space-x-3 px-3 py-2.5 text-sm font-medium transition-all rounded-lg text-muted-foreground hover:text-foreground-muted hover:bg-white/[0.05] border border-transparent"
              >
                <div className="text-muted-foreground transition-colors">
                  {React.cloneElement(tab.icon, { className: "w-4 h-4" })}
                </div>
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden relative isolate">
        {/* Top Header with Hamburger, Process Health Status Indicator, and Controls */}
        <div className="bg-black/85 backdrop-blur-2xl border-b border-theme-500/20 p-2.5 sm:p-3.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0 shadow-lg shadow-black/80 relative z-20">
          
          {/* Left: Hamburger + Server Name + Basic Status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 bg-theme-900/40 hover:bg-theme-500/20 border border-theme-500/30 shadow-sm rounded-xl text-theme-300 hover:text-white transition-all flex items-center justify-center relative overflow-hidden group shrink-0"
              title="Open Navigation Menu"
            >
              <div className="absolute inset-0 bg-theme-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <Menu size={18} className="relative z-10 group-hover:text-theme-300 transition-colors" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight bg-gradient-to-r from-theme-300 via-theme-200 to-theme-400 bg-clip-text text-transparent truncate leading-none">
                {server.name}
              </h1>

              {/* Status Pill */}
              <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-black/40 border border-white/10 shrink-0">
                <span className="flex h-2 w-2 relative shrink-0">
                  {server.status === 'online' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-theme-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${server.status === 'online' ? 'bg-theme-500' : 'bg-red-500'}`}></span>
                </span>
                <span className={`text-[11px] font-mono capitalize ${server.status === 'online' ? 'text-theme-400' : 'text-zinc-400'}`}>
                  {server.status}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Process Health Indicator & Live Real-Time Uptime */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-theme-500/20 shadow-inner backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-zinc-400 font-semibold hidden md:inline text-[11px] uppercase tracking-wider">
                Process Health:
              </span>

              {processHealth === 'healthy' && (
                <div 
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold text-xs shadow-sm shadow-emerald-500/10"
                  title="Server process is active, responding, and healthy."
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Activity size={13} className="text-emerald-400" />
                  <span>Healthy</span>
                </div>
              )}

              {processHealth === 'starting' && (
                <div 
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold text-xs shadow-sm shadow-amber-500/10"
                  title="Server process is currently initializing and booting up."
                >
                  <RefreshCw size={12} className="animate-spin text-amber-400" />
                  <span>Starting...</span>
                </div>
              )}

              {processHealth === 'crashed' && (
                <div 
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 font-semibold text-xs animate-pulse shadow-sm shadow-rose-500/20"
                  title="Process exited unexpectedly or encountered a crash. Click Force Restart to recover."
                >
                  <AlertOctagon size={13} className="text-rose-400" />
                  <span>Crashed / Stuck</span>
                </div>
              )}

              {processHealth === 'offline' && (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-zinc-800/60 border border-zinc-700/40 text-zinc-400 font-semibold text-xs">
                  <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
                  <span>Offline</span>
                </div>
              )}
            </div>

            <div className="h-3.5 w-px bg-white/10" />

            {/* Real-time Uptime Tracker */}
            <div 
              className="flex items-center gap-1.5 text-theme-300 font-mono text-xs font-semibold cursor-help"
              title={`Real-Time Uptime: ${formatHumanDuration(uptimeSeconds)} (${formatDuration(uptimeSeconds)})`}
            >
              <Clock size={13} className={`text-theme-400 ${server.status === 'online' ? 'animate-pulse' : ''}`} />
              <span className="tabular-nums">
                {server.status === 'online' ? formatDuration(uptimeSeconds) : "00:00:00"}
              </span>
            </div>
          </div>
          
          {/* Right: IP Copy Badge + Power Controls (Start/Stop, Restart, and Force Restart) */}
          <div className="flex items-center gap-2 sm:gap-2.5 ml-auto shrink-0 flex-wrap sm:flex-nowrap">
            {/* IP Badge */}
            <button 
              onClick={handleCopyIp} 
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-theme-900/40 hover:bg-theme-500/20 border border-theme-500/30 transition-all group cursor-pointer shrink-0 shadow-sm" 
              title="Click to copy server address"
            >
              <span className="text-xs font-mono text-theme-300 group-hover:text-theme-200 transition-colors truncate max-w-[120px] sm:max-w-[180px]">
                {server.ipAlias ? `${server.ipAlias}:${server.port}` : `:${server.port}`}
              </span>
              {copied ? <Check size={13} className="text-theme-400 shrink-0" /> : <Copy size={13} className="text-theme-400 group-hover:text-theme-300 transition-colors shrink-0" />}
            </button>

            {/* Start / Stop Button */}
            {server.status !== 'online' ? (
              <button 
                disabled={isProcessing} 
                onClick={() => handleAction('start')} 
                className="px-3 sm:px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono font-bold rounded-xl transition-all border border-emerald-500/40 flex items-center justify-center text-xs shadow-lg shadow-emerald-500/10 active:scale-95 disabled:opacity-40 shrink-0 gap-1.5"
                title="Start Server"
              >
                {isProcessing ? (
                  <div className="w-3.5 h-3.5 border-2 border-emerald-400/50 border-t-emerald-400 rounded-full animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-emerald-400/20 text-emerald-400" />
                )}
                <span>Start</span>
              </button>
            ) : (
              <button 
                disabled={isProcessing} 
                onClick={() => handleAction('stop')} 
                className="px-3 sm:px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-mono font-bold rounded-xl transition-all border border-rose-500/40 flex items-center justify-center text-xs shadow-lg shadow-rose-500/10 active:scale-95 disabled:opacity-40 shrink-0 gap-1.5"
                title="Stop Server"
              >
                {isProcessing ? (
                  <div className="w-3.5 h-3.5 border-2 border-rose-400/50 border-t-rose-400 rounded-full animate-spin" />
                ) : (
                  <Square className="w-3.5 h-3.5 fill-rose-400/20 text-rose-400" />
                )}
                <span>Stop</span>
              </button>
            )}

            {/* Normal Restart Button */}
            <button 
              disabled={isProcessing} 
              onClick={() => handleAction('restart')} 
              className="px-3 sm:px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-mono font-bold rounded-xl transition-all border border-amber-500/40 flex items-center justify-center text-xs shadow-lg shadow-amber-500/10 active:scale-95 disabled:opacity-40 shrink-0 gap-1.5"
              title="Gracefully Restart Server"
            >
              {isProcessing ? (
                <div className="w-3.5 h-3.5 border-2 border-amber-400/50 border-t-amber-400 rounded-full animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="hidden xs:inline">Restart</span>
            </button>

            {/* Dedicated Force Restart Button for Stuck Loops */}
            <button 
              disabled={isProcessing} 
              onClick={() => handleAction('force-restart')} 
              className="px-3 sm:px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-mono font-bold rounded-xl transition-all border border-rose-500/40 hover:border-rose-500/70 flex items-center justify-center text-xs shadow-lg shadow-rose-500/15 active:scale-95 disabled:opacity-40 shrink-0 gap-1.5 group"
              title="Force-terminate stuck processes/containers, clear deadlock, and reboot clean instance"
            >
              <Zap className="w-3.5 h-3.5 text-rose-400 fill-rose-400/20 group-hover:scale-110 transition-transform" />
              <span>Force Restart</span>
            </button>
          </div>
        </div>

        {/* Boot Loop & Crash Recovery Warning Banner */}
        <AnimatePresence>
          {(processHealth === 'crashed' || (processHealth === 'starting' && uptimeSeconds > 50)) && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-rose-950/80 border-b border-rose-500/40 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-200 z-10"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
                <span className="font-medium truncate">
                  {processHealth === 'crashed'
                    ? "Warning: Server process stopped unexpectedly or crashed."
                    : "Notice: Server has been starting for an extended duration and may be stuck in a boot loop."}
                </span>
                <span className="text-rose-300/80 hidden sm:inline text-[11px]">
                  Use Force Restart to kill stuck tasks and rebuild container.
                </span>
              </div>
              
              <button 
                onClick={() => handleAction('force-restart')}
                disabled={isProcessing}
                className="px-3 py-1 bg-rose-500/30 hover:bg-rose-500/40 text-rose-200 border border-rose-500/50 rounded-lg font-mono font-bold flex items-center gap-1.5 transition-all text-xs active:scale-95 shrink-0"
              >
                <Zap className="w-3.5 h-3.5 text-rose-300 fill-rose-400/20" /> Force Restart Now
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 relative flex flex-col min-h-0 bg-transparent">
          <div className="flex-1 flex flex-col relative overflow-hidden bg-transparent min-h-0">
            <Routes>
              <Route path="/" element={<ServerConsole serverId={id!} server={server} />} />
              <Route path="/players" element={<PlayerManager serverId={id!} />} />
              <Route path="/properties" element={<ServerProperties serverId={id!} />} />
              <Route path="/world" element={<WorldManager serverId={id!} server={server} onNavigateToFileManager={() => navigate(`/servers/${id}/files`)} />} />
              <Route path="/files" element={<FileManager serverId={id!} />} />
              <Route path="/sftp" element={<ServerSFTP serverId={id!} server={server} />} />
              <Route path="/subusers" element={<SubUsersManager serverId={id!} />} />
              <Route path="/settings" element={<ServerSettings serverId={id!} server={server} />} />
              <Route path="/backup" element={<ServerBackups serverId={id!} />} />
              <Route path="/plugins" element={<PluginManager serverId={id!} />} />
              <Route path="/mods" element={<ModManager serverId={id!} server={server} initialTab="mods" />} />
              <Route path="/resourcepacks" element={<ModManager serverId={id!} server={server} initialTab="resourcepacks" />} />
              {enablePlayit && <Route path="/playit" element={<PlayitTunnel serverId={id!} />} />}
            </Routes>
          </div>
        </div>

      </div>

      <AnimatePresence>
        {showRamWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#121214] border border-theme-500/30 shadow-2xl shadow-theme-500/10 rounded-2xl p-6 max-w-md w-full relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-theme-500 to-theme-600" />
              <div className="flex items-start mb-4">
                <div className="bg-theme-500/10 p-3 rounded-full mr-4">
                  <AlertTriangle className="w-6 h-6 text-theme-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-1">High RAM Allocation</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    This instance is configured to use up to <strong className="text-foreground">{server?.ram}GB</strong> of RAM, but this system only has <strong className="text-foreground">{totalSystemRam.toFixed(1)}GB</strong> physically available. 
                  </p>
                  <p className="text-muted-foreground text-sm leading-relaxed mt-2">
                    The container uses memory on-demand, but if actual memory usage exceeds the host's physical RAM, the server will crash/be terminated by the OS.
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowRamWarning(false)}
                  className="px-4 py-2 bg-muted hover:bg-muted-hover text-foreground font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowRamWarning(false);
                    executeAction('start');
                  }}
                  className="px-4 py-2 bg-theme-500/20 hover:bg-theme-500/30 text-theme-400 font-bold rounded-xl transition-colors border border-theme-500/30"
                >
                  Start Anyway
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isProcessing && <LoadingOverlay message={actionMessage} />}
    </motion.div>
  );
}

