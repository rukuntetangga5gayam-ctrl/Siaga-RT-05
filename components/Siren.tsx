
import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Zap, Megaphone, Timer, Info, VolumeX, Volume1, Volume } from 'lucide-react';
import { resolvePanic } from '../services/db';

interface SirenProps {
  active: boolean;
  isTest?: boolean;
  residentName?: string;
  residentRT?: string;
  emergencyType?: string;
  emergencyDescription?: string;
  providedContext?: AudioContext | null;
  sirenDuration?: number; 
  voiceEnabled?: boolean; 
  testType?: 'GENERAL' | 'NIGHT_PATROL' | 'MORNING_ALERT' | 'CUSTOM_ANNOUNCEMENT';
  customMessage?: string;
}

const Siren: React.FC<SirenProps> = ({ 
  active, 
  isTest = false,
  residentName = "Warga", 
  residentRT = "",
  emergencyType = "",
  emergencyDescription = "",
  providedContext, 
  sirenDuration = 4000,
  voiceEnabled = true,
  testType = 'GENERAL',
  customMessage = ""
}) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const resumeIntervalRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);
  const isMounted = useRef(true);
  const activeRef = useRef(active);
  const testCountRef = useRef(0);

  const [phase, setPhase] = useState<'SIREN' | 'VOICE' | 'CHIME'>('SIREN');
  const [timeLeft, setTimeLeft] = useState(sirenDuration);

  activeRef.current = active;

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
      if (resumeIntervalRef.current) clearInterval(resumeIntervalRef.current);
      resumeIntervalRef.current = setInterval(() => {
          if ('speechSynthesis' in window) {
              if (window.speechSynthesis.paused) {
                  window.speechSynthesis.resume();
              }
          }
      }, 2000);

      if (isTest) {
          testCountRef.current = 0;
          runTestCycle();
      } else {
          startCycle();
      }
    } else {
      cleanupAll();
    }

    return () => {
      isMounted.current = false;
      cleanupAll();
    };
  }, [active, isTest, residentName, residentRT, emergencyType, emergencyDescription, sirenDuration, voiceEnabled, providedContext, testType, customMessage]);

  const startCycle = () => {
    runSirenPhase();
  };

  const runSirenPhase = () => {
    if (!isMounted.current || !activeRef.current) return;
    setPhase('SIREN');
    setTimeLeft(sirenDuration);
    playSirenSound();

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    const startTime = Date.now();
    countdownIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, sirenDuration - elapsed);
        setTimeLeft(remaining);
        if (remaining <= 0) clearInterval(countdownIntervalRef.current);
    }, 50);

    timerRef.current = setTimeout(() => {
      stopSirenSound();
      if (voiceEnabled) {
        setTimeout(() => runVoicePhase(), 300);
      } else {
        runSirenPhase(); 
      }
    }, sirenDuration);
  };

  const runVoicePhase = () => {
    if (!isMounted.current || !activeRef.current) return;
    setPhase('VOICE');
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const cleanName = (residentName || "Warga").replace(/[^a-zA-Z0-9 ]/g, " ");
      const rtOnly = (residentRT || "").replace("RT ", "");
      const cleanRT = rtOnly || "05";
      
      let voiceMessage = "";
      if (isTest) {
          if (testType === 'NIGHT_PATROL') {
              voiceMessage = "Perhatian perhatian! Selamat malam kepada seluruh warga RW 05 Kelurahan Gayam, Kota Kediri. Jam menunjukkan waktu istirahat bagi kita semua. Sebagai langkah pencegahan keamanan, kami menghimbau Bapak dan Ibu untuk memastikan kembali seluruh pintu, jendela, dan pagar rumah telah terkunci rapat. Pastikan kendaraan bermotor telah diletakkan di tempat yang aman dan gunakan kunci pengaman tambahan. Mohon periksa kembali peralatan dapur dan matikan peralatan listrik yang tidak diperlukan. Kami ingatkan kembali, apabila Anda melihat pergerakan orang yang mencurigakan di sekitar rumah atau jika Anda sendiri sedang dalam situasi bahaya, jangan ragu untuk segera menekan tombol panik pada aplikasi Siaga RW 05 di handphone Anda. Sistem akan segera mengirimkan koordinat lokasi Anda ke pos keamanan dan warga sekitar untuk bantuan darurat. Mari kita bersama-sama menjaga lingkungan Gayam tetap kondusif. Selamat malam dan selamat beristirahat dengan tenang. Terima kasih.";
          } else if (testType === 'MORNING_ALERT') {
              voiceMessage = "Perhatian perhatian! Selamat pagi seluruh warga RW 05 Kelurahan Gayam Kota Kediri. Memasuki waktu beraktivitas, bagi warga yang akan berangkat bekerja atau meninggalkan rumah, mohon pastikan kembali seluruh pintu dan jendela sudah terkunci dengan aman. Periksa kembali kompor Anda, serta cabut aliran listrik yang tidak diperlukan untuk menghindari bahaya kebakaran. Bagi warga yang tetap berada di rumah, mari kita saling peduli dan menjaga kewaspadaan terhadap lingkungan sekitar kita. Jika Anda melihat orang asing dengan gerak-gerik mencurigakan, atau jika Anda sendiri sedang dalam kondisi bahaya, jangan ragu untuk segera menekan tombol panik di aplikasi Siaga RW 05. Dengan menekan tersebut, lokasi Anda akan segera diketahui oleh petugas dan warga lainnya untuk bantuan cepat. Mari kita ciptakan pagi yang aman dan produktif. Selamat beraktivitas, semoga hari Anda menyenangkan. Terima kasih.";
          } else if (testType === 'CUSTOM_ANNOUNCEMENT') {
              voiceMessage = customMessage || "Perhatian perhatian! Ini adalah pesan sosialisasi dari pengurus RW 05 Gayam Kota Kediri.";
          } else {
              voiceMessage = "ini bukan keadaan darurat, ini hanya tes sistem keamanan RW 05";
          }
      } else {
          const eventType = emergencyType || "Bahaya";
          voiceMessage = `Perhatian perhatian! Saat ini telah terjadi kondisi darurat di lingkungan RW 05 Kelurahan Gayam. Saat ini warga atas nama ${cleanName} dari RT ${cleanRT} membutuhkan bantuan segera. ${cleanName} saat ini telah melaporkan adanya ${eventType}. Mohon seluruh warga untuk menuju ke tempat ${cleanName} sekarang. Terima kasih.`;
      }
      
      const utterance = new SpeechSynthesisUtterance(voiceMessage);
      const voices = window.speechSynthesis.getVoices();
      const targetVoice = voices.find(v => v.lang.toLowerCase().includes('id-') && (v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('female')));

      if (targetVoice) utterance.voice = targetVoice;
      utterance.lang = 'id-ID';
      utterance.pitch = 1.2; 
      utterance.rate = 1.15; 
      utterance.volume = 1.0; 
      utteranceRef.current = utterance;

      utterance.onend = () => {
        if (isMounted.current && activeRef.current) {
            if (isTest) {
                testCountRef.current += 1;
                const maxRepeats = (testType === 'NIGHT_PATROL' || testType === 'MORNING_ALERT' || testType === 'CUSTOM_ANNOUNCEMENT') ? 2 : 3;
                if (testCountRef.current < maxRepeats) {
                    timerRef.current = setTimeout(() => runTestCycle(), 1000);
                } else {
                    setPhase('CHIME');
                    playClosingChime();
                    timerRef.current = setTimeout(() => {
                        resolvePanic('Sistem');
                    }, 2000);
                }
            } else {
                timerRef.current = setTimeout(() => runSirenPhase(), 2000);
            }
        }
      };

      window.speechSynthesis.speak(utterance);
    } else {
      if (!isTest) runSirenPhase();
    }
  };

  const runTestCycle = () => {
    if (!isMounted.current || !activeRef.current) return;
    setPhase('CHIME');
    playChimeSound();
    timerRef.current = setTimeout(() => {
        runVoicePhase();
    }, 2500);
  };

  const cleanupAll = () => {
    stopSirenSound();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (resumeIntervalRef.current) clearInterval(resumeIntervalRef.current);
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
  };

  const getAudioSetup = () => {
      let ctx = providedContext;
      if (!ctx) {
          if (!audioContextRef.current) {
              const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
              audioContextRef.current = new AudioContext();
          }
          ctx = audioContextRef.current;
      }
      if (!ctx) return null;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      if (!compressorRef.current) {
          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.setValueAtTime(-20, ctx.currentTime);
          compressor.knee.setValueAtTime(30, ctx.currentTime);
          compressor.ratio.setValueAtTime(10, ctx.currentTime);
          compressor.attack.setValueAtTime(0.003, ctx.currentTime);
          compressor.release.setValueAtTime(0.25, ctx.currentTime);
          compressor.connect(ctx.destination);
          compressorRef.current = compressor;
      }

      return { ctx, destination: compressorRef.current };
  };

  const playChimeSound = () => {
      try {
          const setup = getAudioSetup();
          if (!setup) return;
          const { ctx, destination } = setup;

          const playTone = (freq: number, start: number, duration: number) => {
              const osc = ctx.createOscillator();
              const g = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freq, start);
              g.gain.setValueAtTime(0, start);
              g.gain.linearRampToValueAtTime(0.7, start + 0.1); 
              g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
              osc.connect(g);
              g.connect(destination);
              osc.start(start);
              osc.stop(start + duration);
          };

          const now = ctx.currentTime;
          playTone(523.25, now, 1.2); 
          playTone(349.23, now + 0.6, 1.2); 
      } catch (e) {}
  };

  const playClosingChime = () => {
      try {
          const setup = getAudioSetup();
          if (!setup) return;
          const { ctx, destination } = setup;

          const playTone = (freq: number, start: number, duration: number) => {
              const osc = ctx.createOscillator();
              const g = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freq, start);
              g.gain.setValueAtTime(0, start);
              g.gain.linearRampToValueAtTime(0.6, start + 0.1); 
              g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
              osc.connect(g);
              g.connect(destination);
              osc.start(start);
              osc.stop(start + duration);
          };

          const now = ctx.currentTime;
          playTone(783.99, now, 1.0); 
          playTone(523.25, now + 0.5, 1.5); 
      } catch (e) {}
  };

  const playSirenSound = () => {
    try {
      const setup = getAudioSetup();
      if (!setup) return;
      const { ctx, destination } = setup;

      stopSirenSound();

      const gain = ctx.createGain();
      gain.gain.value = 0.7; 
      gain.connect(destination);
      gainNodeRef.current = gain;

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.connect(gain);
      oscillatorRef.current = osc;

      const lfo = ctx.createOscillator();
      lfo.type = 'triangle';
      lfo.frequency.value = 0.6; 
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 350; 
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      
      lfo.start();
      osc.start();
      lfoRef.current = lfo;
      lfoGainRef.current = lfoGain;
    } catch (e) {}
  };

  const stopSirenSound = () => {
    try {
        if (oscillatorRef.current) { oscillatorRef.current.stop(); oscillatorRef.current.disconnect(); oscillatorRef.current = null; }
        if (lfoRef.current) { lfoRef.current.stop(); lfoRef.current.disconnect(); lfoRef.current = null; }
        if (lfoGainRef.current) { lfoGainRef.current.disconnect(); lfoGainRef.current = null; }
        if (gainNodeRef.current) { 
            gainNodeRef.current.gain.exponentialRampToValueAtTime(0.0001, audioContextRef.current?.currentTime || 0 + 0.1);
            setTimeout(() => {
                gainNodeRef.current?.disconnect();
                gainNodeRef.current = null;
            }, 150);
        }
    } catch (e) {}
  };

  const formatTimerValue = (ms: number) => {
      if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!active) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[150] animate-in slide-in-from-top-10 duration-500 w-full max-w-[280px] px-4">
        <div className={`backdrop-blur-md border rounded-2xl shadow-2xl p-3 flex flex-col gap-2 transition-colors duration-300 ${phase === 'SIREN' ? 'bg-red-600/90 border-red-400 text-white' : 'bg-blue-600/90 border-blue-400 text-white'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full bg-white/20 ${phase === 'VOICE' || phase === 'CHIME' ? 'animate-pulse' : ''}`}>
                  {phase === 'SIREN' ? <Zap size={20} className="animate-bounce" /> : (phase === 'CHIME' || isTest) ? <Info size={20} /> : <Megaphone size={20} />}
              </div>
              <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none">
                          {isTest ? `Siaran (${testCountRef.current + 1}/${(testType === 'NIGHT_PATROL' || testType === 'MORNING_ALERT' || testType === 'CUSTOM_ANNOUNCEMENT') ? 2 : 3})` : phase === 'SIREN' ? 'Fase Sirine' : 'Fase Suara'}
                      </p>
                      <div className="flex items-center gap-1 text-[8px] font-black bg-white/20 px-1.5 py-0.5 rounded uppercase">
                          <Volume2 size={10} /> BOOSTED
                      </div>
                  </div>
                  <div className="flex items-center justify-between">
                      <span className="text-sm font-black italic">
                          {isTest ? (testType === 'NIGHT_PATROL' ? 'SIAGA MALAM...' : testType === 'MORNING_ALERT' ? 'SIAGA PAGI...' : testType === 'CUSTOM_ANNOUNCEMENT' ? 'SOSIALISASI...' : 'UJI COBA AUDIO...') : phase === 'SIREN' ? `SIRINE: ${formatTimerValue(timeLeft)}` : 'SIARAN AKTIF...'}
                      </span>
                      <Timer size={14} className="opacity-50" />
                  </div>
              </div>
            </div>
            
            {!isTest && (emergencyType || emergencyDescription) && (
              <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/5 flex flex-col gap-0.5">
                  <span className="text-[8px] font-black uppercase opacity-60">Status Laporan:</span>
                  <span className="text-[10px] font-black uppercase italic tracking-tight">{emergencyType || "Bahaya"}</span>
              </div>
            )}

            {phase === 'SIREN' && (
                <div className="w-full bg-black/20 h-1 rounded-full mt-1 overflow-hidden">
                    <div 
                        className="bg-white h-full transition-all duration-75 ease-linear"
                        style={{ width: `${(timeLeft / sirenDuration) * 100}%` }}
                    />
                </div>
            )}
        </div>
    </div>
  );
};

export default Siren;
