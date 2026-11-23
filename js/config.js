// Physics Arena - settings.  Safe to be public: Firebase security comes from Firestore rules, not from hiding this.
export const firebaseConfig = {
  apiKey: "AIzaSyCtJsaG96BZ3bxesyOfKjFAq8B3dhFpdLI",
  authDomain: "physics-arena.firebaseapp.com",
  projectId: "physics-arena",
  storageBucket: "physics-arena.firebasestorage.app",
  messagingSenderId: "163709941684",
  appId: "1:163709941684:web:1c9bba1368e6a4a27b64e1"
};

export const SITE = {
  // Students sign in with ID + password. Behind the scenes the ID becomes an email like t156@physicsarena.app
  EMAIL_DOMAIN: "physicsarena.app",
  // Paste the links here (inside the quotes). Leave empty until you have them.
  NEW_STUDENT_URL: "https://omarabdo96-stack.github.io/New-Student-Portal/",   // registration portal for new students
  EXAMS_URL: "https://omarabdo96-stack.github.io/Exam-Portal/",       // the separate exams platform
  WHATSAPP: "201550079074"
};
