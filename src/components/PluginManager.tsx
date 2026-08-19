import React, { useEffect, useState, useCallback } from "react"; 
import { LoadingOverlay } from "../components/LoadingOverlay";
import axios from "axios";
import { 
  Search, Download, RefreshCw, Puzzle, AlertCircle, Box, Server, Cpu, 
  Check, ExternalLink, Sparkles, ShieldCheck, Flame, Layers, Tag,
  FileCheck2, Info, ArrowUpRight, Zap
} from "lucide-react";

interface Plugin {
  id: string;
  source: 'modrinth' | 'spigot' | 'hangar' | 'bukkit';
  name: string;
  tag: string;
  downloads: number;
  rating: number;
  icon: string | null;
  author?: string;
  platforms?: string[];
  externalUrl?: string;
  version?: string;
}

const POPULAR_BUKKIT_PAPER_PLUGINS = [
  { name: "EssentialsX", query: "EssentialsX", desc: "Core commands, economy & kit suite for Paper/Bukkit" },
  { name: "WorldEdit", query: "WorldEdit", desc: "In-game world map & schematic editor" },
  { name: "Vault", query: "Vault", desc: "Universal economy & permissions connector API" },
  { name: "LuckPerms", query: "LuckPerms", desc: "Advanced permissions management system" },
  { name: "CoreProtect", query: "CoreProtect", desc: "Fast block logging, rollbacks & anti-grief" },
  { name: "ViaVersion", query: "ViaVersion", desc: "Allow newer Minecraft client versions to connect" },
  { name: "ClearLag", query: "Clearlag", desc: "Reduce server lag & clean entities" },
  { name: "Multiverse-Core", query: "Multiverse", desc: "Multi-world manager for Bukkit/Paper" },
  { name: "Geyser-Spigot", query: "Geyser", desc: "Bedrock Edition player cross-play bridge" },
  { name: "Chunky", query: "Chunky", desc: "High speed world pre-generation tool" },
  { name: "GSit", query: "GSit", desc: "Sit, lay, spin, crawl and player seating" },
  { name: "PlaceholderAPI", query: "PlaceholderAPI", desc: "Universal placeholder engine for plugins" },
  { name: "AuthMe", query: "AuthMe", desc: "Player authentication & login security system" },
  { name: "TAB", query: "TAB", desc: "Advanced tablist, scoreboard and nametag manager" },
  { name: "GriefPrevention", query: "GriefPrevention", desc: "Self-service land claims & anti-grief" }
];

