import axios from "axios";

const apiClient = axios.create({
  baseURL: `${process.env.SSO_SERVER_URL}/api/v1`,
});

export default apiClient;
