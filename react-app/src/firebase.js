import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD6Ia6ANNSzwfW9r4HnT_rgV-ncptlK0m0",
  authDomain: "snigdha-next-project-2026.firebaseapp.com",
  projectId: "snigdha-next-project-2026",
  storageBucket: "snigdha-next-project-2026.firebasestorage.app",
  messagingSenderId: "1021789279226",
  appId: "1:1021789279226:web:8cf564c5a5d65335f68a43",
  measurementId: "G-XB303JLB1F"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { GoogleAuthProvider, signInWithCredential, doc, setDoc, serverTimestamp };

export async function saveUserToFirebase(googleCredential, userInfo) {
  try {
    const credential = GoogleAuthProvider.credential(googleCredential);
    const result = await signInWithCredential(auth, credential);
    const uid = result.user.uid;

    // Save to Firestore — merge:true means repeat logins just update last_seen
    await setDoc(doc(db, 'users', uid), {
      name: userInfo.name,
      email: userInfo.email,
      picture: userInfo.picture,
      last_seen: serverTimestamp()
    }, { merge: true });

    // first_seen only written on first login (won't overwrite if already set)
    await setDoc(doc(db, 'users', uid), {
      first_seen: serverTimestamp()
    }, { merge: true });

    console.log('User saved securely to Firebase:', userInfo.email);
  } catch (err) {
    console.error('Firebase error:', err);
  }
}
