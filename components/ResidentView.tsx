
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, LocationData, PanicState } from '../types';
import { triggerPanic, subscribeToPanicState } from '../services/db';
import { AlertTriangle, MapPin, CheckCircle, ShieldAlert, Smartphone, WifiOff, Signal, Loader2, Power, Info } from 'lucide-react';
import Siren from './Siren';

interface ResidentViewProps {
  user: UserProfile;
  onLogout: () => void;
}

const ResidentView: React.FC<ResidentViewProps> = ({ user, onLogout }) => {
  const [panicState, setPanicState] = useState<PanicState | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(false); 
  const [isPressing, setIsPressing] = useState(false);
  
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Connection State
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Audio & Notification State
  const [isStandbyActive, setIsStandbyActive] = useState(false);
  const prevStatusRef = useRef<string | undefined>(undefined);
  const wakeLockRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);

  // Fungsi Update Location State
  const updateLocationState = (position: GeolocationPosition) => {
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      });
      setGpsAccuracy(position.coords.accuracy);
  };

  // Fungsi Start Watcher (Continuous Tracking)
  // Dijalankan SETELAH izin didapatkan via requestLocationAccess
  const startWatching = () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      
      watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
              updateLocationState(position);
              setLoadingLoc(false);
          },
          (error) => {
              console.warn("Watch Error:", error);
          },
          {
              enableHighAccuracy: true,
              timeout: 30000,
              maximumAge: 0 
          }
      );
  };

  // --- INTI PERUBAHAN: requestLocationAccess ---
  // Menghapus pengecekan isSecureContext.
  // Langsung eksekusi getCurrentPosition saat interaksi user.
  const requestLocationAccess = () => {
    // Cek dasar ketersediaan API di browser (bukan cek security context)
    if (!('geolocation' in navigator)) {
        console.warn("Geolocation API not supported");
        return;
    }

    setLoadingLoc(true);

    // 1. TEMBAK LANGSUNG (Direct Request)
    // Browser akan menangani validasi keamanan (HTTP/HTTPS) dan menampilkan pop-up jika diizinkan.
    navigator.geolocation.getCurrentPosition(
        (position) => {
            // SUKSES: Izin diberikan
            console.log("Initial GPS Lock:", position.coords);
            updateLocationState(position);
            setLoadingLoc(false);
            
            // Lanjut ke mode tracking otomatis
            startWatching();
        },
        (error) => {
            // ERROR: Izin ditolak atau Timeout
            console.warn("GPS Initial Error:", error.code, error.message);
            setLoadingLoc(false);
            
            // Silent Recovery: 
            // Jika error bukan karena "Permission Denied" (Code 1),
            // kita coba nyalakan watcher siapa tau sinyal kembali nanti.
            if (error.code !== 1) {
                startWatching();
            }
            // Jika Code 1 (Denied), kita stop loading dan biarkan user klik tombol lagi nanti.
        },
        { 
            enableHighAccuracy: true, // Wajib TRUE untuk memancing sensor GPS Hardware
            timeout: 30000,           // 30 Detik untuk memberi waktu user klik "Allow"
            maximumAge: 0             // Jangan pakai cache lama
        }
    );
  };

  // --- STARTUP HANDLER ---
  const handleSystemStart = async () => {
      // 1. Trigger GPS segera
      requestLocationAccess();

      // 2. Trigger Audio Context & Wake Lock
      activateStandbyMode();

      // 3. Masuk ke tampilan utama
      setHasInitialized(true);
  };

  const activateStandbyMode = async () => {
    // Notification
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (e) {}
    }

    // Wake Lock
    if ('wakeLock' in navigator && !wakeLockRef.current) {
        try {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (err) {}
    }

    setIsStandbyActive(true);
  };

  const handleInteraction = () => {
      if (!isStandbyActive) activateStandbyMode();
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = subscribeToPanicState((data) => {
      if (data.status === 'AKTIF' && prevStatusRef.current !== 'AKTIF') {
        if (data.nama !== user.name) {
           triggerBrowserNotification(data);
        }
      }
      prevStatusRef.current = data.status;
      setPanicState(data);
    });

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
         activateStandbyMode();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        unsubscribe();
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (wakeLockRef.current) {
            try { wakeLockRef.current.release(); } catch(e) {}
            wakeLockRef.current = null;
        }
    };
  }, [user.name]); 

  const triggerBrowserNotification = (data: PanicState) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const mapUrl = data.lokasi 
          ? `https://www.google.com/maps?q=${data.lokasi.latitude},${data.lokasi.longitude}`
          : null;

        const notif = new Notification('BAHAYA! TETANGGA BUTUH BANTUAN', {
          body: `Warga atas nama ${data.nama} menekan tombol darurat! Segera cek aplikasi Siaga RT 05.`,
          requireInteraction: true, 
          tag: 'resident-panic-alert',
          renotify: true,
          data: { url: mapUrl },
          icon: 'https://cdn-icons-png.flaticon.com/512/1033/1033066.png',
          vibrate: [200, 100, 200, 100, 200, 100, 200]
        } as any);

        notif.onclick = (e) => {
            e.preventDefault();
            window.focus();
            const targetUrl = (e.target as any).data?.url || mapUrl;
            if (targetUrl) window.open(targetUrl, '_blank');
            notif.close();
        };
      } catch (e) {
        console.error("Failed to trigger notification", e);
      }
    }
  };

  const handlePanic = () => {
    if (!isOnline) {
        return;
    }
    
    // Logic Panic:
    // Jika lokasi sudah ada, kirim langsung.
    // Jika belum, coba minta lagi (sebagai backup) lalu kirim.
    if (location) {
        triggerPanic(user.name, location);
    } else {
        setLoadingLoc(true);
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const locData = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    setLocation(locData);
                    setLoadingLoc(false);
                    triggerPanic(user.name, locData);
                },
                (err) => {
                    console.log("Panic sent without location:", err);
                    setLoadingLoc(false);
                    // Tetap kirim panic meski tanpa lokasi
                    triggerPanic(user.name);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } 
            );
        } else {
             triggerPanic(user.name);
        }
    }
  };

  const isMyEmergency = panicState?.status === 'AKTIF' && panicState.nama === user.name;
  const isOthersEmergency = panicState?.status === 'AKTIF' && panicState.nama !== user.name;
  const shouldPlaySiren = isOthersEmergency && isStandbyActive;

  // --- LAYAR AWAL ---
  if (!hasInitialized) {
      return (
        <div className="h-screen bg-red-600 flex flex-col items-center justify-center p-6 text-white text-center relative overflow-hidden">
            {/* Background Accents */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-black rounded-full mix-blend-overlay filter blur-3xl"></div>
            </div>

            <div className="relative z-10 max-w-sm w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Power size={40} className="text-red-600" />
                </div>
                <h1 className="text-2xl font-black uppercase mb-2">Siaga RT 05</h1>
                <p className="text-sm opacity-90 mb-4 leading-relaxed">
                    Aplikasi ini memerlukan Izin Lokasi dan Suara agar dapat berfungsi.
                </p>
                
                <button 
                    onClick={handleSystemStart}
                    className="w-full bg-white text-red-600 font-bold py-4 rounded-xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2 group"
                >
                    <Smartphone size={20} className="group-hover:animate-bounce" />
                    AKTIFKAN SISTEM
                </button>
                
                <p className="mt-6 text-xs text-white/60">
                    <strong>PENTING:</strong><br/>
                    Tunggu Pop-up muncul & pilih <strong>"Allow" / "Izinkan"</strong>.
                </p>
            </div>
        </div>
      );
  }

  // --- TAMPILAN UTAMA ---
  return (
    <div 
        className={`flex flex-col h-screen transition-colors duration-500 ${isOthersEmergency ? 'bg-red-50 animate-siren' : 'bg-gray-100'}`}
        onClick={handleInteraction} 
        onTouchStart={handleInteraction}
    >
      
      <Siren active={shouldPlaySiren} residentName={panicState?.nama} />

      {/* Header */}
      <div className="bg-white shadow-sm p-4 flex justify-between items-center z-10">
        <div>
          <h1 className="font-bold text-gray-800 text-lg">Siaga RT 05</h1>
          <p className="text-xs text-gray-500">Hi, {user.name}</p>
        </div>
        <div className="flex items-center gap-3">
            {!isOnline && (
                <div className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
                    <WifiOff size={14} /> Offline
                </div>
            )}
            <button 
            onClick={onLogout}
            className="text-xs text-gray-500 hover:text-red-600 underline"
            >
            Ganti Nama
            </button>
        </div>
      </div>

      {/* Active Standby Indicator */}
      {isStandbyActive && !isMyEmergency && !isOthersEmergency && (
         <div className="bg-green-600 text-white py-2 px-4 flex items-center justify-between shadow-sm z-20">
            <div className="flex items-center gap-2">
                <Smartphone size={16} className="animate-pulse" />
                <div className="text-[10px] font-bold tracking-wide uppercase leading-tight">
                    Mode Siaga Aktif<br/>
                    <span className="opacity-80 normal-case font-normal">Sistem siap. Jangan tutup tab ini.</span>
                </div>
            </div>
            <div className="h-2 w-2 rounded-full bg-white animate-ping"></div>
         </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        
        {/* Status Indicator */}
        <div className="absolute top-4 w-full px-6 flex flex-col items-center gap-2 z-20">
          
          <button 
            onClick={(e) => { e.stopPropagation(); requestLocationAccess(); }}
            disabled={!!location}
            className={`p-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors w-full shadow-sm select-none ${
                loadingLoc ? 'bg-blue-100 text-blue-700 animate-pulse cursor-wait' 
                : location ? 'bg-green-100 text-green-700 cursor-default' 
                : 'bg-red-100 text-red-700 border border-red-200 cursor-pointer hover:bg-red-200'
            }`}
          >
            {loadingLoc ? <Loader2 size={16} className="animate-spin" /> 
            : location ? <MapPin size={16} /> 
            : <AlertTriangle size={16} />}
            
            {loadingLoc ? 'Meminta Izin Lokasi...' 
            : location ? 'GPS Aktif & Siap' 
            : 'GPS Tidak Terdeteksi (Ketuk)'}
          </button>
          
          {/* Accuracy or Help Text */}
          {location && gpsAccuracy ? (
              <div className="text-[10px] text-gray-500 bg-white/80 px-2 py-1 rounded-full shadow-sm border border-gray-200 flex items-center gap-1">
                  <Signal size={10} /> Akurasi: ±{Math.round(gpsAccuracy)}m
              </div>
          ) : !loadingLoc && !location && (
              <button 
                onClick={(e) => { e.stopPropagation(); requestLocationAccess(); }}
                className="text-[10px] text-red-600 bg-white/90 px-3 py-1 rounded-full text-center shadow-sm font-bold animate-bounce flex items-center gap-1"
              >
                 <Info size={12}/> Klik tombol di atas jika pop-up tidak muncul
              </button>
          )}
        </div>

        {/* --- SCENARIO 1: SOMEONE ELSE'S EMERGENCY --- */}
        {isOthersEmergency && (
           <div className="absolute inset-0 bg-red-600 bg-opacity-95 z-30 flex flex-col items-center justify-center text-white p-8 text-center animate-pulse">
             <AlertTriangle size={80} className="mb-4 animate-bounce" />
             <h2 className="text-3xl font-black uppercase mb-2">PERINGATAN!</h2>
             <p className="text-lg font-bold">Warga Butuh Bantuan</p>
             
             <div className="bg-white text-red-600 rounded-xl p-4 mt-6 w-full shadow-2xl">
                <div className="text-sm text-gray-500 uppercase font-bold">Nama Warga</div>
                <div className="text-2xl font-bold mb-2">{panicState.nama}</div>
                
                {panicState.lokasi && (
                    <a 
                      href={`https://www.google.com/maps?q=${panicState.lokasi.latitude},${panicState.lokasi.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full bg-red-600 text-white font-bold py-3 rounded-lg mt-2 hover:bg-red-700 transition-colors"
                    >
                      LIHAT LOKASI
                    </a>
                )}
             </div>
             
             <p className="mt-8 text-sm opacity-80">
                Segera menuju lokasi jika memungkinkan atau hubungi keamanan.
             </p>
           </div>
        )}

        {/* --- SCENARIO 2: MY OWN EMERGENCY --- */}
        {isMyEmergency ? (
          <div className="text-center z-10">
            <div className="w-48 h-48 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-2xl mb-6 animate-pulse">
              <CheckCircle size={80} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Laporan Terkirim!</h2>
            <p className="text-gray-600 mt-2">Petugas keamanan telah dinotifikasi.</p>
            <p className="text-sm text-gray-400 mt-2 mb-8">Tetap tenang, bantuan segera datang.</p>
            
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl max-w-xs mx-auto text-yellow-800 shadow-sm">
               <p className="font-bold text-sm mb-1 flex items-center justify-center gap-2">
                 <ShieldAlert size={18} />
                 DALAM PENANGANAN
               </p>
               <p className="text-xs opacity-90 leading-relaxed">
                 Hanya petugas keamanan yang dapat mematikan alarm setelah situasi dipastikan aman.
               </p>
            </div>
          </div>
        ) : !isOthersEmergency && (
          // --- SCENARIO 3: STANDBY / PANIC BUTTON ---
          <div className="text-center z-10 flex flex-col items-center w-full">
             
             {/* OFFLINE BLOCKING */}
             {!isOnline ? (
                <div className="w-full max-w-xs bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center border-t-4 border-gray-500">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-500">
                        <WifiOff size={32} />
                    </div>
                    <h3 className="text-xl font-black text-gray-800 mb-2 uppercase text-center">OFFLINE</h3>
                    <p className="text-sm text-gray-600 text-center mb-6 leading-relaxed">
                        Anda tidak terhubung ke internet. Tombol darurat tidak dapat digunakan.
                    </p>
                    <div className="text-xs text-gray-400">Hubungkan ke WiFi atau Data Seluler.</div>
                </div>
             ) : (
                 // --- ACTUAL PANIC BUTTON (ALWAYS VISIBLE) ---
                 <>
                    <button
                        onMouseDown={() => setIsPressing(true)}
                        onMouseUp={() => setIsPressing(false)}
                        onTouchStart={() => setIsPressing(true)}
                        onTouchEnd={() => setIsPressing(false)}
                        onClick={handlePanic}
                        className={`
                            relative w-64 h-64 rounded-full flex items-center justify-center shadow-2xl transition-all duration-100 ease-in-out select-none
                            ${isPressing 
                            ? 'bg-red-700 scale-95 shadow-inner' 
                            : 'bg-gradient-to-br from-red-500 to-red-600 hover:scale-105 shadow-red-300'
                            }
                        `}
                        >
                        <div className="absolute inset-2 rounded-full border-4 border-white/20"></div>
                        <div className="text-white flex flex-col items-center">
                            <AlertTriangle size={64} className="mb-2" />
                            <span className="text-4xl font-black tracking-wider">PANIC</span>
                            <span className="text-xs uppercase opacity-80 mt-1 font-semibold tracking-widest">Tekan Tombol</span>
                        </div>
                    </button>
                    <p className="mt-8 text-gray-500 max-w-xs mx-auto text-sm">
                        Hanya tekan tombol ini jika Anda atau tetangga dalam keadaan bahaya mendesak.
                    </p>
                </>
             )}
          </div>
        )}

        {/* Decorative background rings */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0 opacity-10">
          <div className="w-96 h-96 border-4 border-red-500 rounded-full absolute"></div>
          <div className="w-[30rem] h-[30rem] border-4 border-red-500 rounded-full absolute"></div>
        </div>
      </div>
    </div>
  );
};

export default ResidentView;
