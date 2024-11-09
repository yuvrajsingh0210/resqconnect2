import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD93w8lDUztgjcx8V3QIArripWh_kQ7YE4",
  authDomain: "disaster-app-5b2e4.firebaseapp.com",
  projectId: "disaster-app-5b2e4",
  storageBucket: "disaster-app-5b2e4.firebasestorage.app",
  messagingSenderId: "409082264596",
  appId: "1:409082264596:web:6fd3310a5a225305bffb01"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);