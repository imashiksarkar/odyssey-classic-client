"use client";

import { useEffect, useState } from "react";
import { getUserProfile } from "./actions";
import sso from "../lib/sso";

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

  const handleSignin = () => {
    sso.triggerSignIn("http://localhost:5010/sso");
  };

  return !user ? (
    <nav>
      <ul>
        <li>
          <button onClick={handleSignin}>Signin</button>
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
