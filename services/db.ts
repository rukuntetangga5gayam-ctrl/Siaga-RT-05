
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, push, remove, serverTimestamp } from 'firebase/database';
import { PanicState, Resident, LocationData } from '../types';

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
    const unsubscribe = onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            cb(true);
        } else {
            cb(false);
        }
    });
    return unsubscribe;
};

// --- 1. PANIC STATE ---

export const subscribeToPanicState = (cb: (data: PanicState) => void) => {
    const panicRef = ref(db, 'panic');
    const unsubscribe = onValue(panicRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            cb(data);
        } else {
            cb(initialState);
        }
    });
    return unsubscribe;
};

export const triggerPanic = (nama: string, lokasi?: LocationData) => {
    const panicRef = ref(db, 'panic');
    
    // PENTING: Jangan masukkan properti yang undefined ke dalam objek Firebase
    // Firebase akan melempar error: "set failed: value argument contains undefined"
    const newState: PanicState = { 
        status: 'AKTIF', 
        nama, 
        waktu: Date.now(), // Gunakan client time untuk UI responsif
    };

    if (lokasi) {
        newState.lokasi = lokasi;
    }

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
    const unsubscribe = onValue(residentsRef, (snapshot) => {
        const data = snapshot.val();
        const list: Resident[] = [];
        
        if (data) {
            Object.keys(data).forEach((key) => {
                list.push({
                    id: key,
                    ...data[key]
                });
            });
        }
        
        // Sort A-Z
        list.sort((a, b) => a.name.localeCompare(b.name));
        cb(list);
    });
    return unsubscribe;
};

export const addResident = (name: string, address: string) => {
    const residentsRef = ref(db, 'residents');
    const newResidentRef = push(residentsRef);
    set(newResidentRef, {
        name,
        address
    }).catch(console.error);
};

export const deleteResident = (id: string) => {
    const residentRef = ref(db, `residents/${id}`);
    remove(residentRef).catch(console.error);
};

// --- 3. HISTORY ---

export const subscribeToHistory = (cb: (data: PanicState[]) => void) => {
    const historyRef = ref(db, 'history');
    const unsubscribe = onValue(historyRef, (snapshot) => {
        const data = snapshot.val();
        const list: PanicState[] = [];

        if (data) {
             Object.keys(data).forEach((key) => {
                list.push(data[key]);
            });
        }

        // Sort Newest First (Descending)
        list.sort((a, b) => b.waktu - a.waktu);
        cb(list);
    });
    return unsubscribe;
};

export const addHistoryLog = (entry: PanicState) => {
    const historyRef = ref(db, 'history');
    const newLogRef = push(historyRef);
    set(newLogRef, entry).catch(console.error);
};

export const clearHistoryLog = () => {
    const historyRef = ref(db, 'history');
    remove(historyRef).catch(console.error);
};

export const isOnlineMode = () => true; // Firebase handle offline persistence automatically
