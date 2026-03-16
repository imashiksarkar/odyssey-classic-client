import db from "@/config/db.config";
import { isBrowser } from "./utils";
import { DBRes, ProfileRes, RefTokenRes } from "@/types";

const ssoClientUrl = "https://odyssey-sso-client.vercel.app";
const ssoServerUrl =
  "https://api-gateway.tenant-newgame.ord1.ingress.coreweave.cloud/sso/api/v1";

const dbId = "local-user";

const withRefresh = async (api: (aT: string) => Promise<Response>) => {
  if (!isBrowser()) {
    console.log(`SSO-SDK: Not in browser.`);
    return;
  }

  await db.open();
  const dbUser = (await db.getById(dbId)) as DBRes | undefined;

  if (!dbUser) {
    console.log(`SSO-SDK: No user found in DB.`);
    return;
  }

  const r = await api(dbUser.tokens.accessToken);

  if (r.status !== 401) return r;

  const res = await fetch(`${ssoServerUrl}/users/refresh`, {
    method: "POST",
    body: JSON.stringify({
      token: dbUser.tokens.refreshToken,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    console.log(`SSO-SDK: Refresh failed.`);
    await db.delete(dbId);
    return;
  }

  const { data } = (await res.json()) as RefTokenRes;

  await db.update(dbId, {
    ...dbUser,
    tokens: {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    },
  });

  const nR = await api(data.accessToken);

  return nR;
};

export const login = async (redirectUrl: string) => {
  if (!isBrowser()) return;

  const r = `${ssoClientUrl}/sso?sdkKey=${window.location.origin}&redirectUri=${redirectUrl}`;

  window.location.href = r;
};

export const exchange = async () => {
  if (!isBrowser()) {
    console.log(`SSO-SDK: Not in browser.`);
    return;
  }

  const url = new URL(window.location.href);
  const token = url.searchParams.get("token");

  if (!token) {
    console.log(`SSO-SDK: No token found in URL.`);
    return;
  }

  url.searchParams.delete("token");
  window.history.pushState({}, "", url.href);

  const res = await fetch(`${ssoServerUrl}/sso/exchange`, {
    method: "POST",
    body: JSON.stringify({
      token,
      sdkKey: window.location.origin,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    console.log(`SSO-SDK: Exchange failed.`);
    return;
  }

  interface Res {
    statusCode: number;
    success: boolean;
    message: string;
    data: {
      tokens: {
        accessToken: string;
        refreshToken: string;
      };
    };
  }

  const data: Res = await res.json();

  const profileRes = await fetch(`${ssoServerUrl}/users/profile`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.data.tokens.accessToken}`,
    },
  });

  if (!profileRes.ok) {
    console.log(`SSO-SDK: Profile fetch failed.`);
    return;
  }

  const profileData: ProfileRes = await profileRes.json();

  await db.open();

  await db.delete(dbId);

  await db.create({
    ...profileData.data,
    userId: profileData.data.id,
    tokens: data.data.tokens,
    id: dbId,
  });

  return { ...profileData.data, tokens: data.data.tokens };
};

// todo: fix
// export const fetchProfile = async () => {
//   if (!isBrowser()) {
//     if (this.config.debug) console.log(`SSO-SDK: Not in browser.`);
//     return;
//   }

//   const res = await this.withRefresh(async (aT) => {
//     return await fetch(`${this.ssoServerUrl}/users/profile`, {
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${aT}`,
//         "x-sdk-key": this.config.sdkKey,
//       },
//     });
//   });

//   if (!res?.ok) {
//     if (this.config.debug) console.log(`SSO-SDK: Profile fetch failed.`);
//     return;
//   }

//   const { data } = (await res.json()) as ProfileRes;

//   this.cb({
//     type: c.actions.profile_fetch,
//     payload: data,
//   });

//   return data;
// };

// export const refresh = async () => {
//   if (!isBrowser()) {
//     console.log(`SSO-SDK: Not in browser.`);
//     return;
//   }

//   await db.open();

//   const dbUser = (await db.getById(dbId)) as DBRes | undefined;

//   if (!dbUser) {
//     console.log(`SSO-SDK: No user found in DB.`);
//     return;
//   }

//   const res = await fetch(`${ssoServerUrl}/users/refresh`, {
//     method: "POST",
//     body: JSON.stringify({
//       token: dbUser.tokens.refreshToken,
//     }),
//     headers: {
//       "Content-Type": "application/json",
//     },
//   });

//   if (!res.ok) {
//     console.log(`SSO-SDK: Refresh failed.`);
//     return;
//   }

//   const { data } = (await res.json()) as RefTokenRes;

//   await db.update(dbId, {
//     ...dbUser,
//     tokens: {
//       accessToken: data.accessToken,
//       refreshToken: data.refreshToken,
//     },
//   });

//   return data;
// };

export const logout = async () => {
  if (!isBrowser()) return;

  const res = await withRefresh(async (aT) => {
    return await fetch(`${ssoServerUrl}/users/logout`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aT}`,
      },
    });
  });

  if (!res?.ok) return;

  await db.delete(dbId);

  return true;
};
