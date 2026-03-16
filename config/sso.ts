import SSO from "@newgameplusinc/odyssey-sso";

let sso: SSO | null = null;

const getSdk = () => {
  if (sso) return sso;

  const sdkKey: string | undefined = process.env.NEXT_PUBLIC_SDK_KEY;

  if (!sdkKey) return null;

  sso = new SSO({
    sdkKey: sdkKey,
    debug: process.env.NEXT_PUBLIC_ENV !== "production",
  });

  return sso;
};

export default getSdk;
