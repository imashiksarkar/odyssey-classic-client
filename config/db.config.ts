import Database from "@/lib/db.service";

const db  = new Database({
    dbName: "sso-sdk",
    dbVersion: 1,
    storeName: "credentials",
});

export default db; 