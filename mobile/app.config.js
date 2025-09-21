// app.config.js
require("dotenv").config();

const API_BASE_URL = process.env.API_BASE_URL || "http://192.168.1.50:8000";
const API_TOKEN = process.env.API_TOKEN || "";
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID;

module.exports = {
  expo: {
    name: "mobile",
    slug: "mobile",
    version: "1.0.0",
    scheme: "mosip",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,

    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },

    ios: {
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription: "We use the camera to scan credential QR codes."
      }
    },

    android: {
      package: "com.mosipofflineverifier",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      // expo-camera adds CAMERA automatically; keeping explicit is fine
      permissions: ["CAMERA"]
    },

    web: {
      favicon: "./assets/favicon.png"
    },

    plugins: [
      [
        "expo-camera",
        {
          cameraPermission:
            "Allow this app to access your camera for scanning QR codes",
          recordAudioAndroid: false
        }
      ],
      "expo-secure-store"
    ],

    extra: {
      API_BASE_URL,
      API_TOKEN,
      eas: { projectId: EAS_PROJECT_ID }
    }
  }
};
