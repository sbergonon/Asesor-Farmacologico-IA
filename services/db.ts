
import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy,
  getDoc,
  updateDoc,
  collectionGroup
} from 'firebase/firestore';
import type { HistoryItem, PatientProfile, UserProfile, UserRole } from '../types';

const DEMO_USER_ID = 'demo-user';
const STORAGE_KEY_HISTORY = 'demo_history';
const STORAGE_KEY_PATIENTS = 'demo_patients';

// --- Helper for Local Storage (Demo Mode) ---
const getLocalData = <T>(key: string): T[] => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : [];
    } catch (e) {
        console.error("Error reading local data", e);
        return [];
    }
};

const saveLocalData = <T>(key: string, data: T[]) => {
    localStorage.setItem(key, JSON.stringify(data));
};

// --- History Operations ---

export const saveHistoryItem = async (userId: string, item: HistoryItem) => {
  if (userId === DEMO_USER_ID) {
      const history = getLocalData<HistoryItem>(STORAGE_KEY_HISTORY);
      // Filter out if exists to update, or just push. Usually history items are new.
      const updatedHistory = [item, ...history.filter(h => h.id !== item.id)];
      saveLocalData(STORAGE_KEY_HISTORY, updatedHistory);
      return;
  }

  try {
    // Use the item.id (timestamp string) as the document ID
    const historyRef = doc(db, 'users', userId, 'history', item.id);
    await setDoc(historyRef, item);
  } catch (error) {
    console.error("Error saving history item:", error);
    throw error;
  }
};

export const getHistory = async (userId: string): Promise<HistoryItem[]> => {
  if (userId === DEMO_USER_ID) {
      const history = getLocalData<HistoryItem>(STORAGE_KEY_HISTORY);
      return history.sort((a, b) => new Date(b.id).getTime() - new Date(a.id).getTime());
  }

  try {
    const historyRef = collection(db, 'users', userId, 'history');
    // Order by timestamp descending (newest first)
    // Note: 'id' in HistoryItem is an ISO string, so it sorts chronologically
    const q = query(historyRef); 
    // Ideally we use orderBy('id', 'desc'), but we need to create an index in Firestore first.
    // For now, we'll sort in client or use default retrieval.
    
    const querySnapshot = await getDocs(q);
    const items: HistoryItem[] = [];
    querySnapshot.forEach((doc) => {
      items.push(doc.data() as HistoryItem);
    });
    
    // Client-side sort to ensure order without waiting for index creation
    return items.sort((a, b) => new Date(b.id).getTime() - new Date(a.id).getTime());
  } catch (error) {
    console.error("Error getting history:", error);
    return [];
  }
};

export const clearHistory = async (userId: string) => {
  if (userId === DEMO_USER_ID) {
      saveLocalData(STORAGE_KEY_HISTORY, []);
      return;
  }

  try {
    const historyRef = collection(db, 'users', userId, 'history');
    const snapshot = await getDocs(historyRef);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error clearing history:", error);
    throw error;
  }
};

// --- Patient Profile Operations ---

export const savePatientProfile = async (userId: string, profile: PatientProfile) => {
  if (userId === DEMO_USER_ID) {
      const profiles = getLocalData<PatientProfile>(STORAGE_KEY_PATIENTS);
      const index = profiles.findIndex(p => p.id === profile.id);
      if (index >= 0) {
          profiles[index] = profile;
      } else {
          profiles.push(profile);
      }
      saveLocalData(STORAGE_KEY_PATIENTS, profiles);
      return;
  }

  try {
    const profileRef = doc(db, 'users', userId, 'patients', profile.id);
    await setDoc(profileRef, profile);
  } catch (error) {
    console.error("Error saving patient profile:", error);
    throw error;
  }
};

export const getPatientProfiles = async (userId: string): Promise<PatientProfile[]> => {
  if (userId === DEMO_USER_ID) {
      const profiles = getLocalData<PatientProfile>(STORAGE_KEY_PATIENTS);
      return profiles.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
  }

  try {
    const profilesRef = collection(db, 'users', userId, 'patients');
    const querySnapshot = await getDocs(profilesRef);
    const profiles: PatientProfile[] = [];
    querySnapshot.forEach((doc) => {
      profiles.push(doc.data() as PatientProfile);
    });
    
    // Sort by lastUpdated descending
    return profiles.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
  } catch (error) {
    console.error("Error getting profiles:", error);
    return [];
  }
};

export const deletePatientProfile = async (userId: string, patientId: string) => {
  if (userId === DEMO_USER_ID) {
      const profiles = getLocalData<PatientProfile>(STORAGE_KEY_PATIENTS);
      const filtered = profiles.filter(p => p.id !== patientId);
      saveLocalData(STORAGE_KEY_PATIENTS, filtered);
      return;
  }

  try {
    const profileRef = doc(db, 'users', userId, 'patients', patientId);
    await deleteDoc(profileRef);
  } catch (error) {
    console.error("Error deleting profile:", error);
    throw error;
  }
};

// --- Admin User Management ---

