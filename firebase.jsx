// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDCDusV-Qc6j6Elm9NRb8MBTUnu1YrW0LA",
  authDomain: "pmcsl-c71d8.firebaseapp.com",
  projectId: "pmcsl-c71d8",
  storageBucket: "pmcsl-c71d8.firebasestorage.app",
  messagingSenderId: "1055333580897",
  appId: "1:1055333580897:web:5cb744f3cf0da75be42a20",
  measurementId: "G-TYVMJD7XH9"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// Cloudinary Configuration
// !!! IMPORTANT: Replace these with your actual Cloudinary Cloud Name and an Unsigned Upload Preset !!!
const cloudinaryConfig = {
  cloudName: "dxcrlpike", // e.g., "dxcrlpike"
  uploadPreset: "LeoTechSl Projects" // e.g., "LeoTechSl Projects" (Ensure this is an UNsigned preset)
};

export { db, cloudinaryConfig };


