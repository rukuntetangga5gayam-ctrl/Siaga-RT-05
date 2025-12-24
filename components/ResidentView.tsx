
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, LocationData, PanicState, EmergencyContact } from '../types';
import { triggerPanic, subscribeToPanicState, resolvePanic, subscribeToEmergencyContacts } from '../services/db';
import { AlertTriangle, MapPin, CheckCircle, ShieldAlert, WifiOff, Loader2, Volume2, ShieldCheck, Zap, X, Info, Settings, BellRing, Radio, Navigation, Moon, Sun, BatteryCharging, Bell, HeartPulse, Signal, SignalLow, SignalHigh, Download, FileText, PhoneCall, Shield, Search, Flame, Stethoscope, Users, CloudRain, ShieldX, HelpCircle, MessageSquare, Copy, Check } from 'lucide-react';
import Siren from './Siren';

interface ResidentViewProps {
  user: UserProfile;
  onLogout: () => void;
}

const EMERGENCY_TYPES = [
  { id: 'PENCURIAN', label: 'Tindak Pencurian', icon: ShieldX, color: 'bg-orange-600', textColor: 'text-orange-600' },
  { id: 'PERKELAHIAN', label: 'Perkelahian/Keributan', icon: Users, color: 'bg-indigo-600', textColor: 'text-indigo-600' },
  { id: 'MENCURIGAKAN', label: 'Orang Mencurigakan', icon: Search, color: 'bg-yellow-600', textColor: 'text-yellow-600' },
  { id: 'MEDIS', label: 'Darurat Medis', icon: Stethoscope, color: 'bg-blue-600', textColor: 'text-blue-600' },
  { id: 'KEBAKARAN', label: 'Bahaya Kebakaran', icon: Flame, color: 'bg-red-600', textColor: 'text-red-600' },
  { id: 'BENCANA', label: 'Bencana Alam', icon: CloudRain, color: 'bg-cyan-600', textColor: 'text-cyan-600' },
  { id: 'LAINNYA', label: 'Darurat Lainnya', icon: HelpCircle, color: 'bg-gray-600', textColor: 'text-gray-600' },
];