// Mock users for demo mode to avoid permission errors
const MOCK_USERS: UserProfile[] = [
    { uid: 'demo-1', email: 'doctor@example.com', displayName: 'Dr. House', role: 'professional', institution: 'Princeton-Plainsboro', photoURL: null, createdAt: new Date().toISOString() },
    { uid: 'demo-2', email: 'student@example.com', displayName: 'Estudiante', role: 'personal', institution: 'Universidad Complutense', photoURL: null, createdAt: new Date().toISOString() },
    { uid: 'demo-user', email: 'demo@example.com', displayName: 'Demo Admin', role: 'admin', institution: 'System', photoURL: null, createdAt: new Date().toISOString() }
];

export const getAllUsers = async (requestingUid: string): Promise<UserProfile[]> => {
    if (requestingUid === DEMO_USER_ID) {
        return MOCK_USERS;
    }

    try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        const users: UserProfile[] = [];
        snapshot.forEach((doc) => {
            // Only add if it looks like a user profile
            const data = doc.data();
            if (data.email && data.role) {
                users.push(data as UserProfile);
            }
        });
        return users;
    } catch (error) {
        console.error("Error fetching all users:", error);
        return [];
    }
};

export const updateUserRole = async (requestingUid: string, targetUid: string, newRole: UserRole) => {
    if (requestingUid === DEMO_USER_ID) {
        console.log(`[Demo Mode] Simulated role update for ${targetUid} to ${newRole}`);
        return;
    }

    try {
        const userRef = doc(db, 'users', targetUid);
        await updateDoc(userRef, { role: newRole });
    } catch (error) {
        console.error("Error updating user role:", error);
        throw error;
    }
};

// Update arbitrary user data (displayName, institution, etc)
export const updateUserProfile = async (requestingUid: string, targetUid: string, data: Partial<UserProfile>) => {
    if (requestingUid === DEMO_USER_ID) {
        console.log(`[Demo Mode] Simulated profile update for ${targetUid}:`, data);
        return;
    }

    try {
        const userRef = doc(db, 'users', targetUid);
        await updateDoc(userRef, data);
    } catch (error) {
        console.error("Error updating user profile:", error);
        throw error;
    }
};

// --- Global Data Operations (Superuser/Admin) ---

// Gets all patients from ALL users using a Collection Group Query.
// Requires Firestore index on 'patients' collectionGroup if sorting/filtering, 
// but for simple dump, basic fetch might work if security rules allow.
export const getGlobalPatientData = async (requestingUid: string): Promise<{user: string, patient: PatientProfile}[]> => {
    if (requestingUid === DEMO_USER_ID) {
        // Return dummy data for demo
        return [
            { user: 'Dr. House', patient: { id: 'P-001', medications: [{name: 'Vicodin', dosage: '50mg', frequency: 'PRN'}], allergies: 'None', otherSubstances: '', conditions: 'Chronic Pain', dateOfBirth: '1959-05-15', pharmacogenetics: '', lastUpdated: new Date().toISOString() } },
            { user: 'Dr. House', patient: { id: 'P-002', medications: [{name: 'Lupus meds', dosage: '', frequency: ''}], allergies: 'None', otherSubstances: '', conditions: 'Lupus', dateOfBirth: '1980-01-01', pharmacogenetics: '', lastUpdated: new Date().toISOString() } },
            { user: 'Student', patient: { id: 'TEST-1', medications: [{name: 'Ibuprofen', dosage: '400mg', frequency: ''}], allergies: '', otherSubstances: '', conditions: 'Headache', dateOfBirth: '1990-01-01', pharmacogenetics: '', lastUpdated: new Date().toISOString() } }
        ];
    }

    try {
        // Note: This requires specific Firestore Security Rules allowing admins to read group collections.
        // match /{path=**}/patients/{patientId} { allow read: if isAdmin(); }
        const patientsQuery = query(collectionGroup(db, 'patients'));
        const querySnapshot = await getDocs(patientsQuery);
        
        const results: {user: string, patient: PatientProfile}[] = [];
        
        // We need to fetch user details to map parent ID to a name/institution if possible,
        // or just use the parent ID (User UID). Fetching all user profiles first is more efficient.
        const users = await getAllUsers(requestingUid);
        const userMap = new Map(users.map(u => [u.uid, u]));

        querySnapshot.forEach((doc) => {
            const patientData = doc.data() as PatientProfile;
            const parentUserRef = doc.ref.parent.parent; // users/{uid}/patients/{pid} -> users/{uid}
            const parentUid = parentUserRef?.id || 'unknown';
            
            const userInfo = userMap.get(parentUid);
            // Construct a display string for the owner: "Name (Institution)" or just UID
            const ownerDisplay = userInfo 
                ? `${userInfo.displayName || 'Unknown'} ${userInfo.institution ? `(${userInfo.institution})` : ''}` 
                : parentUid;

            results.push({
                user: ownerDisplay,
                patient: patientData
            });
        });

        return results;
    } catch (error) {
        console.error("Error fetching global patient data:", error);
        throw error;
    }
};
