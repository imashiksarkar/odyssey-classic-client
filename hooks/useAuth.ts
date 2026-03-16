import { AuthContext } from "@/app/auth-wrapper";
import db from "@/config/db.config";
import getSdk from "@/config/sso";
import { exchange, login, logout } from "@/lib/sso.local";
import { DBRes } from "@/types";
import { use, useEffect, useMemo } from "react";

const useAuth = () => {
  const {
    setLoading,
    loading,
    user,
    setUser,
    setInLoggedIn,
    isLoggedIn,
    ssoSdkKey,
  } = use(AuthContext);
  const sdk = useMemo(() => getSdk(), []);

  useEffect(() => {
    db.open().then(async () => {
      const user = (await db.getById("local-user")) as unknown as
        | DBRes
        | undefined;

      setInLoggedIn(!!user);
    });
  }, [setInLoggedIn]);

  return {
    exchange: async () => {
      setLoading(true);
      const r = await exchange();
      await sdk?.fetchProfile();
      setLoading(false);
      return r;
    },
    loading,
    login,
    logout: async () => {
      const success = await logout();
      if (!success) return;
      setUser(null);
      setInLoggedIn(false);
    },
    user,
    isLoggedIn,
    ssoSdkKey,
  };
};

export default useAuth;
