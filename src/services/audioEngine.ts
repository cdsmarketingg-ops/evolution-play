import React, { useEffect, useState, useRef } from 'react';

/**
 * Motor de Som Nativo (Evolution Engine)
 * 100% Offline e Independente de bibliotecas externas.
 * Utiliza a Web Audio API para síntese e reprodução de samples.
 */

export const useSynthesizer = () => {
  const [isReady, setIsReady] = useState(false);
  const [midiDevices, setMidiDevices] = useState<MIDIInput[]>([]);
  const [selectedMidiId, setSelectedMidiId] = useState<string | null>(null);
  
  const [presets, setPresets] = useState<any[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<number>(0);
  const [selectedBank, setSelectedBank] = useState<number>(0);
  const [reverb, setReverbLevel] = useState<number>(0.2);
  const [chorus, setChorusLevel] = useState<number>(0.1);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const pannerRef = useRef<StereoPannerNode | null>(null);
  const synthRef = useRef<any>(null);
  const activeVoices = useRef<Map<number, any>>(new Map());

  const initSynth = async () => {
    // Se já temos o synth, não reinicializamos a menos que ele tenha falhado
    if (audioContextRef.current && synthRef.current) return;
    
    if (!audioContextRef.current) {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      audioContextRef.current = new AudioContextClass();
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    // Cadeia de áudio: Synth -> Master Gain -> Panner -> Destination
    masterGainRef.current = audioContextRef.current.createGain();
    pannerRef.current = audioContextRef.current.createStereoPanner();
    
    masterGainRef.current.connect(pannerRef.current);
    pannerRef.current.connect(audioContextRef.current.destination);

    masterGainRef.current.gain.value = 0.8;

    // Inicializar SpessaSynth se disponível
    if ((window as any).SpessaSynth) {
      try {
        const Spessa = (window as any).SpessaSynth;
        const SynthClass = Spessa.Synthetizer || Spessa.Synthesizer;
        if (SynthClass) {
          synthRef.current = new SynthClass(masterGainRef.current);
          console.log("✅ SpessaSynth inicializado com sucesso!");
          setIsReady(true);
        } else {
          console.error("❌ Classe Synthetizer não encontrada no SpessaSynth. Verifique as exportações.");
          setIsReady(false);
        }
      } catch (e) {
        console.error("Erro ao inicializar SpessaSynth:", e);
        setIsReady(false);
      }
    } else {
      console.warn("⚠️ SpessaSynth não encontrado no window. Tentando novamente em 1s...");
      setTimeout(initSynth, 1000);
      setIsReady(false);
    }

    console.log("✅ Motor de Som Nativo (Evolution Engine) iniciado!");
  };

  const loadSoundFont = async (buffer: ArrayBuffer) => {
    if (synthRef.current && (window as any).SpessaSynth) {
      try {
        const Spessa = (window as any).SpessaSynth;
        // No SpessaSynth moderno, precisamos criar um objeto SoundFont2 a partir do buffer
        const sf = new Spessa.SoundFont2(buffer);
        synthRef.current.loadSoundFont(sf);
        
        console.log("✅ SoundFont carregado com sucesso no SpessaSynth.");
        
        // Obter lista de presets
        if (synthRef.current.soundfont && synthRef.current.soundfont.presets) {
          const sfPresets = synthRef.current.soundfont.presets.map((p: any) => ({
            bank: p.bank,
            program: p.program,
            name: p.presetName || p.name || `Preset ${p.program}`
          }));
          setPresets(sfPresets);
          
          // Selecionar o primeiro preset disponível
          if (sfPresets.length > 0) {
            setInstrument(sfPresets[0].bank, sfPresets[0].program);
          }
        }
      } catch (e) {
        console.error("Erro ao carregar SoundFont no SpessaSynth:", e);
      }
    } else {
      console.warn("SpessaSynth não disponível para carregar o buffer.");
    }
  };

  const setInstrument = (bank: number, program: number) => {
    if (synthRef.current) {
      synthRef.current.programChange(0, program);
      synthRef.current.bankSelect(0, bank);
      setSelectedBank(bank);
      setSelectedPreset(program);
      console.log(`🎹 Instrumento alterado: Bank ${bank}, Program ${program}`);
    }
  };

  const loadSoundFontFromUrl = async (url: string) => {
    if (synthRef.current && (window as any).SpessaSynth) {
      try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const Spessa = (window as any).SpessaSynth;
        const sf = new Spessa.SoundFont2(buffer);
        synthRef.current.loadSoundFont(sf);
        console.log(`✅ SoundFont carregado de URL: ${url}`);
      } catch (e) {
        console.error("Erro ao carregar SoundFont de URL:", e);
      }
    } else {
      console.warn("Carregamento via URL desativado ou SpessaSynth não inicializado.");
    }
  };

  const noteOn = async (note: number, velocity: number = 100) => {
    if (!audioContextRef.current || !masterGainRef.current) {
      console.warn("⚠️ AudioContext ou MasterGain não inicializados.");
      return;
    }

    // Garantir que o contexto está rodando (importante para navegadores)
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    console.log(`🎵 Tocando nota: ${note} (Vel: ${velocity})`);

    if (synthRef.current) {
      // Usar SpessaSynth
      synthRef.current.noteOn(0, note, velocity);
      activeVoices.current.set(note, true);
    } else {
      // Fallback para osciladores básicos (Som "Moog" Sawtooth)
      console.warn(`⚠️ Usando fallback de oscilador para nota ${note}. SpessaSynth não está ativo.`);
      const freq = 440 * Math.pow(2, (note - 69) / 12);
      
      const osc1 = audioContextRef.current.createOscillator();
      const osc2 = audioContextRef.current.createOscillator();
      const voiceGain = audioContextRef.current.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.value = freq;
      osc2.frequency.value = freq / 2;

      voiceGain.gain.value = (velocity / 127) * 0.3;

      osc1.connect(voiceGain);
      osc2.connect(voiceGain);
      voiceGain.connect(masterGainRef.current);

      const now = audioContextRef.current.currentTime;
      voiceGain.gain.setValueAtTime(0, now);
      voiceGain.gain.linearRampToValueAtTime((velocity / 127) * 0.3, now + 0.01);

      osc1.start();
      osc2.start();

      activeVoices.current.set(note, [osc1, osc2, voiceGain as any]);
    }
  };

  const noteOff = (note: number) => {
    if (synthRef.current) {
      synthRef.current.noteOff(0, note);
      activeVoices.current.delete(note);
      return;
    }

    const voice = activeVoices.current.get(note);
    if (voice && audioContextRef.current) {
      const [osc1, osc2, gain] = voice;
      const now = audioContextRef.current.currentTime;
      
      (gain as any).gain.cancelScheduledValues(now);
      (gain as any).gain.setValueAtTime((gain as any).gain.value, now);
      (gain as any).gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      
      setTimeout(() => {
        osc1.stop();
        osc2.stop();
      }, 150);
      
      activeVoices.current.delete(note);
    }
  };

  const setVolume = (val: number) => {
    if (masterGainRef.current && audioContextRef.current) {
      // val vem do fader (0 a 1)
      const targetGain = Math.max(0, Math.min(1, val));
      masterGainRef.current.gain.setTargetAtTime(targetGain, audioContextRef.current.currentTime, 0.05);
      console.log(`🔊 Volume ajustado para: ${targetGain}`);
    }
  };

  const setPan = (val: number) => {
    if (pannerRef.current) {
      pannerRef.current.pan.setTargetAtTime(val, audioContextRef.current?.currentTime || 0, 0.05);
    }
  };

  const setReverb = (val: number) => {
    if (synthRef.current) {
      // SpessaSynth reverb is usually 0 to 1
      synthRef.current.reverbLevel = val;
      setReverbLevel(val);
    }
  };

  const setChorus = (val: number) => {
    if (synthRef.current) {
      // SpessaSynth chorus is usually 0 to 1
      synthRef.current.chorusLevel = val;
      setChorusLevel(val);
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
    midiDevices,
    selectedMidiId,
    setSelectedMidiId,
    synth: null
  };
};
