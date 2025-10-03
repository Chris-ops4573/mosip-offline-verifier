// src/screens/AuthScreen.tsx
import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";
import axios from "axios";

type Props = NativeStackScreenProps<any>;

const colors = {
  bg: "#0b0d12",
  card: "#12151b",
  subtle: "#171b22",
  border: "#232a35",
  text: "#F2F4F7",
  muted: "#9AA3AD",
  accent: "#0A84FF",
  accentAlt: "#30D158",
  error: "#FF3B30",
};

const ACCESS_TOKEN_KEY = "vc_access_token";

interface AuthResponse {
  access_token: string;
  token_type: string;
}

export default function AuthScreen({ navigation, route }: Props) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupUserType, setSignupUserType] = useState<"admin" | "user">("user");

  // The 'onAuthSuccess' function is passed from App.tsx via the route params
  const { onAuthSuccess } = route.params as { onAuthSuccess: () => void };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);

      const response = await api.post<AuthResponse>('/auth/token', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const tokenData = response.data;
      await AsyncStorage.setItem(ACCESS_TOKEN_KEY, tokenData.access_token);
      api.defaults.headers.common['Authorization'] = `Bearer ${tokenData.access_token}`;
      onAuthSuccess();

    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const detail = error.response.data.detail || "Invalid credentials.";
        Alert.alert("Login Failed", detail);
      } else {
        console.error("Login Error:", error);
        Alert.alert("Error", "Could not connect to the server or unknown error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setLoading(true);
    try {
      // Send user_type in signup
      const response = await api.post('/auth/register', {
        username: username,
        password: password,
        user_type: signupUserType,
      });

      Alert.alert("Success", response.data.message || "Registration complete. Please log in.");
      setIsLogin(true);

    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const detail = error.response.data.detail || "Registration failed.";
        Alert.alert("Sign Up Failed", detail);
      } else {
        console.error("Sign Up Error:", error);
        Alert.alert("Error", "Could not connect to the server or unknown error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (loading) return;
    if (!username || !password) {
      Alert.alert("Missing Fields", "Please enter both username and password.");
      return;
    }
    if (isLogin) {
      handleLogin();
    } else {
      handleSignup();
    }
  };

  const formTitle = isLogin ? "Log In" : "Sign Up";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.ornamentTop} />
      <View style={styles.ornamentBottom} />

      <View style={styles.header}>
        <Text style={styles.title}>{formTitle}</Text>
        <Text style={styles.subtitle}>
          {isLogin ? "Access the Admin Console and protected features." : "Create your new verification account."}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.accentBar} />

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., admin_user"
          placeholderTextColor={colors.muted}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          keyboardType="default"
        />

        <Text style={[styles.label, styles.mt14]}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {/* Show user type toggle only in signup mode */}
        {!isLogin && (
          <View style={{ marginTop: 18, marginBottom: 8 }}>
            <Text style={styles.label}>Sign up as:</Text>
            <View style={{ flexDirection: "row", marginTop: 8 }}>
              <Pressable
                onPress={() => setSignupUserType("user")}
                style={[
                  styles.userTypeButton,
                  signupUserType === "user" && styles.userTypeButtonSelected,
                ]}
                hitSlop={8}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.userTypeButtonText,
                    signupUserType === "user" && styles.userTypeButtonTextSelected,
                  ]}
                >
                  Verifier
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSignupUserType("admin")}
                style={[
                  styles.userTypeButton,
                  signupUserType === "admin" && styles.userTypeButtonSelected,
                  { marginLeft: 16 },
                ]}
                hitSlop={8}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.userTypeButtonText,
                    signupUserType === "admin" && styles.userTypeButtonTextSelected,
                  ]}
                >
                  Admin
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <Pressable
          onPress={handleSubmit}
          hitSlop={8}
          android_ripple={{ color: "rgba(255,255,255,0.12)" }}
          disabled={loading}
          style={({ pressed }) => [
            styles.button,
            isLogin ? styles.buttonPrimary : styles.buttonSecondary,
            pressed && styles.pressed,
            styles.mt14,
            loading && { opacity: 0.6 }
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{formTitle}</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            if (loading) return;
            setIsLogin(!isLogin);
          }}
          hitSlop={8}
          style={styles.switchButton}
          disabled={loading}
        >
          <Text style={styles.switchButtonText}>
            {isLogin ? "Need an account? Sign Up" : "Already have an account? Log In"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 28,
  },
  ornamentTop: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(10,132,255,0.16)",
  },
  ornamentBottom: {
    position: "absolute",
    bottom: -90,
    left: -70,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(48,209,88,0.10)",
  },
  header: {
    marginBottom: 18,
    marginTop: 50,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.22,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 7 },
    }),
  },
  accentBar: {
    height: 3,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginBottom: 16,
    width: 56,
  },
  mt14: { marginTop: 14 },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.subtle,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: colors.accent,
  },
  buttonSecondary: {
    backgroundColor: colors.accentAlt,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.2,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.96,
  },
  switchButton: {
    marginTop: 20,
    padding: 10,
    alignItems: "center",
  },
  switchButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "600",
  },
  userTypeButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.subtle,
  },
  userTypeButtonSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  userTypeButtonText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 15,
  },
  userTypeButtonTextSelected: {
    color: "#fff",
  },
});
