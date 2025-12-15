
import React, { useState, useEffect, useRef } from 'react';
import { PanicState, Resident } from '../types';
import { subscribeToPanicState, resolvePanic, subscribeToResidents, addResident, deleteResident, subscribeToHistory, addHistoryLog, clearHistoryLog, subscribeToConnectionStatus } from '../services/db';
import Siren from './Siren';
import { 
  Bell, BellOff, MapPin, Clock, ShieldCheck, History, ExternalLink, 
  User, Settings, Users, Plus, Trash2, X, AlertCircle, Lock, KeyRound, 
  LayoutDashboard, LogOut, ChevronRight, Search, Menu, Printer, Eraser,
  Eye, EyeOff, FileText, Save, Timer, Wifi, WifiOff, Volume2, Mic, Zap
} from 'lucide-react';

// Tiny 1x1 pixel webm video. Playing this in a loop prevents the device from sleeping.
const NO_SLEEP_VIDEO = 'data:video/webm;base64,GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKCQAR3ZWJtQoeBAkKFgQIYU4BnQI0VSalmRBfX1FPM2lncdt9i1jUQAABJqtgAAIAAAGYkssWIDwv3gQFC9oEMQZn3gQFC8oEEQvOBCEKCQAR3ZWJtQoeBAkKFgQIYU4BnQI0VSalmRBfX1FPM2lncdt9i1jUQAABJqtgAAIAAAGYkssWIDw==';

// Optimized Map Component with Update Logic
const MapComponent = ({ lat, lng, name, accuracy }: { lat: number; lng: number; name: string; accuracy?: number }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<{ map: any; marker: any; circle?: any } | null>(null);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // INITIALIZE MAP
      const map = L.map(mapContainerRef.current).setView([lat, lng], 18);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      const marker = L.marker([lat, lng]).addTo(map);
      
      let popupContent = `<b>${name}</b><br>Butuh Bantuan!`;
      if (accuracy) {
          popupContent += `<br><span style="font-size:10px; color: #666;">Akurasi: ±${Math.round(accuracy)}m</span>`;
      }
      marker.bindPopup(popupContent).openPopup();
      
      let circle;
      if (accuracy) {
          circle = L.circle([lat, lng], {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.1,
            radius: accuracy
          }).addTo(map);
      }

      mapInstanceRef.current = { map, marker, circle };

      // Fix render issues
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    } else {
      // UPDATE MAP (No flicker)
      const { map, marker, circle } = mapInstanceRef.current;
      map.setView([lat, lng], 18);
      marker.setLatLng([lat, lng]);
      
      let popupContent = `<b>${name}</b><br>Butuh Bantuan!`;
      if (accuracy) {
          popupContent += `<br><span style="font-size:10px; color: #666;">Akurasi: ±${Math.round(accuracy)}m</span>`;
      }
      marker.getPopup().setContent(popupContent);
      marker.openPopup(); 
      
      if (circle && accuracy) {
          circle.setLatLng([lat, lng]);
          circle.setRadius(accuracy);
      } else if (!circle && accuracy) {
          // Create circle if it didn't exist
           const newCircle = L.circle([lat, lng], {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.1,
            radius: accuracy
          }).addTo(map);
          mapInstanceRef.current.circle = newCircle;
      }
    }
  }, [lat, lng, name, accuracy]);

  // Cleanup
  useEffect(() => {
      return () => {
          if (mapInstanceRef.current) {
              mapInstanceRef.current.map.remove();
              mapInstanceRef.current = null;
          }
      };
  }, []);

  return <div ref={mapContainerRef} className="h-80 w-full rounded-xl border-4 border-red-500 shadow-lg mt-2 z-0 relative" />;
};

