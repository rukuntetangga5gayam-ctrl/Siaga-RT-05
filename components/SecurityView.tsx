
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PanicState, Resident, EmergencyContact } from '../types';
import { 
  subscribeToPanicState, 
  resolvePanic, 
  subscribeToResidents, 
  addResident, 
  deleteResident, 
  subscribeToHistory, 
  addHistoryLog, 
  clearHistoryLog, 
  subscribeToConnectionStatus, 
  triggerTest,
  triggerCustomAnnouncement,
  deleteHistoryEntry,
  HistoryEntry,
  subscribeToAccessPassword,
  updateAccessPassword,
  subscribeToEmergencyContacts,
  updateEmergencyContacts
} from '../services/db';
import Siren from './Siren';
import * as XLSX from 'xlsx';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie, Legend, ComposedChart, Line
} from 'recharts';
import { 
  Bell, BellOff, MapPin, Clock, ShieldCheck, History, ExternalLink, 
  User, Settings, Users, Plus, Trash2, X, AlertCircle, Lock, KeyRound, 
  LayoutDashboard, LogOut, ChevronRight, Search, Menu, Eraser,
  Eye, EyeOff, FileText, Save, Timer, Wifi, WifiOff, Volume2, Mic, Zap, Megaphone, PlayCircle, Monitor, UserCheck, CheckCircle, Radio, Navigation, Map as MapIcon,
  AlertTriangle, FileSearch, Trash, Printer, FileUp, Download, Moon, Sun, CalendarClock, Info, ArrowLeft, Target, Maximize2, UserPlus, VolumeX, ShieldAlert, Activity, Heart, Cpu, Calendar, Check, BarChart3, TrendingUp, PieChart as PieIcon, Layers, CalendarRange, FileSpreadsheet, Share2, MessageSquare
} from 'lucide-react';

// Koordinat Presisi RW 05 Gayam, Mojoroto, Kota Kediri
const DEFAULT_LAT = -7.788555;
const DEFAULT_LNG = 111.983277;

