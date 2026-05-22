import {
  collection,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  getDocs,
  where,
  DocumentData,
  QuerySnapshot,
  DocumentChange
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Payment {
  id?: string;
  userId: string;
  userName: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  processId: string;
  error?: string;
}

export interface AppUser {
  id?: string;
  name: string;
  email: string;
  createdAt: Timestamp | null;
}

export interface QueueItem {
  id?: string;
  userId: string;
  userName: string;
  amount: number;
  status: string;
  createdAt: Timestamp | null;
  processId: string;
}

export const createUser = async (name: string, email: string): Promise<string> => {
  const docRef = await addDoc(collection(db, 'users'), {
    name,
    email,
    createdAt: serverTimestamp()
  });
  return docRef.id;
};

export const createPaymentRequest = async (userId: string, userName: string, amount: number) => {
  const processId = `tr_${Math.random().toString(36).substring(2, 11)}`;

  const queueEntry = {
    userId,
    userName,
    amount,
    status: 'pending',
    createdAt: serverTimestamp(),
    processId
  };

  const docRef = await addDoc(collection(db, 'queue'), queueEntry);

  await addDoc(collection(db, 'payments'), {
    ...queueEntry,
    queueId: docRef.id
  });

  return processId;
};

// Simulates AWS Lambda triggered by SQS — 20% failure rate
export const startSimulatedWorker = (onStatusChange?: (status: 'idle' | 'processing') => void) => {
  console.log('Worker Lambda: Listening for SQS messages...');

  const q = query(collection(db, 'queue'), orderBy('createdAt', 'asc'));

  return onSnapshot(q, async (snapshot: QuerySnapshot<DocumentData>) => {
    snapshot.docChanges().forEach(async (change: DocumentChange<DocumentData>) => {
      if (change.type === 'added') {
        const queueData = change.doc.data();
        const queueId = change.doc.id;

        onStatusChange?.('processing');
        console.log(`Worker Lambda: Processing ${queueData.processId}`);

        const paymentsRef = collection(db, 'payments');
        const pQuery = query(paymentsRef, where('processId', '==', queueData.processId));
        const pSnapshot = await getDocs(pQuery);

        if (!pSnapshot.empty) {
          const paymentDoc = pSnapshot.docs[0];
          await updateDoc(doc(db, 'payments', paymentDoc.id), {
            status: 'processing',
            updatedAt: serverTimestamp()
          });
        }

        // Simulate 2s of processing (validation, bank call, etc.)
        setTimeout(async () => {
          const shouldFail = Math.random() < 0.2;

          if (!pSnapshot.empty) {
            const paymentDoc = pSnapshot.docs[0];
            await updateDoc(doc(db, 'payments', paymentDoc.id), {
              status: shouldFail ? 'failed' : 'completed',
              updatedAt: serverTimestamp(),
              ...(shouldFail && { error: 'Gateway timeout — retry eligible' })
            });
          }

          await deleteDoc(doc(db, 'queue', queueId));
          onStatusChange?.('idle');
          console.log(`Worker Lambda: ${queueData.processId} → ${shouldFail ? 'FAILED' : 'completed'}`);
        }, 2000);
      }
    });
  });
};