const SecurityView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const ADMIN_PASSWORD = 'petugasrt05rw05***#';

  // View Mode State
  const [viewMode, setViewMode] = useState<'MONITOR' | 'DASHBOARD'>('MONITOR');
  const [dashboardTab, setDashboardTab] = useState<'OVERVIEW' | 'RESIDENTS' | 'LOGS' | 'SETTINGS'>('OVERVIEW');

  // Core Logic State
  const [panicState, setPanicState] = useState<PanicState | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isScreenAwake, setIsScreenAwake] = useState(false);

  // --- AUDIO & SIREN SETTINGS ---
  const [autoStopDuration, setAutoStopDuration] = useState(300000); // 5 mins
  const [autoStopEnabled, setAutoStopEnabled] = useState(false); 
  const [sirenLoopDuration, setSirenLoopDuration] = useState(4000); // Durasi sirine sebelum ngomong (ms)
  const [voiceEnabled, setVoiceEnabled] = useState(true); // Toggle Suara Google
  
  // Data State
  const [residents, setResidents] = useState<Resident[]>([]);
  const [historyLog, setHistoryLog] = useState<PanicState[]>([]);
  
  // Log Map View State
  const [viewLogMap, setViewLogMap] = useState<PanicState | null>(null);
  
  // Print Settings State
  const [printConfig, setPrintConfig] = useState({
    rwName: '',
    rtName: '',
    securityName: ''
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Auth & Forms
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Resident Management Form
  const [newResName, setNewResName] = useState('');
  const [newResAddress, setNewResAddress] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{id: string, name: string} | null>(null);
  
  // History Management
  const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);

  // Refs
  const prevStatusRef = useRef<string | undefined>(undefined);
  const wakeLockRef = useRef<any>(null);
  const noSleepVideoRef = useRef<HTMLVideoElement | null>(null);

  // --- INITIALIZATION & SUBSCRIPTIONS ---

  useEffect(() => {
    // Load Settings
    const savedDuration = localStorage.getItem('security_auto_stop_duration');
    if (savedDuration) setAutoStopDuration(parseInt(savedDuration, 10));
    
    const savedAutoStopEnabled = localStorage.getItem('security_auto_stop_enabled_v2');
    if (savedAutoStopEnabled !== null) setAutoStopEnabled(savedAutoStopEnabled === 'true');

    const savedSirenLoop = localStorage.getItem('security_siren_loop_duration');
    if (savedSirenLoop) setSirenLoopDuration(parseInt(savedSirenLoop, 10));

    const savedVoiceEnabled = localStorage.getItem('security_voice_enabled');
    if (savedVoiceEnabled !== null) setVoiceEnabled(savedVoiceEnabled === 'true');

    // Load Print Config
    const savedPrintConfig = localStorage.getItem('security_print_config');
    if (savedPrintConfig) {
        setPrintConfig(JSON.parse(savedPrintConfig));
    }
  }, []);

  useEffect(() => {
    const unsubResidents = subscribeToResidents(setResidents);
    const unsubHistory = subscribeToHistory(setHistoryLog);
    const unsubConnection = subscribeToConnectionStatus(setIsOnline);
    
    const unsubPanic = subscribeToPanicState((data) => {
      // Logic: Transition to Active
      if (data.status === 'AKTIF' && prevStatusRef.current !== 'AKTIF') {
         // Save to persistent history
         addHistoryLog(data);

         // Trigger Notification
         if ('Notification' in window && Notification.permission === 'granted') {
            try {
              // Construct Map URL if location is available
              const mapUrl = data.lokasi 
                ? `https://www.google.com/maps?q=${data.lokasi.latitude},${data.lokasi.longitude}`
                : null;
              
              const notifBody = mapUrl 
                ? `Warga atas nama ${data.nama} membutuhkan bantuan! Klik untuk melihat lokasi di peta.`
                : `Warga atas nama ${data.nama} membutuhkan bantuan!`;

              const notification = new Notification('DARURAT! Warga Butuh Bantuan', {
                body: notifBody,
                requireInteraction: true,
                tag: 'panic-alert',
                icon: 'https://cdn-icons-png.flaticon.com/512/1033/1033066.png',
                data: { url: mapUrl } // Attach URL to data
              });

              // Add click handler to open map
              notification.onclick = (event) => {
                  event.preventDefault();
                  window.focus();
                  const targetUrl = (event.currentTarget as any)?.data?.url || mapUrl;
                  if (targetUrl) {
                      window.open(targetUrl, '_blank');
                  }
                  notification.close();
              };

            } catch (e) { console.error(e); }
         }
      }
      prevStatusRef.current = data.status;
      setPanicState(data);
    });

    // Re-acquire wake lock on visibility change
    const handleVisibilityChange = async () => {
        if (document.visibilityState === 'visible' && audioEnabled) {
            try {
                if ('wakeLock' in navigator && !wakeLockRef.current) {
                    wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                    setIsScreenAwake(true);
                }
                // Also resume video if it was paused
                if (noSleepVideoRef.current && noSleepVideoRef.current.paused) {
                    noSleepVideoRef.current.play().catch(() => {});
                }
            } catch (e) { console.log("WakeLock Re-acquire fail", e); }
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubResidents();
      unsubHistory();
      unsubPanic();
      unsubConnection();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
          wakeLockRef.current.release().catch((e: any) => console.log(e));
      }
    };
  }, [audioEnabled]); 

  // Auto-stop logic
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (panicState?.status === 'AKTIF' && autoStopEnabled && autoStopDuration > 0) {
      const elapsed = Date.now() - panicState.waktu;
      const remaining = autoStopDuration - elapsed;
      
      if (remaining > 0) {
          timeout = setTimeout(() => resolvePanic('Sistem (Auto-Stop)'), remaining);
      }
    }
    return () => clearTimeout(timeout);
  }, [panicState, autoStopDuration, autoStopEnabled]);

  // --- HANDLERS ---

  const startMonitoring = async () => {
    // 1. Pre-warm Audio Context
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext();
        await ctx.resume();
        setAudioCtx(ctx);
    } catch (e) {
        console.error("Audio Context Init Failed", e);
    }

    // 2. Enable Screen Wake Lock (API + Video Hack)
    
    // Method A: Native API
    try {
        if ('wakeLock' in navigator) {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            wakeLockRef.current.addEventListener('release', () => {
                console.log('Wake Lock released');
                setIsScreenAwake(false);
            });
            console.log('Native Wake Lock Active');
            setIsScreenAwake(true);
        }
    } catch (err) {
        console.log(`Wake Lock Error: ${err}`);
    }

    // Method B: Video Hack (Fallback if Native API fails or is revoked)
    if (noSleepVideoRef.current) {
        try {
            await noSleepVideoRef.current.play();
            console.log('NoSleep Video Hack Active');
            setIsScreenAwake(true); // Assume awake if video plays
        } catch (e) {
            console.log("NoSleep Video Hack Failed", e);
        }
    }

    setAudioEnabled(true);
    if ('Notification' in window) Notification.requestPermission();
  };

  const handleReset = () => {
    // Aksi seketika tanpa dialog konfirmasi
    resolvePanic('Pos Utama');
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
        setShowAuthModal(false);
        setViewMode('DASHBOARD');
    } else {
        setAuthError(true);
        setPasswordInput('');
    }
  };

  const handleAddResident = (e: React.FormEvent) => {
    e.preventDefault();
    if (newResName.trim()) {
        addResident(newResName.trim(), newResAddress.trim());
        setNewResName('');
        setNewResAddress('');
    }
  };

  const confirmDelete = () => {
    if (deleteTarget) {
        deleteResident(deleteTarget.id);
        setDeleteTarget(null);
    }
  };
  
  const handleClearHistory = () => {
    clearHistoryLog();
    setShowClearHistoryModal(false);
  };
  
  const handleSavePrintConfig = (e: React.FormEvent) => {
      e.preventDefault();
      localStorage.setItem('security_print_config', JSON.stringify(printConfig));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
  };
  
  const toggleAutoStop = (e: React.MouseEvent) => {
      e.preventDefault();
      const newValue = !autoStopEnabled;
      setAutoStopEnabled(newValue);
      localStorage.setItem('security_auto_stop_enabled_v2', String(newValue));
  };
  
  const toggleVoice = (e: React.MouseEvent) => {
      e.preventDefault();
      const newValue = !voiceEnabled;
      setVoiceEnabled(newValue);
      localStorage.setItem('security_voice_enabled', String(newValue));
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = parseInt(e.target.value, 10);
      setAutoStopDuration(val);
      localStorage.setItem('security_auto_stop_duration', String(val));
  };
  
  const handleSirenLoopChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = parseInt(e.target.value, 10);
      setSirenLoopDuration(val);
      localStorage.setItem('security_siren_loop_duration', String(val));
  };

  const formatTime = (ts: number) => {
    if (!ts || isNaN(ts)) return '-';
    try {
        return new Date(ts).toLocaleString('id-ID', { 
          day: 'numeric', month: 'short', 
          hour: '2-digit', minute: '2-digit' 
        });
    } catch (e) { return '-'; }
  };

  const formatDateOnly = (ts: number) => {
    if (!ts || isNaN(ts)) return '-';
    try {
        return new Date(ts).toLocaleDateString('id-ID', {
          day: 'numeric', month: 'long', year: 'numeric'
        });
    } catch (e) { return '-'; }
  };

  const formatTimeOnly = (ts: number) => {
    if (!ts || isNaN(ts)) return '-';
    try {
        return new Date(ts).toLocaleTimeString('id-ID', {
          hour: '2-digit', minute: '2-digit'
        }).replace('.', ':');
    } catch (e) { return '-'; }
  };

  // Print Report Handler
  const handlePrintLogs = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Gagal membuka jendela cetak. Pastikan pop-up blocker dimatikan untuk situs ini.");
        return;
    }

    const logoUrl = "https://upload.wikimedia.org/wikipedia/commons/c/c1/Logo_Kota_Kediri_-_Seal_of_Kediri_City.svg";
    
    const rwLine = printConfig.rwName ? `(  ${printConfig.rwName}  )` : '( ................................. )';
    const rtLine = printConfig.rtName ? `(  ${printConfig.rtName}  )` : '( ................................. )';
    const secLine = printConfig.securityName ? `(  ${printConfig.securityName}  )` : '( ................................. )';

    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Laporan Darurat RT 05</title>
            <style>
                body { font-family: 'Times New Roman', Times, serif; padding: 40px; }
                .header { text-align: center; margin-bottom: 20px; border-bottom: 3px double black; padding-bottom: 15px; }
                .header img { height: 80px; margin-bottom: 10px; }
                h1 { font-size: 18px; margin: 5px 0; font-weight: bold; text-transform: uppercase; }
                h2 { font-size: 14px; margin: 0; font-weight: normal; }
                .meta { text-align: right; font-size: 12px; margin-bottom: 10px; color: #555; margin-top: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; text-align: center; }
                .footer { margin-top: 40px; width: 100%; }
                .footer-date { text-align: right; margin-bottom: 20px; font-size: 12px; }
                .signatures { display: flex; justify-content: space-between; width: 100%; font-size: 12px; }
                .sig-block { text-align: center; width: 32%; }
                .sig-space { height: 70px; }
                .sig-line { margin-top: 5px; text-transform: uppercase; font-weight: bold; }
                @media print { @page { margin: 1cm; } }
            </style>
        </head>
        <body>
            <div class="header">
                <img src="${logoUrl}" alt="Logo Kediri" />
                <h1>Laporan Riwayat Panggilan Darurat</h1>
                <h2>RT 05 RW 05 Kelurahan Gayam, Kec. Mojoroto, Kota Kediri</h2>
            </div>
            <div class="meta">Dicetak pada: ${new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</div>
            <table>
                <thead>
                    <tr><th style="width: 5%">No</th><th style="width: 20%">Tanggal</th><th style="width: 15%">Jam</th><th style="width: 25%">Nama Pelapor</th><th style="width: 35%">Koordinat Lokasi</th></tr>
                </thead>
                <tbody>
    `;
    
    const logs = Array.isArray(historyLog) ? historyLog : [];
    logs.forEach((log, index) => {
        const gps = log.lokasi ? `${log.lokasi.latitude.toFixed(6)}, ${log.lokasi.longitude.toFixed(6)} (±${Math.round(log.lokasi.accuracy || 0)}m)` : 'Tidak Ada Data GPS';
        html += `<tr><td style="text-align: center;">${index + 1}</td><td>${formatDateOnly(log.waktu)}</td><td style="text-align: center;">${formatTimeOnly(log.waktu)} WIB</td><td><strong>${log.nama}</strong></td><td>${gps}</td></tr>`;
    });

    if (logs.length === 0) html += `<tr><td colspan="5" style="text-align: center; font-style: italic;">Belum ada riwayat kejadian.</td></tr>`;

    html += `</tbody></table>
            <div class="footer">
                <div class="footer-date">Kediri, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div class="signatures">
                    <div class="sig-block"><p>Mengetahui,</p><p style="font-weight: bold;">Ketua RW 05</p><div class="sig-space"></div><p class="sig-line">${rwLine}</p></div>
                    <div class="sig-block"><p>Diperiksa oleh,</p><p style="font-weight: bold;">Ketua RT 05</p><div class="sig-space"></div><p class="sig-line">${rtLine}</p></div>
                    <div class="sig-block"><p>Dilaporkan oleh,</p><p style="font-weight: bold;">Seksi Keamanan</p><div class="sig-space"></div><p class="sig-line">${secLine}</p></div>
                </div>
            </div>
            <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };</script>
        </body></html>
    `;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Filtered residents for table
  const filteredResidents = residents.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isEmergency = panicState?.status === 'AKTIF';

  // --- RENDER HELPERS ---

  // 1. LANDING / START SCREEN
  if (!audioEnabled) {
    return (
      <div className="h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-6 font-sans">
        <div className="relative mb-8">
            <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
            <ShieldCheck size={80} className="text-blue-500 relative z-10" />
        </div>
        <h1 className="text-3xl font-bold mb-2 tracking-tight">Pos Keamanan RT 05</h1>
        <p className="text-gray-400 text-center mb-8 max-w-md">
            Sistem monitoring darurat terintegrasi. Klik tombol di bawah untuk mengaktifkan konsol, sirine, dan mode layar selalu hidup.
        </p>
        
        {/* Hidden video element for reference before activation */}
        <video 
            ref={noSleepVideoRef} 
            src={NO_SLEEP_VIDEO} 
            playsInline 
            muted 
            loop 
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01, pointerEvents: 'none' }} 
        />

        <button 
          onClick={startMonitoring}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-full transition-all shadow-lg shadow-blue-900/50 hover:scale-105 flex items-center gap-3"
        >
          <Zap size={20} className="fill-white" /> Mulai Monitoring
        </button>
        <button onClick={onBack} className="mt-8 text-sm text-gray-500 hover:text-white transition-colors">Kembali ke Menu Utama</button>
      </div>
    );
  }

  // 2. DASHBOARD VIEW
  if (viewMode === 'DASHBOARD') {
    return (
        <div className={`min-h-screen flex font-sans relative ${isEmergency ? 'bg-red-50' : 'bg-gray-100'}`}>
            {/* Visual Alarm Indicator & Audio Persistence for Dashboard */}
            {isEmergency && (
                <>
                    <div className="fixed inset-0 z-[100] border-[12px] border-red-600 pointer-events-none animate-pulse opacity-50"></div>
                    <Siren 
                        active={true} 
                        residentName={panicState?.nama} 
                        providedContext={audioCtx}
                        sirenDuration={sirenLoopDuration}
                        voiceEnabled={voiceEnabled}
                    />
                </>
            )}

            {/* Always Render Video Hack for Dashboard too */}
            <video 
                ref={noSleepVideoRef} 
                src={NO_SLEEP_VIDEO} 
                playsInline 
                muted 
                loop 
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01, pointerEvents: 'none', top: 0, left: 0 }} 
            />

            {/* Sidebar */}
            <div className="w-64 bg-gray-900 text-white flex flex-col shadow-xl z-20">
                <div className="p-6 border-b border-gray-800 flex items-center gap-3">
                    <ShieldCheck className="text-blue-500" />
                    <div>
                        <h2 className="font-bold text-lg leading-none">Admin Pos</h2>
                        <span className="text-xs text-gray-500">RT 05 RW 05 Gayam</span>
                    </div>
                </div>
                
                <nav className="flex-1 p-4 space-y-2">
                    <button onClick={() => setDashboardTab('OVERVIEW')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${dashboardTab === 'OVERVIEW' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><LayoutDashboard size={20} /> Ringkasan</button>
                    <button onClick={() => setDashboardTab('RESIDENTS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${dashboardTab === 'RESIDENTS' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><Users size={20} /> Data Warga</button>
                    <button onClick={() => setDashboardTab('LOGS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${dashboardTab === 'LOGS' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><History size={20} /> Riwayat Log</button>
                    <button onClick={() => setDashboardTab('SETTINGS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${dashboardTab === 'SETTINGS' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><Settings size={20} /> Pengaturan</button>
                </nav>

                <div className="p-4 border-t border-gray-800">
                    <div className={`mb-4 flex items-center justify-center gap-2 text-xs font-bold px-2 py-1.5 rounded ${isOnline ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                         {isOnline ? <Wifi size={14}/> : <WifiOff size={14}/>}
                         {isOnline ? 'ONLINE' : 'TERPUTUS'}
                    </div>
                    <button 
                        onClick={() => setViewMode('MONITOR')}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors text-sm"
                    >
                        <LogOut size={16} /> Kembali ke Monitor
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
                <header className="bg-white shadow-sm p-6 flex justify-between items-center sticky top-0 z-10">
                    <h1 className="text-2xl font-bold text-gray-800">
                        {dashboardTab === 'OVERVIEW' && 'Ringkasan Sistem'}
                        {dashboardTab === 'RESIDENTS' && 'Manajemen Data Warga'}
                        {dashboardTab === 'LOGS' && 'Riwayat Kejadian'}
                        {dashboardTab === 'SETTINGS' && 'Pengaturan Laporan'}
                    </h1>
                    {isEmergency && (
                        <button 
                            onClick={() => setViewMode('MONITOR')}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold animate-pulse flex items-center gap-2 shadow-lg"
                        >
                            <AlertCircle size={20} />
                            DARURAT AKTIF!
                        </button>
                    )}
                </header>

                <main className="p-6">
                    {/* --- OVERVIEW TAB --- */}
                    {dashboardTab === 'OVERVIEW' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="text-gray-500 text-sm font-semibold uppercase mb-2">Total Warga</div>
                                <div className="text-4xl font-bold text-gray-900">{residents.length}</div>
                                <div className="text-green-500 text-sm mt-2 flex items-center gap-1">
                                    <Users size={14} /> Terdaftar di sistem
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="text-gray-500 text-sm font-semibold uppercase mb-2">Status Sistem</div>
                                <div className={`text-2xl font-bold ${isEmergency ? 'text-red-600' : 'text-green-600'}`}>
                                    {isEmergency ? 'BAHAYA / AKTIF' : 'AMAN / STANDBY'}
                                </div>
                                <div className="text-gray-400 text-sm mt-2">
                                    {isEmergency ? 'Sirine berbunyi' : 'Menunggu sinyal...'}
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="text-gray-500 text-sm font-semibold uppercase mb-2">Total Kejadian</div>
                                <div className="text-4xl font-bold text-gray-900">{historyLog.length}</div>
                                <div className="text-blue-500 text-sm mt-2 flex items-center gap-1">
                                    <History size={14} /> Log tersimpan
                                </div>
                            </div>

                            {/* EMERGENCY MAP IN DASHBOARD */}
                            {isEmergency && panicState?.lokasi && (
                                <div className="col-span-1 md:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-red-200 mt-2">
                                    <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2">
                                        <MapPin size={20} /> Lokasi Kejadian Terkini
                                    </h3>
                                    <MapComponent lat={panicState.lokasi.latitude} lng={panicState.lokasi.longitude} name={panicState.nama} accuracy={panicState.lokasi.accuracy} />
                                </div>
                            )}

                            {/* Recent Activity Mini Table */}
                            <div className="col-span-1 md:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 mt-4 overflow-hidden">
                                <div className="p-4 border-b border-gray-100 font-bold text-gray-800">Aktivitas Terakhir</div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-xs">
                                            <tr>
                                                <th className="px-6 py-3">Waktu</th>
                                                <th className="px-6 py-3">Warga</th>
                                                <th className="px-6 py-3">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Array.isArray(historyLog) && historyLog.slice(0, 5).map((log, idx) => (
                                                <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                                    <td className="px-6 py-3">{formatTime(log.waktu)}</td>
                                                    <td className="px-6 py-3 font-medium">{log.nama}</td>
                                                    <td className="px-6 py-3">
                                                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">Selesai</span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!Array.isArray(historyLog) || historyLog.length === 0) && (
                                                <tr>
                                                    <td colSpan={3} className="px-6 py-4 text-center text-gray-400">Belum ada riwayat.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- RESIDENTS TAB --- */}
                    {dashboardTab === 'RESIDENTS' && (
                        <div className="space-y-6">
                            {/* Add Form */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <Plus size={18} className="text-blue-600" /> Tambah Warga Baru
                                </h3>
                                <form onSubmit={handleAddResident} className="flex flex-col md:flex-row gap-4">
                                    <input 
                                        type="text" 
                                        placeholder="Nama Lengkap" 
                                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-800 text-white placeholder-gray-400"
                                        value={newResName}
                                        onChange={e => setNewResName(e.target.value)}
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Alamat / Blok" 
                                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-800 text-white placeholder-gray-400"
                                        value={newResAddress}
                                        onChange={e => setNewResAddress(e.target.value)}
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={!newResName}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-lg disabled:opacity-50 transition-colors"
                                    >
                                        Simpan
                                    </button>
                                </form>
                            </div>

                            {/* Table */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                                    <h3 className="font-bold text-gray-800">Daftar Warga ({filteredResidents.length})</h3>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                        <input 
                                            type="text" 
                                            placeholder="Cari warga..." 
                                            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none w-64"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-xs">
                                            <tr>
                                                <th className="px-6 py-3">Nama</th>
                                                <th className="px-6 py-3">Alamat</th>
                                                <th className="px-6 py-3 text-right">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredResidents.map(res => (
                                                <tr key={res.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-3 font-bold text-gray-800">{res.name}</td>
                                                    <td className="px-6 py-3 text-gray-600">{res.address || '-'}</td>
                                                    <td className="px-6 py-3 text-right">
                                                        <button 
                                                            onClick={() => setDeleteTarget({id: res.id, name: res.name})}
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                            title="Hapus"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredResidents.length === 0 && (
                                                <tr>
                                                    <td colSpan={3} className="px-6 py-8 text-center text-gray-400 italic">
                                                        Tidak ada data ditemukan.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- LOGS TAB --- */}
                    {dashboardTab === 'LOGS' && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[200px]">
                             <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                                <div>
                                    <div className="font-bold text-gray-800">Riwayat Panggilan Darurat</div>
                                    <div className="text-xs text-gray-500">Disimpan secara lokal di browser ini</div>
                                </div>
                                <div className="flex gap-2">
                                    {historyLog.length > 0 && (
                                        <button 
                                            onClick={() => setShowClearHistoryModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors shadow-sm"
                                        >
                                            <Eraser size={16} />
                                            Hapus Semua
                                        </button>
                                    )}
                                    <button 
                                        onClick={handlePrintLogs}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                                    >
                                        <Printer size={16} />
                                        Cetak Laporan
                                    </button>
                                </div>
                             </div>
                             <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-xs">
                                        <tr>
                                            <th className="px-6 py-3">Tanggal</th>
                                            <th className="px-6 py-3">Jam</th>
                                            <th className="px-6 py-3">Pelapor</th>
                                            <th className="px-6 py-3">Lokasi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.isArray(historyLog) && historyLog.map((log, idx) => (
                                            <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                                <td className="px-6 py-4">{formatDateOnly(log.waktu)}</td>
                                                <td className="px-6 py-4 font-mono text-gray-600">{formatTimeOnly(log.waktu)} WIB</td>
                                                <td className="px-6 py-4 font-bold">{log.nama}</td>
                                                <td className="px-6 py-4">
                                                    {log.lokasi ? (
                                                        <button 
                                                            onClick={() => setViewLogMap(log)}
                                                            className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 transition-colors"
                                                        >
                                                            <MapPin size={14} /> Lihat Peta
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs italic">Lokasi tidak tersedia</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                         {(!Array.isArray(historyLog) || historyLog.length === 0) && (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">
                                                    Belum ada riwayat tercatat.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                             </div>
                        </div>
                    )}

                    {/* --- SETTINGS TAB --- */}
                    {dashboardTab === 'SETTINGS' && (
                         <div className="space-y-6 max-w-2xl">
                             {/* Auto Stop / Alarm Settings */}
                             <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-4 border-b border-gray-100 bg-red-50">
                                    <div className="font-bold text-red-800 flex items-center gap-2">
                                        <Timer size={20} />
                                        Konfigurasi Alarm & Suara
                                    </div>
                                </div>
                                <div className="p-6 space-y-6">
                                    
                                    {/* Suara Google Toggle */}
                                    <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                                        <div>
                                            <label className="font-bold text-gray-800 flex items-center gap-2"><Mic size={16}/> Suara Google (Text-to-Speech)</label>
                                            <p className="text-xs text-gray-500">Membacakan nama warga pelapor secara otomatis.</p>
                                        </div>
                                        <button 
                                            onClick={toggleVoice}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${voiceEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${voiceEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    {/* Siren Loop Duration */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                                            <Volume2 size={16}/> Durasi Sirine per Siklus
                                        </label>
                                        <p className="text-xs text-gray-500 mb-2">Berapa lama sirine berbunyi sebelum diselingi suara Google.</p>
                                        <select 
                                            value={sirenLoopDuration} 
                                            onChange={handleSirenLoopChange}
                                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
                                        >
                                            <option value={2000}>2 Detik (Cepat)</option>
                                            <option value={4000}>4 Detik (Sedang)</option>
                                            <option value={6000}>6 Detik (Lama)</option>
                                            <option value={10000}>10 Detik (Sangat Lama)</option>
                                        </select>
                                    </div>

                                    {/* Auto Stop Logic */}
                                    <div className="flex items-center justify-between pt-2">
                                        <div>
                                            <label className="font-bold text-gray-800">Matikan Sirine Otomatis</label>
                                            <p className="text-xs text-gray-500">Mematikan alarm setelah batas waktu tertentu.</p>
                                        </div>
                                        <button 
                                            onClick={toggleAutoStop}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoStopEnabled ? 'bg-red-600' : 'bg-gray-200'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${autoStopEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    {autoStopEnabled && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Durasi Maksimal Alarm</label>
                                            <select 
                                                value={autoStopDuration} 
                                                onChange={handleDurationChange}
                                                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none bg-white cursor-pointer"
                                            >
                                                <option value={60000}>1 Menit</option>
                                                <option value={180000}>3 Menit</option>
                                                <option value={300000}>5 Menit</option>
                                                <option value={600000}>10 Menit</option>
                                                <option value={900000}>15 Menit</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                             </div>

                             {/* Print Settings */}
                             <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                 <div className="p-4 border-b border-gray-100">
                                    <div className="font-bold text-gray-800 flex items-center gap-2">
                                        <FileText size={20} className="text-blue-600" />
                                        Pengaturan Laporan Cetak
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        Sesuaikan nama pejabat yang akan muncul pada tanda tangan laporan PDF.
                                    </div>
                                 </div>
                                 
                                 <form onSubmit={handleSavePrintConfig} className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Nama Ketua RW 05</label>
                                        <input 
                                            type="text" 
                                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-800 text-white placeholder-gray-400"
                                            placeholder="Contoh: Bpk. Sugeng"
                                            value={printConfig.rwName}
                                            onChange={(e) => setPrintConfig({...printConfig, rwName: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Nama Ketua RT 05</label>
                                        <input 
                                            type="text" 
                                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-800 text-white placeholder-gray-400"
                                            placeholder="Contoh: Bpk. Joko"
                                            value={printConfig.rtName}
                                            onChange={(e) => setPrintConfig({...printConfig, rtName: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Nama Seksi Keamanan</label>
                                        <input 
                                            type="text" 
                                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-800 text-white placeholder-gray-400"
                                            placeholder="Contoh: Sdr. Budi"
                                            value={printConfig.securityName}
                                            onChange={(e) => setPrintConfig({...printConfig, securityName: e.target.value})}
                                        />
                                    </div>
                                    
                                    <div className="pt-4 flex items-center gap-4">
                                        <button 
                                            type="submit" 
                                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                                        >
                                            <Save size={18} /> Simpan Pengaturan
                                        </button>
                                        {saveSuccess && (
                                            <span className="text-green-600 text-sm font-bold animate-pulse">
                                                Pengaturan berhasil disimpan!
                                            </span>
                                        )}
                                    </div>
                                 </form>
                             </div>
                         </div>
                    )}
                </main>
            </div>

            {/* Map Viewer Modal for Logs */}
            {viewLogMap && viewLogMap.lokasi && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="font-bold text-gray-900">Lokasi Kejadian</h3>
                                <p className="text-xs text-gray-500">{viewLogMap.nama} - {formatTime(viewLogMap.waktu)}</p>
                            </div>
                            <button onClick={() => setViewLogMap(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4">
                            <MapComponent lat={viewLogMap.lokasi.latitude} lng={viewLogMap.lokasi.longitude} name={viewLogMap.nama} accuracy={viewLogMap.lokasi.accuracy} />
                            <div className="mt-4 flex gap-2">
                                <a 
                                    href={`https://www.google.com/maps?q=${viewLogMap.lokasi.latitude},${viewLogMap.lokasi.longitude}`}
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex-1 bg-blue-600 text-white text-center py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <ExternalLink size={16} /> Buka Google Maps
                                </a>
                                <button 
                                    onClick={() => setViewLogMap(null)}
                                    className="flex-1 bg-gray-100 text-gray-700 text-center py-2 rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors"
                                >
                                    Tutup
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal (Residents) */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-6">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border border-gray-200">
                        <div className="flex flex-col items-center text-center mb-4">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3 text-red-600">
                                <AlertCircle size={28} />
                            </div>
                            <h4 className="text-lg font-bold text-gray-900">Hapus Data Warga?</h4>
                            <p className="text-sm text-gray-600 mt-1">
                                Hapus <strong>{deleteTarget.name}</strong>? Tindakan ini permanen.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Batal</button>
                            <button onClick={confirmDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Hapus</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Clear History Confirmation Modal */}
            {showClearHistoryModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-6">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border border-gray-200 animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center mb-4">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                                <Trash2 size={32} />
                            </div>
                            <h4 className="text-xl font-bold text-gray-900">Hapus Semua Riwayat?</h4>
                            <p className="text-sm text-gray-600 mt-2">
                                Apakah Anda yakin ingin menghapus <strong>seluruh data riwayat kejadian</strong> dan aktivitas terakhir?
                            </p>
                            <p className="text-xs text-red-600 mt-2 font-semibold bg-red-50 p-2 rounded">
                                Data yang dihapus tidak dapat dikembalikan.
                            </p>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button 
                                onClick={() => setShowClearHistoryModal(false)} 
                                className="flex-1 px-4 py-3 border border-gray-300 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={handleClearHistory} 
                                className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-md transition-colors"
                            >
                                Ya, Hapus Semua
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  }

  // 3. MONITOR VIEW (DEFAULT)
  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-500 ${isEmergency ? 'animate-siren' : 'bg-gray-900'}`}>
      <Siren 
        active={isEmergency} 
        residentName={panicState?.nama} 
        providedContext={audioCtx}
        sirenDuration={sirenLoopDuration}
        voiceEnabled={voiceEnabled}
      />
      
      {/* Hidden Video Hack for NoSleep (Monitor View) */}
      <video 
        ref={noSleepVideoRef} 
        src={NO_SLEEP_VIDEO} 
        playsInline 
        muted 
        loop 
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01, pointerEvents: 'none', top: 0, left: 0 }} 
      />
      
      {/* Header */}
      <div className="bg-gray-800 text-white p-4 shadow-md flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-blue-400" />
          <h1 className="font-bold text-lg">Pos Keamanan RT 05</h1>
        </div>
        <div className="flex items-center gap-4">
           {/* CONNECTION STATUS INDICATOR */}
           <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border border-gray-700 transition-colors ${isOnline ? 'bg-gray-900 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
               {isOnline ? <Wifi size={14} /> : <WifiOff size={14} className="animate-pulse" />}
               {isOnline ? 'ONLINE' : 'TERPUTUS'}
           </div>

           {/* SCREEN AWAKE INDICATOR */}
           {isScreenAwake && (
                <div className="flex items-center gap-1 text-xs bg-yellow-900/30 text-yellow-400 px-3 py-1.5 rounded-full border border-yellow-700/50" title="Layar tidak akan mati">
                    <Zap size={12} className="fill-yellow-400" />
                    ALWAYS ON
                </div>
           )}

          <div className="flex items-center gap-2 text-xs bg-gray-900/50 px-3 py-1 rounded-full border border-gray-700">
            <div className={`w-3 h-3 rounded-full ${isEmergency ? 'bg-red-500 animate-ping' : 'bg-green-500'}`}></div>
            {isEmergency ? 'DARURAT' : 'AMAN'}
          </div>
          <button 
            onClick={() => {
                setPasswordInput('');
                setAuthError(false);
                setShowAuthModal(true);
                setShowPassword(false);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
          >
            <Settings size={16} /> Dashboard Admin
          </button>
        </div>
      </div>

      {/* Main Alert Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
        {isEmergency ? (
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full transform transition-transform">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 text-left">
                 <div className="flex items-center gap-3 mb-4">
                    <Bell size={40} className="text-red-600 animate-bounce" />
                    <div>
                      <h2 className="text-2xl font-black text-red-600 leading-tight">PERHATIAN!</h2>
                      <p className="text-sm font-semibold text-gray-800">Warga membutuhkan bantuan.</p>
                    </div>
                 </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-100 space-y-3 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="font-bold text-gray-500 w-16 text-sm flex items-center gap-1"><User size={14} /> Nama</div>
                    <div className="font-bold text-gray-900 text-lg uppercase">{panicState?.nama}</div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="font-bold text-gray-500 w-16 text-sm">Waktu</div>
                    <div className="text-gray-900">{formatTime(panicState?.waktu || 0)}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {panicState?.lokasi && (
                     <a 
                      href={`https://www.google.com/maps/dir/?api=1&destination=${panicState.lokasi.latitude},${panicState.lokasi.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
                    >
                      <ExternalLink size={16} /> Buka Google Maps / Rute
                    </a>
                  )}
                  <button 
                    onClick={handleReset}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
                  >
                    <BellOff size={16} /> MATIKAN SIRINE & RESET
                  </button>
                </div>
              </div>
              
              <div className="flex-1 min-h-[350px] flex flex-col">
                   <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2"><MapPin size={18} /> Peta Lokasi</h3>
                   {panicState?.lokasi ? (
                       <MapComponent lat={panicState.lokasi.latitude} lng={panicState.lokasi.longitude} name={panicState.nama} accuracy={panicState.lokasi.accuracy} />
                   ) : (
                       <div className="h-80 w-full rounded-xl border-4 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                           <MapPin size={48} className="mb-2 opacity-30" />
                           <p className="font-bold">Lokasi Tidak Tersedia</p>
                           <p className="text-xs text-center max-w-[200px] mt-1 text-gray-500">
                             Perangkat warga tidak mengirimkan koordinat GPS.
                           </p>
                       </div>
                   )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-400 flex flex-col items-center">
            <div className="w-48 h-48 rounded-full border-4 border-gray-700 flex items-center justify-center mb-6">
               <ShieldCheck size={80} className="text-gray-700" />
            </div>
            <h2 className="text-2xl font-bold text-gray-300">Situasi Aman</h2>
            <p className="mt-2 text-gray-500">Sistem berjalan normal. Menunggu data...</p>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-6">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-600">
                        <Lock size={32} />
                    </div>
                    <h3 className="font-bold text-xl text-gray-900">Login Admin</h3>
                    <p className="text-sm text-gray-500 mt-1">Masukkan password petugas pos.</p>
                </div>
                <form onSubmit={handleAuthSubmit}>
                    <div className="relative mb-4">
                        <KeyRound className="absolute left-3 top-3.5 text-gray-400" size={20} />
                        <input 
                            type={showPassword ? "text" : "password"}
                            autoFocus
                            placeholder="Password..." 
                            className={`w-full border rounded-lg pl-10 pr-10 py-2.5 outline-none focus:ring-2 transition-all ${authError ? 'border-red-500 focus:ring-red-200 bg-red-50' : 'border-gray-300 focus:ring-blue-200 bg-gray-50'}`}
                            value={passwordInput}
                            onChange={(e) => {
                                setPasswordInput(e.target.value);
                                setAuthError(false);
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                    {authError && <p className="text-xs text-red-600 mb-4 text-center font-bold">Password salah!</p>}
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setShowAuthModal(false)} className="flex-1 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg">Batal</button>
                        <button type="submit" className="flex-1 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Masuk</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default SecurityView;
