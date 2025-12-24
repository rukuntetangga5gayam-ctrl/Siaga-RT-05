
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, push, remove } from 'firebase/database';
import { PanicState, Resident, LocationData, EmergencyContact } from '../types';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDa0pxtWZ4xsaQIV6FPBw-lH2ZDsr9vDUw",
    authDomain: "siaga-rt05.firebaseapp.com",
    databaseURL: "https://siaga-rt05-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "siaga-rt05",
    storageBucket: "siaga-rt05.firebasestorage.app",
    messagingSenderId: "710709288372",
    appId: "1:710709288372:web:bbb27ee558f49063b7e6e1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Initial State Fallback
const initialState: PanicState = { status: 'NONAKTIF', nama: '', waktu: 0 };

// --- CONNECTION STATUS ---
export const subscribeToConnectionStatus = (cb: (online: boolean) => void) => {
    const connectedRef = ref(db, '.info/connected');
    return onValue(connectedRef, (snap) => {
        cb(snap.val() === true);
    });
};

// --- CONFIG / SECURITY ---
export const subscribeToAccessPassword = (cb: (password: string) => void) => {
    const passwordRef = ref(db, 'config/residentAccessPassword');
    return onValue(passwordRef, (snapshot) => {
        const val = snapshot.val();
        cb(val || '55555*#');
    });
};

export const updateAccessPassword = (newPassword: string) => {
    const passwordRef = ref(db, 'config/residentAccessPassword');
    return set(passwordRef, newPassword);
};

// --- WHATSAPP CONFIG ---
export const subscribeToEmergencyContacts = (cb: (contacts: EmergencyContact[]) => void) => {
    const waRef = ref(db, 'config/emergencyContacts');
    return onValue(waRef, (snapshot) => {
        const val = snapshot.val();
        if (Array.isArray(val)) {
            cb(val);
        } else {
            cb([]);
        }
    });
};

export const updateEmergencyContacts = (contacts: EmergencyContact[]) => {
    const waRef = ref(db, 'config/emergencyContacts');
    return set(waRef, contacts);
};

// Backward compatibility (deprecated but kept to prevent breaks during transition)
export const subscribeToWhatsappNumber = (cb: (number: string) => void) => {
    const waRef = ref(db, 'config/emergencyContacts');
    return onValue(waRef, (snapshot) => {
        const val = snapshot.val();
        if (Array.isArray(val) && val.length > 0) {
            // Return comma separated string of numbers only
            cb(val.map(c => c.number).join(','));
        } else {
            cb('');
        }
    });
};

export const updateWhatsappNumber = (newNumber: string) => {
    // This is now handled by updateEmergencyContacts
};

// --- 1. PANIC STATE ---
export const subscribeToPanicState = (cb: (data: PanicState) => void) => {
    const panicRef = ref(db, 'panic');
    return onValue(panicRef, (snapshot) => {
        const data = snapshot.val();
        cb(data || initialState);
    });
};

export const triggerPanic = (nama: string, rt?: string, lokasi?: LocationData, emergencyType?: string, emergencyDescription?: string) => {
    const panicRef = ref(db, 'panic');
    
    const newState: any = { 
        status: 'AKTIF', 
        nama, 
        waktu: Date.now()
    };

    if (rt !== undefined) newState.rt = rt;
    if (lokasi !== undefined) newState.lokasi = lokasi;
    if (emergencyType !== undefined) newState.emergencyType = emergencyType;
    if (emergencyDescription !== undefined && emergencyDescription !== '') {
        newState.emergencyDescription = emergencyDescription;
    }

    set(panicRef, newState).catch(console.error);
};

export const triggerTest = (type: 'GENERAL' | 'NIGHT_PATROL' | 'MORNING_ALERT' = 'GENERAL') => {
    const panicRef = ref(db, 'panic');
    let label = 'UJI COBA SISTEM';
    if (type === 'NIGHT_PATROL') label = 'PENGUMUMAN KEAMANAN MALAM';
    if (type === 'MORNING_ALERT') label = 'PENGUMUMAN KEAMANAN PAGI';

    const newState: PanicState = { 
        status: 'TEST', 
        nama: label, 
        waktu: Date.now(),
        testType: type
    };
    set(panicRef, newState).catch(console.error);
};

export const triggerCustomAnnouncement = (text: string) => {
    const panicRef = ref(db, 'panic');
    const newState: PanicState = { 
        status: 'TEST', 
        nama: 'PENGUMUMAN WARGA', 
        waktu: Date.now(),
        testType: 'CUSTOM_ANNOUNCEMENT',
        customMessage: text
    };
    set(panicRef, newState).catch(console.error);
};

export const resolvePanic = (petugasName: string) => {
    const panicRef = ref(db, 'panic');
    const newState: PanicState = { 
        status: 'NONAKTIF', 
        nama: '', 
        waktu: Date.now() 
    };
    set(panicRef, newState).catch(console.error);
};

// --- 2. RESIDENTS ---
export const subscribeToResidents = (cb: (data: Resident[]) => void) => {
    const residentsRef = ref(db, 'residents');
    return onValue(residentsRef, (snapshot) => {
        const data = snapshot.val();
        const list: Resident[] = [];
        if (data) {
            Object.keys(data).forEach((key) => {
                list.push({ id: key, ...data[key] });
            });
        }
        list.sort((a, b) => a.name.localeCompare(b.name));
        cb(list);
    });
};

export const addResident = (name: string, address: string) => {
    const residentsRef = ref(db, 'residents');
    const newResidentRef = push(residentsRef);
    set(newResidentRef, { name, address }).catch(console.error);
};

export const deleteResident = (id: string) => {
    const residentRef = ref(db, `residents/${id}`);
    set(residentRef, null).catch(console.error);
};

// --- 3. HISTORY ---
export interface HistoryEntry extends PanicState {
    id: string;
}

export const subscribeToHistory = (cb: (data: HistoryEntry[]) => void) => {
    const historyRef = ref(db, 'history');
    return onValue(historyRef, (snapshot) => {
        const data = snapshot.val();
        const list: HistoryEntry[] = [];
        if (data) {
             Object.keys(data).forEach((key) => {
                list.push({ id: key, ...data[key] });
            });
        }
        list.sort((a, b) => b.waktu - a.waktu);
        cb(list);
    });
};

export const addHistoryLog = (entry: PanicState) => {
    const historyRef = ref(db, 'history');
    const newLogRef = push(historyRef);
    set(newLogRef, entry).catch(console.error);
};

export const deleteHistoryEntry = (id: string) => {
    const logRef = ref(db, `history/${id}`);
    remove(logRef).catch(console.error);
};

export const clearHistoryLog = () => {
    const historyRef = ref(db, 'history');
    set(historyRef, null).catch(console.error);
};
