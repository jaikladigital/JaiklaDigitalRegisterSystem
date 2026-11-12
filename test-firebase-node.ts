import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const rawConfig = fs.readFileSync('firebase-applet-config.json', 'utf8');
const firebaseConfig = JSON.parse(rawConfig);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function test() {
  try {
    const snap = await getDoc(doc(db, 'config', 'main'));
    console.log("Channel ID:", snap.data()?.lineChannelId);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
test();
