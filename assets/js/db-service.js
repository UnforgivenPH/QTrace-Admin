import { db } from './config.js';
import { collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const usersCol = collection(db, 'users');

// Add a new user
export const addUser = async (userData) => {
  try {
    const docRef = await addDoc(usersCol, userData);
    return docRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
  }
};

// Fetch all users
export const getAllUsers = async () => {
  const snapshot = await getDocs(usersCol);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};