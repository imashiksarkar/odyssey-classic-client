"use client";

import { useEffect, useState } from "react";

export interface Credentials {
  userId: string;
  accessToken: string;
}

/**
 * Reads credentials from IndexedDB → sso-sdk → credentials store.
 * The record keyed as 'local-user' contains userId and tokens.accessToken.
 */
const readCredentialsFromIndexedDB = (): Promise<Credentials | null> => {
  return new Promise((resolve) => {
    const request = indexedDB.open("sso-sdk");

    request.onerror = () => {
      console.warn("[useCredentials] Failed to open sso-sdk IndexedDB");
      resolve(null);
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("credentials")) {
        console.warn("[useCredentials] credentials store not found in sso-sdk");
        db.close();
        resolve(null);
        return;
      }

      const tx = db.transaction("credentials", "readonly");
      const store = tx.objectStore("credentials");
      const getRequest = store.get("local-user");

      getRequest.onsuccess = () => {
        const record = getRequest.result;
        db.close();

        if (!record?.userId || !record?.tokens?.accessToken) {
          console.warn("[useCredentials] No valid credentials found in store");
          resolve(null);
          return;
        }

        resolve({
          userId: record.userId,
          accessToken: record.tokens.accessToken,
        });
      };

      getRequest.onerror = () => {
        console.warn("[useCredentials] Failed to read from credentials store");
        db.close();
        resolve(null);
      };
    };
  });
};

export const useCredentials = () => {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    readCredentialsFromIndexedDB()
      .then(setCredentials)
      .finally(() => setLoading(false));
  }, []);

  return { credentials, loading };
};
