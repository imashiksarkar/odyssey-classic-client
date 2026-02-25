export default class Database {
  constructor(
    private readonly config: {
      dbName: string;
      dbVersion: number;
      storeName: string;
    },
  ) {}

  open = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.dbVersion);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(this.config.storeName))
          db.createObjectStore(this.config.storeName, {
            keyPath: "id",
          });
      };

      request.onsuccess = () => resolve(request.result);
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create = async (user: { id: string; [key: string]: any }) => {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, "readwrite");
      const store = tx.objectStore(this.config.storeName);

      const request = store.add(user);

      request.onsuccess = () => resolve(user);
      request.onerror = () => reject(request.error);
    });
  };

  getById = async <T = unknown>(id: string): Promise<T | null> => {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, "readonly");
      const store = tx.objectStore(this.config.storeName);

      const request = store.get(id) ?? null;

      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  };

  getAll = async () => {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, "readonly");
      const store = tx.objectStore(this.config.storeName);

      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update = async (id: string, updates: Partial<Record<string, any>>) => {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, "readwrite");
      const store = tx.objectStore(this.config.storeName);

      const getReq = store.get(id);

      getReq.onerror = () => reject(getReq.error);

      getReq.onsuccess = () => {
        if (!getReq.result) {
          reject(new Error("User not found"));
          return;
        }

        const updatedUser = {
          ...getReq.result,
          ...updates,
        };

        const putReq = store.put(updatedUser);

        putReq.onsuccess = () => resolve(updatedUser);
        putReq.onerror = () => reject(putReq.error);
      };
    });
  };

  delete = async (id: string) => {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, "readwrite");
      const store = tx.objectStore(this.config.storeName);

      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  };

  reset = async () => {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, "readwrite");
      const store = tx.objectStore(this.config.storeName);

      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  };
}
