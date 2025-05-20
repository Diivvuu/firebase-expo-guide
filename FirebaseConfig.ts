// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from "firebase/firestore";
import { getStorage } from 'firebase/storage';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC279i1-R0anKcu-2kGd9MauPftrQ5vaj4",
  authDomain: "chat-app-92003.firebaseapp.com",
  projectId: "chat-app-92003",
  storageBucket: "chat-app-92003.firebasestorage.app",
  messagingSenderId: "10257206139",
  appId: "1:10257206139:web:7a12e0300c86ed7e034bde",
  measurementId: "G-4YM8DEC59Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
export const db = getFirestore(app);
export const storage = getStorage(app);
