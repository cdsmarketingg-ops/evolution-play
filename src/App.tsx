import React, { useState, useRef, useEffect } from 'react';
import { 
  Volume2, 
  Music, 
  Settings, 
  Upload, 
  Keyboard as KeyboardIcon,
  Activity,
  Sliders,
  Power,
  Layers,
  Piano as PianoIcon,
  FolderOpen,
  Trash2,
  Plus,
  ChevronRight
} from 'lucide-react';
import { soundFontStorage, SavedSoundFont } from './services/storage';
import { motion, AnimatePresence } from 'motion/react';
import { useSynthesizer } from './services/audioEngine';

const Knob = ({ label, value, onChange, min = 0, max = 100, unit = "" }: { 
  label: string, 
  value: number, 
  onChange: (v: number) => void,
  min?: number,
  max?: number,
  unit?: string
}) => {
  const rotation = ((value - min) / (max - min)) * 270 - 135;
  
  return (
    <div className="flex flex-col items-center gap-1 group">
      <span className="text-[10px] uppercase font-mono text-hw-text-dim group-hover:text-hw-accent transition-colors">
        {label}
      </span>
      <div 
        className="relative w-10 h-10 rounded-full bg-hw-panel border-2 border-hw-border shadow-inner cursor-pointer flex items-center justify-center"
        onMouseDown={(e) => {
          const startY = e.clientY;
          const startValue = value;
          const onMouseMove = (moveEvent: MouseEvent) => {
            const deltaY = startY - moveEvent.clientY;
            const newValue = Math.min(max, Math.max(min, startValue + deltaY * ((max - min) / 200)));
            onChange(newValue);
          };
          const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
          };
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
        }}
      >
        <div 
          className="absolute w-1 h-3 bg-hw-accent rounded-full top-1 origin-bottom"
          style={{ transform: `rotate(${rotation}deg) translateY(-2px)` }}
        />
        <span className="text-[8px] font-mono text-hw-text-dim pointer-events-none">
          {Math.round(value)}{unit}
        </span>
      </div>
    </div>
  );
};

const Fader = ({ value, onChange, label }: { value: number, onChange: (v: number) => void, label: string }) => {
  return (
    <div className="flex flex-col items-center gap-2 h-full py-4">
      <div className="relative h-48 w-8 bg-black/40 rounded-sm border border-hw-border flex flex-col items-center py-2">
        {/* Scale marks */}
        <div className="absolute inset-0 flex flex-col justify-between px-1 py-4 pointer-events-none opacity-20">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="w-full h-[1px] bg-white" />
          ))}
        </div>
        
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          style={{ appearance: 'none', writingMode: 'bt-lr' }}
        />
        
        <div 
          className="absolute w-6 h-10 bg-hw-text rounded-sm shadow-lg border border-hw-border flex items-center justify-center pointer-events-none z-0"
          style={{ bottom: `${value * 80}%` }}
        >
          <div className="w-full h-[2px] bg-red-500" />
        </div>
      </div>
      <span className="text-[10px] font-mono uppercase text-hw-text-dim">{label}</span>
    </div>
  );
};

