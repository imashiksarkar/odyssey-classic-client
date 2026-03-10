"use client";

import db from "@/config/db.config";
import { useCallback, useEffect, useState } from "react";

type LocalUser = {
  email: string;
  tokens?: {
    accessToken?: string;
  };
};

const useAccessToken = () => {
  const [accessToken, setAccessToken] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [isTokenLoading, setIsTokenLoading] = useState(true);
  const [tokenError, setTokenError] = useState<string>("");

  const readAccessToken = useCallback(async () => {
    setIsTokenLoading(true);
    setTokenError("");

    try {
      const result = await db.getById<LocalUser>("local-user");
      console.log({result})
      setAccessToken(result?.tokens?.accessToken || "");
      setEmail(result?.email || "");
    } catch (error) {
      console.error("Failed to read access token from IndexedDB", error);
      setTokenError("Failed to load access token.");
      setAccessToken("");
    } finally {
      setIsTokenLoading(false);
    }
  }, []);

  useEffect(() => {
    readAccessToken();
  }, [readAccessToken]);

  return {
    email,
    accessToken,
    isTokenLoading,
    tokenError,
    refreshAccessToken: readAccessToken,
  };
};

export default useAccessToken;
