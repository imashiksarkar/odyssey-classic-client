import Database from "@/lib/database";

const db = new Database({
  dbName: "odyssey-sso",
  dbVersion: 1,
  storeName: "credentials",
});

export default db;
