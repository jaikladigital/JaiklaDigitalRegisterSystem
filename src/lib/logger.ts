import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

export const logStaffAction = async (action: string, details: string, targetId?: string, extraData?: any) => {
  try {
    const user = auth.currentUser;
    if (!user) return;
    
    await addDoc(collection(db, 'staff_logs'), {
      uid: user.uid,
      email: user.email || 'unknown',
      action,
      details,
      targetId: targetId || null,
      extraData: extraData || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Failed to log staff action", error);
  }
};
