"use client";

// import { useSearchParams } from "next/navigation";
// import { exchange } from "../actions";
import { useEffect } from "react";
import Link from "next/link";

import sso from "@/lib/sso";

const SSO = () => {
  // const searchParams = useSearchParams();
  // const token = searchParams.get("token");

  useEffect(() => {
    // if (!token) return;

    // todo: don't need the client secret in the frontend once the backend is fixed
    sso.exchangeCode(undefined, "root_client_secret").then((res) => {
      if (!res.isSuccess) return;

      localStorage.setItem("accessToken", res.data.accessToken);
      localStorage.setItem("refreshToken", res.data.refreshToken);

      window.location.href = "/";
    });

    // exchange(token).then((data) => {
    //   localStorage.setItem("accessToken", data.accessToken);
    //   localStorage.setItem("refreshToken", data.refreshToken);

    //   window.location.href = "/";
    // });
  }, []);

  return (
    <div>
      SSO
      <br />
      <Link href="/">Home</Link>
    </div>
  );
};

export default SSO;
