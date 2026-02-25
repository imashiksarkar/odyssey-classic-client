// "use client";

import axios from "axios";

const apiClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_SSO_SERVER_URL}/api/v1`,
});

export default apiClient;
