// ==========================================================================
// Hello Kaffi — Firebase Configuration
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// IMPORTANT: this project must be the SAME one as backend-sync/serviceAccountKey.json,
// otherwise the server rejects the Google token ("Invalid Google sign-in").
const firebaseConfig = {
  apiKey: "AIzaSyBGcDVhzBzfiIKIrEiyc31YAg28i5YBpqs",
  authDomain: "hello-kaffi-hybrid.firebaseapp.com",
  projectId: "hello-kaffi-hybrid",
  storageBucket: "hello-kaffi-hybrid.firebasestorage.app",
  messagingSenderId: "966898943973",
  appId: "1:966898943973:web:50056984ad6ff57a9f910c",
};

// --------------------------------------------------------------------------
// Initialize Firebase
// --------------------------------------------------------------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Auto-detect long polling so Firestore still connects when the network,
// VPN, antivirus or an extension blocks the default streaming connection.
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export { app, auth, db, googleProvider };
