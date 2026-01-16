import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBMbxSKDFA9LR2WQCli3mkS8CZdfGZKB74",
  authDomain: "qtrace-5a6cc.firebaseapp.com",
  projectId: "qtrace-5a6cc",
  storageBucket: "qtrace-5a6cc.firebasestorage.app",
  messagingSenderId: "845442207924",
  appId: "1:845442207924:web:0f2fa2bc443c29e19947e1",
  measurementId: "G-6WZFZQY43H"
};


const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);