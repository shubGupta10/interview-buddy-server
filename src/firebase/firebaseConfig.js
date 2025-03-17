import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAnqtTS_Mfh0IEJnVAS8YLQ46q-Xq3a8j0",
  authDomain: "interview-buddy-cccd2.firebaseapp.com",
  projectId: "interview-buddy-cccd2",
  storageBucket: "interview-buddy-cccd2.firebasestorage.app",
  messagingSenderId: "349123045088",
  appId: "1:349123045088:web:76435137f1cb565855d285",
  measurementId: "G-212SG5NQ51"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);