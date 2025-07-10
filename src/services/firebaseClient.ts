import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // These would typically come from environment variables
  // For now, using placeholder values - you'll need to get these from Firebase console
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "your-api-key",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "clara-insurance-2.firebaseapp.com", 
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "clara-insurance-2",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "clara-insurance-2.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "156450826904",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

export default app; 