import SSOSdk from "@newgameplusinc/odyssey-sso";

export default (() => {
  if (typeof window === "undefined") return null;

  return new SSOSdk({
    apiKey: "api",
    clientId: "cuid_root_app",
    debug: true,
  });
})();
