"use client";

import db from "@/config/db.config";
import getSdk from "@/config/sso";
import { exchange } from "@/lib/sso.local";
import { DBRes, SdkKeysRes } from "@/types";
import { Profile } from "@newgameplusinc/odyssey-sso";
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

interface IAuthContext {
  user: Profile | null;
  setUser: Dispatch<SetStateAction<Profile | null>>;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  isLoggedIn: boolean;
  setInLoggedIn: Dispatch<SetStateAction<boolean>>;
  ssoSdkKey: string | null;
}

export const AuthContext = createContext({} as IAuthContext);

const AuthWrapper = ({
  children,
}: Readonly<{
  children: ReactNode;
}>) => {
  const getUserId = useCallback(async () => {
    return db.open().then(async () => {
      const u = (await db.getById("local-user")) as DBRes | undefined;

      if (!u) return;

      return u.userId;
    });
  }, []);

  const [ssoSdkKey, setSsoSdkKey] = useState<string | null>(null);
  const [isLoggedIn, setInLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<null | Profile>(null);

  const sdk = useMemo(() => getSdk(ssoSdkKey), [ssoSdkKey]);
  useEffect(() => {
    sdk?.onEvents((action) => {
      if (action.type === "profile.fetch") setUser(action.payload);
    });

    exchange().then(async () => {
      setLoading(true);
      const r = await sdk?.fetchProfile();
      setInLoggedIn(!!r);
      setLoading(false);
    });
  }, [sdk]);

  useEffect(() => {
    getUserId().then(async (userId) => {
      if (!userId) return;

      const fetchSdks = async (userId: string) => {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL_FOR_SSO}/api/v1/sdk-key/user/${userId}`,
          );

          if (!res.ok) return null;

          const d = (await res.json()) as unknown as SdkKeysRes;

          const active = d.data.filter((sdk) => sdk.isActive);

          const ssoSdk = active.find((sdk) => sdk.serviceType === "AVATAR_SSO");

          if (!ssoSdk) return;

          setSsoSdkKey(ssoSdk.sdkKey);
        } catch (e) {
          console.log("error fetching sdk keys", e);
        }
      };

      await fetchSdks(userId);
    });
  }, [isLoggedIn, user, getUserId]);

  return (
    <AuthContext
      value={{
        user,
        setUser,
        loading,
        setLoading,
        isLoggedIn,
        setInLoggedIn,
        ssoSdkKey,
      }}
    >
      {children}
    </AuthContext>
  );
};

export default AuthWrapper;
