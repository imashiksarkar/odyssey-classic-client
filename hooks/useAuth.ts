import { AuthContext } from "@/app/auth-wrapper";
import db from "@/config/db.config";
import { login, logout } from "@/lib/sso.local";
import { DBRes } from "@/types";
import { use, useEffect } from "react";

const useAuth = () => {
  const {
    loading,
    user,
    setUser,
    setLoggedIn,
    isLoggedIn,
    ssoSdkKey,
    assetSdkKey,
  } = use(AuthContext);

  useEffect(() => {
    db.open().then(async () => {
      const user = (await db.getById("local-user")) as unknown as
        | DBRes
        | undefined;

      setLoggedIn(!!user);
    });
  }, [setLoggedIn]);

  return {
    loading,
    login,
    logout: async () => {
      const success = await logout();
      if (!success) return;
      setUser(null);
      setLoggedIn(false);
    },
    user,
    isLoggedIn,
    ssoSdkKey,
    assetSdkKey,
  };
};

export default useAuth;
