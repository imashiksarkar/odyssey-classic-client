import SSO from "@newgameplusinc/odyssey-sso";

let sso: SSO | null = null;

const getSdk = (sdkKey?: string | null) => {
  if (sso) return sso;

  if (!sdkKey) return null;

  sso = new SSO({
    sdkKey: sdkKey,
    debug: process.env.NEXT_PUBLIC_ENV !== "production",
  });

  return sso;
};

export default getSdk;
