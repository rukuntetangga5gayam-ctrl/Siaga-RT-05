
export type AppMode = 'HOME' | 'RESIDENT' | 'SECURITY' | 'SECURITY_DASHBOARD';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number; // Akurasi dalam meter
}

export interface PanicState {
  status: 'AKTIF' | 'NONAKTIF';
  nama: string; // Name of the resident
  waktu: number; // Timestamp
  lokasi?: LocationData;
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
