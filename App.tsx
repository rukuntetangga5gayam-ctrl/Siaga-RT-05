
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, AppMode, Resident } from './types';
import ResidentView from './components/ResidentView';
import SecurityView from './components/SecurityView';
import { Shield, User, ArrowRight, ChevronDown, Search, Download, X, Smartphone, Wifi, WifiOff, AlertTriangle, Users, Loader2, Power, MapPin, Heart, ShieldAlert, Sparkles, Lock, KeyRound, Eye, EyeOff } from 'lucide-react';
import { subscribeToResidents, subscribeToAccessPassword } from './services/db';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('WELCOME');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // Welcome Security State
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [accessPassword, setAccessPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [showAccessPassword, setShowAccessPassword] = useState(false);

  // Dynamic config from DB
  const [dbAccessPassword, setDbAccessPassword] = useState<string | null>(null);

  // Input State
  const [nameInput, setNameInput] = useState('');
  const [rtInput, setRtInput] = useState('01'); // Default RT
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isLoadingGPS, setIsLoadingGPS] = useState(false);
  
  // Resident List
  const [residentList, setResidentList] = useState<Resident[]>([]);
  
  // PWA Install Prompt State
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Exit Confirmation State
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Wrapper ref for click outside handling
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  // Updated to RT 01 - 05
  const rtOptions = ['01', '02', '03', '04', '05'];

  // --- FUNGSI REQUEST LOCATION ---
  const requestLocation = (onSuccess?: () => void, onError?: () => void) => {
    if ("geolocation" in navigator) {
        setIsLoadingGPS(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setIsLoadingGPS(false);
                if (onSuccess) onSuccess();
            },
            (error) => {
                setIsLoadingGPS(false);
                if (error.code === error.PERMISSION_DENIED) {
                    console.log("Izin lokasi ditolak user.");
                }
                if (onError) onError();
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    } else {
        if (onError) onError();
    }
  };

  useEffect(() => {
    const savedProfile = localStorage.getItem('rt05_user_profile');
    if (savedProfile) {
      setUserProfile(JSON.parse(savedProfile));
    }

    const unsubResidents = subscribeToResidents((data) => {
        setResidentList(data);
    });

    const unsubPassword = subscribeToAccessPassword((password) => {
        setDbAccessPassword(password);
    });
    
    const handleClickOutside = (event: MouseEvent) => {
      if (inputWrapperRef.current && !inputWrapperRef.current.contains(event.target as Node)) {
        setIsInputFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setTimeout(() => setShowInstallBanner(true), 1500);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
        unsubResidents();
        unsubPassword();
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleMulaiClick = () => {
      if ('vibrate' in navigator) navigator.vibrate(50);
      setShowPasswordPrompt(true);
  };

  const handleVerifyAccess = (e: React.FormEvent) => {
      e.preventDefault();
      // Verifikasi terhadap data dari database
      if (dbAccessPassword && accessPassword === dbAccessPassword) {
          if ('vibrate' in navigator) navigator.vibrate([50, 30, 50]);
          requestLocation();
          setMode('HOME');
      } else {
          if ('vibrate' in navigator) navigator.vibrate(200);
          setPasswordError(true);
          setAccessPassword('');
          setTimeout(() => setPasswordError(false), 2000);
      }
  };

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
    if ('vibrate' in navigator) navigator.vibrate(50); 
    const finalName = nameInput.trim();
    
    if (finalName) {
        const existing = residentList.find(r => r.name.toLowerCase() === finalName.toLowerCase());
        const profile: UserProfile = { 
          name: finalName,
          address: existing ? existing.address : `RT ${rtInput}` 
        };
        
        localStorage.setItem('rt05_user_profile', JSON.stringify(profile));
        requestLocation(
            () => {
                setUserProfile(profile);
                setMode('RESIDENT');
            },
            () => {
                setUserProfile(profile);
                setMode('RESIDENT');
            }
        );
    }
  };

  const handleLogout = () => {
    if ('vibrate' in navigator) navigator.vibrate(30);
    localStorage.removeItem('rt05_user_profile');
    setUserProfile(null);
    setMode('HOME');
  };

  const handleSelectSuggestion = (name: string) => {
    if ('vibrate' in navigator) navigator.vibrate(50);
    setNameInput(name);
    setIsInputFocused(false);
  };

  const handleEnterResidentMode = () => {
    if ('vibrate' in navigator) navigator.vibrate(50);
    requestLocation(
        () => setMode('RESIDENT'),
        () => setMode('RESIDENT')
    );
  };

  const handleTriggerExitConfirm = () => {
    if ('vibrate' in navigator) navigator.vibrate(100);
    setShowExitConfirm(true);
  };

  // Logic checks
  const isNameRegistered = residentList.some(r => r.name.toLowerCase() === nameInput.trim().toLowerCase());
  const filteredResidents = residentList.filter(r => 
    r.name.toLowerCase().includes(nameInput.toLowerCase())
  );

  // --- RENDER WELCOME SCREEN ---
  if (mode === 'WELCOME') {
    return (
        <div className="h-screen bg-red-600 flex flex-col items-center justify-center p-8 text-white relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-30">
                <div className="absolute -top-20 -left-20 w-80 h-80 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-pulse"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-white/10 rounded-full"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/5 rounded-full"></div>
                <div className="absolute bottom-[-50px] right-[-50px] w-96 h-96 bg-red-900 rounded-full mix-blend-multiply filter blur-3xl"></div>
            </div>

            <div className="relative z-10 flex flex-col items-center max-w-sm w-full text-center">
                <div className="animate-in fade-in zoom-in duration-1000">
                    <div className="relative h-32 w-32 mb-8 flex items-center justify-center">
                        {/* Radio Wave Ripples */}
                        <div className="absolute inset-0 rounded-full bg-white/40 animate-radio-wave z-0" style={{ animationDelay: '0s' }}></div>
                        <div className="absolute inset-0 rounded-full bg-white/40 animate-radio-wave z-0" style={{ animationDelay: '0.7s' }}></div>
                        <div className="absolute inset-0 rounded-full bg-white/40 animate-radio-wave z-0" style={{ animationDelay: '1.4s' }}></div>
                        
                        {/* Main Icon Button */}
                        <div className="relative z-10 h-full w-full drop-shadow-[0_15px_25px_rgba(0,0,0,0.4)] animate-vibrate animate-shadow-pulse bg-white p-2 rounded-[2.5rem] flex items-center justify-center border-4 border-red-500/20">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-full h-full">
                                <circle cx="256" cy="256" r="180" fill="#dc2626" stroke="#b91212" stroke-width="4"/>
                                <text x="50%" y="54%" font-family="'Inter', sans-serif" font-weight="840" font-size="80" fill="white" text-anchor="middle" letter-spacing="-3">PANIC</text>
                            </svg>
                        </div>
                    </div>
                </div>

                {!showPasswordPrompt ? (
                    <div className="animate-in slide-in-from-bottom-6 duration-700 delay-200">
                        <h1 className="text-4xl font-black tracking-tighter uppercase italic mb-2 animate-text-siaga">SIAGA RW 05</h1>
                        <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-100 mb-2">KELURAHAN GAYAM</p>
                        <div className="h-1 w-16 bg-white/40 rounded-full mx-auto mb-6"></div>
                        <p className="text-sm leading-relaxed opacity-90 mb-10 font-medium px-4">
                            Sistem keamanan digital warga terpadu untuk wilayah RW 05 Kelurahan Gayam - Mojoroto, Kota Kediri.
                        </p>
                        
                        <div className="w-full space-y-4 animate-in slide-in-from-bottom-10 duration-700 delay-500">
                            <button 
                                onClick={handleMulaiClick}
                                className="w-full bg-white text-red-600 font-black py-5 rounded-2xl shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all uppercase tracking-widest italic"
                            >
                                MULAI SEKARANG <ArrowRight size={20} />
                            </button>
                            <div className="flex items-center justify-center gap-6 opacity-60">
                                <div className="flex flex-col items-center gap-1">
                                    <ShieldAlert size={16} />
                                    <span className="text-[8px] font-black uppercase">Keamanan</span>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <Heart size={16} />
                                    <span className="text-[8px] font-black uppercase">Sosial</span>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <Sparkles size={16} />
                                    <span className="text-[8px] font-black uppercase">Modern</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="w-full animate-in zoom-in-95 duration-500">
                         <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/20 shadow-2xl">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Lock size={32} className="text-white" />
                            </div>
                            <h2 className="text-xl font-black uppercase italic tracking-tighter mb-2">Verifikasi Warga</h2>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-red-100 mb-8 leading-relaxed">Masukkan kode keamanan warga <br/>untuk masuk ke aplikasi.</p>
                            
                            <form onSubmit={handleVerifyAccess} className="space-y-4">
                                <div className="relative">
                                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" size={18} />
                                    <input 
                                        type={showAccessPassword ? "text" : "password"}
                                        autoFocus
                                        placeholder="Kode Keamanan..."
                                        className={`w-full bg-white/10 border-2 rounded-2xl py-4 pl-12 pr-12 outline-none transition-all font-black text-center tracking-widest placeholder:text-white/30 placeholder:font-bold placeholder:tracking-normal ${passwordError ? 'border-red-400 bg-red-400/20 animate-shake' : 'border-white/20 focus:border-white focus:bg-white/20'}`}
                                        value={accessPassword}
                                        onChange={(e) => {
                                            if ('vibrate' in navigator) navigator.vibrate(10);
                                            setAccessPassword(e.target.value);
                                            setPasswordError(false);
                                        }}
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowAccessPassword(!showAccessPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                                    >
                                        {showAccessPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>

                                {passwordError && (
                                    <p className="text-[10px] font-black text-white bg-red-500/50 py-2 rounded-lg uppercase italic tracking-widest animate-in slide-in-from-top-2">
                                        Kode Salah! Hubungi Pengurus RW.
                                    </p>
                                )}

                                <button 
                                    type="submit"
                                    disabled={!dbAccessPassword}
                                    className="w-full bg-white text-red-600 font-black py-4 rounded-xl shadow-xl active:scale-95 transition-all uppercase tracking-widest italic text-xs mt-4 disabled:opacity-50"
                                >
                                    {dbAccessPassword ? 'VERIFIKASI & MASUK' : 'Sinkronisasi...'}
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setShowPasswordPrompt(false);
                                        setAccessPassword('');
                                    }}
                                    className="w-full text-white/50 font-black text-[10px] uppercase tracking-widest mt-2 hover:text-white"
                                >
                                    Kembali
                                </button>
                            </form>
                         </div>
                    </div>
                )}
            </div>

            <p className="absolute bottom-8 text-[10px] font-bold uppercase tracking-widest opacity-40">KOTA KEDIRI - HARMONI TERJALIN</p>
        </div>
    );
  }

  // --- RENDER VIEWS ---
  if (mode === 'RESIDENT' && userProfile) {
    return <ResidentView user={userProfile} onLogout={handleLogout} />;
  }

  if (mode === 'SECURITY_DASHBOARD') {
    return <SecurityView onBack={() => setMode('SECURITY')} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-6 font-sans relative">
      
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-visible relative z-10 mt-6 border border-gray-100"> 
        
        <button 
          onClick={handleTriggerExitConfirm}
          className="absolute top-4 right-4 z-20 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all active:scale-95"
          title="Keluar Aplikasi"
        >
          <Power size={20} />
        </button>

        <div className="bg-red-600 p-8 text-center text-white flex flex-col items-center rounded-t-2xl relative">
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Logo_Kota_Kediri_-_Seal_of_Kediri_City.svg" 
            alt="Lambang Kota Kediri" 
            className="h-16 w-auto mb-4 drop-shadow-md"
          />
          <h1 className="text-2xl font-extrabold mb-1 tracking-tight italic uppercase">SIAGA RW 05</h1>
          <p className="text-red-100 text-[10px] font-bold uppercase tracking-widest">Kelurahan Gayam - Mojoroto - Kota Kediri</p>
        </div>

        <div className="p-8">
          <h2 className="text-sm font-black text-black mb-6 text-center uppercase tracking-widest">Pilih Akses Masuk</h2>

          <div className="flex bg-gray-100 rounded-xl p-1 mb-8 shadow-inner">
            <button
              onClick={() => setMode('HOME')}
              disabled={isLoadingGPS}
              className={`flex-1 py-3 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-tighter ${
                mode === 'HOME' ? 'bg-white text-red-600 shadow-md' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users size={16} />
              Warga
            </button>
            <button
              onClick={() => setMode('SECURITY')}
              disabled={isLoadingGPS}
              className={`flex-1 py-3 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-tighter ${
                mode === 'SECURITY' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Shield size={16} />
              Pos Keamanan
            </button>
          </div>

          {mode === 'HOME' && (
             <div className="space-y-6">
                {userProfile ? (
                   <div className="text-center">
                     <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Selamat datang kembali,</p>
                     <h3 className="text-2xl font-black text-gray-900 mb-2 italic uppercase tracking-tighter">{userProfile.name}</h3>
                     <p className="text-[10px] font-black text-red-600 bg-red-50 px-4 py-1.5 rounded-full w-fit mx-auto mb-8 uppercase italic tracking-tighter border border-red-100">{userProfile.address}</p>
                     <button
                        onClick={handleEnterResidentMode}
                        disabled={isLoadingGPS}
                        className={`w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 px-4 rounded-xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-red-100 uppercase tracking-widest italic text-xs ${isLoadingGPS ? 'opacity-75 cursor-wait' : ''}`}
                     >
                        {isLoadingGPS ? (
                            <>
                                <Loader2 size={18} className="animate-spin" /> Memproses...
                            </>
                        ) : (
                            <>
                                Buka Panel Darurat <ArrowRight size={18} />
                            </>
                        )}
                     </button>
                     <button 
                        onClick={handleLogout}
                        disabled={isLoadingGPS}
                        className="mt-6 text-[10px] font-black text-gray-300 uppercase tracking-widest hover:text-red-600"
                     >
                        Ganti Akun
                     </button>
                   </div>
                ) : (
                  <form onSubmit={handleResidentLogin} className="relative">
                    <label className="block text-[10px] font-black text-black mb-2 uppercase tracking-widest ml-1">Identitas Warga</label>
                    <div ref={inputWrapperRef} className="relative mb-4">
                      <div className="relative">
                        <User className="absolute left-4 top-3.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            required
                            className="w-full pl-12 pr-10 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all bg-gray-50 text-gray-900 placeholder-gray-400 font-bold text-sm"
                            placeholder="Ketik Nama Anda..."
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            onFocus={() => setIsInputFocused(true)}
                            autoComplete="off"
                            disabled={isLoadingGPS}
                        />
                        {residentList.length > 0 && (
                            <div className="absolute right-4 top-4 text-gray-300 pointer-events-none">
                                {isInputFocused ? <Search size={16} /> : <ChevronDown size={16} />}
                            </div>
                        )}
                      </div>

                      {isInputFocused && residentList.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
                            {filteredResidents.length > 0 ? (
                                filteredResidents.map(res => (
                                    <button
                                        key={res.id}
                                        type="button"
                                        className="w-full text-left px-5 py-4 hover:bg-red-50 hover:text-red-700 transition-colors border-b border-gray-50 last:border-0"
                                        onClick={() => handleSelectSuggestion(res.name)}
                                    >
                                        <div className="font-black text-gray-800 uppercase italic tracking-tighter">{res.name}</div>
                                        {res.address && <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{res.address}</div>}
                                    </button>
                                ))
                            ) : (
                                <div className="px-5 py-4 text-[10px] font-bold text-gray-400 italic uppercase">
                                    Nama belum terdaftar. Lanjutkan mengetik...
                                </div>
                            )}
                        </div>
                      )}
                    </div>

                    {nameInput.trim().length > 2 && !isNameRegistered && (
                        <div className="mb-6 animate-in slide-in-from-top-2 duration-300">
                             <label className="block text-[10px] font-black text-red-400 uppercase italic mb-2 ml-1">Nama baru! Pilih RT asal Anda:</label>
                             <div className="relative">
                                <MapPin className="absolute left-4 top-3.5 text-red-500" size={18} />
                                <select 
                                    className="w-full pl-12 pr-10 py-3.5 bg-red-50 border border-red-100 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-black text-red-900 appearance-none text-sm italic"
                                    value={rtInput}
                                    onChange={(e) => {
                                        setRtInput(e.target.value);
                                        if ('vibrate' in navigator) navigator.vibrate(50);
                                    }}
                                    disabled={isLoadingGPS}
                                >
                                    {rtOptions.map(rt => <option key={rt} value={rt}>RT {rt}</option>)}
                                </select>
                                <ChevronDown className="absolute right-4 top-4 text-red-400 pointer-events-none" size={16} />
                             </div>
                        </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoadingGPS}
                      className={`w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 px-4 rounded-xl transition-all shadow-xl shadow-red-100 relative z-0 flex items-center justify-center gap-3 uppercase tracking-widest italic text-xs ${isLoadingGPS ? 'opacity-75 cursor-wait' : ''}`}
                    >
                      {isLoadingGPS ? (
                          <>
                           <Loader2 size={18} className="animate-spin" /> Memproses GPS...
                          </>
                      ) : (
                          "MASUK SEKARANG"
                      )}
                    </button>
                  </form>
                )}
             </div>
          )}

          {mode === 'SECURITY' && (
             <div className="text-center animate-in fade-in duration-500">
                <div className="bg-blue-50 p-6 rounded-2xl mb-8 border border-blue-100">
                  <Shield className="mx-auto text-blue-600 mb-4" size={40} />
                  <p className="text-xs font-bold text-blue-800 leading-relaxed uppercase">
                    KHUSUS MONITOR POS KEAMANAN.<br/>
                    <span className="opacity-70 normal-case font-medium">Layar akan menyala terus menerus dan sirine akan berbunyi otomatis.</span>
                  </p>
                </div>
                <button
                  onClick={() => setMode('SECURITY_DASHBOARD')}
                  className="w-full bg-gray-900 hover:bg-black text-white font-black py-4 px-4 rounded-xl transition-all uppercase tracking-widest italic text-xs shadow-xl"
                >
                  Masuk Dashboard Utama
                </button>
             </div>
          )}
        </div>
      </div>
      
      <p className="mt-8 text-[9px] font-bold text-gray-300 text-center uppercase tracking-widest italic">
        &copy; 2025 RW 05 Kelurahan Gayam. <br/>
        Dalam keadaan Darurat Hubungi 112 (Kota Kediri).
      </p>

      {/* Exit Confirmation */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xs overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-10 text-center">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Power size={40} className="text-red-600" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-2 italic uppercase tracking-tighter">Keluar Aplikasi?</h3>
                    <p className="text-gray-400 text-xs font-bold uppercase leading-relaxed mb-10">Tutup aplikasi Siaga RW 05 Gayam?</p>
                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={() => window.close()}
                            className="w-full bg-red-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-red-100 active:scale-95 transition-all uppercase tracking-widest text-xs italic"
                        >
                            IYA, KELUAR
                        </button>
                        <button 
                            onClick={() => setShowExitConfirm(false)}
                            className="w-full py-4 text-gray-300 font-black hover:text-gray-600 transition-colors uppercase tracking-widest text-[10px]"
                        >
                            BATAL
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* PWA Install Banner */}
      {showInstallBanner && installPrompt && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in slide-in-from-bottom-10 duration-500 border-t-8 border-red-600">
                <div className="p-8 text-center relative">
                     <button 
                        onClick={() => setShowInstallBanner(false)}
                        className="absolute top-6 right-6 text-gray-300 hover:text-red-600"
                     >
                        <X size={20} />
                     </button>
                    <div className="h-16 w-16 mb-4 mx-auto animate-bounce">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                          <circle cx="256" cy="256" r="180" fill="#dc2626" />
                          <text x="50%" y="54%" font-family="sans-serif" font-weight="900" font-size="80" fill="white" text-anchor="middle" letter-spacing="-3">PANIC</text>
                        </svg>
                    </div>
                    <h3 className="text-2xl font-black italic tracking-tighter uppercase mb-2">PASANG APLIKASI</h3>
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Wajib bagi warga RW 05 Gayam</p>
                    
                    <div className="my-8 bg-gray-50 p-4 rounded-2xl">
                        <p className="text-gray-500 text-xs font-medium leading-relaxed italic">
                            Agar notifikasi darurat berbunyi lantang dan GPS tetap akurat meski layar mati, mohon pasang aplikasi ini ke HP Anda.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <button 
                            onClick={handleInstallClick}
                            className="w-full bg-red-600 text-white font-black py-5 px-4 rounded-2xl shadow-2xl shadow-red-100 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase text-xs italic tracking-widest"
                        >
                            <Download size={20} /> PASANG SEKARANG
                        </button>
                        <button 
                            onClick={() => setShowInstallBanner(false)}
                            className="w-full py-2 text-gray-300 text-[10px] font-black uppercase tracking-widest hover:text-gray-500"
                        >
                            Mungkin Nanti
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
