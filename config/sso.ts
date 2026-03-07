import SSO from "@newgameplusinc/odyssey-sso";

const sso = new SSO({
  sdkKey: process.env.NEXT_PUBLIC_SDK_KEY ?? "testing",
  debug: process.env.NEXT_PUBLIC_ENV !== "production",
});

export default sso;
