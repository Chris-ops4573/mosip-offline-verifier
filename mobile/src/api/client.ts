import axios from "axios";
import Constants from "expo-constants";

const { API_BASE_URL, API_TOKEN } = Constants.expoConfig?.extra ?? {};

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use((cfg) => {
  if (API_TOKEN) {
    cfg.headers = { ...(cfg.headers ?? {}), Authorization: `Bearer ${API_TOKEN}` };
  }
  return cfg;
});
