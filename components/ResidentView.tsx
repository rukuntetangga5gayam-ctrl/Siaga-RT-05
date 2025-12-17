
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, LocationData, PanicState } from '../types';
import { triggerPanic, subscribeToPanicState } from '../services/db';
import { AlertTriangle, MapPin, CheckCircle, ShieldAlert, WifiOff, Loader2 } from 'lucide-react';
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
  
  // Connection State
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Audio State & Refs
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

  // Fungsi Watcher (Continuous Tracking) - Dijalankan setelah izin didapat
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

  // --- LOGIKA UTAMA: Request Location Access ---
  const requestLocationAccess = () => {
    if (!('geolocation' in navigator)) {
        return;
    }

    setLoadingLoc(true);

    navigator.geolocation.getCurrentPosition(
        (position) => {
            // SUKSES: Izin diberikan -> Simpan lokasi -> Mulai Tracking
            console.log("GPS Lock Acquired:", position.coords);
            updateLocationState(position);
            setLoadingLoc(false);
            startWatching();
        },
        (error) => {
            // ERROR: Izin ditolak atau timeout
            setLoadingLoc(false);
            
            if (error.code === error.PERMISSION_DENIED) {
                alert("Mohon aktifkan izin lokasi di pengaturan browser Anda untuk melanjutkan.");
            } else {
                console.warn("GPS Initial Error:", error.code, error.message);
                // Tetap coba jalankan watcher di background jika error bukan karena user menolak (Code 1)
                startWatching();
            }
        },
        { 
            enableHighAccuracy: true,
            timeout: 5000, // Timeout 5 detik sesuai permintaan
            maximumAge: 0
        }
    );
  };

  // Request Wake Lock (Screen Always On) saat Panic Terjadi
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator && !wakeLockRef.current) {
        try {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (err) {
            console.log("Wake Lock fail", err);
        }
    }
  };

  // --- USE EFFECT INITIALIZATION ---
  useEffect(() => {
    // 1. OTOMATIS REQUEST LOKASI (Pop-up GPS)
    requestLocationAccess();

    // 2. OTOMATIS REQUEST NOTIFIKASI (Pop-up Notif)
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Listener Online/Offline
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listener Panic State dari Database
    const unsubscribe = subscribeToPanicState((data) => {
      if (data.status === 'AKTIF' && prevStatusRef.current !== 'AKTIF') {
        // Jika ada panic baru (bukan dari diri sendiri), kirim notifikasi browser
        if (data.nama !== user.name) {
           triggerBrowserNotification(data);
        }
        // Aktifkan layar agar tidak mati saat darurat
        requestWakeLock();
      }
      prevStatusRef.current = data.status;
      setPanicState(data);
    });

    // Visibility Change: Refresh GPS saat user kembali ke tab
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
         if (!location) requestLocationAccess();
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
    if (!isOnline) return;
    
    // Kirim Panic ke Database
    if (location) {
        triggerPanic(user.name, location);
    } else {
        // Fallback: Jika lokasi belum ada, coba ambil sekali lagi (one-shot) lalu kirim
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
                    triggerPanic(user.name); // Kirim tanpa lokasi
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 } 
            );
        } else {
             triggerPanic(user.name);
        }
    }
  };

  const isMyEmergency = panicState?.status === 'AKTIF' && panicState.nama === user.name;
  const isOthersEmergency = panicState?.status === 'AKTIF' && panicState.nama !== user.name;
  
  // Sirine bunyi jika ada darurat orang lain
  const shouldPlaySiren = isOthersEmergency;

  // --- TAMPILAN UTAMA ---
  return (
    <div className={`flex flex-col h-screen transition-colors duration-500 ${isOthersEmergency ? 'bg-red-50 animate-siren' : 'bg-gray-100'}`}>
      
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        
        {/* Status GPS Indicator (Hanya Badge Informatif) */}
        <div className="absolute top-4 w-full flex justify-center z-20 pointer-events-none">
          {loadingLoc ? (
            <div className="bg-blue-50/90 backdrop-blur-sm text-blue-700 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm text-xs font-bold border border-blue-100 animate-pulse">
               <Loader2 size={12} className="animate-spin" /> Mencari Lokasi...
            </div>
          ) : location ? (
            <div className="bg-green-50/90 backdrop-blur-sm text-green-700 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm text-xs font-bold border border-green-100">
               <MapPin size={12} /> Lokasi Aktif (±{Math.round(gpsAccuracy || 0)}m)
            </div>
          ) : (
            <div className="bg-orange-50/90 backdrop-blur-sm text-orange-700 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm text-xs font-bold border border-orange-100">
               <AlertTriangle size={12} /> Lokasi Belum Terdeteksi
            </div>
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
          // --- SCENARIO 3: PANIC BUTTON (READY) ---
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
