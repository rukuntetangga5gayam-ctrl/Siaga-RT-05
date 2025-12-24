
export type AppMode = 'WELCOME' | 'HOME' | 'RESIDENT' | 'SECURITY' | 'SECURITY_DASHBOARD';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number; // Akurasi dalam meter
}

export interface EmergencyContact {
  name: string;
  number: string;
}

export interface PanicState {
  status: 'AKTIF' | 'NONAKTIF' | 'TEST';
  nama: string; // Name of the resident
  rt?: string; // RT information (e.g., "RT 05")
  waktu: number; // Timestamp
  lokasi?: LocationData;
  emergencyType?: string; // Jenis darurat (Pencurian, Kebakaran, dll)
  emergencyDescription?: string; // Keterangan tambahan
  testType?: 'GENERAL' | 'NIGHT_PATROL' | 'MORNING_ALERT' | 'CUSTOM_ANNOUNCEMENT'; // Jenis uji coba
  customMessage?: string; // Teks kustom untuk sosialisasi
}

export interface UserProfile {
  name: string;
  address?: string;
}

export interface Resident {
  id: string;
  name: string;
  address: string;
}
