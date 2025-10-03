import axios from "axios";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { API_BASE_URL } = Constants.expoConfig?.extra ?? {};

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Store the logout callback function - now supports optional message
let logoutCallback: ((message?: string) => void) | null = null;

// Function to set the logout callback from App.tsx
export const setLogoutCallback = (callback: (message?: string) => void) => {
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
      const requestUrl = error.config?.url || '';
      const errorDetail = error.response?.data?.detail || '';
      
      console.log("🔓 Authentication failed:", errorDetail);
      console.log("🔓 Request URL:", requestUrl);

      // If this is a login request, don't trigger automatic logout
      if (requestUrl.includes('/auth/token') || requestUrl.includes('/auth/register')) {
        console.log("🔓 Login/Register request failed - not triggering logout");
        // Let the login screen handle this error directly
        return Promise.reject(error);
      }

      // For other protected endpoints, treat as session expiration
      console.log("🔓 Protected endpoint failed - triggering logout");
      if (logoutCallback) {
        logoutCallback("Your session has expired. Please login again.");
      }
    }

    return Promise.reject(error);
  }
);
