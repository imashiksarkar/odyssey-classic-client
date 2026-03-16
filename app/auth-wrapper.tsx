"use client";

import getSdk from "@/config/sso";
import { exchange } from "@/lib/sso.local";
import { Profile } from "@newgameplusinc/odyssey-sso";
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
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
}

export const AuthContext = createContext({} as IAuthContext);

const AuthWrapper = ({
  children,
}: Readonly<{
  children: ReactNode;
}>) => {
  const [isLoggedIn, setInLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<null | Profile>(null);

  const sdk = useMemo(() => getSdk(), []);
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

  return (
    <AuthContext
      value={{
        user,
        setUser,
        loading,
        setLoading,
        isLoggedIn,
        setInLoggedIn,
      }}
    >
      {children}
    </AuthContext>
  );
};

export default AuthWrapper;