export default function PluginManager({ serverId }: { serverId: string }) {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInstalling, setIsInstalling] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeSource, setActiveSource] = useState<'all' | 'paper' | 'bukkit' | 'spigot' | 'modrinth'>('all');
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [installedFiles, setInstalledFiles] = useState<string[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);

  // Load currently installed plugins in /plugins folder
  const loadInstalledPlugins = useCallback(async () => {
    try {
      const res = await axios.get(`/api/servers/${serverId}/files?path=/plugins`);
      if (Array.isArray(res.data)) {
        const jarNames = res.data
          .filter((f: any) => !f.isDirectory && f.name.endsWith('.jar'))
          .map((f: any) => f.name.toLowerCase());
        setInstalledFiles(jarNames);
      }
    } catch {
      // /plugins folder might not exist yet if server is brand new
      setInstalledFiles([]);
    }
  }, [serverId]);

  useEffect(() => {
    loadInstalledPlugins();
  }, [loadInstalledPlugins]);

  const searchPlugins = async (searchQuery: string = "") => {
    try {
      setLoading(true);
      
      const q = searchQuery.trim() || 'essentials';
      const results: Plugin[] = [];
      const promises = [];
      
      // Clean axios instance for external repository queries
      const externalAxios = axios.create();
      delete externalAxios.defaults.headers.common['Authorization'];
      
      // 1. PAPERMC OFFICIAL (Hangar API)
      if (activeSource === 'all' || activeSource === 'paper') {
        promises.push(
          externalAxios.get(`https://hangar.papermc.io/api/v1/projects?q=${encodeURIComponent(q)}&limit=25`)
            .then(res => {
              if (res.data && res.data.result) {
                res.data.result.forEach((hit: any) => {
                  results.push({
                    id: `${hit.namespace.owner}/${hit.namespace.slug}`,
                    source: 'hangar',
                    name: hit.name,
                    tag: hit.description || 'PaperMC / Bukkit plugin on Hangar',
                    downloads: hit.stats?.downloads || 0,
                    rating: hit.stats?.stars || 0,
                    icon: hit.avatarUrl || null,
                    author: hit.namespace?.owner,
                    platforms: ['PaperMC', 'Bukkit', 'Purpur', 'Folia'],
                    externalUrl: `https://hangar.papermc.io/${hit.namespace.owner}/${hit.namespace.slug}`
                  });
                });
              }
            }).catch(err => {
              console.warn("Paper Hangar API warning:", err.message);
            })
        );
      }

      // 2. BUKKIT & SPIGOT (Spiget API)
      if (activeSource === 'all' || activeSource === 'bukkit' || activeSource === 'spigot') {
        promises.push(
          externalAxios.get(`https://api.spiget.org/v2/search/resources/${encodeURIComponent(q)}?field=name&size=25&page=1`)
            .then(res => {
              if (Array.isArray(res.data)) {
                res.data.forEach((hit: any) => {
                  results.push({
                    id: hit.id.toString(),
                    source: 'spigot',
                    name: hit.name,
                    tag: hit.tag || 'Bukkit / Spigot server plugin',
                    downloads: hit.downloads || 0,
                    rating: hit.rating ? hit.rating.average : 0,
                    icon: hit.icon?.url ? `https://spigotmc.org/${hit.icon.url}` : null,
                    author: hit.author?.id ? `Author #${hit.author.id}` : 'Bukkit Community',
                    platforms: ['Bukkit', 'PaperMC', 'Spigot', 'CraftBukkit'],
                    externalUrl: `https://www.spigotmc.org/resources/${hit.id}`
                  });
                });
              }
            }).catch(err => {
              console.warn("Spiget API warning:", err.message);
            })
        );
      }

      // 3. MODRINTH (Bukkit, Paper, Spigot, Folia indexed plugins)
      if (activeSource === 'all' || activeSource === 'modrinth' || activeSource === 'bukkit' || activeSource === 'paper') {
        promises.push(
          externalAxios.get(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(q)}&facets=[["project_type:plugin"]]&limit=25`)
            .then(res => {
              if (res.data && res.data.hits) {
                res.data.hits.forEach((hit: any) => {
                  const loaders = hit.loaders || ['bukkit', 'paper', 'spigot'];
                  const readablePlatforms = loaders.map((l: string) => {
                    if (l === 'paper') return 'PaperMC';
                    if (l === 'bukkit') return 'Bukkit';
                    if (l === 'spigot') return 'Spigot';
                    if (l === 'purpur') return 'Purpur';
                    if (l === 'folia') return 'Folia';
                    if (l === 'velocity') return 'Velocity';
                    if (l === 'bungeecord') return 'Bungee';
                    return l.toUpperCase();
                  });

                  results.push({
                    id: hit.project_id,
                    source: 'modrinth',
                    name: hit.title,
                    tag: hit.description || 'Minecraft server plugin',
                    downloads: hit.downloads || 0,
                    rating: hit.follows || 0,
                    icon: hit.icon_url || null,
                    author: hit.author,
                    platforms: readablePlatforms.length > 0 ? readablePlatforms : ['PaperMC', 'Bukkit', 'Spigot'],
                    externalUrl: `https://modrinth.com/plugin/${hit.slug || hit.project_id}`
                  });
                });
              }
            }).catch(err => {
              console.warn("Modrinth API warning:", err.message);
            })
        );
      }

      await Promise.all(promises);
      
      // Deduplicate by normalized name
      const seen = new Set<string>();
      const deduped: Plugin[] = [];
      for (const p of results) {
        const key = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(p);
        }
      }

      deduped.sort((a, b) => b.downloads - a.downloads);
      setPlugins(deduped);
    } catch (e) {
      console.error("Plugin search error:", e);
      setPlugins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchPlugins(query);
  }, [activeSource]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchPlugins(query);
  };

  const handleQuickSearch = (pluginName: string) => {
    setQuery(pluginName);
    searchPlugins(pluginName);
  };

  const isPluginInstalled = (pluginName: string) => {
    const clean = pluginName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return installedFiles.some(file => file.replace(/[^a-z0-9]/g, '').includes(clean));
  };

  const handleInstall = async (plugin: Plugin) => {
    setStatusMsg(null);
    try {
      setIsInstalling(plugin.id);
      
      const res = await axios.post(`/api/servers/${serverId}/plugins/install`, {
        source: plugin.source === 'bukkit' ? 'spigot' : plugin.source,
        pluginId: plugin.id,
        pluginName: plugin.name
      });
      
      setStatusMsg({
        text: res.data.message || `✓ ${plugin.name} successfully installed into /plugins! Restart the server to activate.`,
        type: "success"
      });

      // Refresh installed files list
      await loadInstalledPlugins();
    } catch (e: any) {
      setStatusMsg({
        text: e.response?.data?.error || "Failed to download and install plugin.",
        type: "error"
      });
    } finally {
      setIsInstalling(null);
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'hangar':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
            <Cpu className="w-3 h-3" /> Paper Hangar
          </span>
        );
      case 'spigot':
      case 'bukkit':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <Server className="w-3 h-3" /> Bukkit / Spigot
          </span>
        );
      case 'modrinth':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <Box className="w-3 h-3" /> Modrinth
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/30 flex items-center gap-1">
            <Puzzle className="w-3 h-3" /> {source}
          </span>
        );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 text-foreground bg-transparent">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight drop-shadow-md flex items-center gap-3">
              <Layers className="w-7 h-7 text-theme-500" />
              Paper & Bukkit Plugin Manager
            </h2>
            <p className="text-[12px] font-bold text-theme-500/90 uppercase tracking-wider mt-1 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> Direct integration with PaperMC Hangar, BukkitDev, SpigotMC & Modrinth
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { searchPlugins(query); loadInstalledPlugins(); }}
              disabled={loading}
              className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white rounded-xl text-xs font-mono transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* STATUS MSG */}
        {statusMsg && (
          <div className={`p-4 rounded-2xl border text-sm flex items-center justify-between shadow-lg animate-in fade-in duration-200 ${
            statusMsg.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" 
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}>
            <div className="flex items-center gap-2.5">
              {statusMsg.type === "success" ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              <span>{statusMsg.text}</span>
            </div>
            <button onClick={() => setStatusMsg(null)} className="text-xs font-mono opacity-70 hover:opacity-100 ml-3 px-2 py-1 bg-white/5 hover:bg-white/10 rounded">Dismiss</button>
          </div>
        )}

        {/* POPULAR BUKKIT & PAPER PLUGINS CAROUSEL */}
        <div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-4 md:p-5 rounded-2xl shadow-[0_0_30px_-15px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold font-mono tracking-wider text-zinc-300 flex items-center gap-2 uppercase">
              <Flame className="w-4 h-4 text-amber-400" /> Popular Paper & Bukkit Essentials:
            </span>
            <span className="text-[11px] font-mono text-zinc-500">Click to search</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {POPULAR_BUKKIT_PAPER_PLUGINS.map(item => (
              <button
                key={item.name}
                type="button"
                onClick={() => handleQuickSearch(item.query)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 cursor-pointer ${
                  query.toLowerCase() === item.query.toLowerCase()
                    ? 'bg-theme-500 text-white border-theme-400 shadow-md shadow-theme-500/20 font-bold'
                    : 'bg-white/[0.03] hover:bg-white/[0.08] text-zinc-300 hover:text-white border-white/10'
                }`}
                title={item.desc}
              >
                <Tag className="w-3 h-3 text-theme-400" />
                {item.name}
              </button>
            ))}
          </div>
        </div>

        {/* SEARCH AND SOURCE FILTERS */}
        <div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border rounded-3xl overflow-hidden shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle">
          <div className="p-4 md:p-6 border-b border-border-subtle space-y-4">
            
            {/* SEARCH BAR */}
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search PaperMC, Bukkit, Spigot & Modrinth plugins (e.g. EssentialsX, WorldEdit, LuckPerms, Vault)..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-muted-subtle border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder-zinc-500 focus:outline-none focus:border-theme-500 transition-colors"
                />
              </div>
              <button 
                type="submit"
                className="px-6 py-3 bg-theme-600 hover:bg-theme-500 active:scale-[0.98] text-white rounded-xl text-sm font-bold transition-all whitespace-nowrap shrink-0 flex items-center justify-center gap-2 shadow-lg shadow-theme-600/20 cursor-pointer"
              >
                <Search className="w-4 h-4" /> Search
              </button>
            </form>
            
            {/* SOURCE FILTER TABS */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {[
                { id: 'all', label: 'All Sources', icon: Layers },
                { id: 'paper', label: 'PaperMC (Hangar)', icon: Cpu },
                { id: 'bukkit', label: 'Bukkit / CraftBukkit', icon: Server },
                { id: 'spigot', label: 'SpigotMC', icon: Server },
                { id: 'modrinth', label: 'Modrinth Plugins', icon: Box },
              ].map(src => {
                const Icon = src.icon;
                const active = activeSource === src.id;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setActiveSource(src.id as any)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                      active 
                        ? 'bg-white text-black font-bold shadow-md' 
                        : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08] border border-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {src.label}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* PLUGINS LIST */}
          <div className="divide-y divide-border-subtle">
            {loading ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                <RefreshCw className="w-8 h-8 animate-spin mb-4 text-theme-500" />
                <p className="font-mono text-sm font-medium">Scanning PaperMC & Bukkit repositories...</p>
                <p className="text-xs text-zinc-500 mt-1">Fetching plugins from Hangar, Spiget & Modrinth</p>
              </div>
            ) : plugins.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                <AlertCircle className="w-10 h-10 mb-3 text-zinc-500" />
                <h4 className="text-base font-bold text-zinc-300">No plugins found</h4>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                  Try searching for general keywords like "Essentials", "Economy", "Chat", "WorldEdit", or choose "All Sources".
                </p>
              </div>
            ) : (
              plugins.map((plugin) => {
                const installed = isPluginInstalled(plugin.name);
                return (
                  <div 
                    key={`${plugin.source}-${plugin.id}`} 
                    className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* ICON */}
                      <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0 overflow-hidden border border-border-subtle shadow-inner">
                        {plugin.icon ? (
                          <img src={plugin.icon} alt={plugin.name} className="w-full h-full object-cover" />
                        ) : (
                          <Puzzle className="w-6 h-6 text-zinc-600" />
                        )}
                      </div>

                      {/* INFO */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-base text-white truncate">{plugin.name}</h4>
                          {getSourceBadge(plugin.source)}
                          {installed && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                              <FileCheck2 className="w-3 h-3" /> Installed
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                          {plugin.tag}
                        </p>

                        {/* PLATFORMS & STATS */}
                        <div className="flex flex-wrap items-center gap-3 mt-2.5 text-[11px] text-zinc-500 font-mono">
                          {plugin.platforms && plugin.platforms.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-[10px] text-zinc-500">Supports:</span>
                              {plugin.platforms.slice(0, 4).map(plat => (
                                <span key={plat} className="px-1.5 py-0.2 bg-white/[0.04] border border-white/10 rounded text-[10px] text-zinc-300">
                                  {plat}
                                </span>
                              ))}
                            </div>
                          )}

                          {plugin.downloads > 0 && (
                            <span className="flex items-center gap-1" title="Downloads">
                              <Download className="w-3 h-3 text-zinc-400" />
                              {plugin.downloads.toLocaleString()}
                            </span>
                          )}

                          {plugin.author && (
                            <span className="text-zinc-500">
                              by <strong className="text-zinc-400 font-normal">{plugin.author}</strong>
                            </span>
                          )}

                          {plugin.externalUrl && (
                            <a 
                              href={plugin.externalUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-theme-400 hover:text-white flex items-center gap-1 transition-colors"
                            >
                              Details <ArrowUpRight className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* INSTALL ACTION BUTTON */}
                    <div className="w-full md:w-auto flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleInstall(plugin)}
                        disabled={isInstalling !== null}
                        className={`w-full md:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                          installed 
                            ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20' 
                            : 'bg-theme-600 hover:bg-theme-500 active:scale-[0.98] text-white shadow-lg shadow-theme-600/20'
                        }`}
                      >
                        {isInstalling === plugin.id ? (
                          <><RefreshCw className="w-4 h-4 animate-spin" /> Installing...</>
                        ) : installed ? (
                          <><RefreshCw className="w-4 h-4 text-emerald-400" /> Reinstall / Update</>
                        ) : (
                          <><Download className="w-4 h-4" /> Install</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* HELPFUL NOTICE */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-border flex items-start gap-3 text-xs text-zinc-400">
          <Info className="w-4 h-4 text-theme-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-zinc-200">Paper, Bukkit & Spigot Compatibility</p>
            <p className="mt-0.5 text-zinc-400">
              All PaperMC, Bukkit, CraftBukkit, Spigot and Purpur servers run standard <code className="text-theme-400">.jar</code> plugins located inside the <code className="text-zinc-300">/plugins</code> directory. Installed plugins will automatically load when you start or restart your server.
            </p>
          </div>
        </div>

      </div>
      
      {isInstalling !== null && <LoadingOverlay message="Downloading and placing plugin in /plugins directory..." />}
    </div>
  );
}
