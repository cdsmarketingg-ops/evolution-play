import { useEffect, useState, useRef } from 'react';

/**
 * Motor de Som Evolution (Sampler Real)
 * Integração com SpessaSynth para tocar arquivos .sf2 reais.
 */

declare const SpessaSynth: any;

export const useSynthesizer = () => {
  const [isReady, setIsReady] = useState(false);
  const [midiDevices, setMidiDevices] = useState<MIDIInput[]>([]);
  const [selectedMidiId, setSelectedMidiId] = useState<string | null>(null);
  
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const synthRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const initSynth = async () => {
    if (synthRef.current) return;
    
    // Verifica se a biblioteca carregou no window
    const SpessaSynthLib = (window as any).SpessaSynth;
    if (!SpessaSynthLib) {
      console.error("❌ Biblioteca SpessaSynth não encontrada no window. Aguardando...");
      alert("O motor de som ainda está carregando. Por favor, aguarde 2 segundos e tente novamente.");
      return;
    }

    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    audioContextRef.current = new AudioContextClass();

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    try {
      // No SpessaSynth 1.2.1+, a classe pode estar em SpessaSynth.Synthetizer
      synthRef.current = new SpessaSynthLib.Synthetizer(audioContextRef.current.destination);
      setIsReady(true);
      console.log("✅ Motor Sampler (SpessaSynth) iniciado com sucesso!");
    } catch (e) {
      console.error("Erro ao instanciar Synthetizer:", e);
    }
  };

  const loadSoundFont = async (buffer: ArrayBuffer) => {
    if (!synthRef.current) await initSynth();
    
    try {
      console.log("📦 Carregando SoundFont no Sampler...");
      await synthRef.current.loadSoundFont(buffer);
      console.log("✅ Timbre real carregado e pronto para tocar!");
    } catch (e) {
      console.error("Erro ao carregar SoundFont no motor:", e);
    }
  };

  const loadSoundFontFromUrl = async (url: string) => {
    try {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      await loadSoundFont(buffer);
    } catch (e) {
      console.error("Erro ao carregar SoundFont via URL:", e);
    }
  };

  const noteOn = (note: number, velocity: number = 100) => {
    if (!synthRef.current) return;
    // Canal 0, Nota, Velocidade
    synthRef.current.noteOn(0, note, velocity);
    setActiveNotes(prev => new Set(prev).add(note));
    console.log(`🎵 Sampler: Nota ${note} ON`);
  };

  const noteOff = (note: number) => {
    if (!synthRef.current) return;
    synthRef.current.noteOff(0, note);
    setActiveNotes(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  };

  const setVolume = (val: number) => {
    if (synthRef.current) {
      // Tenta setMainVolume ou propriedade volume
      if (typeof synthRef.current.setMainVolume === 'function') {
        synthRef.current.setMainVolume(val);
      } else {
        synthRef.current.volume = val;
      }
    }
  };

  const setPan = (val: number) => {
    if (synthRef.current) {
      // MIDI CC 10 é Pan (0-127)
      // val é -1 a 1 -> mapear para 0-127
      const panValue = Math.round(((val + 1) / 2) * 127);
      synthRef.current.controllerChange(0, 10, panValue);
    }
  };

  // MIDI Setup
  useEffect(() => {
    const setupMidi = async () => {
      try {
        const access = await navigator.requestMIDIAccess();
        const inputs = Array.from(access.inputs.values());
        setMidiDevices(inputs);
        access.onstatechange = () => setMidiDevices(Array.from(access.inputs.values()));
      } catch (e) {
        console.error("MIDI access denied", e);
      }
    };
    setupMidi();
  }, []);

  useEffect(() => {
    if (!selectedMidiId) return;
    const device = midiDevices.find(d => d.id === selectedMidiId);
    if (!device) return;

    const handleMidiMessage = (event: any) => {
      const [status, note, velocity] = event.data;
      const command = status & 0xf0;
      if (command === 0x90 && velocity > 0) noteOn(note, velocity);
      else if (command === 0x80 || (command === 0x90 && velocity === 0)) noteOff(note);
    };

    device.onmidimessage = handleMidiMessage;
    return () => { device.onmidimessage = null; };
  }, [selectedMidiId, midiDevices]);

  return {
    isReady,
    initSynth,
    loadSoundFont,
    loadSoundFontFromUrl,
    noteOn,
    noteOff,
    activeNotes,
    setVolume,
    setPan,
    midiDevices,
    selectedMidiId,
    setSelectedMidiId,
    synth: synthRef.current
  };
};
