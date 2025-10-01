import axios from "axios";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { API_BASE_URL } = Constants.expoConfig?.extra ?? {};

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Store the logout callback function
let logoutCallback: (() => void) | null = null;

// Function to set the logout callback from App.tsx
export const setLogoutCallback = (callback: () => void) => {
  logoutCallback = callback;
};

// Add an interceptor to include the Authorization header dynamically
api.interceptors.request.use(async (cfg) => {
  const token = await AsyncStorage.getItem("vc_access_token"); // Retrieve token from storage
  if (token) {
    cfg.headers = { ...(cfg.headers ?? {}), Authorization: `Bearer ${token}` };
  }
  return cfg;
});

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      console.log("🔓 Authentication failed - triggering logout");

      // Call the logout callback if it exists
      if (logoutCallback) {
        logoutCallback();
      }
    }

    return Promise.reject(error);
  }
);
