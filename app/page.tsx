"use client";

import { useEffect, useState } from "react";
import sso from "../lib/sso";

export default function Home() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    sso?.getProfileData().then(setUser);
  }, []);

  const handleSignin = () => {
    sso?.triggerSignIn("http://localhost:5010/sso");
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
      <br />
      <br />
      <button
        onClick={async() => {
          await sso?.refreshToken()
        }}
      >
        Refresh Token
      </button>
      <br />
      <br />
      <br />
      <button
        onClick={() => {
          sso?.logout()
          window.location.href = "/";
        }}
      >
        Logout
      </button>
    </div>
  );
}
