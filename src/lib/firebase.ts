import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBr1pU2ds-RS2mP0sXMqLsL2d_5RND0G1o",
  authDomain: "coldwatch-94d56.firebaseapp.com",
  projectId: "coldwatch-94d56",
  storageBucket: "coldwatch-94d56.firebasestorage.app",
  messagingSenderId: "486661762421",
  appId: "1:486661762421:web:c41def1d6b7f260c7a773c",
  measurementId: "G-55Y98YK8WG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

export default app;
