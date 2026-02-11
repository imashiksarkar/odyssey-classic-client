import SSOSdk from "@newgameplusinc/odyssey-sso";

const sso = new SSOSdk({
  apiKey: "api",
  clientId: "cuid_root_app",
  debug: true,
});

export default sso;
