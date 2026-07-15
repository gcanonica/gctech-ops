import { applicationDefault, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import path from 'node:path';

interface GCTechFirebaseConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

function readJsonFile<T>(filePath: string): T {
  const resolvedPath = path.resolve(filePath);
  return JSON.parse(fs.readFileSync(resolvedPath, 'utf-8')) as T;
}

function getCredential() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (serviceAccountJson?.trim()) {
    return cert(JSON.parse(serviceAccountJson));
  }

  if (serviceAccountPath?.trim()) {
    return cert(readJsonFile(serviceAccountPath));
  }

  return applicationDefault();
}

export function getGCTechAdminDb() {
  const configPath = process.env.GCTECH_FIREBASE_CONFIG_PATH;

  if (!configPath?.trim()) {
    throw new Error('Configure GCTECH_FIREBASE_CONFIG_PATH apontando para firebase-applet-config.json do GCTech.');
  }

  const firebaseConfig = readJsonFile<GCTechFirebaseConfig>(configPath);

  if (!firebaseConfig.projectId) {
    throw new Error('firebase-applet-config.json nao possui projectId.');
  }

  const app = getApps().length
    ? getApp()
    : initializeApp({
        projectId: firebaseConfig.projectId,
        credential: getCredential(),
      });

  return firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
}