export default function App() {
  const { 
    isReady, 
    initSynth, 
    loadSoundFont, 
    loadSoundFontFromUrl,
    midiDevices, 
    selectedMidiId, 
    setSelectedMidiId,
    setVolume,
    setPan,
    reverb,
    chorus,
    setReverb,
    setChorus,
    presets,
    selectedPreset,
    selectedBank,
    setInstrument,
    noteOn,
    noteOff
  } = useSynthesizer();

  const [volume, setVol] = useState(0.8);
  const [pan, setP] = useState(0); // -1 to 1
  const [eqHigh, setEqHigh] = useState(0);
  const [eqMid, setEqMid] = useState(0);
  const [eqLow, setEqLow] = useState(0);
  const [sfName, setSfName] = useState<string | null>(null);
  const [isPowerOn, setIsPowerOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [library, setLibrary] = useState<string[]>([]);
  const [localLibrary, setLocalLibrary] = useState<SavedSoundFont[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);

  // Load library from server and local storage
  const loadLibrary = async () => {
    // 1. Load from IndexedDB (Always works)
    try {
      const local = await soundFontStorage.getAll();
      setLocalLibrary(local);
    } catch (err) {
      console.error("Failed to load local library", err);
    }

    // 2. Try to load from server
    try {
      const response = await fetch('/api/soundfonts');
      if (response.ok) {
        const data = await response.json();
        setLibrary(data);
      }
    } catch (err) {
      console.warn("Server library unavailable. Using local storage only.");
    }
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      // Ensure engine is initialized
      if (!isReady) {
        await initSynth();
      }

      const buffer = await file.arrayBuffer();
      
      // 1. Save to IndexedDB (Local persistence)
      await soundFontStorage.save(file.name, buffer);
      
      // 2. Load into memory immediately
      await loadSoundFont(buffer);
      setSfName(file.name.toUpperCase());
      
      // 3. Refresh local library
      await loadLibrary();

      // 4. Try to persist to server in background
      const formData = new FormData();
      formData.append('file', file);

      fetch('/api/upload', {
        method: 'POST',
        body: formData,
      }).then(async (response) => {
        if (response.ok) {
          await loadLibrary();
          console.log("✅ Timbre persistido no servidor.");
        }
      }).catch(() => {
        console.warn("⚠️ Servidor indisponível. Timbre salvo apenas localmente.");
      });

    } catch (error) {
      console.error("Failed to load soundfont", error);
      alert("Erro ao carregar o arquivo .sf2. Verifique se o arquivo é válido.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadFromLibrary = async (fileName: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/soundfonts/${fileName}`);
      if (!response.ok) throw new Error("Server file not found");
      const buffer = await response.arrayBuffer();
      await loadSoundFont(buffer);
      setSfName(fileName.toUpperCase());
    } catch (error) {
      console.warn("Failed to load from server library, checking local storage...");
      // Fallback to local storage if server fails
      const localMatch = localLibrary.find(item => item.name === fileName);
      if (localMatch) {
        await loadSoundFont(localMatch.data);
        setSfName(fileName.toUpperCase());
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadFromLocal = async (item: SavedSoundFont) => {
    setIsLoading(true);
    try {
      await loadSoundFont(item.data);
      setSfName(item.name.toUpperCase());
    } catch (error) {
      console.error("Failed to load from local storage", error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteFromLibrary = async (fileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Remover "${fileName}" do servidor?`)) {
      try {
        await fetch(`/api/soundfonts/${fileName}`, { method: 'DELETE' });
        await loadLibrary();
      } catch (err) {
        alert("Erro ao deletar do servidor.");
      }
    }
  };

  const deleteFromLocal = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Remover este timbre da memória local?`)) {
      await soundFontStorage.delete(id);
      await loadLibrary();
    }
  };

  const loadSamplePiano = async () => {
    setIsLoading(true);
    setSfName("SAMPLE UPRIGHT PIANO");
    try {
      // Small but good quality piano soundfont
      await loadSoundFontFromUrl("https://spessasynth.js.org/soundfonts/default.sf2");
    } catch (error) {
      console.error("Failed to load sample piano", error);
      setSfName("LOAD ERROR");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePower = async () => {
    if (!isReady) {
      await initSynth();
    }
    setIsPowerOn(!isPowerOn);
  };

  useEffect(() => {
    if (isReady && isPowerOn) {
      setVolume(volume);
      setPan(pan);
      setReverb(reverb);
      setChorus(chorus);
    }
  }, [isReady, isPowerOn, volume, pan, reverb, chorus, setVolume, setPan, setReverb, setChorus]);

  useEffect(() => {
    setVolume(volume);
  }, [volume, setVolume]);

  useEffect(() => {
    setPan(pan);
  }, [pan, setPan]);

  return (
    <div className="flex flex-col h-screen bg-hw-bg text-hw-text">
      {/* Top Header */}
      <header className="h-14 border-bottom border-hw-border bg-hw-panel flex items-center justify-between px-6 shadow-md z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-hw-accent rounded-lg flex items-center justify-center shadow-lg">
            <Activity className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tighter text-white">EVOLUTION PLAY</h1>
            <p className="text-[10px] font-mono text-hw-text-dim uppercase tracking-widest">Digital Sample Station</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-full border border-hw-border">
            <div className={`w-2 h-2 rounded-full ${selectedMidiId ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
            <select 
              className="bg-transparent text-xs font-mono outline-none cursor-pointer text-hw-text-dim"
              value={selectedMidiId || ''}
              onChange={(e) => setSelectedMidiId(e.target.value)}
            >
              <option value="">NO MIDI DEVICE</option>
              {midiDevices.map(device => (
                <option key={device.id} value={device.id}>{device.name}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={togglePower}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md border transition-all ${
              isPowerOn 
                ? 'bg-hw-accent border-hw-accent text-white shadow-[0_0_15px_rgba(242,125,38,0.4)]' 
                : 'bg-hw-panel border-hw-border text-hw-text-dim hover:border-hw-text'
            }`}
          >
            <Power className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">{isPowerOn ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Browser/Settings */}
        <aside className="w-64 border-r border-hw-border bg-hw-panel/50 flex flex-col">
          <div className="p-4 border-b border-hw-border">
            <h3 className="text-[10px] font-mono uppercase text-hw-text-dim mb-4 tracking-widest">Sound Library</h3>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-4 bg-hw-accent/20 border-2 border-dashed border-hw-accent/40 rounded-xl hover:border-hw-accent hover:bg-hw-accent/30 transition-all group shadow-lg"
              >
                <Plus className="w-5 h-5 text-hw-accent" />
                <span className="text-sm font-bold uppercase tracking-tight">Import SF2 Timbre</span>
              </button>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".sf2" 
              className="hidden" 
              onChange={handleFileUpload}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-10 gap-3"
                >
                  <div className="w-8 h-8 border-2 border-hw-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-mono text-hw-accent uppercase animate-pulse">Loading Samples...</p>
                </motion.div>
              ) : (
                <motion.div 
                  key="library"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  {/* Active Sound Display */}
                  {sfName && (
                    <div className="p-3 bg-hw-accent/10 border border-hw-accent/20 rounded-lg flex items-start gap-3">
                      <Music className="w-4 h-4 text-hw-accent shrink-0 mt-0.5" />
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-white truncate">{sfName}</p>
                        <p className="text-[10px] text-hw-accent uppercase font-mono mt-1">Active Sound</p>
                      </div>
                    </div>
                  )}

                  {/* Library List */}
                  <div className="space-y-4">
                    {/* Server Library */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between px-1 mb-2">
                        <span className="text-[10px] font-mono uppercase text-hw-text-dim">Server Library</span>
                        <span className="text-[10px] font-mono text-hw-text-dim">{library.length}</span>
                      </div>
                      
                      {library.length === 0 ? (
                        <div className="py-4 text-center border border-dashed border-hw-border rounded-lg opacity-30">
                          <p className="text-[8px] uppercase font-mono">No files on server</p>
                        </div>
                      ) : (
                        library.map((fileName) => (
                          <div 
                            key={fileName}
                            onClick={() => loadFromLibrary(fileName)}
                            className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-all ${
                              sfName === fileName.toUpperCase() 
                                ? 'bg-hw-accent/20 border border-hw-accent/30' 
                                : 'hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <PianoIcon className={`w-3 h-3 ${sfName === fileName.toUpperCase() ? 'text-hw-accent' : 'text-hw-text-dim'}`} />
                              <span className="text-[11px] truncate text-hw-text-dim group-hover:text-hw-text transition-colors">
                                {fileName}
                              </span>
                            </div>
                            <button 
                              onClick={(e) => deleteFromLibrary(fileName, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Local Library (IndexedDB) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between px-1 mb-2">
                        <span className="text-[10px] font-mono uppercase text-hw-text-dim">Local Memory</span>
                        <span className="text-[10px] font-mono text-hw-text-dim">{localLibrary.length}</span>
                      </div>
                      
                      {localLibrary.length === 0 ? (
                        <div className="py-4 text-center border border-dashed border-hw-border rounded-lg opacity-30">
                          <p className="text-[8px] uppercase font-mono">No local files</p>
                        </div>
                      ) : (
                        localLibrary.map((item) => (
                          <div 
                            key={item.id}
                            onClick={() => loadFromLocal(item)}
                            className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-all ${
                              sfName === item.name.toUpperCase() 
                                ? 'bg-hw-accent/20 border border-hw-accent/30' 
                                : 'hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <Activity className={`w-3 h-3 ${sfName === item.name.toUpperCase() ? 'text-hw-accent' : 'text-hw-text-dim'}`} />
                              <span className="text-[11px] truncate text-hw-text-dim group-hover:text-hw-text transition-colors">
                                {item.name}
                              </span>
                            </div>
                            <button 
                              onClick={(e) => deleteFromLocal(item.id, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-4 border-t border-hw-border bg-black/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase text-hw-text-dim">Engine Status</span>
              <span className={`text-[10px] font-mono ${isReady ? 'text-green-500' : 'text-red-500'}`}>
                {isReady ? 'READY (HI-FI)' : 'NOT READY'}
              </span>
            </div>
            <div className="w-full h-1 bg-hw-border rounded-full overflow-hidden">
              <motion.div 
                className={`h-full ${isReady ? 'bg-hw-accent' : 'bg-red-500'}`}
                animate={{ width: isReady ? '100%' : '10%' }}
              />
            </div>
            {!isReady ? (
              <div className="mt-2">
                <p className="text-[8px] text-red-400 uppercase font-mono leading-tight mb-2">
                  Library not loaded. Using basic oscillators.
                </p>
                <button 
                  onClick={() => initSynth()}
                  className="w-full py-1 bg-hw-accent/20 border border-hw-accent/40 rounded text-[8px] font-bold uppercase hover:bg-hw-accent/40 transition-all"
                >
                  Retry Initialization
                </button>
              </div>
            ) : (
              <p className="text-[8px] text-green-500 mt-2 uppercase font-mono leading-tight">
                FluidSynth active. Real samples enabled.
              </p>
            )}
          </div>
        </aside>

        {/* Mixer Area */}
        <div className="flex-1 bg-[#121214] flex overflow-x-auto p-6 gap-4">
          {/* Master Channel Strip */}
          <div className="flex flex-col bg-hw-panel border border-hw-border rounded-xl shadow-2xl min-w-[140px] overflow-hidden">
            <div className="p-3 bg-black/40 border-b border-hw-border flex items-center justify-between">
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">Master</span>
              <Sliders className="w-3 h-3 text-hw-accent" />
            </div>
            
            <div className="flex-1 flex flex-col items-center py-6 px-4 gap-8">
              {/* EQ Section */}
              <div className="grid grid-cols-1 gap-6">
                <Knob label="Reverb" value={reverb * 100} onChange={(v) => setReverb(v / 100)} unit="%" />
                <Knob label="Chorus" value={chorus * 100} onChange={(v) => setChorus(v / 100)} unit="%" />
              </div>

              <div className="w-full h-[1px] bg-hw-border" />

              {/* Pan */}
              <Knob label="Pan" value={pan * 50 + 50} onChange={(v) => setP((v - 50) / 50)} min={0} max={100} />

              {/* Fader */}
              <Fader value={volume} onChange={setVol} label="Volume" />
            </div>

            <div className="p-3 bg-black/40 border-t border-hw-border flex justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-hw-accent animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-hw-accent/30" />
            </div>
          </div>

          {/* Instrument Channel (Active) */}
          <div className="flex flex-col bg-hw-panel border border-hw-border rounded-xl shadow-2xl min-w-[200px] overflow-hidden">
            <div className="p-3 bg-black/40 border-b border-hw-border flex items-center justify-between">
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">Instrument</span>
              <PianoIcon className="w-3 h-3 text-hw-accent" />
            </div>
            
            <div className="flex-1 flex flex-col p-3 gap-4 overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {presets.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 text-center p-4">
                    <Music className="w-8 h-8 mb-2" />
                    <p className="text-[10px] uppercase font-mono">No Presets Loaded</p>
                  </div>
                ) : (
                  presets.map((p, idx) => (
                    <button
                      key={`${p.bank}-${p.program}-${idx}`}
                      onClick={() => setInstrument(p.bank, p.program)}
                      className={`w-full text-left p-2 rounded text-[10px] font-mono truncate transition-all ${
                        selectedPreset === p.program && selectedBank === p.bank
                          ? 'bg-hw-accent text-white shadow-lg'
                          : 'hover:bg-white/5 text-hw-text-dim'
                      }`}
                    >
                      {p.bank}:{p.program.toString().padStart(3, '0')} - {p.presetName || p.name || 'Unnamed'}
                    </button>
                  ))
                )}
              </div>

              <div className="w-full h-[1px] bg-hw-border" />
              
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[8px] font-mono text-hw-text-dim uppercase">
                  <span>Bank: {selectedBank}</span>
                  <span>Prog: {selectedPreset}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-black/40 border-t border-hw-border flex justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-hw-accent" />
            </div>
          </div>

          {/* Instrument Channel (Placeholder for more channels) */}
          <div className="flex flex-col bg-hw-panel/40 border border-hw-border/50 rounded-xl min-w-[140px] overflow-hidden opacity-60 grayscale">
            <div className="p-3 bg-black/20 border-b border-hw-border/50 flex items-center justify-between">
              <span className="text-[10px] font-bold text-hw-text-dim uppercase tracking-widest">CH 02</span>
            </div>
            <div className="flex-1 flex flex-col items-center py-6 px-4 gap-8">
              <div className="grid grid-cols-1 gap-6 opacity-50">
                <Knob label="High" value={0} onChange={() => {}} />
                <Knob label="Mid" value={0} onChange={() => {}} />
                <Knob label="Low" value={0} onChange={() => {}} />
              </div>
              <div className="w-full h-[1px] bg-hw-border/30" />
              <Knob label="Pan" value={50} onChange={() => {}} />
              <Fader value={0.5} onChange={() => {}} label="Volume" />
            </div>
          </div>
        </div>
      </main>

      {/* Virtual Keyboard / Footer */}
      <footer className="h-40 bg-hw-panel border-t border-hw-border flex flex-col">
        <div className="h-8 bg-black/40 border-b border-hw-border flex items-center px-6 justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <KeyboardIcon className="w-3 h-3 text-hw-text-dim" />
              <span className="text-[10px] font-mono text-hw-text-dim uppercase">Virtual Keyboard</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono text-hw-text-dim uppercase">Latency: 12ms</span>
            <span className="text-[10px] font-mono text-hw-text-dim uppercase">CPU: 4%</span>
          </div>
        </div>
        
        <div className="flex-1 flex p-2 gap-1 overflow-x-auto">
          {[...Array(36)].map((_, i) => {
            const note = i + 48; // Start from C3
            const isBlack = [1, 3, 6, 8, 10].includes(note % 12);
            return (
              <button
                key={note}
                onMouseDown={() => noteOn(note)}
                onMouseUp={() => noteOff(note)}
                onMouseLeave={() => noteOff(note)}
                className={`
                  relative flex-1 min-w-[30px] rounded-b-md transition-all active:scale-95
                  ${isBlack 
                    ? 'bg-black h-2/3 z-10 -mx-3 border-x border-hw-border hover:bg-zinc-800' 
                    : 'bg-white h-full border border-hw-border hover:bg-zinc-100'}
                `}
              >
                {!isBlack && (
                  <span className="absolute bottom-2 left-0 right-0 text-[8px] text-black/30 font-bold text-center">
                    {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][note % 12]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </footer>
    </div>
  );
}
