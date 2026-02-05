"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUserProfile } from "./actions";

export default function Home() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) return;

    getUserProfile(accessToken).then((res) => {
      setUser(res);
    });
  }, []);

  const url = `${process.env.NEXT_PUBLIC_SSO_CLIENT_URL}/sso?client_id=${process.env.NEXT_PUBLIC_CLASSIC_CLIENT_ID}&redirect_uri=http://localhost:5010/sso`;

  return !user ? (
    <nav>
      <ul>
        <li>
          <Link href={url}>Signin</Link>
        </li>
      </ul>
    </nav>
  ) : (
    <div>
      {JSON.stringify(user)}
      <br />
      <button
        onClick={() => {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          window.location.href = "/";
        }}
      >
        Logout
      </button>
    </div>
  );
}
