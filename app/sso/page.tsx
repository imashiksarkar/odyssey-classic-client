"use client";

import { useSearchParams } from "next/navigation";
import { exchange } from "../actions";
import { useEffect } from "react";
import Link from "next/link";

const SSO = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) return;

    exchange(token).then((res) => {
      localStorage.setItem("accessToken", res.data.accessToken);
      localStorage.setItem("refreshToken", res.data.refreshToken);

      window.location.href = "/";
    });
  }, [token]);

  return (
    <div>
      SSO
      <br />
      <Link href="/">Home</Link>
    </div>
  );
};

export default SSO;
