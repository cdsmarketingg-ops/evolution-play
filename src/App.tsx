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
  ChevronRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSynthesizer } from './services/audioEngine';

const Knob = ({ label, value, onChange, min = 0, max = 1, step = 0.01 }: { 
  label: string, 
  value: number, 
  onChange: (v: number) => void,
  min?: number,
  max?: number,
  step?: number
}) => {
  const rotation = ((value - min) / (max - min)) * 270 - 135;
  
  return (
    <div className="flex flex-col items-center gap-2 group">
      <span className="text-[9px] uppercase font-bold text-hw-text-dim group-hover:text-hw-accent transition-colors">
        {label}
      </span>
      <div className="relative w-16 h-16 bg-hw-bg rounded-full border-2 border-hw-border flex items-center justify-center group cursor-ns-resize">
        <div 
          className="absolute w-1 h-6 bg-hw-accent rounded-full origin-bottom transition-transform duration-75"
          style={{ transform: `rotate(${rotation}deg)`, bottom: '50%' }}
        ></div>
        <input 
          type="range" 
          min={min} 
          max={max} 
          step={step} 
          value={value} 
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 opacity-0 cursor-ns-resize"
        />
        <div className="absolute -bottom-6 text-[10px] font-mono text-hw-text-dim">
          {label === 'Pan' ? (value < -0.1 ? 'L' : value > 0.1 ? 'R' : 'C') : `${Math.round(value * 100)}%`}
        </div>
      </div>
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
    noteOn,
    noteOff,
    activeNotes
  } = useSynthesizer();

  const [volume, setVol] = useState(0.8);
  const [pan, setP] = useState(0); // -1 to 1
  const [sfName, setSfName] = useState<string | null>(null);
  const [isPowerOn, setIsPowerOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [library, setLibrary] = useState<string[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);

  // Load library from server
  const loadLibrary = async () => {
    try {
      const response = await fetch('/api/soundfonts');
      const data = await response.json();
      setLibrary(data);
    } catch (err) {
      console.error("Failed to load library", err);
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
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        await loadLibrary();
        const data = await response.json();
        setSfName(data.filename.toUpperCase());
        
        const buffer = await file.arrayBuffer();
        await loadSoundFont(buffer);
      }
    } catch (error) {
      console.error("Failed to upload soundfont", error);
      alert("Erro ao enviar o arquivo .sf2 para o servidor");
    } finally {
      setIsLoading(false);
    }
  };

  const loadFromLibrary = async (fileName: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/soundfonts/${fileName}`);
      const buffer = await response.arrayBuffer();
      await loadSoundFont(buffer);
      setSfName(fileName.toUpperCase());
    } catch (error) {
      console.error("Failed to load from library", error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteFromLibrary = async (fileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Remover "${fileName}" permanentemente do servidor?`)) {
      await fetch(`/api/soundfonts/${fileName}`, { method: 'DELETE' });
      await loadLibrary();
      if (sfName === fileName.toUpperCase()) setSfName(null);
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
    }
  }, [isReady, isPowerOn, volume, pan, setVolume, setPan]);

  useEffect(() => {
    setVolume(volume);
  }, [volume, setVolume]);

  useEffect(() => {
    setPan(pan);
  }, [pan, setPan]);

  return (
    <div className="h-screen w-screen bg-hw-bg text-hw-text font-sans flex flex-col overflow-hidden">
      {/* Main Sforzando Panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl bg-hw-panel border-2 border-hw-border rounded-sm shadow-2xl overflow-hidden flex flex-col">
          
          {/* Top Bar / Logo */}
          <div className="bg-gradient-to-b from-hw-border/50 to-transparent p-2 border-b border-hw-border flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="bg-hw-accent px-2 py-0.5 rounded-sm text-[10px] font-black text-black uppercase tracking-tighter">EVOLUTION</div>
              <div className="text-[10px] font-bold text-hw-text-dim uppercase tracking-widest">PLAY v2.0</div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowLibrary(!showLibrary)}
                className="text-[10px] uppercase font-bold text-hw-text-dim hover:text-hw-accent transition-colors"
              >
                Instrument
              </button>
              <button className="text-[10px] uppercase font-bold text-hw-text-dim hover:text-hw-accent transition-colors">Settings</button>
              <button className="text-[10px] uppercase font-bold text-hw-text-dim hover:text-hw-accent transition-colors">Info</button>
            </div>
          </div>

          {/* Main Control Area */}
          <div className="p-6 flex gap-8 items-start relative">
            
            {/* Left: LCD Display */}
            <div className="flex-1">
              <div className="mb-1 flex justify-between items-end">
                <span className="text-[9px] uppercase font-bold text-hw-text-dim">Loaded Instrument</span>
                <span className="text-[9px] uppercase font-bold text-hw-text-dim">Poly: 128</span>
              </div>
              <div className="bg-hw-display border border-hw-border p-4 rounded-sm h-24 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-hw-lcd/5 pointer-events-none"></div>
                {isLoading ? (
                  <div className="flex items-center gap-2 text-hw-lcd animate-pulse">
                    <div className="w-2 h-2 bg-hw-lcd rounded-full"></div>
                    <span className="font-mono text-sm uppercase tracking-widest">Loading...</span>
                  </div>
                ) : (
                  <>
                    <div className="text-hw-lcd font-mono text-lg truncate uppercase tracking-tighter">
                      {sfName || "NO INSTRUMENT LOADED"}
                    </div>
                    <div className="text-hw-lcd/40 font-mono text-[10px] mt-1">
                      {sfName ? "SF2 ENGINE | 44.1KHZ | 24BIT" : "PLEASE SELECT A SOUNDFONT"}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right: Main Knobs */}
            <div className="flex gap-6">
              <Knob label="Volume" value={volume} onChange={setVol} />
              <Knob label="Pan" value={pan} onChange={setP} min={-1} max={1} />
            </div>

            {/* Library Overlay */}
            <AnimatePresence>
              {showLibrary && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 z-50 bg-hw-panel border border-hw-border p-4 flex flex-col"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-hw-text-dim">Instrument Browser</h3>
                    <button onClick={() => setShowLibrary(false)} className="text-hw-text-dim hover:text-hw-accent">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                    {library.length === 0 ? (
                      <div className="py-10 text-center border border-dashed border-hw-border rounded-lg opacity-30">
                        <FolderOpen className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-[10px] uppercase font-mono">Empty Server Folder</p>
                      </div>
                    ) : (
                      library.map((fileName) => (
                        <div 
                          key={fileName}
                          onClick={() => { loadFromLibrary(fileName); setShowLibrary(false); }}
                          className={`group flex items-center justify-between p-2 rounded-sm cursor-pointer transition-all ${
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Controls / MIDI */}
          <div className="px-6 pb-6 flex justify-between items-center">
            <div className="flex gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase font-bold text-hw-text-dim">MIDI Input</span>
                <select 
                  value={selectedMidiId || ""} 
                  onChange={(e) => setSelectedMidiId(e.target.value)}
                  className="bg-hw-bg border border-hw-border text-[10px] text-hw-text px-2 py-1 rounded-sm outline-none focus:border-hw-accent"
                >
                  <option value="">No MIDI Device</option>
                  {midiDevices.map(device => (
                    <option key={device.id} value={device.id}>{device.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase font-bold text-hw-text-dim">Action</span>
                <label className="bg-hw-bg border border-hw-border text-[10px] text-hw-text px-3 py-1 rounded-sm cursor-pointer hover:bg-hw-border transition-colors uppercase font-bold">
                  Import SF2
                  <input type="file" ref={fileInputRef} accept=".sf2" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            <button 
              onClick={togglePower}
              className={`px-6 py-2 rounded-sm font-black uppercase tracking-widest text-xs transition-all border-2 ${
                isPowerOn 
                  ? 'bg-hw-accent text-black border-hw-accent shadow-[0_0_15px_rgba(242,125,38,0.4)]' 
                  : 'bg-transparent text-hw-text-dim border-hw-border'
              }`}
            >
              {isPowerOn ? 'POWER ON' : 'POWER OFF'}
            </button>
          </div>

          {/* Keyboard Section */}
          <div className="bg-hw-bg p-4 border-t border-hw-border">
            <div className="relative h-32 flex select-none">
              {Array.from({ length: 25 }).map((_, i) => {
                const midiNote = 48 + i;
                const isBlack = [1, 3, 6, 8, 10, 13, 15, 18, 20, 22].includes(i);
                
                if (isBlack) return null;

                return (
                  <div
                    key={midiNote}
                    onMouseDown={() => noteOn(midiNote)}
                    onMouseUp={() => noteOff(midiNote)}
                    onMouseLeave={() => noteOff(midiNote)}
                    className={`relative flex-1 border-r border-black/20 last:border-r-0 transition-all cursor-pointer ${
                      activeNotes.has(midiNote) 
                        ? 'bg-hw-accent' 
                        : 'bg-gradient-to-b from-white to-[#e0e0e0] hover:to-[#d0d0d0]'
                    } rounded-b-sm shadow-sm`}
                  >
                    {/* Black Keys */}
                    {[1, 3, 6, 8, 10, 13, 15, 18, 20, 22].includes(i + 1) && (
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); noteOn(midiNote + 1); }}
                        onMouseUp={(e) => { e.stopPropagation(); noteOff(midiNote + 1); }}
                        onMouseLeave={(e) => { e.stopPropagation(); noteOff(midiNote + 1); }}
                        className={`absolute top-0 -right-1/2 w-full h-20 z-10 transition-all ${
                          activeNotes.has(midiNote + 1) 
                            ? 'bg-hw-accent' 
                            : 'bg-gradient-to-b from-[#333] to-black hover:from-[#444]'
                        } rounded-b-md shadow-lg border-x border-b border-white/5`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
