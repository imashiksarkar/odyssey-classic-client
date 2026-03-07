"use client";

import sso from "@/config/sso";
import { Profile } from "@newgameplusinc/odyssey-sso";
import { ReactNode, useEffect, createContext, useState } from "react";

interface IAuthContext {
  user: Profile | null;
}

export const AuthContext = createContext({} as IAuthContext);

const AuthWrapper = ({
  children,
}: Readonly<{
  children: ReactNode;
}>) => {
  const [user, setUser] = useState<null | Profile>(null);

  useEffect(() => {
    sso.onEvents((action) => {
      if (action.type === "login") setUser(action.payload);
      else if (action.type === "profile.fetch") setUser(action.payload);
      else if (action.type === "logout") setUser(null);
    });
    sso.exchange();
  }, []);

  return (
    <AuthContext
      value={{
        user,
      }}
    >
      {children}
    </AuthContext>
  );
};

export default AuthWrapper;
