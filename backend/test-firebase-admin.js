const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');
const path = require('path');

const keyPath = path.join(__dirname, 'firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

try {
  admin.initializeApp({
    credential: admin.cert(serviceAccount)
  });
  const db = getFirestore();
  const auth = getAuth();
  console.log('Firestore and Auth initialized successfully!');
  console.log('db is:', typeof db);
  console.log('auth is:', typeof auth);
} catch (e) {
  console.error('Initialization failed:', e.message);
}