const MapComponent = ({ lat, lng, name, accuracy, isIdle = false, zoom = 18 }: { lat: number; lng: number; name?: string; accuracy?: number, isIdle?: boolean, zoom?: number }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<{ map: any; marker: any; circle?: any } | null>(null);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;
    
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, { 
        zoomControl: false,
        attributionControl: false 
      }).setView([lat, lng], isIdle ? 17 : zoom);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        maxZoom: 19,
      }).addTo(map);
      
      let marker = null;
      let circle = null;

      if (!isIdle) {
        const customIcon = L.divIcon({
          className: 'custom-emergency-icon',
          html: `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-16 h-16 bg-red-500 rounded-full animate-ping opacity-20"></div>
              <div class="absolute w-10 h-10 bg-red-600 rounded-full animate-pulse opacity-40"></div>
              <div class="relative w-6 h-6 bg-red-600 rounded-full border-[3px] border-white shadow-2xl flex items-center justify-center">
                <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
              <div class="absolute bottom-full mb-4 bg-red-600 text-white px-4 py-2 rounded-2xl shadow-[0_10px_30px_rgba(220,38,38,0.4)] border-2 border-white whitespace-nowrap animate-bounce" style="animation-duration: 2s;">
                <div class="text-[11px] font-black uppercase italic tracking-tighter leading-none text-white">${name || 'DARURAT'}</div>
                <div class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-red-600"></div>
              </div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
        
        marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        
        if (accuracy) {
          circle = L.circle([lat, lng], { 
            color: '#ef4444', 
            fillColor: '#ef4444', 
            fillOpacity: 0.15, 
            radius: accuracy,
            weight: 2,
            dashArray: '5, 10'
          }).addTo(map);
        }
      } else {
        L.circle([lat, lng], { color: '#3b82f6', fillOpacity: 0.05, radius: 150 }).addTo(map);
        marker = L.circleMarker([lat, lng], { radius: 6, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.8 }).addTo(map);
      }
      
      mapInstanceRef.current = { map, marker, circle };
      setTimeout(() => { if (mapInstanceRef.current) mapInstanceRef.current.map.invalidateSize(); }, 500);
    } else {
      const { map, marker, circle } = mapInstanceRef.current;
      map.panTo([lat, lng], { animate: true });
      
      if (!isIdle && marker) {
        if (marker.setLatLng) marker.setLatLng([lat, lng]);
        if (circle && accuracy) {
          circle.setLatLng([lat, lng]);
          circle.setRadius(accuracy);
        }
      }
    }
  }, [lat, lng, accuracy, isIdle, zoom, name]);

  const centerMap = () => {
    if (mapInstanceRef.current) {
        mapInstanceRef.current.map.setView([lat, lng], isIdle ? 17 : zoom + 1, { animate: true });
    }
  };

  return (
    <div className="h-full w-full relative group">
        <div ref={mapContainerRef} className="h-full w-full z-0 bg-gray-100" />
        <button 
            onClick={centerMap}
            className="absolute bottom-6 right-6 z-10 bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-xl text-gray-700 hover:text-blue-600 transition-all active:scale-90 border border-gray-100"
        >
            <Target size={24} />
        </button>
    </div>
  );
};

const SecurityView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const ADMIN_PASSWORD = 'petugasrt05rw05***#';
  const [viewMode, setViewMode] = useState<'MONITOR' | 'DASHBOARD'>('MONITOR');
  const [dashboardTab, setDashboardTab] = useState<'OVERVIEW' | 'RESIDENTS' | 'LOGS' | 'SETTINGS' | 'ANALYTICS'>('OVERVIEW');
  const [panicState, setPanicState] = useState<PanicState | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [systemTime, setSystemTime] = useState(new Date());

  const [showAdminLoginPassword, setShowAdminLoginPassword] = useState(false);
  const [showResolveAuthModal, setShowResolveAuthModal] = useState(false);
  const [resolvePasswordInput, setResolvePasswordInput] = useState('');
  const [showResolvePassword, setShowResolvePassword] = useState(false);
  const [resolvePasswordError, setResolvePasswordError] = useState(false);

  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const [customAnnounceText, setCustomAnnounceText] = useState('');
  const [historyMapEntry, setHistoryMapEntry] = useState<HistoryEntry | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' } | null>(null);

  const [autoStopDuration, setAutoStopDuration] = useState(120000); 
  const [sirenCycleDuration, setSirenCycleDuration] = useState(10000); 
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
  const [morningScheduleTime, setMorningScheduleTime] = useState('06:00');
  const [nightScheduleTime, setNightScheduleTime] = useState('22:00');
  const [isAutoScheduleEnabled, setIsAutoScheduleEnabled] = useState(false);
  
  const [officialRW, setOfficialRW] = useState('........................................');
  const [officialRT, setOfficialRT] = useState('........................................');
  const [officialSecurity, setOfficialSecurity] = useState('........................................');
  
  const [residentAccessPassword, setResidentAccessPassword] = useState('55555*#');
  
  // Kontak Darurat Baru
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [newContactName, setNewContactName] = useState('');
  const [newContactNumber, setNewContactNumber] = useState('');
  
  const [residents, setResidents] = useState<Resident[]>([]);
  const [historyLog, setHistoryLog] = useState<HistoryEntry[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [newResName, setNewResName] = useState('');
  const [newResRT, setNewResRT] = useState('01');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteResidentId, setDeleteResidentId] = useState<string | null>(null);
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null);
  const [deleteContactIdx, setDeleteContactIdx] = useState<number | null>(null);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [autoStopCountdown, setAutoStopCountdown] = useState<number | null>(null);
  const autoStopTimerRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);
  const clockIntervalRef = useRef<any>(null);
  const lastTriggeredDateRef = useRef<{ morning: string; night: string }>({ morning: '', night: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const prevStatusRef = useRef<string | undefined>(undefined);
  const wakeLockRef = useRef<any>(null);

  const rtOptions = ['01', '02', '03', '04', '05'];

  const triggerToast = (message: string, type: 'success' | 'danger' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
  };

  const analyticsData = useMemo(() => {
      const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return d.toISOString().split('T')[0];
      }).reverse();

      // Tren harian dipisah AKTIF dan TEST
      const weeklyTrend = last7Days.map(date => {
          const aktif = historyLog.filter(log => 
              new Date(log.waktu).toISOString().split('T')[0] === date && log.status === 'AKTIF'
          ).length;
          const test = historyLog.filter(log => 
            new Date(log.waktu).toISOString().split('T')[0] === date && log.status === 'TEST'
          ).length;
          const dayName = new Date(date).toLocaleDateString('id-ID', { weekday: 'short' });
          return { name: dayName, Darurat: aktif, UjiCoba: test };
      });

      const last12Months = Array.from({ length: 12 }, (_, i) => {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          return { month: d.getMonth(), year: d.getFullYear() };
      }).reverse();

      const monthlyTrend = last12Months.map(m => {
          const count = historyLog.filter(log => {
              const d = new Date(log.waktu);
              return d.getMonth() === m.month && d.getFullYear() === m.year && log.status === 'AKTIF';
          }).length;
          const monthName = new Date(m.year, m.month).toLocaleDateString('id-ID', { month: 'short' });
          return { name: monthName, count };
      });

      const hotspotRT = rtOptions.map(rt => {
          const count = historyLog.filter(log => {
              const logRt = log.rt?.replace('RT ', '') || residents.find(r => r.name.toLowerCase() === log.nama.toLowerCase())?.address?.replace('RT ', '');
              return logRt === rt && log.status === 'AKTIF';
          }).length;
          return { name: `RT ${rt}`, count };
      });

      const timeDistribution = [
          { name: 'Pagi (06-12)', value: 0, color: '#f59e0b' },
          { name: 'Siang (12-18)', value: 0, color: '#3b82f6' },
          { name: 'Malam (18-00)', value: 0, color: '#6366f1' },
          { name: 'Dini Hari (00-06)', value: 0, color: '#1e1b4b' },
      ];

      historyLog.filter(l => l.status === 'AKTIF').forEach(log => {
          const hour = new Date(log.waktu).getHours();
          if (hour >= 6 && hour < 12) timeDistribution[0].value++;
          else if (hour >= 12 && hour < 18) timeDistribution[1].value++;
          else if (hour >= 18 && hour < 24) timeDistribution[2].value++;
          else timeDistribution[3].value++;
      });

      // Breakdown Jenis Kejadian
      const typeDistributionData = historyLog
        .filter(l => l.status === 'AKTIF' && l.emergencyType)
        .reduce((acc: any, curr) => {
            const type = curr.emergencyType || 'LAINNYA';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});

      const COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#6366f1', '#10b981', '#06b6d4', '#8b5cf6'];
      const emergencyTypeStats = Object.entries(typeDistributionData).map(([name, value], idx) => ({
          name: name.toUpperCase(),
          value: value as number,
          color: COLORS[idx % COLORS.length]
      })).sort((a: any, b: any) => b.value - a.value);

      const totalEmergencies = historyLog.filter(l => l.status === 'AKTIF').length;
      const totalTests = historyLog.filter(l => l.status === 'TEST').length;
      const topReporter = historyLog.reduce((acc: any, curr) => {
          if (curr.status === 'AKTIF') acc[curr.nama] = (acc[curr.nama] || 0) + 1;
          return acc;
      }, {});
      const busiestReporter = Object.entries(topReporter).sort((a: any, b: any) => b[1] - a[1])[0] || ['-', 0];

      return { weeklyTrend, monthlyTrend, hotspotRT, timeDistribution, emergencyTypeStats, totalEmergencies, totalTests, busiestReporter };
  }, [historyLog, residents, rtOptions]);

  useEffect(() => {
    const unsubResidents = subscribeToResidents(setResidents);
    const unsubHistory = subscribeToHistory(setHistoryLog);
    const unsubConnection = subscribeToConnectionStatus(setIsOnline);
    const unsubPassword = subscribeToAccessPassword(setResidentAccessPassword);
    const unsubWA = subscribeToEmergencyContacts(setEmergencyContacts);
    const unsubPanic = subscribeToPanicState((data) => {
      if (data.status !== 'NONAKTIF' && prevStatusRef.current !== data.status) {
         addHistoryLog(data);
         if (data.status === 'AKTIF') {
            startAutoStopTimer();
         }
      } else if (data.status === 'NONAKTIF' && prevStatusRef.current === 'AKTIF') {
         stopAutoStopTimer();
         setShowResolveAuthModal(false);
         setResolvePasswordInput('');
      }
      prevStatusRef.current = data.status;
      setPanicState(data);
    });

    setOfficialRW(localStorage.getItem('official_rw') || '........................................');
    setOfficialRT(localStorage.getItem('official_rt') || '........................................');
    setOfficialSecurity(localStorage.getItem('official_security') || '........................................');
    
    const savedAutoStop = localStorage.getItem('security_auto_stop_duration');
    if (savedAutoStop) setAutoStopDuration(parseInt(savedAutoStop, 10));

    const savedSirenCycle = localStorage.getItem('security_siren_cycle_duration');
    if (savedSirenCycle) setSirenCycleDuration(parseInt(savedSirenCycle, 10));

    const savedMorningTime = localStorage.getItem('auto_morning_time');
    if (savedMorningTime) setMorningScheduleTime(savedMorningTime);

    const savedNightTime = localStorage.getItem('auto_night_time');
    if (savedNightTime) setNightScheduleTime(savedNightTime);

    const savedVoice = localStorage.getItem('security_voice_enabled');
    if (savedVoice !== null) setVoiceEnabled(savedVoice === 'true');

    const savedAuto = localStorage.getItem('is_auto_schedule_enabled');
    if (savedAuto !== null) setIsAutoScheduleEnabled(savedAuto === 'true');

    return () => {
      unsubResidents(); unsubHistory(); unsubPanic(); unsubConnection(); unsubPassword(); unsubWA();
      stopAutoStopTimer();
      if (wakeLockRef.current) wakeLockRef.current.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    clockIntervalRef.current = setInterval(() => {
      const now = new Date();
      setSystemTime(now);
      
      if (isAutoScheduleEnabled && audioEnabled) {
        const todayStr = now.toDateString();
        const HHmm = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const seconds = now.getSeconds();

        if (seconds === 0) {
            if (HHmm === morningScheduleTime && lastTriggeredDateRef.current.morning !== todayStr) {
              lastTriggeredDateRef.current.morning = todayStr;
              handleTriggerTest('MORNING_ALERT');
            }
            if (HHmm === nightScheduleTime && lastTriggeredDateRef.current.night !== todayStr) {
              lastTriggeredDateRef.current.night = todayStr;
              handleTriggerTest('NIGHT_PATROL');
            }
        }
      }
    }, 1000);
    return () => clearInterval(clockIntervalRef.current);
  }, [audioEnabled, isAutoScheduleEnabled, morningScheduleTime, nightScheduleTime]);

  const startAutoStopTimer = () => {
      stopAutoStopTimer();
      setAutoStopCountdown(autoStopDuration);
      autoStopTimerRef.current = setTimeout(() => resolvePanic('Sistem (Auto-Stop)'), autoStopDuration);

      const startTime = Date.now();
      countdownIntervalRef.current = setInterval(() => {
          const remaining = Math.max(0, autoStopDuration - (Date.now() - startTime));
          setAutoStopCountdown(remaining);
          if (remaining <= 0) stopAutoStopTimer();
      }, 1000);
  };

  const stopAutoStopTimer = () => {
      clearTimeout(autoStopTimerRef.current);
      clearInterval(countdownIntervalRef.current);
      setAutoStopCountdown(null);
  };

  const getAddressByName = (name: string) => residents.find(r => r.name.toLowerCase() === name.toLowerCase())?.address || 'RT 05 Gayam';

  const startMonitoring = async () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext();
        await ctx.resume();
        setAudioCtx(ctx);
        if ('wakeLock' in navigator) wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
    } catch (e) {}
    setAudioEnabled(true);
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      if ('vibrate' in navigator) navigator.vibrate([50, 30, 50]);
      setShowAuthModal(false);
      setViewMode('DASHBOARD');
      setPasswordInput('');
      setShowAdminLoginPassword(false);
    } else {
      if ('vibrate' in navigator) navigator.vibrate(200);
      alert("Password Salah!");
    }
  };

  const handleResolveAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resolvePasswordInput === ADMIN_PASSWORD) {
        if ('vibrate' in navigator) navigator.vibrate([50, 30, 50]);
        resolvePanic('Petugas');
        setShowResolveAuthModal(false);
        setResolvePasswordInput('');
        setShowResolvePassword(false);
        triggerToast('Status darurat berhasil diselesaikan');
    } else {
        if ('vibrate' in navigator) navigator.vibrate(200);
        setResolvePasswordError(true);
        setTimeout(() => setResolvePasswordError(false), 2000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = XLSX.utils.sheet_to_json(XLSX.read(evt.target?.result, { type: 'binary' }).Sheets[XLSX.read(evt.target?.result, { type: 'binary' }).SheetNames[0]], { header: 1 }) as any[];
      data.slice(1).forEach(row => {
        const name = row[0]?.toString().trim();
        if (name) addResident(name, `RT ${row[1]?.toString().trim() || '01'}`);
      });
      triggerToast('Database warga berhasil diimpor');
      setIsImporting(false);
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const data = [
      ["NAMA LENGKAP", "NOMOR RT (Contoh: 01)"],
      ["AHMAD SUBARI", "05"],
      ["SITI NURAINI", "02"],
      ["BUDI SANTOSO", "01"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daftar Warga");
    XLSX.writeFile(wb, "Template_Warga_RW05.xlsx");
  };

  const handleExportLogsExcel = () => {
    const filteredLogs = historyLog.filter(log => {
      const logDate = new Date(log.waktu).toISOString().split('T')[0];
      const start = filterStartDate || '0000-00-00';
      const end = filterEndDate || '9999-99-99';
      return logDate >= start && logDate <= end;
    });

    const data = filteredLogs.map((log, idx) => ({
      "No": idx + 1,
      "Tanggal": new Date(log.waktu).toLocaleDateString('id-ID'),
      "Waktu": new Date(log.waktu).toLocaleTimeString('id-ID'),
      "Nama Pelapor": log.nama,
      "RT": log.rt || getAddressByName(log.nama),
      "Latitude": log.lokasi?.latitude || "-",
      "Longitude": log.lokasi?.longitude || "-",
      "Status": log.status === 'AKTIF' ? 'DARURAT' : 'TEST'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Log Keamanan");
    XLSX.writeFile(wb, `Log_Keamanan_RW05_${new Date().getTime()}.xlsx`);
    triggerToast('File log Excel berhasil diunduh');
  };

  const handleExportResidentsExcel = () => {
    const data = residents.map((res, idx) => ({
      "No": idx + 1,
      "Nama Lengkap": res.name,
      "Alamat RT": res.address
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Database Warga");
    XLSX.writeFile(wb, `Database_Warga_RW05_${new Date().getTime()}.xlsx`);
    triggerToast('Database warga berhasil diekspor ke Excel');
  };

  const handleDownloadReportCard = (log: HistoryEntry) => {
    const text = `
LAPORAN KEJADIAN SIAGA RW 05 GAYAM
----------------------------------
ID Kejadian: ${log.id}
Nama Pelapor: ${log.nama}
Wilayah: RT ${log.rt?.replace('RT ', '') || '05'}
Waktu: ${new Date(log.waktu).toLocaleString('id-ID')}
Koordinat: ${log.lokasi ? `${log.lokasi.latitude}, ${log.lokasi.longitude}` : 'Tidak Ada'}
Link Maps: https://www.google.com/maps/search/?api=1&query=${log.lokasi?.latitude},${log.lokasi?.longitude}
Status: SELESAI
----------------------------------
Dihasilkan secara otomatis oleh Sistem Siaga RW 05 Gayam.
    `;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_${log.nama}_${log.id.slice(0,5)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast('Ringkasan kejadian berhasil diunduh');
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const filteredLogs = historyLog.filter(log => {
        const logDate = new Date(log.waktu).toISOString().split('T')[0];
        const start = filterStartDate || '0000-00-00';
        const end = filterEndDate || '9999-99-99';
        return logDate >= start && logDate <= end;
    });

    let periodLabel = "Seluruh Periode";
    if (filterStartDate && filterEndDate) {
        periodLabel = `${new Date(filterStartDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} s/d ${new Date(filterEndDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else if (filterStartDate) {
        periodLabel = `Mulai ${new Date(filterStartDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else if (filterEndDate) {
        periodLabel = `Sampai ${new Date(filterEndDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }

    let tableRows = filteredLogs.map((log, index) => {
        const date = new Date(log.waktu);
        const coordinate = log.lokasi ? `${log.lokasi.latitude.toFixed(6)}, ${log.lokasi.longitude.toFixed(6)}` : '-';
        return `
            <tr>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${index + 1}</td>
                <td style="border: 1px solid #ddd; padding: 10px;">${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                <td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">${log.nama}</td>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${log.rt || getAddressByName(log.nama)}</td>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-family: monospace; font-size: 9px;">${coordinate}</td>
                <td style="border: 1px solid #ddd; padding: 10px; text-align: center; color: green; font-size: 10px;">${log.status === 'AKTIF' ? 'DARURAT' : 'TEST'}</td>
            </tr>
        `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Laporan Keamanan RW 05 Gayam - ${periodLabel}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #333; font-size: 12px; }
            .header { border-bottom: 3px double #333; padding-bottom: 10px; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; position: relative; }
            .logo { width: 60px; height: auto; position: absolute; left: 0; }
            .header-text { text-align: center; }
            .header-text h1 { margin: 0; font-size: 16px; font-weight: 900; text-transform: uppercase; }
            .header-text h2 { margin: 2px 0; font-size: 14px; font-weight: 700; text-transform: uppercase; }
            .header-text p { margin: 0; font-size: 10px; opacity: 0.8; }
            .report-title { text-align: center; margin-bottom: 20px; }
            .report-title h3 { text-decoration: underline; font-weight: 900; margin-bottom: 5px; font-size: 14px; }
            .report-title p { margin: 0; font-weight: 700; color: #666; font-size: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #f8f8f8; border: 1px solid #ddd; padding: 10px; text-transform: uppercase; font-size: 10px; font-weight: 900; }
            .signature-grid { display: flex; justify-content: space-between; margin-top: 40px; gap: 20px; }
            .signature-item { text-align: center; flex: 1; }
            .signature-item p { margin: 0; font-size: 11px; }
            .signature-space { height: 60px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Logo_Kota_Kediri_-_Seal_of_Kediri_City.svg" class="logo" />
            <div class="header-text">
              <h1>Pemerintah Kota Kediri</h1>
              <h2>KELURAHAN GAYAM - KECAMATAN MOJOROTO</h2>
              <p>Lingkungan RW 05 Gayam - Harmoni Terjalin</p>
            </div>
          </div>
          <div class="report-title">
            <h3>REKAPITULASI AKTIVITAS PANIC BUTTON</h3>
            <p>Periode: ${periodLabel}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th width="5%">No</th>
                <th width="15%">Tanggal</th>
                <th width="10%">Pukul</th>
                <th width="20%">Nama Pelapor</th>
                <th width="10%">RT</th>
                <th width="25%">Koordinat Lokasi</th>
                <th width="15%">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="7" style="text-align:center; padding: 20px;">Belum ada riwayat tercatat pada periode ini.</td></tr>'}
            </tbody>
          </table>
          <div style="text-align: right; margin-bottom: 10px; font-size: 11px;">Kediri, ${today}</div>
          <div class="signature-grid">
            <div class="signature-item">
              <p>Mengetahui,</p>
              <p style="font-weight: bold;">Ketua RW 05 Gayam</p>
              <div class="signature-space"></div>
              <p>( <strong>${officialRW}</strong> )</p>
            </div>
            <div class="signature-item">
              <p>Diperiksa oleh,</p>
              <p style="font-weight: bold;">Ketua RT Setempat</p>
              <div class="signature-space"></div>
              <p>( <strong>${officialRT}</strong> )</p>
            </div>
            <div class="signature-item">
              <p>Dilaporkan oleh,</p>
              <p style="font-weight: bold;">Seksi Keamanan RT</p>
              <div class="signature-space"></div>
              <p>( <strong>${officialSecurity}</strong> )</p>
            </div>
          </div>
          <script>window.print(); setTimeout(() => window.close(), 500);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleTriggerTest = (type: 'GENERAL' | 'NIGHT_PATROL' | 'MORNING_ALERT' = 'GENERAL') => {
      if ('vibrate' in navigator) navigator.vibrate(100);
      triggerTest(type);
  };

  const handleTriggerCustomAnnouncement = () => {
    if (!customAnnounceText.trim()) {
        triggerToast('Teks pengumuman tidak boleh kosong!', 'danger');
        return;
    }
    if ('vibrate' in navigator) navigator.vibrate(100);
    triggerCustomAnnouncement(customAnnounceText);
    triggerToast('Siaran kustom sedang dikirim ke warga...');
    setCustomAnnounceText('');
  };

  const isEmergency = panicState?.status === 'AKTIF';
  const isTesting = panicState?.status === 'TEST';
  const formattedTime = systemTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const formattedDate = systemTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Logic untuk kontak darurat
  const handleAddEmergencyContact = () => {
      if (!newContactName || !newContactNumber) {
          triggerToast('Nama dan Nomor harus diisi!', 'danger');
          return;
      }
      if ('vibrate' in navigator) navigator.vibrate(50);
      const cleanNumber = newContactNumber.replace(/[^0-9]/g, '');
      const newList = [...emergencyContacts, { name: newContactName, number: cleanNumber }];
      setEmergencyContacts(newList);
      setNewContactName('');
      setNewContactNumber('');
      triggerToast('Kontak darurat ditambahkan ke daftar antrian simpan');
  };

  const handleRemoveEmergencyContact = (index: number) => {
      if ('vibrate' in navigator) navigator.vibrate(50);
      const newList = emergencyContacts.filter((_, i) => i !== index);
      setEmergencyContacts(newList);
      triggerToast('Kontak dihapus dari daftar');
  };

  if (!audioEnabled) {
    return (
      <div className="h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-6 text-center">
        <ShieldCheck size={80} className="text-blue-500 mb-6" />
        <h1 className="text-2xl font-black italic uppercase tracking-tighter mb-2">Monitor Pos Keamanan</h1>
        <p className="text-gray-400 mb-8 max-w-xs text-sm">Aktifkan untuk memulai pemantauan wilayah RW 05 secara real-time.</p>
        <button onClick={startMonitoring} className="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-10 rounded-2xl transition-all shadow-2xl flex items-center gap-3 uppercase tracking-widest active:scale-95 text-xs italic">
          <Zap size={20}/> Aktifkan Sekarang
        </button>
        <button onClick={onBack} className="mt-8 text-[10px] text-gray-500 underline uppercase font-bold tracking-widest">Batal</button>
      </div>
    );
  }

  if (viewMode === 'MONITOR') {
    return (
      <div className={`h-screen flex flex-col overflow-hidden transition-all duration-700 ${isEmergency ? 'animate-siren' : isTesting ? 'bg-blue-900' : 'bg-gray-950'}`}>
        <Siren 
          active={isEmergency || isTesting} 
          isTest={isTesting} 
          residentName={panicState?.nama} 
          residentRT={panicState?.rt} 
          emergencyType={panicState?.emergencyType}
          emergencyDescription={panicState?.emergencyDescription}
          providedContext={audioCtx} 
          sirenDuration={sirenCycleDuration} 
          voiceEnabled={voiceEnabled} 
          testType={panicState?.testType} 
          customMessage={panicState?.customMessage} 
        />
        <header className="bg-gray-900/40 backdrop-blur-xl text-white p-3 md:p-5 shadow-2xl flex justify-between items-center z-30 border-b border-white/5">
          <div className="flex items-center gap-3 md:gap-5">
            <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Logo_Kota_Kediri_-_Seal_of_Kediri_City.svg" className="h-8 md:h-12 w-auto filter drop-shadow-md" alt="Logo" />
            <div>
              <h1 className="font-black text-sm md:text-2xl uppercase tracking-tighter italic leading-none">Pusat Komando RW 05</h1>
              <div className="flex items-center gap-2 mt-1.5">
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                  <span className="text-[9px] md:text-[11px] text-gray-400 font-black uppercase tracking-widest italic">{isOnline ? 'Network Secured' : 'Connection Error'}</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 flex justify-center px-4 md:px-0">
             <div className="bg-black/30 px-6 py-2 rounded-2xl border border-white/5 flex items-center gap-6">
                 <div className="text-center">
                    <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Precise Time</p>
                    <p className="text-2xl md:text-3xl font-black font-mono italic tracking-tighter text-white leading-none">{formattedTime}</p>
                 </div>
                 <div className="w-px h-8 bg-white/10 hidden md:block"></div>
                 <div className="hidden md:block">
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Calendar</p>
                    <p className="text-xs font-black uppercase italic text-gray-300 leading-none">{formattedDate}</p>
                 </div>
             </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
             <button onClick={() => setShowAuthModal(true)} className="bg-blue-600 hover:bg-blue-500 p-2.5 md:px-6 md:py-3.5 rounded-2xl text-white shadow-xl active:scale-90 transition-all border border-blue-400/30 flex items-center gap-3">
               <LayoutDashboard size={20}/>
               <span className="hidden md:inline text-[11px] font-black uppercase tracking-widest italic">Admin Panel</span>
             </button>
             <button onClick={onBack} className="bg-white/5 hover:bg-white/10 p-2.5 md:px-6 md:py-3.5 rounded-2xl text-gray-400 active:scale-90 transition-all border border-white/5">
               <ArrowLeft size={20}/>
             </button>
          </div>
        </header>

        <main className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
          {!isEmergency && !isTesting && (
            <div className="hidden lg:flex w-[320px] bg-black/20 backdrop-blur-sm border-r border-white/5 flex-col p-6 animate-in slide-in-from-left duration-700">
                <div className="mb-8">
                   <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest italic mb-6 border-b border-white/5 pb-2">Informasi Wilayah</h3>
                   <div className="space-y-4">
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
                         <div className="flex items-center gap-3 mb-2">
                             <div className="p-2 rounded-lg bg-green-500/10 text-green-500"><ShieldCheck size={18}/></div>
                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-tight">Status Gayam</p>
                         </div>
                         <p className="text-xl font-black text-white italic uppercase tracking-tighter text-white">Situasi Aman</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
                         <div className="flex items-center gap-3 mb-2">
                             <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><Users size={18}/></div>
                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-tight">Cakupan Monitor</p>
                         </div>
                         <p className="text-xl font-black text-white italic uppercase tracking-tighter text-white">{residents.length} Warga Aktif</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
                         <div className="flex items-center gap-3 mb-2">
                             <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500"><Wifi size={18}/></div>
                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-tight">Sinyal GPS Satelit</p>
                         </div>
                         <p className="text-xl font-black text-white italic uppercase tracking-tighter text-white">Normal Sync</p>
                      </div>
                   </div>
                </div>

                <div className="flex-1">
                   <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest italic mb-4 border-b border-white/5 pb-2">Log Kejadian Terakhir</h3>
                   <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar">
                      {historyLog.slice(0, 4).map(log => (
                        <div key={log.id} className="p-3 bg-white/5 rounded-xl border border-white/5">
                            <div className="flex justify-between items-start mb-1">
                                <p className="text-[10px] font-black text-blue-400 italic uppercase truncate max-w-[120px]">{log.nama}</p>
                                <span className="text-[8px] font-bold text-gray-500">{new Date(log.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tight truncate">RT {log.rt?.replace('RT ', '') || '-'}</p>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="mt-auto bg-blue-600/10 border border-blue-500/20 p-5 rounded-3xl">
                   <div className="flex items-center gap-3 mb-3">
                      <Cpu size={20} className="text-blue-500 animate-pulse" />
                      <p className="text-blue-400 text-[9px] font-black uppercase tracking-widest">System Health</p>
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                      <div className="h-1 bg-green-500 rounded-full"></div>
                      <div className="h-1 bg-green-500 rounded-full"></div>
                      <div className="h-1 bg-green-500 rounded-full animate-pulse"></div>
                      <div className="h-1 bg-white/10 rounded-full"></div>
                   </div>
                </div>
            </div>
          )}

          {isEmergency ? (
             <>
              <div className="absolute inset-x-0 bottom-0 md:relative md:inset-auto md:w-full lg:w-[480px] z-20 p-4 md:p-8 animate-in slide-in-from-bottom md:slide-in-from-left duration-500">
                <div className="bg-white rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_30px_70px_rgba(0,0,0,0.5)] overflow-hidden border-t-[12px] border-red-600">
                   <div className="p-7 md:p-10 lg:p-12">
                       <div className="flex items-center gap-6 mb-8 border-b border-gray-100 pb-8">
                          <div className="bg-red-100 p-5 rounded-[2rem] text-red-600 animate-bounce shadow-inner">
                            <AlertTriangle size={40} />
                          </div>
                          <div>
                            <h2 className="text-4xl lg:text-5xl font-black uppercase italic tracking-tighter text-red-600 leading-none mb-2">BAHAYA!</h2>
                            <p className="text-xl lg:text-2xl font-black text-gray-900 uppercase truncate italic leading-none">{panicState?.nama}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <MapPin size={12} className="text-gray-400" />
                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest italic">{panicState?.rt || getAddressByName(panicState?.nama || '')}</span>
                            </div>
                          </div>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-5 mb-10 text-gray-900">
                          <div className="bg-gray-50 rounded-[2rem] p-5 border border-gray-100 shadow-sm">
                             <p className="text-[10px] font-black text-gray-400 uppercase italic mb-1 flex items-center gap-2"><Navigation size={12}/> Akurasi GPS</p>
                             <p className="text-2xl font-black text-blue-600 italic leading-none">±{panicState?.lokasi?.accuracy?.toFixed(0) || '0'}M</p>
                          </div>
                          <div className="bg-gray-50 rounded-[2rem] p-5 border border-gray-100 shadow-sm">
                             <p className="text-[10px] font-black text-gray-400 uppercase italic mb-1 flex items-center gap-2"><Activity size={12}/> Status</p>
                             <p className="text-2xl font-black text-red-600 italic leading-none">AKTIF</p>
                          </div>
                       </div>

                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${panicState?.lokasi?.latitude},${panicState?.lokasi?.longitude}`} target="_blank" className="bg-blue-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 text-xs shadow-2xl hover:bg-blue-700 active:scale-95 transition-all uppercase italic tracking-widest text-white">
                            <ExternalLink size={20}/> Buka Navigasi
                          </a>
                          <button onClick={() => setShowResolveAuthModal(true)} className="bg-gray-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 text-xs shadow-2xl hover:bg-black active:scale-95 transition-all uppercase italic tracking-widest text-white">
                            <BellOff size={20}/> Selesaikan
                          </button>
                       </div>
                       
                       {autoStopCountdown !== null && (
                         <div className="mt-8 flex items-center justify-center gap-3 text-[11px] font-black text-gray-400 uppercase italic tracking-widest">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
                            Auto-stop dalam {Math.ceil(autoStopCountdown / 1000)} Detik
                         </div>
                       )}
                   </div>
                </div>
              </div>
              <div className="flex-1 h-full z-0">
                 {panicState?.lokasi ? (
                    <MapComponent lat={panicState.lokasi.latitude} lng={panicState.lokasi.longitude} name={panicState.nama} accuracy={panicState.lokasi.accuracy} />
                 ) : (
                    <div className="h-full w-full bg-gray-900 flex flex-col items-center justify-center text-gray-700">
                        <WifiOff size={80} className="mb-6 animate-pulse" />
                        <p className="font-black italic uppercase text-2xl tracking-tighter">Koneksi Satelit Terputus</p>
                        <p className="text-xs uppercase font-bold mt-2 opacity-50 tracking-widest">Mencoba menghubungkan kembali...</p>
                    </div>
                 )}
              </div>
             </>
          ) : isTesting ? (
             <div className="h-full w-full flex items-center justify-center p-6 bg-blue-900/40">
               <div className="bg-blue-600 text-white rounded-[4rem] p-12 md:p-24 shadow-[0_40px_100px_rgba(0,0,0,0.5)] animate-pulse text-center max-w-3xl border-8 border-blue-400/50">
                  <div className="bg-white/10 w-32 h-32 md:w-48 md:h-48 rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner">
                    {panicState?.testType === 'NIGHT_PATROL' ? <Moon size={100} /> : panicState?.testType === 'MORNING_ALERT' ? <Sun size={100} /> : <Radio size={100} />}
                  </div>
                  <h2 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter leading-none mb-6">
                    {panicState?.testType === 'NIGHT_PATROL' ? 'SIAGA MALAM' : panicState?.testType === 'MORNING_ALERT' ? 'SIAGA PAGI' : 'BROADCAST TEST'}
                  </h2>
                  <p className="text-lg md:text-2xl font-bold opacity-80 leading-relaxed italic max-w-xl mx-auto mb-14 text-white">
                    {panicState?.testType === 'CUSTOM_ANNOUNCEMENT' ? panicState.customMessage : 'Menyiarkan instruksi keamanan otomatis ke seluruh unit warga RW 05 Gayam.'}
                  </p>
                  <button onClick={() => setShowResolveAuthModal(true)} className="bg-white text-blue-600 font-black px-16 py-6 rounded-3xl shadow-2xl hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-lg italic">Hentikan Siaran</button>
               </div>
             </div>
          ) : (
            <div className="flex-1 h-full flex flex-col lg:flex-row gap-0 lg:gap-4 lg:p-4 text-gray-900">
                <div className="absolute top-8 left-8 lg:left-[350px] z-20 pointer-events-none flex flex-col gap-5">
                    <div className="bg-white/95 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-white pointer-events-auto hidden md:block w-80 text-gray-900">
                        <div className="bg-green-100 w-14 h-14 rounded-2xl flex items-center justify-center text-green-600 mb-6 shadow-inner"><ShieldCheck size={32} /></div>
                        <h2 className="text-3xl font-black text-gray-900 uppercase italic tracking-tighter leading-none mb-3 text-gray-900">Status: Gayam Aman</h2>
                        <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">Seluruh sensor dan unit panic button di wilayah RW 05 beroperasi normal.</p>
                    </div>
                    <div className="bg-gray-900/90 backdrop-blur-xl px-6 py-4 rounded-2xl shadow-2xl border border-white/10 pointer-events-auto flex items-center gap-4 text-white">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></div>
                        <span className="text-white font-black text-[11px] uppercase italic tracking-widest leading-none">Pusat Komando: Monitoring Aktif</span>
                    </div>
                </div>
                <div className="flex-1 h-full rounded-none lg:rounded-[3.5rem] overflow-hidden border-0 lg:border-[12px] border-gray-900 shadow-2xl relative">
                   <MapComponent lat={DEFAULT_LAT} lng={DEFAULT_LNG} isIdle={true} />
                   <div className="absolute bottom-8 left-8 z-10 hidden md:block">
                      <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-black text-gray-600 uppercase italic tracking-widest border border-white shadow-lg">
                         Gayam, Mojoroto - Kota Kediri
                      </div>
                   </div>
                </div>
            </div>
          )}
        </main>

        {showResolveAuthModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
              <div className="bg-white rounded-[3rem] p-10 md:p-14 w-full max-w-md text-center shadow-2xl border-t-[10px] border-red-600 animate-in zoom-in-95">
                  <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                    <KeyRound size={48} className="text-red-600" />
                  </div>
                  <h3 className="font-black text-3xl mb-3 italic uppercase tracking-tighter text-gray-900">Konfirmasi Petugas</h3>
                  <p className="text-gray-500 text-[11px] font-bold uppercase tracking-widest mb-10 leading-relaxed">Masukkan kode otorisasi keamanan <br/>untuk menonaktifkan alarm unit.</p>
                  <form onSubmit={handleResolveAuthSubmit} className="space-y-8">
                      <div className="relative">
                        <input 
                            type={showResolvePassword ? "text" : "password"} 
                            autoFocus 
                            className={`w-full bg-gray-100 border-2 rounded-3xl px-8 py-6 outline-none font-black text-center text-3xl tracking-[0.3em] text-gray-900 ${resolvePasswordError ? 'border-red-500 animate-shake' : 'border-gray-100 focus:border-red-600'}`} 
                            value={resolvePasswordInput} 
                            onChange={(e) => {
                                if ('vibrate' in navigator) navigator.vibrate(10);
                                setResolvePasswordInput(e.target.value);
                            }} 
                        />
                        <button type="button" onClick={() => setShowResolvePassword(!showResolvePassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 p-2 hover:text-red-600 transition-colors">{showResolvePassword ? <EyeOff size={24} /> : <Eye size={24} />}</button>
                      </div>
                      <div className="flex flex-col gap-4">
                          <button type="submit" className="w-full py-6 bg-red-600 text-white rounded-3xl font-black shadow-2xl shadow-red-200 uppercase text-sm tracking-widest italic hover:bg-red-700 active:scale-95 transition-all text-white">Konfirmasi Penyelesaian</button>
                          <button type="button" onClick={() => { setShowResolveAuthModal(false); setShowResolvePassword(false); }} className="w-full py-2 text-gray-400 font-black uppercase text-[11px] tracking-widest hover:text-gray-600">Batalkan</button>
                      </div>
                  </form>
              </div>
          </div>
        )}

        {showAuthModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-xl p-4">
              <div className="bg-white rounded-[3rem] p-12 w-full max-w-md text-center shadow-2xl border-t-[10px] border-blue-600">
                  <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner"><Lock size={48} className="text-blue-600" /></div>
                  <h3 className="font-black text-3xl mb-3 italic uppercase tracking-tighter text-gray-900">Akses Dashboard</h3>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-10 text-gray-500">Otorisasi Khusus Petugas RW 05</p>
                  <form onSubmit={handleAuthSubmit} className="space-y-8">
                      <div className="relative">
                        <input 
                            type={showAdminLoginPassword ? "text" : "password"} 
                            autoFocus 
                            placeholder="PIN ADMIN..." 
                            className="w-full bg-gray-100 border-2 border-gray-100 rounded-3xl px-8 py-6 outline-none focus:border-blue-600 font-black text-center text-2xl tracking-[0.2em] placeholder:tracking-normal text-gray-900" 
                            value={passwordInput} 
                            onChange={(e) => {
                                if ('vibrate' in navigator) navigator.vibrate(10);
                                setPasswordInput(e.target.value);
                            }} 
                        />
                        <button type="button" onClick={() => setShowAdminLoginPassword(!showAdminLoginPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 p-2 hover:text-blue-600">
                           {showAdminLoginPassword ? <EyeOff size={24} /> : <Eye size={24} />}
                        </button>
                      </div>
                      <div className="flex gap-4">
                          <button type="button" onClick={() => { setShowAuthModal(false); setShowAdminLoginPassword(false); }} className="flex-1 py-5 text-gray-400 font-black uppercase text-[11px] tracking-widest hover:text-gray-600">Kembali</button>
                          <button type="submit" className="flex-1 py-5 bg-blue-600 text-white rounded-3xl font-black shadow-2xl shadow-blue-100 uppercase text-xs tracking-widest italic hover:bg-blue-700 transition-all text-white">Masuk Panel</button>
                      </div>
                  </form>
              </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative">
        {toast && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-5 duration-300">
                <div className={`px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-md border ${toast.type === 'success' ? 'bg-green-600/90 border-green-400 text-white' : 'bg-red-600/90 border-red-400 text-white'}`}>
                    {toast.type === 'success' ? <Check size={20} className="shrink-0" /> : <AlertCircle size={20} className="shrink-0" />}
                    <span className="font-black italic uppercase text-[10px] tracking-widest whitespace-nowrap text-white">{toast.message}</span>
                </div>
            </div>
        )}

        <div className="bg-white border-b px-4 md:px-8 py-5 flex justify-between items-center sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-100"><LayoutDashboard size={24} /></div>
                <div>
                    <h1 className="font-black text-base md:text-xl text-gray-900 leading-none italic uppercase tracking-tighter">Panel Administrasi</h1>
                    <p className="text-[9px] md:text-[11px] text-gray-400 mt-1 uppercase font-black tracking-widest italic leading-none">Sistem Siaga RW 05 Gayam</p>
                </div>
            </div>
            <div className="flex items-center gap-3 md:gap-4">
                <button onClick={() => setViewMode('MONITOR')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-3 md:px-6 md:py-3.5 rounded-2xl text-[11px] font-black flex items-center gap-3 transition-all uppercase tracking-widest italic"><Monitor size={18}/><span className="hidden md:inline text-gray-700">Monitor Wilayah</span></button>
                <button onClick={onBack} className="bg-red-50 text-red-600 p-3 md:px-6 md:py-3.5 rounded-2xl text-[11px] font-black flex items-center gap-3 hover:bg-red-100 active:scale-95 transition-all uppercase tracking-widest italic text-red-600"><LogOut size={18}/><span className="hidden md:inline">Keluar Sesi</span></button>
            </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row h-full">
            <div className="w-full md:w-72 bg-white border-b md:border-b-0 md:border-r p-5 md:p-8 flex md:flex-col gap-3 overflow-x-auto no-scrollbar md:h-[calc(100vh-84px)] sticky top-[84px] md:top-auto">
                <p className="hidden md:block text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 italic">Main Menu</p>
                <button onClick={() => setDashboardTab('OVERVIEW')} className={`flex items-center gap-4 px-6 py-4 md:py-5 rounded-3xl text-[11px] font-black transition-all whitespace-nowrap uppercase tracking-widest italic ${dashboardTab === 'OVERVIEW' ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'text-gray-500 hover:bg-gray-50'}`}><LayoutDashboard size={20}/> Ringkasan</button>
                <button onClick={() => setDashboardTab('RESIDENTS')} className={`flex items-center gap-4 px-6 py-4 md:py-5 rounded-3xl text-[11px] font-black transition-all whitespace-nowrap uppercase tracking-widest italic ${dashboardTab === 'RESIDENTS' ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'text-gray-500 hover:bg-gray-50'}`}><Users size={20}/> Database Warga</button>
                <button onClick={() => setDashboardTab('ANALYTICS')} className={`flex items-center gap-4 px-6 py-4 md:py-5 rounded-3xl text-[11px] font-black transition-all whitespace-nowrap uppercase tracking-widest italic ${dashboardTab === 'ANALYTICS' ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'text-gray-500 hover:bg-gray-50'}`}><BarChart3 size={20}/> Analisa & Tren</button>
                <button onClick={() => setDashboardTab('LOGS')} className={`flex items-center gap-4 px-6 py-4 md:py-5 rounded-3xl text-[11px] font-black transition-all whitespace-nowrap uppercase tracking-widest italic ${dashboardTab === 'LOGS' ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'text-gray-500 hover:bg-gray-50'}`}><History size={20}/> Log Aktivitas</button>
                <button onClick={() => setDashboardTab('SETTINGS')} className={`flex items-center gap-4 px-6 py-4 md:py-5 rounded-3xl text-[11px] font-black transition-all whitespace-nowrap uppercase tracking-widest italic ${dashboardTab === 'SETTINGS' ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'text-gray-500 hover:bg-gray-50'}`}><Settings size={20}/> Konfigurasi</button>
            </div>

            <div className="flex-1 p-5 md:p-10 lg:p-14 overflow-y-auto bg-gray-50/50 custom-scrollbar">
                {dashboardTab === 'OVERVIEW' && (
                    <div className="space-y-8 md:space-y-12 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-gray-900">
                            <div className="lg:col-span-2 bg-gray-900 rounded-[3rem] p-10 md:p-16 text-white shadow-2xl relative overflow-hidden border-b-8 border-blue-600">
                                <div className="absolute top-0 right-0 p-12 opacity-5">
                                    <Clock size={200} />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-10">
                                        <div className="bg-blue-600/20 p-4 rounded-2xl border border-blue-500/30 backdrop-blur-md">
                                            <Activity size={28} className="text-blue-400 animate-pulse" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black italic uppercase tracking-widest text-blue-400 leading-none">System Commander</h2>
                                            <p className="text-[9px] font-bold text-blue-400/50 uppercase tracking-widest mt-1">Gayam Atomic Sync Active</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-8">
                                        <h1 className="text-7xl md:text-9xl font-black font-mono tracking-tighter italic leading-none drop-shadow-2xl text-white">
                                            {formattedTime}
                                        </h1>
                                        <div className="pb-3">
                                            <p className="text-2xl font-black uppercase tracking-widest italic leading-none mb-2 text-blue-500">{formattedDate}</p>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]"></div>
                                                <span className="text-[11px] font-black uppercase tracking-widest text-gray-400 italic">Real-Time Monitoring</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-white rounded-[3rem] p-10 border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-blue-500 transition-all duration-500 text-gray-900">
                                <div className="flex justify-between items-start">
                                    <div className={`p-5 rounded-[2rem] shadow-inner ${isAutoScheduleEnabled ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-300'}`}>
                                        <ShieldAlert size={40} />
                                    </div>
                                    <span className={`px-5 py-2 rounded-full text-[11px] font-black uppercase italic tracking-widest ${isAutoScheduleEnabled ? 'bg-green-600 text-white animate-pulse' : 'bg-gray-100 text-gray-400'}`}>
                                        {isAutoScheduleEnabled ? 'System Armed' : 'Disarmed'}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-3xl font-black text-gray-900 italic uppercase tracking-tighter leading-none mb-3">Commander<br/>Status</h3>
                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed italic">
                                        {isAutoScheduleEnabled ? `Broadcast otomatis aktif pada ${morningScheduleTime} & ${nightScheduleTime}` : 'Penjadwalan siaran sedang dinonaktifkan oleh Admin.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-10 md:p-14 rounded-[3.5rem] shadow-sm border border-gray-100 relative overflow-hidden border-t-[12px] border-blue-600 text-gray-900">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-10">
                                <div className="flex-1 space-y-6">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-4 bg-blue-50 text-blue-600 rounded-3xl shadow-inner"><Mic size={32} /></div>
                                        <div>
                                            <h3 className="text-2xl font-black text-gray-900 italic uppercase tracking-tighter leading-none">Broadcast Sosialisasi</h3>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1 italic">Ubah teks menjadi suara di seluruh HP warga</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-gray-400 uppercase italic ml-2">Teks Pengumuman (Ketik di sini...)</label>
                                        <textarea 
                                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-[2rem] px-8 py-6 outline-none focus:border-blue-600 font-bold text-gray-700 shadow-inner min-h-[160px] resize-none text-lg text-gray-900"
                                            placeholder="Contoh: Perhatian warga RW 05, hari Minggu besok pukul 07 pagi akan diadakan kerja bakti serentak. Mohon partisipasinya. Terima kasih."
                                            value={customAnnounceText}
                                            onChange={(e) => setCustomAnnounceText(e.target.value)}
                                        ></textarea>
                                        <div className="flex justify-between px-4">
                                            <p className="text-[9px] font-bold text-gray-300 italic uppercase">Gunakan Bahasa Indonesia yang baku untuk suara lebih jernih</p>
                                            <p className="text-[9px] font-black text-blue-400 uppercase italic">{customAnnounceText.length} Karakter</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full md:w-80 flex flex-col gap-4 self-center md:self-end">
                                    <div className="bg-blue-50 p-6 rounded-[2.5rem] border border-blue-100 mb-2">
                                        <p className="text-[10px] text-blue-800 font-black uppercase italic leading-relaxed text-center">
                                            Suara akan dibacakan oleh asisten digital Siaga RW 05 dengan durasi siaran menyesuaikan panjang teks.
                                        </p>
                                    </div>
                                    <button 
                                        onClick={handleTriggerCustomAnnouncement}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-6 rounded-[2rem] shadow-2xl shadow-blue-200 flex items-center justify-center gap-4 transition-all active:scale-95 uppercase text-sm tracking-widest italic text-white"
                                    >
                                        <Megaphone size={24} /> Siarkan Sekarang
                                    </button>
                                    <button 
                                        onClick={() => setCustomAnnounceText('')}
                                        className="w-full text-gray-400 font-black uppercase text-[10px] tracking-widest py-2 hover:text-gray-600"
                                    >
                                        Hapus Teks
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 text-gray-900">
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between group hover:border-blue-500 hover:shadow-xl transition-all duration-500">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl w-fit mb-6"><Users size={28} /></div>
                                <div>
                                    <p className="text-gray-400 text-[11px] font-black uppercase tracking-widest italic mb-1">Total Database</p>
                                    <h3 className="text-5xl font-black text-gray-900 italic leading-none">{residents.length} <span className="text-lg font-bold text-gray-300">Warga</span></h3>
                                </div>
                            </div>
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between hover:border-blue-500 hover:shadow-xl transition-all duration-500">
                                <div className="p-3 bg-red-50 text-red-600 rounded-2xl w-fit mb-6"><History size={28} /></div>
                                <div>
                                    <p className="text-gray-400 text-[11px] font-black uppercase tracking-widest italic mb-1">Laporan Terakhir</p>
                                    <h3 className="text-2xl font-black text-gray-900 truncate italic leading-tight">{historyLog.length > 0 ? historyLog[0].nama : 'NIHIL'}</h3>
                                </div>
                            </div>
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between hover:border-blue-500 hover:shadow-xl transition-all duration-500">
                                <div className="p-3 bg-green-50 text-green-600 rounded-2xl w-fit mb-6"><Wifi size={28} /></div>
                                <div>
                                    <p className="text-gray-400 text-[11px] font-black uppercase tracking-widest italic mb-1">Server Uplink</p>
                                    <h3 className={`text-2xl font-black italic leading-none ${isOnline ? 'text-green-500' : 'text-red-500'}`}>{isOnline ? 'ONLINE' : 'OFFLINE'}</h3>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                <button onClick={() => handleTriggerTest('GENERAL')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg shadow-blue-100 text-white"><Radio size={22}/><span className="text-[11px] font-black uppercase italic tracking-widest">Tes Broadcast</span></button>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => handleTriggerTest('MORNING_ALERT')} className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-orange-100 text-white">
                                        <Sun size={18}/>
                                        <span className="text-[9px] font-black uppercase italic tracking-tighter">Pagi</span>
                                    </button>
                                    <button onClick={() => handleTriggerTest('NIGHT_PATROL')} className="bg-indigo-700 hover:bg-indigo-800 text-white px-3 py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-indigo-100 text-white">
                                        <Moon size={18}/>
                                        <span className="text-[9px] font-black uppercase italic tracking-tighter">Malam</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[3rem] p-6 md:p-10 border border-gray-100 shadow-sm relative overflow-hidden text-gray-900">
                           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                              <div>
                                <h4 className="text-xl font-black text-gray-800 italic uppercase tracking-tighter flex items-center gap-4"><MapIcon size={24} className="text-blue-600" /> Monitor Wilayah RW 05 Gayam</h4>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1 italic">Koordinat Satelit Mojoroto, Kediri</p>
                              </div>
                              <div className="flex items-center gap-3 bg-blue-50 px-5 py-2.5 rounded-2xl border border-blue-100 text-blue-600">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></div>
                                <span className="text-[10px] font-black uppercase tracking-widest italic">Live Satelit Tracking</span>
                              </div>
                           </div>
                           <div className="h-[400px] md:h-[600px] w-full rounded-[2.5rem] overflow-hidden border-2 border-gray-50 shadow-inner group">
                             <MapComponent lat={DEFAULT_LAT} lng={DEFAULT_LNG} isIdle={true} />
                           </div>
                        </div>
                    </div>
                )}

                {dashboardTab === 'ANALYTICS' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom duration-500 pb-24 text-gray-900">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-3xl font-black text-gray-900 italic uppercase tracking-tighter leading-none">Analisa & Tren</h2>
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-2 italic">Intelligence Dashboard RW 05 Gayam</p>
                            </div>
                            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><Layers size={20}/></div>
                                <span className="text-[10px] font-black uppercase italic tracking-widest pr-4 text-gray-700">Database History: {historyLog.length} entri</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 relative overflow-hidden group border-b-4 border-red-500">
                                <div className="absolute top-0 right-0 p-6 text-red-100 opacity-50"><AlertTriangle size={60}/></div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic mb-2">Total Kejadian Darurat</p>
                                <div className="flex items-end gap-4">
                                  <h3 className="text-5xl font-black text-red-600 italic leading-none">{analyticsData.totalEmergencies}</h3>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-green-500 uppercase flex items-center gap-1"><TrendingUp size={12}/> 100%</span>
                                    <span className="text-[9px] font-bold text-gray-400 uppercase">Response Rate</span>
                                  </div>
                                </div>
                            </div>
                            
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 md:col-span-2 flex flex-col justify-between">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl"><UserCheck size={24}/></div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Anomali & Konsentrasi Laporan</p>
                                </div>
                                <div className="flex items-center justify-between gap-8">
                                  <div className="flex-1">
                                    <h3 className="text-2xl font-black text-gray-900 italic uppercase truncate leading-none mb-2">{analyticsData.busiestReporter[0]}</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase italic tracking-widest">Warga Teraktif: {analyticsData.busiestReporter[1]} Laporan</p>
                                  </div>
                                  <div className="w-px h-12 bg-gray-100 hidden sm:block"></div>
                                  <div className="flex-1 hidden sm:block">
                                    <h3 className="text-2xl font-black text-blue-600 italic uppercase leading-none mb-2">RT 0{analyticsData.hotspotRT.sort((a,b) => b.count - a.count)[0]?.name.split(' ')[1] || '5'}</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase italic tracking-widest">Wilayah Paling Rawan</p>
                                  </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-gray-900">
                            <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
                                <div className="flex items-center justify-between mb-10">
                                    <h4 className="text-xl font-black text-gray-900 italic uppercase tracking-tighter flex items-center gap-3"><TrendingUp className="text-red-600" size={24}/> Tren Aktivitas 7 Hari</h4>
                                    <span className="text-[10px] font-black text-gray-400 uppercase italic">Darurat vs Uji Coba</span>
                                </div>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={analyticsData.weeklyTrend}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#9ca3af'}} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#9ca3af'}} />
                                            <Tooltip 
                                                contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '15px'}}
                                                itemStyle={{fontSize: '12px', fontWeight: 900, textTransform: 'uppercase'}}
                                            />
                                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: '20px', fontSize: '10px', fontWeight: 900}} />
                                            <Bar dataKey="Darurat" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
                                            <Line type="monotone" dataKey="UjiCoba" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
                                <div className="flex items-center justify-between mb-10">
                                    <h4 className="text-xl font-black text-gray-900 italic uppercase tracking-tighter flex items-center gap-3"><Activity className="text-indigo-600" size={24}/> Distribusi Jenis Kejadian</h4>
                                    <span className="text-[10px] font-black text-gray-400 uppercase italic">Kategori Darurat</span>
                                </div>
                                <div className="h-[300px] w-full flex flex-col md:flex-row items-center">
                                    <div className="h-full flex-1 w-full">
                                      <ResponsiveContainer width="100%" height="100%">
                                          <PieChart>
                                              <Pie
                                                  data={analyticsData.emergencyTypeStats}
                                                  cx="50%"
                                                  cy="50%"
                                                  innerRadius={60}
                                                  outerRadius={80}
                                                  paddingAngle={5}
                                                  dataKey="value"
                                              >
                                                  {analyticsData.emergencyTypeStats.map((entry, index) => (
                                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                                  ))}
                                              </Pie>
                                              <Tooltip contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)'}} />
                                          </PieChart>
                                      </ResponsiveContainer>
                                    </div>
                                    <div className="w-full md:w-48 space-y-2 max-h-[250px] overflow-y-auto no-scrollbar py-4 px-2">
                                      {analyticsData.emergencyTypeStats.length > 0 ? analyticsData.emergencyTypeStats.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between gap-3 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
                                          <div className="flex items-center gap-2 truncate">
                                            <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor: item.color}}></div>
                                            <span className="text-[9px] font-black uppercase italic truncate">{item.name}</span>
                                          </div>
                                          <span className="text-[10px] font-black text-gray-900">{item.value}</span>
                                        </div>
                                      )) : (
                                        <p className="text-[10px] text-gray-300 italic text-center uppercase font-bold">Data Nihil</p>
                                      )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-gray-900">
                             <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
                                <div className="flex items-center justify-between mb-10">
                                    <h4 className="text-xl font-black text-gray-900 italic uppercase tracking-tighter flex items-center gap-3"><CalendarRange className="text-indigo-600" size={24}/> Tren 12 Bulan Terakhir</h4>
                                    <span className="text-[10px] font-black text-gray-400 uppercase italic">Frekuensi Bulanan</span>
                                </div>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analyticsData.monthlyTrend}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#9ca3af'}} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#9ca3af'}} />
                                            <Tooltip 
                                                cursor={{fill: '#f9fafb'}}
                                                contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)'}}
                                            />
                                            <Bar dataKey="count" radius={[10, 10, 0, 0]} barSize={40}>
                                                {analyticsData.monthlyTrend.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#6366f1' : '#f3f4f6'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col items-center">
                                <div className="w-full mb-6">
                                    <h4 className="text-xl font-black text-gray-900 italic uppercase tracking-tighter flex items-center gap-3"><Clock className="text-indigo-600" size={24}/> Heatmap Waktu Kejadian</h4>
                                </div>
                                <div className="h-[280px] w-full text-gray-900">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={analyticsData.timeDistribution}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={8}
                                                dataKey="value"
                                            >
                                                {analyticsData.timeDistribution.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip 
                                                contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)'}}
                                            />
                                            <Legend 
                                                verticalAlign="bottom" 
                                                align="center"
                                                iconType="circle"
                                                wrapperStyle={{paddingTop: '20px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase'}}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-gray-900">
                             <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
                                <div className="flex items-center justify-between mb-10">
                                    <h4 className="text-xl font-black text-gray-900 italic uppercase tracking-tighter flex items-center gap-3"><MapPin className="text-red-600" size={24}/> Hotspot Wilayah RT</h4>
                                    <span className="text-[10px] font-black text-gray-400 uppercase italic">RT 01 - 05</span>
                                </div>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analyticsData.hotspotRT}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#9ca3af'}} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#9ca3af'}} />
                                            <Tooltip 
                                                cursor={{fill: '#f9fafb'}}
                                                contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)'}}
                                            />
                                            <Bar dataKey="count" radius={[10, 10, 0, 0]} barSize={35}>
                                                {analyticsData.hotspotRT.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#ef4444' : '#f3f4f6'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-gray-900 p-10 md:p-14 rounded-[3.5rem] shadow-2xl relative overflow-hidden border-b-8 border-red-600">
                                <div className="absolute bottom-0 right-0 p-10 opacity-5"><ShieldAlert size={200}/></div>
                                <div className="relative z-10 text-white">
                                    <h4 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-8 leading-tight">Laporan Intelijen<br/>RW 05 Kelurahan Gayam</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-6">
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shrink-0"><Zap size={20} className="text-white"/></div>
                                                <div>
                                                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 italic">Kesimpulan Keamanan</p>
                                                    <p className="text-xs text-gray-300 font-bold leading-relaxed uppercase italic">
                                                        {analyticsData.totalEmergencies === 0 
                                                            ? "Lingkungan RW 05 terpantau sangat kondusif tanpa catatan darurat aktif." 
                                                            : `Tercatat ${analyticsData.totalEmergencies} insiden. Tren mingguan menunjukkan pergerakan stabil dengan response rate 100%.`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 bg-green-600 rounded-2xl flex items-center justify-center shrink-0"><Check size={20} className="text-white"/></div>
                                                <div>
                                                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1 italic">Integritas Sistem</p>
                                                    <p className="text-xs text-gray-300 font-bold leading-relaxed uppercase italic">Infrastruktur Panic Button aktif 100% dengan total {analyticsData.totalTests} kali validasi siaran uji coba.</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-white/10">
                                            <div className="flex items-center gap-3 mb-6">
                                                <Info size={18} className="text-blue-400"/>
                                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest italic">Rekomendasi Strategis</p>
                                            </div>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase leading-relaxed italic">
                                                Berdasarkan heatmap waktu, perketat patroli pada jam {analyticsData.timeDistribution.sort((a,b) => b.value - a.value)[0]?.name.split(' ')[0]} dan pantau khusus area RT 0{analyticsData.hotspotRT.sort((a,b) => b.count - a.count)[0]?.name.split(' ')[1] || '5'}.
                                            </p>
                                            <button onClick={() => setDashboardTab('LOGS')} className="mt-8 text-[10px] font-black text-white bg-blue-600 px-6 py-2.5 rounded-xl uppercase italic tracking-widest hover:bg-blue-700 transition-all active:scale-95">Analisa Data Log</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {dashboardTab === 'RESIDENTS' && (
                  <div className="space-y-8 md:space-y-12 animate-in slide-in-from-bottom duration-500 pb-24 text-gray-900">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
                            <h3 className="font-black text-2xl text-gray-900 mb-8 flex items-center gap-4 italic uppercase tracking-tighter"><Plus size={24} className="text-blue-600"/> Registrasi Warga Baru</h3>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                if (newResName) { addResident(newResName, `RT ${newResRT}`); setNewResName(''); triggerToast('Warga baru berhasil didaftarkan'); }
                            }} className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-gray-400 uppercase italic ml-2">Nama Lengkap Sesuai KTP</label>
                                    <input required type="text" placeholder="Masukkan nama..." className="w-full bg-gray-50 border-gray-200 rounded-[1.5rem] px-6 py-5 outline-none focus:border-blue-600 font-bold text-sm shadow-inner text-gray-900" value={newResName} onChange={e => setNewResName(e.target.value)} />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-gray-400 uppercase italic ml-2">Nomor RT</label>
                                    <select className="w-full bg-gray-50 border-gray-200 rounded-[1.5rem] px-6 py-5 outline-none focus:border-blue-600 font-bold appearance-none text-sm shadow-inner text-gray-900" value={newResRT} onChange={e => setNewResRT(e.target.value)}>
                                        {rtOptions.map(rt => <option key={rt} value={rt}>RT {rt}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-[1.5rem] hover:bg-blue-700 transition-all uppercase text-[11px] tracking-widest shadow-xl shadow-blue-100 italic text-white">Simpan Data</button>
                                </div>
                            </form>
                        </div>
                        <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center group">
                            <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center text-green-600 mb-6 group-hover:scale-110 transition-transform"><FileUp size={40} /></div>
                            <h4 className="font-black text-gray-900 italic uppercase tracking-tighter text-lg mb-2">Unggah Masal</h4>
                            <p className="text-[11px] text-gray-400 font-bold uppercase mb-6 leading-relaxed italic">Import database warga melalui file .xlsx secara cepat.</p>
                            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.csv" onChange={handleFileUpload} />
                            <div className="flex flex-col gap-3 w-full">
                                <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-green-100 uppercase text-[11px] tracking-widest italic hover:bg-green-700 transition-all text-white">{isImporting ? 'Memproses...' : 'Pilih File Excel'}</button>
                                <button onClick={downloadTemplate} className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl shadow-xl shadow-gray-100 uppercase text-[11px] tracking-widest italic flex items-center justify-center gap-3 hover:bg-black transition-all text-white">
                                  <Download size={18}/> Template File
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden text-gray-900">
                        <div className="p-8 md:p-10 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-100">
                            <div>
                                <h4 className="text-2xl font-black text-gray-900 italic uppercase tracking-tighter leading-none">Database Warga</h4>
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1 italic">Daftar penduduk RW 05 Kelurahan Gayam</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={handleExportResidentsExcel} className="bg-white text-green-600 border border-green-200 px-6 py-4 rounded-2xl text-xs font-black uppercase italic shadow-sm hover:bg-green-50 transition-all flex items-center gap-2">
                                    <FileSpreadsheet size={18}/> Ekspor Excel
                                </button>
                                <div className="relative w-full md:w-80">
                                    <Search className="absolute left-5 top-4.5 text-gray-300" size={20}/>
                                    <input type="text" placeholder="Cari berdasarkan nama..." className="w-full pl-14 pr-8 py-4 bg-white border border-gray-200 rounded-2xl text-xs font-bold outline-none shadow-sm focus:border-blue-500 transition-all text-gray-900" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto max-h-[600px] no-scrollbar">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b text-[11px] text-gray-400 font-black uppercase tracking-widest">
                                    <tr><th className="px-10 py-6">Nama Lengkap</th><th className="px-10 py-6">Wilayah RT</th><th className="px-10 py-6 text-right">Aksi Kelola</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {residents.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase())).map(res => (
                                        <tr key={res.id} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="px-10 py-7 font-black text-gray-900 uppercase italic text-sm">{res.name}</td>
                                            <td className="px-10 py-7"><span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase italic border border-blue-100">Unit {res.address}</span></td>
                                            <td className="px-10 py-7 text-right">
                                                <button onClick={() => setDeleteResidentId(res.id)} className="text-gray-200 hover:text-red-500 transition-all hover:scale-125 p-2"><Trash2 size={22}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {residents.length === 0 && (
                                        <tr><td colSpan={3} className="px-10 py-20 text-center text-gray-300 italic uppercase font-black tracking-widest">Database Kosong</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                  </div>
                )}

                {dashboardTab === 'LOGS' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom duration-500 pb-24 text-gray-900">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm items-end text-gray-900">
                            <div className="space-y-2 md:col-span-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase italic flex items-center gap-2 ml-2"><Calendar size={12}/> Mulai Tanggal</label>
                                <input 
                                    type="date" 
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 font-bold text-sm outline-none focus:border-blue-600 shadow-inner text-gray-900"
                                    value={filterStartDate}
                                    onChange={(e) => setFilterStartDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2 md:col-span-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase italic flex items-center gap-2 ml-2"><Calendar size={12}/> Sampai Tanggal</label>
                                <input 
                                    type="date" 
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 font-bold text-sm outline-none focus:border-blue-600 shadow-inner text-gray-900"
                                    value={filterEndDate}
                                    onChange={(e) => setFilterEndDate(e.target.value)}
                                />
                            </div>
                            <div className="md:col-span-3 flex gap-3">
                                <button onClick={handlePrintReport} className="flex-1 bg-gray-900 text-white font-black px-6 py-4.5 rounded-2xl shadow-xl flex items-center justify-center gap-3 uppercase text-[10px] tracking-widest italic hover:bg-black active:scale-95 transition-all text-white">
                                    <Printer size={20}/> Cetak PDF
                                </button>
                                <button onClick={handleExportLogsExcel} className="flex-1 bg-blue-600 text-white font-black px-6 py-4.5 rounded-2xl shadow-xl shadow-blue-100 flex items-center justify-center gap-3 uppercase text-[10px] tracking-widest italic hover:bg-blue-700 active:scale-95 transition-all text-white">
                                    <FileSpreadsheet size={20}/> Ekspor Excel
                                </button>
                                {(filterStartDate || filterEndDate) && (
                                    <button onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }} className="bg-gray-100 text-gray-500 font-black px-6 py-4.5 rounded-2xl flex items-center justify-center gap-3 uppercase text-[10px] tracking-widest italic hover:bg-gray-200 transition-all">
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-8 md:p-12 border-b bg-gray-50 flex flex-col lg:flex-row justify-between items-center gap-8">
                                <div>
                                    <h4 className="text-3xl font-black text-gray-900 italic uppercase tracking-tighter mb-2 leading-none">Arsip Kejadian</h4>
                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest italic">Dokumentasi Aktivitas Otoritas Keamanan RW 05</p>
                                </div>
                                <div className="flex items-center gap-4 w-full lg:w-auto">
                                    <button onClick={() => { if('vibrate' in navigator) navigator.vibrate(50); setShowClearHistoryConfirm(true); }} className="flex-1 lg:flex-none bg-red-600 text-white font-black px-8 py-5 rounded-2xl flex items-center justify-center gap-4 uppercase text-[11px] tracking-widest italic hover:bg-red-700 active:scale-95 transition-all shadow-xl shadow-red-100 text-white">
                                        <Eraser size={22}/> Reset Log
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-x-auto no-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b text-[11px] font-black text-gray-400 uppercase tracking-widest">
                                        <tr>
                                            <th className="px-10 py-6">Tanggal & Waktu</th>
                                            <th className="px-10 py-6">Nama Pelapor</th>
                                            <th className="px-10 py-6">RT</th>
                                            <th className="px-10 py-6">Koordinat</th>
                                            <th className="px-10 py-6 text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 text-gray-900">
                                        {historyLog
                                          .filter(log => {
                                              const logDate = new Date(log.waktu).toISOString().split('T')[0];
                                              const start = filterStartDate || '0000-00-00';
                                              const end = filterEndDate || '9999-99-99';
                                              return logDate >= start && logDate <= end;
                                          })
                                          .length > 0 ? historyLog
                                            .filter(log => {
                                                const logDate = new Date(log.waktu).toISOString().split('T')[0];
                                                const start = filterStartDate || '0000-00-00';
                                                const end = filterEndDate || '9999-99-99';
                                                return logDate >= start && logDate <= end;
                                            })
                                            .map((log, idx) => (
                                            <tr key={log.id} className="hover:bg-blue-50/30 transition-all group">
                                                <td className="px-10 py-7">
                                                    <div className="text-sm font-black text-gray-900 leading-none mb-1 italic uppercase tracking-tight">{new Date(log.waktu).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</div>
                                                    <div className="text-[10px] font-black text-gray-400 uppercase italic tracking-widest">{new Date(log.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                                                </td>
                                                <td className="px-10 py-7 font-black text-gray-900 italic uppercase text-sm">{log.nama}</td>
                                                <td className="px-10 py-7"><span className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase italic border border-gray-200">RT {log.rt?.replace('RT ', '') || getAddressByName(log.nama)}</span></td>
                                                <td className="px-10 py-7 font-mono text-[10px] text-gray-500 italic">
                                                    {log.lokasi ? `${log.lokasi.latitude.toFixed(4)}, ${log.lokasi.longitude.toFixed(4)}` : '-'}
                                                </td>
                                                <td className="px-10 py-7 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button 
                                                            onClick={() => handleDownloadReportCard(log)}
                                                            className="p-2.5 bg-gray-50 text-gray-400 hover:text-blue-600 rounded-xl transition-all"
                                                            title="Unduh Ringkasan"
                                                        >
                                                            <Share2 size={18}/>
                                                        </button>
                                                        {log.lokasi && (
                                                            <button 
                                                                onClick={() => setHistoryMapEntry(log)}
                                                                className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white p-2.5 rounded-xl transition-all shadow-sm"
                                                            >
                                                                <MapIcon size={18}/>
                                                            </button>
                                                        )}
                                                        <button onClick={() => setDeleteLogId(log.id)} className="text-gray-200 hover:text-red-600 transition-all hover:scale-110 p-2.5">
                                                            <Trash2 size={20}/>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={5} className="px-10 py-24 text-center text-gray-300 italic uppercase font-black tracking-widest">Belum ada riwayat</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {dashboardTab === 'SETTINGS' && (
                    <div className="pb-24 animate-in slide-in-from-bottom duration-500 max-w-5xl space-y-8 text-gray-900">
                        <div className="bg-white p-10 md:p-14 rounded-[3rem] shadow-sm border border-gray-100">
                            <h3 className="font-black text-2xl text-gray-900 uppercase italic tracking-tighter mb-10 flex items-center gap-4"><ShieldAlert className="text-red-600" size={32}/> Pengaturan Sistem & Audio</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-6">
                                    <label className="text-[11px] font-black text-gray-400 uppercase italic block ml-2">Durasi Siklus Sirine (Detik)</label>
                                    <div className="flex items-center gap-6 bg-gray-50 p-6 rounded-3xl shadow-inner">
                                        <input type="range" min="3000" max="30000" step="1000" className="flex-1 accent-red-600 h-2 bg-gray-200 rounded-lg appearance-none" value={sirenCycleDuration} onChange={e => setSirenCycleDuration(parseInt(e.target.value))} />
                                        <span className="font-black text-2xl text-red-600 italic min-w-[60px] text-right">{sirenCycleDuration / 1000}s</span>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <label className="text-[11px] font-black text-gray-400 uppercase italic block ml-2">Waktu Auto-Stop Keamanan (Detik)</label>
                                    <div className="flex items-center gap-6 bg-gray-50 p-6 rounded-3xl shadow-inner">
                                        <input type="range" min="30000" max="300000" step="10000" className="flex-1 accent-red-600 h-2 bg-gray-200 rounded-lg appearance-none" value={autoStopDuration} onChange={e => setAutoStopDuration(parseInt(e.target.value))} />
                                        <span className="font-black text-2xl text-red-600 italic min-w-[60px] text-right">{autoStopDuration / 1000}s</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-10 md:p-14 rounded-[3rem] shadow-sm border border-gray-100">
                            <h3 className="font-black text-2xl text-gray-900 uppercase italic tracking-tighter mb-10 flex items-center gap-4"><Lock className="text-orange-600" size={32}/> Otorisasi & Keamanan Warga</h3>
                            <div className="max-w-xl">
                                <div className="space-y-6">
                                    <label className="text-[11px] font-black text-gray-400 uppercase italic block ml-2">Kode Akses Aplikasi (Warga)</label>
                                    <div className="relative group">
                                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"><KeyRound size={24}/></div>
                                        <input 
                                            type="text" 
                                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-3xl pl-16 pr-8 py-6 font-black text-2xl tracking-[0.2em] text-gray-900 outline-none focus:border-orange-500 focus:bg-white transition-all shadow-inner"
                                            value={residentAccessPassword}
                                            onChange={(e) => setResidentAccessPassword(e.target.value)}
                                            placeholder="Kode Baru..."
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase italic ml-2">Ganti kode ini secara berkala untuk mencegah penyalahgunaan.</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-10 md:p-14 rounded-[3rem] shadow-sm border border-gray-100">
                            <h3 className="font-black text-2xl text-gray-900 uppercase italic tracking-tighter mb-10 flex items-center gap-4"><MessageSquare className="text-green-600" size={32}/> Kontak WhatsApp Darurat</h3>
                            <div className="space-y-8">
                                <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100">
                                    <h4 className="text-sm font-black text-gray-700 uppercase italic mb-6">Tambah Kontak Baru</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase italic ml-2">Nama/Jabatan Petugas</label>
                                            <input 
                                                type="text" 
                                                placeholder="Contoh: Pak RW 05"
                                                className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 font-bold text-sm outline-none focus:border-green-600 shadow-sm text-gray-900"
                                                value={newContactName}
                                                onChange={(e) => setNewContactName(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase italic ml-2">Nomor HP (WhatsApp)</label>
                                            <input 
                                                type="text" 
                                                placeholder="Contoh: 62812345..."
                                                className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 font-bold text-sm outline-none focus:border-green-600 shadow-sm text-gray-900"
                                                value={newContactNumber}
                                                onChange={(e) => setNewContactNumber(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex items-end">
                                            <button 
                                                onClick={handleAddEmergencyContact}
                                                className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-green-100 flex items-center justify-center gap-2 hover:bg-green-700 transition-all uppercase text-[10px] tracking-widest italic text-white"
                                            >
                                                <Plus size={18}/> Tambah Kontak
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase italic mt-4 ml-2">Gunakan format angka tanpa spasi/simbol, misal: 628125555xxx</p>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-sm font-black text-gray-700 uppercase italic ml-2">Daftar Kontak Terdaftar ({emergencyContacts.length})</h4>
                                    {emergencyContacts.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {emergencyContacts.map((contact, idx) => (
                                                <div key={idx} className="bg-white border-2 border-gray-50 p-5 rounded-3xl flex items-center justify-between hover:border-green-500 transition-all group">
                                                    <div className="flex items-center gap-4">
                                                        <div className="bg-green-50 text-green-600 p-3 rounded-2xl group-hover:scale-110 transition-transform">
                                                            <User size={20}/>
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-gray-900 uppercase italic text-sm leading-none mb-1">{contact.name}</p>
                                                            <p className="text-[10px] font-bold text-gray-400">{contact.number}</p>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => setDeleteContactIdx(idx)}
                                                        className="text-gray-300 hover:text-red-600 p-2 transition-colors"
                                                    >
                                                        <Trash2 size={20}/>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-gray-50 border-2 border-dashed border-gray-200 py-12 rounded-[2.5rem] flex flex-col items-center justify-center text-gray-300">
                                            <MessageSquare size={40} className="mb-3 opacity-20"/>
                                            <p className="text-[10px] font-black uppercase tracking-widest italic">Belum ada kontak darurat</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-10 md:p-14 rounded-[3rem] shadow-sm border border-gray-100 text-gray-900">
                            <h3 className="font-black text-2xl text-gray-900 uppercase italic tracking-tighter mb-10 flex items-center gap-4"><CalendarClock className="text-blue-600" size={32}/> Jadwal Detonator Siaran</h3>
                            <div className="space-y-8">
                                <div className="flex items-center justify-between p-8 bg-gray-900 rounded-[2.5rem] border border-white/5 shadow-2xl">
                                    <div className="flex items-center gap-5">
                                        <div className={`p-4 rounded-2xl ${isAutoScheduleEnabled ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-500'}`}><Zap size={24}/></div>
                                        <div>
                                            <p className="font-black text-white uppercase italic tracking-tighter text-lg">Aktifkan Detonator Waktu</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase italic tracking-widest mt-1">Siaran otomatis pagi & malam hari.</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsAutoScheduleEnabled(!isAutoScheduleEnabled)} className={`w-20 h-10 rounded-full transition-all relative border-2 ${isAutoScheduleEnabled ? 'bg-green-600 border-green-400' : 'bg-gray-800 border-gray-700'}`}>
                                        <div className={`absolute top-1 bg-white w-7 h-7 rounded-full shadow-lg transition-all ${isAutoScheduleEnabled ? 'right-1' : 'left-1'}`}></div>
                                    </button>
                                </div>
                                <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 transition-all duration-500 ${isAutoScheduleEnabled ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                                    <div className="p-8 bg-white border-2 border-gray-100 rounded-[2.5rem] hover:border-blue-500 transition-colors">
                                        <div className="flex items-center gap-3 mb-6">
                                            <Sun size={24} className="text-orange-500" />
                                            <label className="text-[11px] font-black text-gray-400 uppercase italic tracking-widest">Waktu Siaga Pagi</label>
                                        </div>
                                        <input type="time" className="w-full bg-gray-50 border-none rounded-2xl px-8 py-6 font-black text-5xl text-center outline-none focus:ring-4 focus:ring-blue-500/10 text-gray-900" value={morningScheduleTime} onChange={e => setMorningScheduleTime(e.target.value)} />
                                    </div>
                                    <div className="p-8 bg-white border-2 border-gray-100 rounded-[2.5rem] hover:border-blue-500 transition-colors">
                                        <div className="flex items-center gap-3 mb-6">
                                            <Moon size={24} className="text-indigo-600" />
                                            <label className="text-[11px] font-black text-gray-400 uppercase italic tracking-widest">Waktu Siaga Malam</label>
                                        </div>
                                        <input type="time" className="w-full bg-gray-50 border-none rounded-2xl px-8 py-6 font-black text-5xl text-center outline-none focus:ring-4 focus:ring-blue-500/10 text-gray-900" value={nightScheduleTime} onChange={e => setNightScheduleTime(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-10 md:p-14 rounded-[3rem] shadow-sm border border-gray-100 text-gray-900">
                            <h3 className="font-black text-2xl text-gray-900 uppercase italic tracking-tighter mb-10 flex items-center gap-4"><UserPlus className="text-blue-600" size={32}/> Personalia Otoritas</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-gray-900">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-gray-400 uppercase italic block ml-2">Nama Ketua RW 05</label>
                                    <input type="text" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-5 font-black text-sm outline-none focus:border-blue-600 shadow-inner italic text-gray-900" value={officialRW} onChange={e => setOfficialRW(e.target.value)} placeholder="Nama Ketua RW..." />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-gray-400 uppercase italic block ml-2">Nama Ketua RT Setempat</label>
                                    <input type="text" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-5 font-black text-sm outline-none focus:border-blue-600 shadow-inner italic text-gray-900" value={officialRT} onChange={e => setOfficialRT(e.target.value)} placeholder="Nama Ketua RT..." />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-gray-400 uppercase italic block ml-2">Nama Seksi Keamanan RT</label>
                                    <input type="text" className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-5 font-black text-sm outline-none focus:border-blue-600 shadow-inner italic text-gray-900" value={officialSecurity} onChange={e => setOfficialSecurity(e.target.value)} placeholder="Nama Seksi Keamanan..." />
                                </div>
                            </div>
                            <button onClick={() => {
                                updateAccessPassword(residentAccessPassword);
                                updateEmergencyContacts(emergencyContacts);
                                localStorage.setItem('security_auto_stop_duration', autoStopDuration.toString());
                                localStorage.setItem('security_siren_cycle_duration', sirenCycleDuration.toString());
                                localStorage.setItem('auto_morning_time', morningScheduleTime);
                                localStorage.setItem('auto_night_time', nightScheduleTime);
                                localStorage.setItem('is_auto_schedule_enabled', isAutoScheduleEnabled.toString());
                                localStorage.setItem('official_rw', officialRW);
                                localStorage.setItem('official_rt', officialRT);
                                localStorage.setItem('official_security', officialSecurity);
                                triggerToast('Data konfigurasi berhasil disinkronkan');
                            }} className="w-full mt-12 bg-gray-900 text-white font-black py-6 rounded-[2rem] shadow-2xl hover:bg-black active:scale-95 transition-all uppercase text-[11px] tracking-widest italic flex items-center justify-center gap-4 text-white">
                                <Save size={20}/> Simpan & Sinkronkan Konfigurasi
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {historyMapEntry && historyMapEntry.lokasi && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 md:p-10 animate-in fade-in duration-300">
                <div className="bg-white rounded-[3rem] w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl relative text-gray-900">
                    <button 
                        onClick={() => setHistoryMapEntry(null)}
                        className="absolute top-6 right-6 z-[160] bg-black/50 text-white p-3 rounded-full hover:bg-black transition-colors"
                    >
                        <X size={24}/>
                    </button>

                    <div className="p-6 md:p-10 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-5">
                            <div className="bg-blue-50 p-4 rounded-[1.5rem] text-blue-600">
                                <History size={32}/>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 italic uppercase tracking-tighter leading-none">Arsip Lokasi Kejadian</h3>
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1 italic">Pelapor: {historyMapEntry.nama}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => handleDownloadReportCard(historyMapEntry)} className="bg-gray-100 text-gray-700 px-6 py-4 rounded-2xl flex items-center gap-3 text-xs font-black uppercase italic tracking-widest">
                                <Download size={18}/> Unduh Berkas
                            </button>
                            <a 
                                href={`https://www.google.com/maps/dir/?api=1&destination=${historyMapEntry.lokasi.latitude},${historyMapEntry.lokasi.longitude}`} 
                                target="_blank" 
                                className="bg-blue-600 text-white font-black px-6 py-4 rounded-2xl flex items-center justify-center gap-3 text-xs shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all uppercase italic tracking-widest text-white"
                            >
                                <ExternalLink size={18}/> Navigasi Maps
                            </a>
                        </div>
                    </div>

                    <div className="flex-1 relative bg-gray-50">
                        <MapComponent 
                            lat={historyMapEntry.lokasi.latitude} 
                            lng={historyMapEntry.lokasi.longitude} 
                            name={historyMapEntry.nama} 
                            accuracy={historyMapEntry.lokasi.accuracy}
                            zoom={19}
                        />
                    </div>
                </div>
            </div>
        )}

        {deleteLogId && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
                <div className="bg-white rounded-[3rem] p-12 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95 border-t-8 border-red-600 text-gray-900">
                    <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 shadow-inner"><AlertCircle size={40}/></div>
                    <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-3 leading-none">Hapus Log?</h3>
                    <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-10 leading-relaxed">Data kejadian terpilih akan dihapus dari arsip selamanya.</p>
                    <div className="flex gap-4">
                        <button onClick={() => setDeleteLogId(null)} className="flex-1 py-5 text-gray-400 font-black uppercase text-[11px] tracking-widest">Batal</button>
                        <button onClick={() => { deleteHistoryEntry(deleteLogId); setDeleteLogId(null); triggerToast('Satu entri log berhasil dihapus'); }} className="flex-1 py-5 bg-red-600 text-white font-black rounded-2xl uppercase text-xs active:scale-95 shadow-xl shadow-red-200 text-white">Hapus</button>
                    </div>
                </div>
            </div>
        )}

        {deleteContactIdx !== null && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
                <div className="bg-white rounded-[3rem] p-12 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95 border-t-8 border-red-600 text-gray-900">
                    <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 shadow-inner"><Trash2 size={40}/></div>
                    <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-3 leading-none">Hapus Kontak?</h3>
                    <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-10 leading-relaxed">Kontak ini tidak akan lagi muncul <br/> di aplikasi warga saat darurat.</p>
                    <div className="flex gap-4">
                        <button onClick={() => setDeleteContactIdx(null)} className="flex-1 py-5 text-gray-400 font-black uppercase text-[11px] tracking-widest">Batal</button>
                        <button onClick={() => { handleRemoveEmergencyContact(deleteContactIdx); setDeleteContactIdx(null); }} className="flex-1 py-5 bg-red-600 text-white font-black rounded-2xl uppercase text-xs active:scale-95 shadow-xl shadow-red-200 text-white">Hapus</button>
                    </div>
                </div>
            </div>
        )}

        {deleteResidentId && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
                <div className="bg-white rounded-[3rem] p-12 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95 border-t-8 border-red-600 text-gray-900">
                    <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 shadow-inner"><Trash2 size={40}/></div>
                    <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-3 leading-none">Hapus Warga?</h3>
                    <div className="flex gap-4 mt-10">
                        <button onClick={() => setDeleteResidentId(null)} className="flex-1 py-5 text-gray-400 font-black uppercase text-[11px] tracking-widest">Batalkan</button>
                        <button onClick={() => { deleteResident(deleteResidentId); setDeleteResidentId(null); triggerToast('Data warga berhasil dihapus'); }} className="flex-1 py-5 bg-red-600 text-white font-black rounded-2xl uppercase text-xs active:scale-95 shadow-xl shadow-red-200 text-white">Hapus</button>
                    </div>
                </div>
            </div>
        )}

        {showClearHistoryConfirm && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
                <div className="bg-white rounded-[3rem] p-12 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95 border-t-[12px] border-red-600 text-gray-900">
                    <div className="bg-red-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 text-red-600 shadow-inner animate-pulse"><Eraser size={56}/></div>
                    <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-4 leading-none text-gray-900">BERSIHKAN LOG?</h3>
                    <div className="flex flex-col gap-4 mt-8">
                        <button onClick={() => { clearHistoryLog(); setShowClearHistoryConfirm(false); triggerToast('Seluruh riwayat log telah dibersihkan', 'danger'); }} className="w-full py-6 bg-red-600 text-white font-black rounded-[2rem] uppercase text-sm active:scale-95 shadow-2xl shadow-red-200 italic tracking-widest text-white">Iya, Reset Sekarang</button>
                        <button onClick={() => setShowClearHistoryConfirm(false)} className="w-full py-4 text-gray-400 font-black uppercase text-[11px] tracking-widest">Batalkan</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default SecurityView;
