import React, { useState, useEffect } from "react"; 
import { LoadingOverlay } from "../components/LoadingOverlay";
import { Trash2, AlertTriangle, User, Save, Globe, RefreshCw, Sliders, Code2, TerminalSquare, Info, Lock, Download, Cpu, HardDrive, Zap, CheckCircle2, RotateCcw, Plus, Minus } from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import SearchableDropdown from "./SearchableDropdown";

export default function ServerSettings({ serverId, server }: { serverId: string, server: any }) {
  const { runtimeLocked, defaultRuntime, isDev } = useSettings();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAction, setIsDeletingAction] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [owner, setOwner] = useState(server?.owner || "");
  const [ipAlias, setIpAlias] = useState(server?.ipAlias || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAlias, setIsSavingAlias] = useState(false);

  // Resource Management States
  const [ram, setRam] = useState<number | string>(server?.ram ?? 2);
  const [cpu, setCpu] = useState<number | string>(server?.cpu ?? 100);
  const [disk, setDisk] = useState<number | string>(server?.disk ?? 10);
  const [isSavingResources, setIsSavingResources] = useState(false);
  const [resourceMessage, setResourceMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState(server?.version || "");
  const [selectedType, setSelectedType] = useState((server?.type || "PAPER").toUpperCase());
  const [isChangingVersion, setIsChangingVersion] = useState(false);
  const [isReinstalling, setIsReinstalling] = useState(false);
  const [showReinstallConfirm, setShowReinstallConfirm] = useState(false);
  const [versionProgress, setVersionProgress] = useState(0);
  const [javaVersion, setJavaVersion] = useState(server?.javaVersion || "");
  const [dockerImage, setDockerImage] = useState(server?.dockerImage || "");
  const [serverJar, setServerJar] = useState(server?.serverJar || "");
  const [startupCommand, setStartupCommand] = useState(server?.startupCommand || "");
  const [showDowngradeRestartPopup, setShowDowngradeRestartPopup] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isMigratingRuntime, setIsMigratingRuntime] = useState(false);
  const [showMigrateConfirm, setShowMigrateConfirm] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (server) {
      setSelectedVersion(server.version || "");
      setSelectedType((server.type || "PAPER").toUpperCase());
      setJavaVersion(server.javaVersion || "");
      setDockerImage(server.dockerImage || "");
      setServerJar(server.serverJar || "");
      setStartupCommand(server.startupCommand || "");
      setOwner(server.owner || "");
      setIpAlias(server.ipAlias || "");
      setRam(server.ram || 2);
      setCpu(server.cpu || 100);
      setDisk(server.disk || 10);
    }
  }, [server]);
  
  useEffect(() => {
    // Fetch software versions when type changes
    axios.get(`/api/system/versions?type=${selectedType}`).then((res) => {
      if (Array.isArray(res.data) && res.data.length > 0) {
        const vList = [...res.data];
        setVersions(vList);
        // If current selected version doesn't exist in the new software type list, pick the first version
        if (!vList.includes(selectedVersion)) {
          setSelectedVersion(vList[0] || "");
        }
      } else {
        setVersions([]);
      }
    }).catch(() => {});

    if (user?.role === "admin" || user?.role === "owner") {
      axios.get("/api/auth/users").then(res => {
        setUsers(res.data);
      }).catch(() => {});
    }
  }, [user, selectedType]);

  if (!server) return null;
  const canManage = user?.role === "admin" || user?.role === "owner" || server.owner === user?.id;

  const handleDelete = async () => {
    try {
      setIsDeletingAction(true);
      await axios.delete(`/api/servers/${serverId}`);
      navigate("/servers");
    } catch(e) {
      alert("Failed to delete server");
      setIsDeletingAction(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleChangeVersion = async () => {
    setIsChangingVersion(true);
    setVersionProgress(10);
    const interval = setInterval(() => {
        setVersionProgress(p => p < 90 ? p + 10 : p);
    }, 500);

    try {
      await axios.put(`/api/servers/${serverId}/version`, { 
        version: selectedVersion, 
        type: selectedType,
        javaVersion,
        dockerImage,
        startupCommand,
        serverJar
      });
      setVersionProgress(100);
      setTimeout(() => {
         window.location.reload();
      }, 1000);
    } catch (e: any) {
      alert(e.response?.data?.error || "Failed to update runtime configuration");
      setIsChangingVersion(false);
    } finally {
      clearInterval(interval);
    }
  };

  const handleReinstall = async () => {
    try {
      setIsReinstalling(true);
      setShowReinstallConfirm(false);
      await axios.post(`/api/servers/${serverId}/reinstall`);
      alert("Server software successfully reinstalled and ready!");
    } catch (e: any) {
      alert("Failed to reinstall server: " + (e.response?.data?.error || e.message));
    } finally {
      setIsReinstalling(false);
    }
  };

  const handleDowngradeRestart = async () => {
    try {
      setIsRestarting(true);
      await axios.post(`/api/servers/${serverId}/restart`);
      setShowDowngradeRestartPopup(false);
    } catch (e: any) {
      alert("Failed to restart server: " + (e.response?.data?.error || e.message));
    } finally {
      setIsRestarting(false);
    }
  };

  const handleUpdateOwner = async () => {
    try {
      setIsSaving(true);
      await axios.put(`/api/servers/${serverId}/owner`, { owner });
      alert("Owner updated successfully");
    } catch(e) {
      alert("Failed to update owner");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateIpAlias = async () => {
    try {
      setIsSavingAlias(true);
      await axios.put(`/api/servers/${serverId}/ipalias`, { ipAlias });
      alert("IP Alias updated successfully");
    } catch(e) {
      alert("Failed to update IP Alias");
    } finally {
      setIsSavingAlias(false);
    }
  };

  const handleUpdateResources = async () => {
    const numRam = Math.max(0.5, typeof ram === "number" ? ram : (parseFloat(String(ram)) || 2));
    const numCpu = Math.max(10, typeof cpu === "number" ? cpu : (parseInt(String(cpu)) || 100));
    const numDisk = Math.max(1, typeof disk === "number" ? disk : (parseInt(String(disk)) || 10));

    try {
      setIsSavingResources(true);
      setResourceMessage(null);
      await axios.put(`/api/servers/${serverId}/resources`, {
        ram: numRam,
        cpu: numCpu,
        disk: numDisk
      });
      if (server) {
        server.ram = numRam;
        server.cpu = numCpu;
        server.disk = numDisk;
      }
      setRam(numRam);
      setCpu(numCpu);
      setDisk(numDisk);
      setResourceMessage({
        type: "success",
        text: "Resource limits updated and container recreated successfully with dynamic JVM memory calculation."
      });
    } catch (e: any) {
      setResourceMessage({
        type: "error",
        text: e.response?.data?.error || "Failed to update resources and recreate container."
      });
    } finally {
      setIsSavingResources(false);
    }
  };

  return (
    <>
      {showReinstallConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950/95 backdrop-blur-2xl border border-border p-6 md:p-8 rounded-3xl max-w-md w-full shadow-[0_0_50px_-10px_rgba(0,0,0,0.8)] ring-1 ring-border-subtle relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-theme-600 to-amber-500"></div>
            <div className="flex items-start mb-4">
              <div className="bg-theme-600/20 p-3 rounded-2xl mr-4 text-theme-500">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground mb-1">Reinstall Server Software</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This will cleanly download and install the official server software (<span className="text-theme-400 font-semibold">{selectedType} {selectedVersion}</span>). Your world, plugin configurations, and player data will remain safe.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowReinstallConfirm(false)}
                disabled={isReinstalling}
                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-all disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleReinstall}
                disabled={isReinstalling}
                className="px-6 py-2.5 bg-theme-600 hover:bg-theme-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-theme-600/20 disabled:opacity-50 text-sm flex items-center gap-2"
              >
                {isReinstalling ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Reinstalling...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Confirm Reinstall
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDowngradeRestartPopup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-black/60 backdrop-blur-2xl border border-border p-6 md:p-8 rounded-3xl max-w-md w-full shadow-[0_0_50px_-10px_rgba(0,0,0,0.8)] ring-1 ring-border-subtle relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-theme-600/5 to-transparent pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-600 to-theme-500"></div>
            <div className="flex items-start mb-4">
              <div className="bg-theme-600/20 p-3 rounded-xl mr-4 text-theme-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground mb-1">Restart Required</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Restart the server to ensure files are processed correctly.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={handleDowngradeRestart}
                disabled={isRestarting}
                className="px-6 py-2.5 bg-theme-600 hover:bg-theme-500 text-black font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                {isRestarting ? "Restarting..." : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

    <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar text-foreground bg-transparent">
      <div className="max-w-3xl space-y-8">
        <div>
          <h2 className="text-xl font-bold mb-2">Settings</h2>
          <p className="text-muted-foreground text-sm mb-6">Manage advanced configuration and dangerous actions for this unit.</p>
        </div>

        {canManage ? (
          <>

            {isDev && (
              <div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle relative z-30 group hover:bg-black/60 transition-colors mb-8">
                <h3 className="text-foreground font-bold mb-2 flex items-center">
                  <RefreshCw className={`w-5 h-5 mr-2 text-theme-500 ${isMigratingRuntime ? "animate-spin" : ""}`} /> Runtime Migration & Conversion
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Current execution runtime: <strong className="text-theme-400 uppercase font-mono">{server.runtimeType === 'local' ? 'Local Process' : 'Docker Container'}</strong>.
                  <span className="text-zinc-400/80 block mt-1">
                    You can seamlessly switch this unit between Docker Container isolation and Node.js Local Process execution. Make sure the server is stopped before migrating.
                  </span>
                </p>

                {migrationMessage && (
                  <div className={`mb-4 p-3 rounded-xl text-sm font-medium border ${migrationMessage.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"}`}>
                    {migrationMessage.text}
                  </div>
                )}
                
                {runtimeLocked ? (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
                    <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-200">Runtime Switching Locked</p>
                      <p className="mt-0.5 text-amber-300/80">
                        The execution engine is locked to <strong className="uppercase">{defaultRuntime === 'local' ? 'Local Process' : 'Docker Container'}</strong> by installation configuration (`install.sh`).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!showMigrateConfirm ? (
                      <button 
                        disabled={isMigratingRuntime}
                        onClick={() => setShowMigrateConfirm(true)}
                        className="bg-theme-600 hover:bg-theme-500 active:scale-[0.98] text-white px-5 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50 text-sm flex items-center gap-2 shadow-lg shadow-theme-600/20"
                      >
                        <RefreshCw className={`w-4 h-4 ${isMigratingRuntime ? "animate-spin" : ""}`} />
                        {isMigratingRuntime ? "Migrating Runtime..." : `Convert to ${server.runtimeType === 'local' ? 'Docker Container' : 'Local Process'}`}
                      </button>
                    ) : (
                      <div className="p-4 rounded-2xl bg-zinc-900/90 border border-theme-500/30 space-y-3">
                        <p className="text-sm text-zinc-200">
                          Convert this server to <strong className="text-theme-400">{server.runtimeType === 'local' ? 'Docker Container' : 'Local Process'}</strong>?
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            disabled={isMigratingRuntime}
                            onClick={async () => {
                              const target = server.runtimeType === 'local' ? 'docker' : 'local';
                              setIsMigratingRuntime(true);
                              setMigrationMessage(null);
                              setShowMigrateConfirm(false);
                              try {
                                const token = localStorage.getItem("jtg_token") || localStorage.getItem("token");
                                const headers: any = {};
                                if (token) headers["Authorization"] = `Bearer ${token}`;
                                const res = await axios.put(`/api/servers/${serverId}/migrate-runtime`, { targetRuntime: target }, { headers });
                                setMigrationMessage({
                                  text: `Successfully converted runtime to ${target === 'local' ? 'Local Process' : 'Docker Container'}!`,
                                  type: "success"
                                });
                                if (server) {
                                  server.runtimeType = target;
                                }
                                setTimeout(() => {
                                  window.location.reload();
                                }, 1000);
                              } catch (err: any) {
                                setMigrationMessage({
                                  text: err.response?.data?.error || err.message || "Failed to migrate server runtime.",
                                  type: "error"
                                });
                                setIsMigratingRuntime(false);
                              }
                            }}
                            className="bg-theme-600 hover:bg-theme-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
                          >
                            {isMigratingRuntime ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                            Confirm Conversion
                          </button>
                          <button
                            disabled={isMigratingRuntime}
                            onClick={() => setShowMigrateConfirm(false)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            
            
            
            {/* RUNTIME CONFIGURATION */}
            {(() => {
              const upperType = (server?.type || "").toUpperCase();
              const isGeneric = ["NODEJS", "NODE", "PYTHON", "PYTHON3"].includes(upperType);
              const isNode = ["NODEJS", "NODE"].includes(upperType);
              const isPy = ["PYTHON", "PYTHON3"].includes(upperType);

              if (isGeneric) {
                return (
                  <div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle relative z-30 group hover:bg-black/60 transition-colors mb-8">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-theme-500 font-bold flex items-center gap-2">
                        {isNode ? <Code2 className="w-5 h-5 text-theme-500" /> : <TerminalSquare className="w-5 h-5 text-theme-500" />}
                        {isNode ? "Node.js Runtime Environment" : "Python Runtime Environment"}
                      </h3>
                      <span className="flex items-center gap-1.5 text-xs font-mono bg-white/10 text-white/90 px-2.5 py-1 rounded-full border border-white/10">
                        <Lock className="w-3 h-3 text-theme-400" /> Fixed Runtime
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4">
                      Dedicated standalone code runtime. Upload your project scripts, packages, and dependencies in the File Manager and start them in the Console.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Runtime Platform</label>
                        <div className="w-full bg-card/60 border border-border rounded-xl px-4 py-3 text-foreground font-mono text-sm flex items-center justify-between opacity-80 cursor-not-allowed">
                          <span>{isNode ? "Node.js (JavaScript / TypeScript)" : "Python (Python 3.x)"}</span>
                          <span className="text-xs text-muted-foreground">Fixed</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Runtime Version</label>
                        <SearchableDropdown
                          value={selectedVersion}
                          onChange={setSelectedVersion}
                          options={versions.map(v => ({ value: v, label: isNode ? `Node.js v${v}` : `Python ${v}` }))}
                          placeholder="Select Version"
                          searchPlaceholder="Search versions..."
                          disabled={isChangingVersion}
                          className="font-mono bg-card"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Startup Command</label>
                        <input
                          type="text"
                          value={startupCommand}
                          onChange={e => setStartupCommand(e.target.value)}
                          placeholder={isNode ? "e.g. node index.js or npm start" : "e.g. python3 -u main.py"}
                          disabled={isChangingVersion}
                          className="w-full bg-card border border-border focus:border-theme-600 rounded-xl px-4 py-3 text-foreground transition-all outline-none font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground font-mono mt-1.5">
                          {isNode ? "Leave empty to automatically execute index.js, app.js, or package.json start script." : "Leave empty to automatically execute main.py, app.py, or bot.py."}
                        </p>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Custom Docker Image (Optional)</label>
                        <input
                          type="text"
                          value={dockerImage}
                          onChange={e => setDockerImage(e.target.value)}
                          placeholder={isNode ? "node:20-alpine" : "python:3.11-slim"}
                          disabled={isChangingVersion}
                          className="w-full bg-card border border-border focus:border-theme-600 rounded-xl px-4 py-3 text-foreground transition-all outline-none font-mono text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end mt-4">
                      <button 
                        onClick={handleChangeVersion}
                        disabled={isChangingVersion}
                        className="px-6 py-3 bg-theme-600/10 hover:bg-theme-600/20 text-theme-600 font-medium rounded-xl border border-theme-600/20 transition-all disabled:opacity-50 flex items-center min-w-[160px] justify-center h-[50px]"
                      >
                        {isChangingVersion ? "Updating..." : "Update Runtime"}
                      </button>
                    </div>

                    {isChangingVersion && (
                      <div className="mt-6 p-4 border border-zinc-800 bg-muted rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-theme-500">Updating runtime configuration...</span>
                          <span className="text-sm font-mono text-theme-500/80">{versionProgress}%</span>
                        </div>
                        <div className="w-full bg-zinc-800/50 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-theme-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${versionProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle relative z-30 group hover:bg-black/60 transition-colors mb-8">
                  <h3 className="text-theme-500 font-bold mb-2 flex items-center">
                    <Sliders className="w-5 h-5 mr-2" /> Minecraft Runtime
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Configure server software, Java version, and Docker image.
                    <span className="text-theme-500/80 block mt-1">
                      WARNING: The server MUST be stopped before changing the runtime. A backup will be created automatically.
                    </span>
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Software Type</label>
                      <select
                        value={selectedType}
                        onChange={e => setSelectedType(e.target.value)}
                        disabled={isChangingVersion}
                        className="w-full bg-card border border-border focus:border-theme-600 rounded-xl px-4 py-3 text-foreground transition-all outline-none"
                      >
                        <option value="PAPER">Paper</option>
                        <option value="PURPUR">Purpur</option>
                        <option value="FOLIA">Folia</option>
                        <option value="SPIGOT">Spigot</option>
                        <option value="FABRIC">Fabric</option>
                        <option value="FORGE">Forge</option>
                        <option value="VANILLA">Vanilla</option>
                        <option value="BUNGEECORD">BungeeCord</option>
                        <option value="VELOCITY">Velocity</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Software Version</label>
                      <SearchableDropdown
                        value={selectedVersion}
                        onChange={setSelectedVersion}
                        options={versions.map(v => ({ value: v, label: v }))}
                        placeholder="Select Version"
                        searchPlaceholder="Search versions..."
                        disabled={isChangingVersion}
                        className="font-mono bg-card"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Java Version</label>
                      <select
                        value={javaVersion}
                        onChange={e => setJavaVersion(e.target.value)}
                        disabled={isChangingVersion}
                        className="w-full bg-card border border-border focus:border-theme-600 rounded-xl px-4 py-3 text-foreground transition-all outline-none"
                      >
                        <option value="">Auto-detect (Recommended)</option>
                        <option value="8">Java 8</option>
                        <option value="11">Java 11</option>
                        <option value="16">Java 16</option>
                        <option value="17">Java 17</option>
                        <option value="21">Java 21 (LTS)</option>
                        <option value="22">Java 22</option>
                        <option value="23">Java 23</option>
                        <option value="24">Java 24</option>
                        <option value="25">Java 25 (LTS)</option>
                        <option value="26">Java 26</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Docker Image</label>
                      <input
                        type="text"
                        value={dockerImage}
                        onChange={e => setDockerImage(e.target.value)}
                        placeholder="e.g. ghcr.io/pterodactyl/yolks:java_17"
                        disabled={isChangingVersion}
                        className="w-full bg-card border border-border focus:border-theme-600 rounded-xl px-4 py-3 text-foreground transition-all outline-none font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Server JAR</label>
                      <input
                        type="text"
                        value={serverJar}
                        onChange={e => setServerJar(e.target.value)}
                        placeholder="e.g. server.jar"
                        disabled={isChangingVersion}
                        className="w-full bg-card border border-border focus:border-theme-600 rounded-xl px-4 py-3 text-foreground transition-all outline-none font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Startup Command</label>
                      <input
                        type="text"
                        value={startupCommand}
                        onChange={e => setStartupCommand(e.target.value)}
                        placeholder="e.g. java -Xms1G -Xmx4G -jar server.jar --nogui"
                        disabled={isChangingVersion}
                        className="w-full bg-card border border-border focus:border-theme-600 rounded-xl px-4 py-3 text-foreground transition-all outline-none font-mono text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 mt-4">
                    {!["NODEJS", "NODE", "PYTHON", "PYTHON3"].includes(selectedType) && (
                      <button 
                        onClick={() => setShowReinstallConfirm(true)}
                        disabled={isReinstalling || isChangingVersion}
                        className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-xl border border-zinc-700 transition-all disabled:opacity-50 flex items-center justify-center h-[50px] active:scale-[0.98]"
                        title="Cleanly reinstall server software JAR from official mirror"
                      >
                        <RotateCcw className={`w-4 h-4 mr-2 ${isReinstalling ? "animate-spin" : ""}`} />
                        {isReinstalling ? "Reinstalling..." : "Reinstall Server"}
                      </button>
                    )}
                    <button 
                      onClick={handleChangeVersion}
                      disabled={isChangingVersion || isReinstalling}
                      className="px-6 py-3 bg-theme-600/10 hover:bg-theme-600/20 text-theme-500 hover:text-theme-400 font-medium rounded-xl border border-theme-600/20 transition-all disabled:opacity-50 flex items-center min-w-[160px] justify-center h-[50px]"
                    >
                      {isChangingVersion ? "Updating & Installing..." : "Update Runtime"}
                    </button>
                  </div>
                  {isChangingVersion && (
                    <div className="mt-6 p-4 border border-zinc-800 bg-muted rounded-xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-theme-500">Updating runtime configuration...</span>
                        <span className="text-sm font-mono text-theme-500/80">{versionProgress}%</span>
                      </div>
                      <div className="w-full bg-zinc-800/50 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-theme-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${versionProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
<div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle relative z-20 group hover:bg-black/60 transition-colors mb-8">
              <h3 className="text-theme-500 font-bold mb-2 flex items-center">
                <Globe className="w-5 h-5 mr-2" /> Server IP Alias
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                Set a custom domain or IP to display on the console page.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input 
                    type="text" 
                    value={ipAlias} 
                    onChange={e => setIpAlias(e.target.value)} 
                    placeholder="e.g. play.example.com"
                    className="w-full bg-card border border-border focus:border-theme-600 focus:ring-1 focus:ring-theme-600/50 rounded-xl px-4 py-2 text-foreground transition-all shadow-inner outline-none font-mono"
                  />
                </div>
                <button 
                  onClick={handleUpdateIpAlias}
                  disabled={isSavingAlias || ipAlias === (server.ipAlias || "")}
                  className="px-6 py-2 bg-theme-600/10 hover:bg-theme-600/20 text-theme-500 font-medium rounded-xl border border-theme-600/20 transition-all disabled:opacity-50 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" /> Save
                </button>
              </div>
            </div>

            {(user?.role === "admin" || user?.role === "owner") ? (
              <>
                <div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle relative z-10 group hover:bg-black/60 transition-colors mb-8">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-theme-500 font-bold flex items-center">
                      <Cpu className="w-5 h-5 mr-2" /> Resource Limits & JVM Memory
                    </h3>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-theme-600/10 text-theme-500 border border-theme-600/20 font-medium">
                      Auto-Recreates Container
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm mb-6">
                    Adjust resource limits allocated to this server. Updating resources dynamically calculates JVM heap allocation with off-heap safety headroom and recreates the container to apply strict limits.
                  </p>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {/* RAM */}
                    {(() => {
                      const numRam = typeof ram === "number" ? ram : (parseFloat(String(ram)) || 0);
                      const presets = [1, 2, 4, 6, 8, 12, 16, 32];
                      return (
                        <div className="bg-card/40 border border-border/70 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center">
                              <Zap className="w-3.5 h-3.5 mr-1 text-theme-500" /> RAM (GB)
                            </label>
                            <span className="text-foreground font-mono text-xs font-bold bg-theme-600/10 px-2 py-0.5 rounded-md border border-theme-600/20 text-theme-500">
                              {numRam > 0 ? `${Math.round(numRam * 1024)} MB` : "—"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const curr = typeof ram === "number" ? ram : (parseFloat(String(ram)) || 2);
                                setRam(Math.max(0.5, Number((curr - 0.5).toFixed(1))));
                              }}
                              className="p-2.5 bg-card hover:bg-zinc-800 border border-border rounded-xl text-foreground active:scale-95 transition-all"
                              title="Decrease 0.5 GB"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input 
                              type="number" 
                              min="0.5" 
                              max="128" 
                              step="0.5"
                              value={ram}
                              onChange={e => setRam(e.target.value)}
                              onBlur={() => {
                                if (ram === "" || isNaN(Number(ram)) || Number(ram) < 0.5) {
                                  setRam(0.5);
                                } else {
                                  setRam(Number(parseFloat(String(ram)).toFixed(1)));
                                }
                              }}
                              placeholder="e.g. 4"
                              className="w-full bg-background border border-border focus:border-theme-600 focus:ring-1 focus:ring-theme-600/50 rounded-xl px-3 py-2 text-foreground font-mono font-bold text-center text-sm outline-none transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const curr = typeof ram === "number" ? ram : (parseFloat(String(ram)) || 2);
                                setRam(Number((curr + 0.5).toFixed(1)));
                              }}
                              className="p-2.5 bg-card hover:bg-zinc-800 border border-border rounded-xl text-foreground active:scale-95 transition-all"
                              title="Increase 0.5 GB"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          <input
                            type="range"
                            min="0.5"
                            max="64"
                            step="0.5"
                            value={numRam || 0.5}
                            onChange={e => setRam(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-theme-600"
                          />

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {presets.map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setRam(p)}
                                className={`text-[11px] font-mono px-2 py-0.5 rounded-lg border transition-all ${
                                  numRam === p 
                                    ? "bg-theme-600 text-black border-theme-500 font-bold" 
                                    : "bg-background/80 hover:bg-zinc-800 text-muted-foreground border-border/80"
                                }`}
                              >
                                {p}G
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* CPU */}
                    {(() => {
                      const numCpu = typeof cpu === "number" ? cpu : (parseInt(String(cpu)) || 0);
                      const presets = [50, 100, 200, 400, 800];
                      return (
                        <div className="bg-card/40 border border-border/70 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center">
                              <Cpu className="w-3.5 h-3.5 mr-1 text-theme-500" /> CPU Limit (%)
                            </label>
                            <span className="text-foreground font-mono text-xs font-bold bg-theme-600/10 px-2 py-0.5 rounded-md border border-theme-600/20 text-theme-500">
                              {numCpu > 0 ? `~${(numCpu / 100).toFixed(1)} vCPU` : "—"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const curr = typeof cpu === "number" ? cpu : (parseInt(String(cpu)) || 100);
                                setCpu(Math.max(10, curr - 25));
                              }}
                              className="p-2.5 bg-card hover:bg-zinc-800 border border-border rounded-xl text-foreground active:scale-95 transition-all"
                              title="Decrease 25%"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input 
                              type="number" 
                              min="10" 
                              max="1600" 
                              step="10"
                              value={cpu}
                              onChange={e => setCpu(e.target.value)}
                              onBlur={() => {
                                if (cpu === "" || isNaN(Number(cpu)) || Number(cpu) < 10) {
                                  setCpu(10);
                                } else {
                                  setCpu(Math.round(Number(cpu)));
                                }
                              }}
                              placeholder="e.g. 200"
                              className="w-full bg-background border border-border focus:border-theme-600 focus:ring-1 focus:ring-theme-600/50 rounded-xl px-3 py-2 text-foreground font-mono font-bold text-center text-sm outline-none transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const curr = typeof cpu === "number" ? cpu : (parseInt(String(cpu)) || 100);
                                setCpu(curr + 25);
                              }}
                              className="p-2.5 bg-card hover:bg-zinc-800 border border-border rounded-xl text-foreground active:scale-95 transition-all"
                              title="Increase 25%"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          <input
                            type="range"
                            min="10"
                            max="800"
                            step="10"
                            value={numCpu || 10}
                            onChange={e => setCpu(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-theme-600"
                          />

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {presets.map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setCpu(p)}
                                className={`text-[11px] font-mono px-2 py-0.5 rounded-lg border transition-all ${
                                  numCpu === p 
                                    ? "bg-theme-600 text-black border-theme-500 font-bold" 
                                    : "bg-background/80 hover:bg-zinc-800 text-muted-foreground border-border/80"
                                }`}
                              >
                                {p}%
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Disk */}
                    {(() => {
                      const numDisk = typeof disk === "number" ? disk : (parseInt(String(disk)) || 0);
                      const presets = [5, 10, 25, 50, 100, 200];
                      return (
                        <div className="bg-card/40 border border-border/70 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center">
                              <HardDrive className="w-3.5 h-3.5 mr-1 text-theme-500" /> Disk Space (GB)
                            </label>
                            <span className="text-foreground font-mono text-xs font-bold bg-theme-600/10 px-2 py-0.5 rounded-md border border-theme-600/20 text-theme-500">
                              {numDisk > 0 ? `${numDisk} GB` : "—"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const curr = typeof disk === "number" ? disk : (parseInt(String(disk)) || 10);
                                setDisk(Math.max(1, curr - 5));
                              }}
                              className="p-2.5 bg-card hover:bg-zinc-800 border border-border rounded-xl text-foreground active:scale-95 transition-all"
                              title="Decrease 5 GB"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input 
                              type="number" 
                              min="1" 
                              max="1000" 
                              step="1"
                              value={disk}
                              onChange={e => setDisk(e.target.value)}
                              onBlur={() => {
                                if (disk === "" || isNaN(Number(disk)) || Number(disk) < 1) {
                                  setDisk(1);
                                } else {
                                  setDisk(Math.round(Number(disk)));
                                }
                              }}
                              placeholder="e.g. 25"
                              className="w-full bg-background border border-border focus:border-theme-600 focus:ring-1 focus:ring-theme-600/50 rounded-xl px-3 py-2 text-foreground font-mono font-bold text-center text-sm outline-none transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const curr = typeof disk === "number" ? disk : (parseInt(String(disk)) || 10);
                                setDisk(curr + 5);
                              }}
                              className="p-2.5 bg-card hover:bg-zinc-800 border border-border rounded-xl text-foreground active:scale-95 transition-all"
                              title="Increase 5 GB"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          <input
                            type="range"
                            min="1"
                            max="200"
                            step="1"
                            value={numDisk || 1}
                            onChange={e => setDisk(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-theme-600"
                          />

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {presets.map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setDisk(p)}
                                className={`text-[11px] font-mono px-2 py-0.5 rounded-lg border transition-all ${
                                  numDisk === p 
                                    ? "bg-theme-600 text-black border-theme-500 font-bold" 
                                    : "bg-background/80 hover:bg-zinc-800 text-muted-foreground border-border/80"
                                }`}
                              >
                                {p}G
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Dynamic JVM Calculation Live Preview */}
                  {(() => {
                    const parsedRam = typeof ram === "number" ? ram : (parseFloat(String(ram)) || 2);
                    const totalMb = Math.round(Math.max(0.5, parsedRam) * 1024);
                    const headroomMb = Math.max(384, Math.min(2048, Math.round(totalMb * 0.14)));
                    const heapMaxMb = Math.max(256, totalMb - headroomMb);
                    const heapInitMb = Math.max(128, Math.min(1024, Math.round(heapMaxMb * 0.25)));

                    return (
                      <div className="p-4 rounded-2xl bg-card/60 border border-border/80 mb-6 text-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-foreground flex items-center">
                            <Info className="w-4 h-4 mr-1.5 text-theme-500" /> Dynamic Memory Allocation Formula
                          </span>
                          <span className="font-mono text-muted-foreground">Total Cgroup Memory: {totalMb} MB</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-muted-foreground font-mono">
                          <div className="bg-background/80 p-2.5 rounded-xl border border-border/50">
                            <span className="text-foreground font-semibold block text-[11px] uppercase tracking-wider mb-1">JVM Max Heap (-Xmx)</span>
                            <span className="text-theme-500 text-sm font-bold">{heapMaxMb} MB</span> ({Math.round((heapMaxMb / totalMb) * 100)}%)
                          </div>
                          <div className="bg-background/80 p-2.5 rounded-xl border border-border/50">
                            <span className="text-foreground font-semibold block text-[11px] uppercase tracking-wider mb-1">Off-Heap Headroom</span>
                            <span className="text-amber-500 text-sm font-bold">{headroomMb} MB</span> (Native, Metaspace, GC)
                          </div>
                          <div className="bg-background/80 p-2.5 rounded-xl border border-border/50">
                            <span className="text-foreground font-semibold block text-[11px] uppercase tracking-wider mb-1">JVM Initial Heap (-Xms)</span>
                            <span className="text-foreground text-sm font-bold">{heapInitMb} MB</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {resourceMessage && (
                    <div className={`p-4 rounded-xl mb-4 text-sm flex items-center ${
                      resourceMessage.type === "success" 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}>
                      {resourceMessage.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                      )}
                      {resourceMessage.text}
                    </div>
                  )}

                  <div className="flex justify-end">
                    {(() => {
                      const numRam = typeof ram === "number" ? ram : (parseFloat(String(ram)) || 2);
                      const numCpu = typeof cpu === "number" ? cpu : (parseInt(String(cpu)) || 100);
                      const numDisk = typeof disk === "number" ? disk : (parseInt(String(disk)) || 10);
                      const isUnchanged = numRam === Number(server.ram || 2) && numCpu === Number(server.cpu || 100) && numDisk === Number(server.disk || 10);
                      
                      return (
                        <button 
                          onClick={handleUpdateResources}
                          disabled={isSavingResources || isUnchanged}
                          className="px-6 py-2.5 bg-theme-600 hover:bg-theme-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center shadow-lg shadow-theme-600/20 active:scale-[0.98]"
                        >
                          <Save className="w-4 h-4 mr-2" /> {isSavingResources ? "Recreating Container..." : "Apply & Recreate Container"}
                        </button>
                      );
                    })()}
                  </div>
                </div>

                <div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle relative z-10 group hover:bg-black/60 transition-colors mb-8">
                  <h3 className="text-theme-500 font-bold mb-2 flex items-center">
                    <User className="w-5 h-5 mr-2" /> Server Ownership
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Transfer the ownership of this server to another user.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <SearchableDropdown
                        value={owner}
                        onChange={setOwner}
                        options={users.map(u => ({ value: u.id, label: `${u.username} (${u.role})` }))}
                        placeholder="Select an owner..."
                        searchPlaceholder="Search users..."
                        className="bg-card"
                      />
                    </div>
                    <button 
                      onClick={handleUpdateOwner}
                      disabled={isSaving || owner === server.owner}
                      className="px-6 py-2 bg-theme-600/10 hover:bg-theme-600/20 text-theme-500 font-medium rounded-xl border border-theme-600/20 transition-all disabled:opacity-50 flex items-center"
                    >
                      <Save className="w-4 h-4 mr-2" /> Save
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </>
        ) : (
           <div className="text-muted-foreground text-sm p-4 bg-muted rounded-xl border border-border-subtle">
             You do not have permission to manage this server's settings.
           </div>
        )}
      </div>
          {(isDeletingAction || isSaving || isSavingAlias || isChangingVersion || isRestarting) && <LoadingOverlay />}
    </div>
    </>
  );
}
