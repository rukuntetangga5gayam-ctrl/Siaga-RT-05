
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, AppMode, Resident } from './types';
import ResidentView from './components/ResidentView';
import SecurityView from './components/SecurityView';
import { Shield, User, ArrowRight, ChevronDown, Search, Download, X, Smartphone, Wifi, WifiOff, AlertTriangle, Users, Loader2 } from 'lucide-react';
import { subscribeToResidents, isOnlineMode } from './services/db';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('HOME');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // Input State
  const [nameInput, setNameInput] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isLoadingGPS, setIsLoadingGPS] = useState(false);
  
  // Resident List
  const [residentList, setResidentList] = useState<Resident[]>([]);
  
  // PWA Install Prompt State
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Wrapper ref for click outside handling
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  // --- FUNGSI REQUEST LOCATION (Sesuai Snippet) ---
  const requestLocation = (onSuccess?: () => void, onError?: () => void) => {
    if ("geolocation" in navigator) {
        setIsLoadingGPS(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log("Lokasi diizinkan:", position.coords.latitude);
                setIsLoadingGPS(false);
                if (onSuccess) onSuccess();
            },
            (error) => {
                setIsLoadingGPS(false);
                if (error.code === error.PERMISSION_DENIED) {
                    alert("Mohon aktifkan izin lokasi di pengaturan browser Anda untuk melanjutkan.");
                }
                if (onError) onError();
            },
            {
                enableHighAccuracy: true, // Memaksa GPS aktif
                timeout: 5000,
                maximumAge: 0 // Memastikan tidak mengambil data cache lama
            }
        );
    } else {
        alert("Browser Anda tidak mendukung Geolocation.");
        if (onError) onError();
    }
  };

  useEffect(() => {
    // 1. Check local storage for existing user profile
    const savedProfile = localStorage.getItem('rt05_user_profile');
    if (savedProfile) {
      setUserProfile(JSON.parse(savedProfile));
    }

    // 2. Subscribe to resident list updates
    const unsub = subscribeToResidents((data) => {
        setResidentList(data);
    });
    
    // 3. Handle click outside to close suggestions
    const handleClickOutside = (event: MouseEvent) => {
      if (inputWrapperRef.current && !inputWrapperRef.current.contains(event.target as Node)) {
        setIsInputFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    // 4. PWA INSTALL LISTENER
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setTimeout(() => setShowInstallBanner(true), 1500);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. AUTO REQUEST LOCATION ON LOAD (Window OnLoad)
    // Mencoba memancing pop-up saat aplikasi pertama kali dimuat
    requestLocation();

    return () => {
        unsub();
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setShowInstallBanner(false);
    }
  };

  const handleResidentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = nameInput.trim();
    
    if (finalName) {
        const profile: UserProfile = { name: finalName };
        localStorage.setItem('rt05_user_profile', JSON.stringify(profile));

        // Trigger GPS Check sebelum masuk
        requestLocation(
            () => { // Success
                setUserProfile(profile);
                setMode('RESIDENT');
            },
            () => { // Error / Denied
                // Tetap izinkan masuk, tapi nanti ResidentView akan mencoba lagi/menampilkan status
                setUserProfile(profile);
                setMode('RESIDENT');
            }
        );
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('rt05_user_profile');
    setUserProfile(null);
    setMode('HOME');
  };

  const handleSelectSuggestion = (name: string) => {
    setNameInput(name);
    setIsInputFocused(false);
  };

  const handleEnterResidentMode = () => {
    requestLocation(
        () => setMode('RESIDENT'),
        () => setMode('RESIDENT') // Fallback enter
    );
  };

  const filteredResidents = residentList.filter(r => 
    r.name.toLowerCase().includes(nameInput.toLowerCase())
  );

  // Render Resident View
  if (mode === 'RESIDENT' && userProfile) {
    return <ResidentView user={userProfile} onLogout={handleLogout} />;
  }

  // Render Security View
  if (mode === 'SECURITY_DASHBOARD') {
    return <SecurityView onBack={() => setMode('SECURITY')} />;
  }

  // Render Home / Onboarding
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-6 font-sans relative">
      
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-visible relative z-10 mt-6"> 
        
        {/* Header Branding */}
        <div className="bg-red-600 p-8 text-center text-white flex flex-col items-center rounded-t-2xl">
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Logo_Kota_Kediri_-_Seal_of_Kediri_City.svg" 
            alt="Lambang Kota Kediri" 
            className="h-20 w-auto mb-4 drop-shadow-md"
          />
          <h1 className="text-3xl font-extrabold mb-1 tracking-tight">SIAGA RT 05</h1>
          <p className="text-red-100 text-sm">RW 05 Gayam - Mojoroto - Kediri</p>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Pilih Akses Masuk</h2>

          {/* Tab Switcher */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-8">
            <button
              onClick={() => setMode('HOME')}
              disabled={isLoadingGPS}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${
                mode === 'HOME' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users size={18} />
              Warga
            </button>
            <button
              onClick={() => setMode('SECURITY')}
              disabled={isLoadingGPS}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${
                mode === 'SECURITY' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Shield size={18} />
              Pos Keamanan
            </button>
          </div>

          {mode === 'HOME' && (
             <div className="space-y-6">
                {userProfile ? (
                   <div className="text-center">
                     <p className="text-gray-600 mb-4">Selamat datang kembali,</p>
                     <h3 className="text-2xl font-bold text-gray-900 mb-6">{userProfile.name}</h3>
                     <button
                        onClick={handleEnterResidentMode}
                        disabled={isLoadingGPS}
                        className={`w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 ${isLoadingGPS ? 'opacity-75 cursor-wait' : ''}`}
                     >
                        {isLoadingGPS ? (
                            <>
                                <Loader2 size={20} className="animate-spin" /> Memproses Izin GPS...
                            </>
                        ) : (
                            <>
                                Buka Tombol Darurat <ArrowRight size={18} />
                            </>
                        )}
                     </button>
                     <button 
                        onClick={handleLogout}
                        disabled={isLoadingGPS}
                        className="mt-4 text-sm text-gray-400 underline"
                     >
                        Ganti Akun
                     </button>
                   </div>
                ) : (
                  <form onSubmit={handleResidentLogin} className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Identitas Warga</label>
                    
                    {/* Combobox Wrapper */}
                    <div ref={inputWrapperRef} className="relative mb-6">
                      <div className="relative">
                        <User className="absolute left-3 top-3.5 text-gray-400" size={20} />
                        <input
                            type="text"
                            required
                            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all bg-gray-800 text-white placeholder-gray-400"
                            placeholder="Ketik Nama atau Pilih dari List..."
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            onFocus={() => setIsInputFocused(true)}
                            autoComplete="off"
                            disabled={isLoadingGPS}
                        />
                        {/* Indicator Icon */}
                        {residentList.length > 0 && (
                            <div className="absolute right-3 top-3.5 text-gray-400 pointer-events-none">
                                {isInputFocused ? <Search size={18} /> : <ChevronDown size={18} />}
                            </div>
                        )}
                      </div>

                      {/* Suggestions Dropdown */}
                      {isInputFocused && residentList.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                            {filteredResidents.length > 0 ? (
                                filteredResidents.map(res => (
                                    <button
                                        key={res.id}
                                        type="button"
                                        className="w-full text-left px-4 py-3 hover:bg-red-50 hover:text-red-700 transition-colors border-b border-gray-50 last:border-0"
                                        onClick={() => handleSelectSuggestion(res.name)}
                                    >
                                        <div className="font-bold text-gray-800">{res.name}</div>
                                        {res.address && <div className="text-xs text-gray-500">{res.address}</div>}
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-3 text-sm text-gray-500 italic">
                                    Nama tidak ditemukan di daftar. Silakan lanjutkan mengetik untuk masuk sebagai nama baru.
                                </div>
                            )}
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isLoadingGPS}
                      className={`w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-lg shadow-red-200 relative z-0 flex items-center justify-center gap-2 ${isLoadingGPS ? 'opacity-75 cursor-wait' : ''}`}
                    >
                      {isLoadingGPS ? (
                          <>
                           <Loader2 size={18} className="animate-spin" /> Memproses Izin GPS...
                          </>
                      ) : (
                          "Masuk"
                      )}
                    </button>
                  </form>
                )}
             </div>
          )}

          {mode === 'SECURITY' && (
             <div className="text-center">
                <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-100">
                  <Shield className="mx-auto text-blue-600 mb-2" size={32} />
                  <p className="text-sm text-blue-800">
                    Mode ini khusus untuk perangkat yang standby di Pos Keamanan (Tablet/Laptop/HP Petugas).
                  </p>
                </div>
                <button
                  onClick={() => setMode('SECURITY_DASHBOARD')}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Masuk Dashboard Keamanan
                </button>
             </div>
          )}
        </div>
      </div>
      
      <p className="mt-8 text-xs text-gray-400 text-center">
        &copy; {new Date().getFullYear()} RT 05 RW 05 Kelurahan Gayam. <br/>
        Dalam Keadaan Darurat Hubungi 112 (Kota Kediri).
      </p>

      {/* PWA Install Modal Notification */}
      {showInstallBanner && installPrompt && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in slide-in-from-bottom-10 duration-500">
                <div className="bg-red-600 p-6 text-center text-white relative">
                     <button 
                        onClick={() => setShowInstallBanner(false)}
                        className="absolute top-4 right-4 text-white/70 hover:text-white"
                     >
                        <X size={20} />
                     </button>
                    <Smartphone className="mx-auto mb-3 animate-bounce" size={48} />
                    <h3 className="text-xl font-extrabold tracking-tight">Pasang Aplikasi Siaga</h3>
                    <p className="text-red-100 text-sm mt-1 font-medium">Wajib dipasang di Handphone Warga</p>
                </div>
                <div className="p-6">
                    <p className="text-gray-700 text-sm text-center mb-6 leading-relaxed">
                        Agar notifikasi darurat dapat berbunyi lantang dan GPS berfungsi akurat, mohon pasang aplikasi ini ke dalam sistem HP Anda.
                    </p>
                    <div className="space-y-3">
                        <button 
                            onClick={handleInstallClick}
                            className="w-full bg-red-600 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-red-200 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Download size={20} />
                            Pasang Aplikasi (Otomatis)
                        </button>
                        <button 
                            onClick={() => setShowInstallBanner(false)}
                            className="w-full py-3 text-gray-400 text-xs font-semibold hover:text-gray-600"
                        >
                            Ingatkan Saya Nanti
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