const ResidentView: React.FC<ResidentViewProps> = ({ user, onLogout }) => {
  const [panicState, setPanicState] = useState<PanicState | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(false); 
  const [isPressing, setIsPressing] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false); 
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showBatteryGuide, setShowBatteryGuide] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [hasAutoRedirected, setHasAutoRedirected] = useState(false);
  
  const [selectedEmergency, setSelectedEmergency] = useState<string | null>(null);
  
  const [notifPermission, setNotifPermission] = useState<string>('default');
  const [gpsPermission, setGpsPermission] = useState<string>('granted');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const prevStatusRef = useRef<string | undefined>(undefined);
  const wakeLockRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const updateLocationState = (position: GeolocationPosition) => {
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      });
  };

  const stopWatching = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const startWatching = () => {
      if (!('geolocation' in navigator)) return;
      if (watchIdRef.current !== null) return;

      watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            updateLocationState(position);
            setGpsPermission('granted');
          },
          (error) => {
            setGpsPermission('denied');
          },
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );
  };

  const checkPermissionsStatus = async () => {
    if ('Notification' in window) setNotifPermission(Notification.permission);
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' as any });
        setGpsPermission(result.state);
        result.onchange = () => setGpsPermission(result.state);
      } catch (e) {}
    }
  };

  const requestLocationAccess = () => {
    if (!('geolocation' in navigator)) return;
    setLoadingLoc(true);
    navigator.geolocation.getCurrentPosition(
        (position) => {
            updateLocationState(position);
            setLoadingLoc(false);
            setGpsPermission('granted');
        },
        (error) => {
            setLoadingLoc(false);
            setGpsPermission('denied');
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  const activateFullMonitoring = async () => {
      try {
          if ('Notification' in window) {
              const res = await Notification.requestPermission();
              setNotifPermission(res);
          }
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          audioCtxRef.current = new AudioContext();
          if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
          if ('wakeLock' in navigator) {
              try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch (e) {}
          }
          setIsMonitoring(true);
          setShowPermissionModal(false);
          
          if (panicState?.status === 'AKTIF' || panicState?.status === 'TEST') {
            startWatching();
          }
      } catch (e) {
          setIsMonitoring(true);
          setShowPermissionModal(false);
      }
  };

  const handleDownloadSOP = () => {
    const text = `
PANDUAN SIAGA DARURAT RW 05 GAYAM
---------------------------------
1. Pastikan Aplikasi Terpasang (Install PWA).
2. Aktifkan Fitur "SIAGA" agar HP berbunyi otomatis.
3. PILIH JENIS DARURAT sebelum menekan tombol PANIC.
4. Gunakan Tombol PANIC hanya dalam kondisi bahaya.
5. Gunakan tombol "Teruskan ke WA" untuk lapor ke pengurus.
---------------------------------
RW 05 KELURAHAN GAYAM - KOTA KEDIRI
    `;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SOP_Siaga_RW05_Gayam.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getEmergencyMessage = () => {
    const cleanName = (user.name).toUpperCase();
    const typeLabel = (EMERGENCY_TYPES.find(t => t.id === selectedEmergency)?.label || 'BAHAYA').toUpperCase();
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    let mapsLink = "Lokasi tidak tersedia";
    let coordsText = "-";
    let accuracyText = "";
    
    if (location) {
        mapsLink = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
        coordsText = `${location.latitude}, ${location.longitude}`;
        accuracyText = ` (Akurasi: ±${location.accuracy?.toFixed(0)}m)`;
    }

    return `🚨 *LAPORAN DARURAT SIAGA RW 05 GAYAM* 🚨%0A--------------------------------------------------%0A*STATUS:* DARURAT AKTIF!%0A*NAMA PELAPOR:* ${cleanName}%0A*WILAYAH:* ${user.address}%0A*JENIS KEJADIAN:* ${typeLabel}%0A*WAKTU:* ${dateStr}, ${timeStr} WIB%0A%0A*DETAIL LOKASI:*%0ASistem mendeteksi pelapor berada di koordinat:%0A${coordsText}${accuracyText}%0A%0A*LINK GOOGLE MAPS:*%0A${mapsLink}%0A%0A--------------------------------------------------%0A_Pesan ini dikirim otomatis melalui Aplikasi Siaga RW 05 Gayam. Mohon segera berikan bantuan ke lokasi tersebut!_`;
  };

  const handleWhatsAppNotify = (number: string) => {
    const cleanNumber = number.replace(/[^0-9]/g, '');
    const message = getEmergencyMessage();
    const waUrl = `https://wa.me/${cleanNumber}?text=${message}`;
    window.open(waUrl, '_blank');
  };

  const handleCopyText = () => {
    const message = decodeURIComponent(getEmergencyMessage().replace(/%0A/g, '\n'));
    navigator.clipboard.writeText(message).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  useEffect(() => {
    requestLocationAccess();
    checkPermissionsStatus();
    
    const unsubWA = subscribeToEmergencyContacts(setEmergencyContacts);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = subscribeToPanicState((data) => {
      if (data.status === 'AKTIF' || data.status === 'TEST') {
        startWatching();
      } else {
        stopWatching();
      }

      if (data.status === 'AKTIF' && prevStatusRef.current !== 'AKTIF') {
        if (data.nama !== user.name) triggerBrowserNotification(data);
      }
      prevStatusRef.current = data.status;
      setPanicState(data);
    });

    return () => {
        unsubscribe();
        unsubWA();
        stopWatching();
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        if (wakeLockRef.current) wakeLockRef.current.release().catch(() => {});
    };
  }, [user.name, isMonitoring]); 

  const isOthersEmergency = panicState?.status === 'AKTIF' && panicState.nama !== user.name;
  const isMyEmergency = panicState?.status === 'AKTIF' && panicState.nama === user.name;
  const isTestMode = panicState?.status === 'TEST';

  // --- AUTO REDIRECT LOGIC ---
  useEffect(() => {
    if (isMyEmergency && !hasAutoRedirected && emergencyContacts.length > 0) {
      setHasAutoRedirected(true);
      // Tunggu sebentar agar warga melihat notif aplikasi, lalu buka WA kontak pertama
      const timer = setTimeout(() => {
        handleWhatsAppNotify(emergencyContacts[0].number);
      }, 1800);
      return () => clearTimeout(timer);
    }
    // Reset state jika darurat selesai
    if (panicState?.status === 'NONAKTIF') {
      setHasAutoRedirected(false);
    }
  }, [isMyEmergency, emergencyContacts, panicState?.status]);

  const triggerBrowserNotification = (data: PanicState) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('DARURAT! RW 05 GAYAM', {
          body: `Laporan ${data.emergencyType || 'Bahaya'}: ${data.nama} butuh bantuan!`,
          icon: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Logo_Kota_Kediri_-_Seal_of_Kediri_City.svg',
        } as any);
      } catch (e) {}
    }
  };

  const handlePanic = async () => {
    if (!isOnline) return;
    if (!selectedEmergency) {
        if ('vibrate' in navigator) navigator.vibrate(200);
        return;
    }

    // EFEK GETAR KERAS (Hard Vibration Pattern)
    if ('vibrate' in navigator) {
        navigator.vibrate([500, 100, 500, 100, 500, 100, 1000]);
    }

    setLoadingLoc(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      });
      
      const newLoc: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      
      setLocation(newLoc);
      const typeLabel = EMERGENCY_TYPES.find(t => t.id === selectedEmergency)?.label || 'Darurat';
      triggerPanic(user.name, user.address, newLoc, typeLabel, undefined);
    } catch (error) {
      const typeLabel = EMERGENCY_TYPES.find(t => t.id === selectedEmergency)?.label || 'Darurat';
      triggerPanic(user.name, user.address, location || undefined, typeLabel, undefined);
    } finally {
      setLoadingLoc(false);
    }
  };

  const getSignalColor = (accuracy?: number) => {
      if (!accuracy) return 'text-gray-400';
      if (accuracy < 20) return 'text-green-500';
      if (accuracy < 50) return 'text-orange-500';
      return 'text-red-500';
  };

  return (
    <div className={`flex flex-col h-screen transition-colors duration-500 ${isOthersEmergency ? 'bg-red-50 animate-siren' : isTestMode ? (panicState?.testType === 'NIGHT_PATROL' ? 'bg-indigo-50' : panicState?.testType === 'MORNING_ALERT' ? 'bg-orange-50' : 'bg-blue-50') : isMyEmergency ? 'bg-green-50' : 'bg-gray-100'}`}>
      
      <Siren 
        active={(isOthersEmergency || isTestMode) && isMonitoring} 
        isTest={isTestMode}
        residentName={panicState?.nama} 
        residentRT={panicState?.rt}
        emergencyType={panicState?.emergencyType}
        emergencyDescription={panicState?.emergencyDescription}
        providedContext={audioCtxRef.current} 
        testType={panicState?.testType}
        customMessage={panicState?.customMessage}
      />

      <div className="bg-white shadow-md p-4 flex justify-between items-center z-40 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Logo_Kota_Kediri_-_Seal_of_Kediri_City.svg" alt="Logo" className="w-9 h-9" />
          <div>
            <h1 className="font-black text-sm md:text-2xl uppercase tracking-tighter italic leading-none text-gray-900">Siaga RW 05 Gayam</h1>
            <p className="text-[9px] text-gray-400 mt-1 uppercase font-black tracking-widest leading-none">{user.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={onLogout} className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-red-600 transition-colors">Keluar</button>
        </div>
      </div>

      {!isMyEmergency && !isOthersEmergency && !isTestMode && (
          <div className="bg-white px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-4 shrink-0">
                  <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full mb-1 ${gpsPermission === 'granted' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                      <span className="text-[8px] font-black text-gray-400 uppercase italic">GPS</span>
                  </div>
                  <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full mb-1 ${notifPermission === 'granted' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                      <span className="text-[8px] font-black text-gray-400 uppercase italic">Notif</span>
                  </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => setShowPermissionModal(true)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black transition-all shadow-lg uppercase tracking-widest italic ${isMonitoring ? 'bg-green-600 text-white shadow-green-100' : 'bg-red-600 text-white shadow-red-100 animate-pulse'}`}
                >
                    {isMonitoring ? <ShieldCheck size={14}/> : <BellRing size={14}/>}
                    {isMonitoring ? 'Siaga Aktif' : 'Aktifkan'}
                </button>
              </div>
          </div>
      )}

      <div className="flex-1 flex flex-col items-center p-6 relative overflow-y-auto no-scrollbar">
        {isOthersEmergency && (
           <div className="absolute inset-0 bg-red-600 z-50 flex flex-col items-center justify-center text-white p-8 text-center animate-in fade-in duration-500">
             <AlertTriangle size={80} className="mb-6 animate-bounce" />
             <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2">BAHAYA!</h2>
             <p className="text-xs font-black uppercase tracking-widest mb-6 opacity-80">{panicState.emergencyType || 'LAPORAN WARGA'}</p>
             <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-8 w-full max-w-xs">
                <p className="text-xl font-bold italic tracking-tight text-white">{panicState.nama}</p>
             </div>
             {!isMonitoring && (
                 <button onClick={activateFullMonitoring} className="bg-white text-red-600 px-8 py-5 rounded-2xl font-black shadow-2xl text-sm uppercase tracking-widest italic active:scale-95 transition-all">
                    NYALAKAN ALARM
                 </button>
             )}
           </div>
        )}

        {isTestMode && (
           <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center text-white p-8 text-center ${panicState?.testType === 'NIGHT_PATROL' ? 'bg-indigo-900' : panicState?.testType === 'MORNING_ALERT' ? 'bg-orange-600' : 'bg-blue-700'}`}>
             <Radio size={100} className="mb-6 animate-pulse text-white" />
             <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-4 text-white">SIARAN WARGA</h2>
             {!isMonitoring && (
                 <button onClick={activateFullMonitoring} className="bg-white px-8 py-4 rounded-2xl font-black shadow-2xl text-sm uppercase tracking-widest italic text-gray-900">
                    DENGARKAN SIARAN
                 </button>
             )}
           </div>
        )}

        {isMyEmergency ? (
          <div className="w-full max-w-md text-center z-10 animate-in zoom-in-95 duration-500 flex flex-col items-center mt-auto mb-auto">
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-20"></div>
                <div className="w-44 h-44 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-[0_15px_40px_rgba(34,197,94,0.3)] border-4 border-white relative z-10">
                    <CheckCircle size={80} className="text-white" />
                </div>
            </div>
            
            <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase mb-1">LAPORAN TERKIRIM!</h2>
            <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-green-100 mb-8 w-full">
                <div className="flex items-center gap-3 text-green-600 mb-3 justify-center">
                    <HeartPulse size={20} className="animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest italic">{panicState?.emergencyType || 'Instruksi Keamanan'}</span>
                </div>
                <p className="text-xs font-bold text-gray-700 italic leading-relaxed uppercase mb-5 tracking-tight">
                    "MOHON TETAP TENANG. POS KEAMANAN TELAH MENERIMA SINYAL DARURAT ANDA DAN SEDANG MENUJU KE LOKASI SEKARANG."
                </p>
                <div className="space-y-4">
                    <div className="flex items-center gap-3 bg-gray-50 p-3.5 rounded-xl">
                        <Shield size={16} className="text-blue-600" />
                        <p className="text-[9px] font-black uppercase text-gray-500 italic text-left leading-tight">Membuka WhatsApp Petugas otomatis dalam 2 detik...</p>
                    </div>
                    
                    {emergencyContacts.length > 0 && (
                        <div className="pt-4 border-t border-gray-100">
                             <p className="text-[10px] font-black text-gray-400 uppercase italic mb-4">Hubungi Petugas (Manual):</p>
                             <div className="grid grid-cols-1 gap-3">
                                {emergencyContacts.map((contact, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => handleWhatsAppNotify(contact.number)}
                                        className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 uppercase text-[10px] tracking-widest italic shadow-lg"
                                    >
                                        <MessageSquare size={18} /> Hubungi {contact.name}
                                    </button>
                                ))}
                                <button 
                                    onClick={handleCopyText}
                                    className="w-full bg-gray-100 text-gray-600 font-black py-3 rounded-xl flex items-center justify-center gap-3 uppercase text-[9px] tracking-widest italic hover:bg-gray-200 transition-all"
                                >
                                    {copySuccess ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                                    {copySuccess ? 'Tersalin ke Clipboard' : 'Salin Teks Laporan'}
                                </button>
                             </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3 text-gray-400 animate-pulse">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-[9px] font-black uppercase tracking-widest italic">Menunggu Verifikasi Petugas...</span>
            </div>
          </div>
        ) : !isOthersEmergency && !isTestMode && (
          <div className="text-center z-10 flex flex-col items-center w-full max-w-md">
                <div className="mb-6 text-center">
                    <h3 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase leading-none mb-1">SIAGA<br/>DARURAT</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">RW 05 KELURAHAN GAYAM</p>
                </div>

                <div className="w-full mb-8">
                    <div className="flex items-center gap-2 mb-3 ml-2">
                        <ShieldAlert size={14} className="text-red-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 italic">Pilih Jenis Kejadian:</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {EMERGENCY_TYPES.map((type) => {
                            const Icon = type.icon;
                            const isSelected = selectedEmergency === type.id;
                            return (
                                <button
                                    key={type.id}
                                    onClick={() => {
                                        setSelectedEmergency(type.id);
                                        if ('vibrate' in navigator) navigator.vibrate(50);
                                    }}
                                    className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all duration-300 text-left ${isSelected ? `border-gray-900 ${type.color} text-white shadow-lg` : 'border-white bg-white text-gray-700 shadow-sm'}`}
                                >
                                    <div className={`p-2 rounded-xl ${isSelected ? 'bg-white/20' : 'bg-gray-100'}`}>
                                        <Icon size={18} className={isSelected ? 'text-white' : type.textColor} />
                                    </div>
                                    <span className={`text-[10px] font-black uppercase leading-none italic tracking-tight ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                        {type.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="relative w-64 h-64 flex items-center justify-center mb-8">
                    {!isPressing && selectedEmergency && (
                        <>
                            <div className="absolute inset-0 rounded-full bg-red-600/20 border-2 border-red-400/30 animate-radar-wave" style={{ animationDelay: '0s' }}></div>
                            <div className="absolute inset-0 rounded-full bg-red-600/20 border-2 border-red-400/30 animate-radar-wave" style={{ animationDelay: '1s' }}></div>
                        </>
                    )}
                    
                    <button
                        onMouseDown={() => setIsPressing(true)}
                        onMouseUp={() => setIsPressing(false)}
                        onTouchStart={() => setIsPressing(true)}
                        onTouchEnd={() => setIsPressing(false)}
                        onClick={handlePanic}
                        className={`relative w-full h-full rounded-full flex items-center justify-center transition-all duration-75 select-none active:translate-y-2 border-[10px] border-white z-10 ${isPressing ? 'bg-red-900 scale-95 shadow-none' : selectedEmergency ? 'bg-red-600 hover:scale-105 shadow-red-200 animate-glow-red' : 'bg-gray-300 cursor-not-allowed opacity-50 grayscale'}`}
                    >
                        <div className="text-white flex flex-col items-center">
                            <AlertTriangle size={60} className="mb-2" />
                            <span className="text-4xl font-black tracking-tighter italic uppercase">PANIC</span>
                        </div>
                    </button>
                    {!selectedEmergency && (
                        <div className="absolute top-full mt-4 bg-white/80 backdrop-blur-md px-4 py-2 rounded-xl border border-red-100 shadow-sm animate-bounce">
                            <p className="text-[10px] font-black text-red-600 uppercase italic tracking-widest">Pilih jenis darurat di atas!</p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-4 w-full">
                    <div className={`px-5 py-2.5 rounded-2xl border flex items-center gap-3 shadow-sm bg-white transition-all ${location ? 'border-gray-100' : 'border-red-100 bg-red-50'}`}>
                        <div className={getSignalColor(location?.accuracy)}>
                            {loadingLoc ? <Loader2 size={16} className="animate-spin" /> : <Signal size={14} />}
                        </div>
                        <p className={`text-[10px] font-black italic uppercase leading-none tracking-tight ${getSignalColor(location?.accuracy)}`}>
                            {location ? `GPS Presisi: ± ${location.accuracy?.toFixed(0)}M` : (loadingLoc ? 'Mencari Lokasi...' : 'GPS Mode Hemat')}
                        </p>
                    </div>

                    {!isMonitoring && (
                        <div className="bg-red-50 border-2 border-red-100 p-5 rounded-[2rem] flex items-center gap-4 text-left">
                            <div className="bg-red-600 text-white p-2.5 rounded-2xl"><HeartPulse size={20} className="animate-pulse" /></div>
                            <p className="text-[10px] text-red-900 font-bold leading-tight italic uppercase tracking-tight text-red-900">
                                PENTING: Aktifkan <strong>"SIAGA"</strong> agar HP berbunyi saat ada bahaya di RW 05.
                            </p>
                        </div>
                    )}
                    <button 
                        onClick={() => setShowBatteryGuide(true)}
                        className="flex items-center justify-center gap-3 py-4 bg-gray-200/50 rounded-2xl text-[9px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-200 transition-all"
                    >
                        <Settings size={14} /> Informasi Sistem
                    </button>
                </div>
          </div>
        )}
      </div>

      {showPermissionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 border-t-8 border-red-600 text-gray-900">
                  <div className="p-8 text-center border-b border-gray-50 text-gray-900">
                      <h3 className="text-2xl font-black italic tracking-tighter uppercase">AKTIFKAN SIAGA</h3>
                      <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mt-1">Lengkapi Perizinan Berikut:</p>
                  </div>
                  <div className="p-8 space-y-6 text-gray-900">
                      <div className="flex items-center gap-5 text-gray-800">
                          <MapPin size={20} className="text-blue-600" />
                          <p className="text-xs font-black italic uppercase leading-none">Izin Lokasi (GPS Aktif)</p>
                      </div>
                      <div className="flex items-center gap-5 text-gray-800">
                          <Volume2 size={20} className="text-red-600" />
                          <p className="text-xs font-black italic uppercase leading-none">Izin Audio & Notifikasi</p>
                      </div>
                      
                      <button onClick={activateFullMonitoring} className="w-full bg-red-600 text-white font-black py-5 rounded-[2rem] shadow-xl uppercase tracking-widest text-xs italic">Aktifkan Sekarang</button>
                      <button onClick={() => setShowPermissionModal(false)} className="w-full text-center text-gray-400 font-bold text-[10px] uppercase py-2">Batal</button>
                  </div>
              </div>
          </div>
      )}

      {showBatteryGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 border-t-8 border-orange-500">
                  <div className="p-8 text-center bg-orange-50/30">
                      <BatteryCharging size={50} className="text-orange-600 mx-auto mb-4" />
                      <h3 className="text-2xl font-black italic tracking-tighter uppercase leading-none text-gray-900">SETTING BATERAI</h3>
                  </div>
                  <div className="p-8 space-y-6">
                      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-4 text-left">
                          <p className="text-[11px] font-bold uppercase italic text-gray-600">Agar aplikasi tetap aktif di HP Android:</p>
                          <p className="text-[10px] font-black uppercase text-gray-800 italic leading-relaxed">1. Masuk Info Aplikasi <br/> 2. Cari Menu Baterai <br/> 3. Pilih "TIDAK DIBATASI" (Unrestricted)</p>
                      </div>
                      <div className="flex flex-col gap-3">
                          <button 
                            onClick={handleDownloadSOP}
                            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 uppercase text-[10px] tracking-widest italic"
                          >
                            <Download size={18} /> Unduh Panduan (SOP)
                          </button>
                          <button 
                            onClick={() => setShowBatteryGuide(false)}
                            className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] italic"
                          >
                            Tutup
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ResidentView;
