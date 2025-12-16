
import React, { useEffect, useRef, useState } from 'react';

interface SirenProps {
  active: boolean;
  residentName?: string;
  providedContext?: AudioContext | null;
  sirenDuration?: number; // Durasi sirine sebelum ngomong (ms)
  voiceEnabled?: boolean; // Toggle suara google
}

// Base64 dari file MP3 hening (1 detik). 
// Memutar ini secara looping memaksa browser tetap menjalankan Javascript di background/saat layar mati.
const SILENT_MP3 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTSSEAAAAAPAAADEJNUEkzLjUBAAAAAAAAAAAAAAABAAAABDAAAAAAAAAAAAAAABAAAAEAAACAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADEJNUEkzLjUBAAAAAAAAAAAAAAABAAAABDAAAAAAAAAAAAAAABAAAAEAAACAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const Siren: React.FC<SirenProps> = ({ 
  active, 
  residentName = "Warga", 
  providedContext, 
  sirenDuration = 4000, // Default 4 detik sirine
  voiceEnabled = true 
}) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);
  
  // Refs untuk menjaga objek tetap hidup di memori (Anti Garbage Collection)
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const resumeIntervalRef = useRef<any>(null);
  
  const timerRef = useRef<any>(null);
  const isMounted = useRef(true);
  const activeRef = useRef(active);

  // State untuk melacak fase loop: 'SIREN' atau 'VOICE'
  const [phase, setPhase] = useState<'SIREN' | 'VOICE'>('SIREN');

  // Update activeRef setiap render
  activeRef.current = active;

  // Pre-load voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => { window.speechSynthesis.getVoices(); };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;

    if (active) {
      // 1. Jalankan mekanisme Keep Alive (Silent Audio)
      playSilentAudio();
      
      // 2. Force Resume Interval
      // Browser modern (terutama iOS & Chrome Android) cenderung men-suspend SpeechSynthesis saat layar mati.
      // Interval ini "membangunkan" engine setiap 2 detik.
      if (resumeIntervalRef.current) clearInterval(resumeIntervalRef.current);
      resumeIntervalRef.current = setInterval(() => {
          if ('speechSynthesis' in window) {
              if (window.speechSynthesis.paused) {
                  // console.log("Force resuming speech...");
                  window.speechSynthesis.resume();
              }
          }
      }, 2000);

      // 3. Mulai siklus Sirine/Suara
      startCycle();
    } else {
      // Matikan total
      cleanupAll();
    }

    return () => {
      isMounted.current = false;
      cleanupAll();
    };
  }, [active, residentName, sirenDuration, voiceEnabled, providedContext]);

  // --- KEEP ALIVE MECHANISM ---
  const playSilentAudio = () => {
    if (!silentAudioRef.current) {
        silentAudioRef.current = new Audio(SILENT_MP3);
        silentAudioRef.current.loop = true;
        silentAudioRef.current.volume = 0.01; // Volume sangat kecil
    }
    
    // Perlu interaksi user sebelumnya agar play() berhasil tanpa error.
    const promise = silentAudioRef.current.play();
    if (promise !== undefined) {
        promise.catch(e => {
            // console.warn("Silent audio background playback blocked:", e);
        });
    }
  };

  const stopSilentAudio = () => {
    if (silentAudioRef.current) {
        silentAudioRef.current.pause();
        silentAudioRef.current.currentTime = 0;
    }
  };

  // --- CYCLE LOGIC ---
  const startCycle = () => {
    // Reset fase ke Sirine dulu
    runSirenPhase();
  };

  const runSirenPhase = () => {
    if (!isMounted.current || !activeRef.current) return;
    
    setPhase('SIREN');
    playSirenSound();

    // Jadwalkan pindah ke Voice setelah durasi tertentu
    timerRef.current = setTimeout(() => {
      stopSirenSound(); // Matikan sirine fisik
      if (voiceEnabled) {
        runVoicePhase();
      } else {
        // Jika voice dimatikan, loop sirine saja (reset timer sirine)
        runSirenPhase(); 
      }
    }, sirenDuration);
  };

  const runVoicePhase = () => {
    if (!isMounted.current || !activeRef.current) return;

    setPhase('VOICE');
    
    // Gunakan Web Speech API
    if ('speechSynthesis' in window) {
      // Pastikan tidak ada antrian bicara sebelumnya
      window.speechSynthesis.cancel();

      // Clean text to prevent syntax errors
      const cleanName = residentName.replace(/[^a-zA-Z0-9 ]/g, " ");
      
      const utterance = new SpeechSynthesisUtterance(`Perhatian perhatian. Saat ini warga lingkungan RT Lima RW lima atas nama ${cleanName} memerlukan bantuan. Mohon para warga segera menuju ke lokasi. Terima kasih.`);
      
      const voices = window.speechSynthesis.getVoices();
      
      // 1. Cari suara Indonesia
      const indoVoices = voices.filter(v => v.lang.toLowerCase().includes('id-'));

      let targetVoice = null;

      // 2. Prioritas: Google / Wanita / Female
      targetVoice = indoVoices.find(v => 
        v.name.toLowerCase().includes('google') ||
        v.name.toLowerCase().includes('female') || 
        v.name.toLowerCase().includes('wanita')
      );

      // 3. Fallback: Ambil suara Indonesia apa saja
      if (!targetVoice && indoVoices.length > 0) {
          targetVoice = indoVoices[0];
      }

      if (targetVoice) {
          utterance.voice = targetVoice;
      }

      // --- SETTING KARAKTER SUARA ---
      utterance.lang = 'id-ID';
      
      // Pitch: 1.0 (Normal - Cenderung Perempuan/Netral)
      utterance.pitch = 1.0; 

      // Rate: 1.0 (Normal)
      utterance.rate = 1.0; 
      
      utterance.volume = 1.0;

      // PENTING: Simpan ke ref agar tidak di-Garbage Collect saat layar mati
      utteranceRef.current = utterance;

      utterance.onend = () => {
        // Setelah selesai bicara, kembali ke Sirine
        if (isMounted.current && activeRef.current) {
            timerRef.current = setTimeout(() => runSirenPhase(), 500);
        }
      };

      utterance.onerror = (e) => {
        // Ignore interruption errors (triggered by cancel())
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        
        console.warn("Speech synthesis error:", e.error);
        // Fallback jika error, kembali ke sirine
        if (isMounted.current && activeRef.current) {
            timerRef.current = setTimeout(() => runSirenPhase(), 500);
        }
      };

      try {
          window.speechSynthesis.speak(utterance);
          // HACK: Double check resume untuk iOS
          if (window.speechSynthesis.paused) {
              window.speechSynthesis.resume();
          }
      } catch (err) {
          console.error("Speech speak execution error:", err);
          runSirenPhase();
      }

    } else {
      // Browser tidak support TTS, fallback ke sirine loop
      runSirenPhase();
    }
  };

  const cleanupAll = () => {
    stopSirenSound();
    stopSilentAudio();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (resumeIntervalRef.current) clearInterval(resumeIntervalRef.current);
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
  };

  // --- AUDIO LOGIC (Oscillator) ---
  const playSirenSound = () => {
    try {
      let ctx = providedContext;
      if (!ctx) {
         if (!audioContextRef.current) {
             const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
             audioContextRef.current = new AudioContext();
         }
         ctx = audioContextRef.current;
      }
      
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      // Hentikan suara lama jika tumpeng tindih
      stopSirenSound();

      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      gain.connect(ctx.destination);
      gainNodeRef.current = gain;

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.connect(gain);
      oscillatorRef.current = osc;

      const lfo = ctx.createOscillator();
      lfo.type = 'triangle';
      lfo.frequency.value = 0.5; 
      
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 400; 
      
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      
      lfo.start();
      osc.start();

      lfoRef.current = lfo;
      lfoGainRef.current = lfoGain;

    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  const stopSirenSound = () => {
    try {
        if (oscillatorRef.current) { oscillatorRef.current.stop(); oscillatorRef.current.disconnect(); oscillatorRef.current = null; }
        if (lfoRef.current) { lfoRef.current.stop(); lfoRef.current.disconnect(); lfoRef.current = null; }
        if (lfoGainRef.current) { lfoGainRef.current.disconnect(); lfoGainRef.current = null; }
        if (gainNodeRef.current) { gainNodeRef.current.disconnect(); gainNodeRef.current = null; }
    } catch (e) {}
  };

  return null;
};

export default Siren;
