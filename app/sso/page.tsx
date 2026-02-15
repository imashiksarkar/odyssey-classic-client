"use client";

// import { useSearchParams } from "next/navigation";
// import { exchange } from "../actions";
import { useEffect } from "react";
import Link from "next/link";

import sso from "@/lib/sso";

const SSO = () => {
  useEffect(() => {
    sso?.exchangeCode("/");
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
