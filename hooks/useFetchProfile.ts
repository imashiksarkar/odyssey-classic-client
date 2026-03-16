import { AuthContext } from "@/app/auth-wrapper";
import getSdk from "@/config/sso";
import { use, useMemo } from "react";

const useFetchProfile = () => {
  const { setLoading } = use(AuthContext);
  const sdk = useMemo(() => getSdk(), []);

  if (!sdk) return;

  setLoading(true);

  return sdk.fetchProfile().then((r) => {
    setLoading(false);
    return r;
  });
};

export default useFetchProfile;
