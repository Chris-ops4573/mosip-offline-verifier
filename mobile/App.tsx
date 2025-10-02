import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, StyleSheet, View, Text, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setLogoutCallback } from "./src/api/client"; // Add this import

// Screens
import HomeScreen from "./src/screens/HomeScreen";
import AuthScreen from "./src/screens/AuthScreen";
import SyncScreen from "./src/screens/SyncScreen";
import ScanScreen from "./src/screens/ScanScreen";
import AdminConsoleScreen from "./src/screens/AdminConsoleScreen";
import ScanHistoryScreen from "./src/screens/ScanHistoryScreen";

// Add this import for decoding JWT
import { decode as atob } from "base-64";

const Stack = createNativeStackNavigator();
const ACCESS_TOKEN_KEY = "vc_access_token";
const BACKGROUND_COLOR = "#0b0d12";

// Helper to decode JWT and extract user_type
function getUserTypeFromToken(token: string | null): string | null {
    if (!token) return null;
    try {
        const payload = token.split(".")[1];
        const decoded = JSON.parse(atob(payload));
        return decoded.user_type || null;
    } catch (e) {
        return null;
    }
}

function App() {
    // isLoggedIn: null (initial loading), false (logged out), true (logged in)
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [userType, setUserType] = useState<string | null>(null);

    // Function to check for token on app startup
    useEffect(() => {
        const checkToken = async () => {
            try {
                const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
                setIsLoggedIn(!!token);
                setUserType(getUserTypeFromToken(token));
            } catch (e) {
                console.error("Error reading token from storage:", e);
                setIsLoggedIn(false);
                setUserType(null);
            }
        };
        checkToken();
    }, []);

    // Function passed to AuthScreen to be called on successful login/signup
    const handleAuthSuccess = async () => {
        // After login, re-check token and user type
        try {
            const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
            setIsLoggedIn(!!token);
            setUserType(getUserTypeFromToken(token));
        } catch (e) {
            setIsLoggedIn(true);
            setUserType(null);
        }
    };

    // Updated logout handler to accept optional message
    const handleLogout = async (message?: string) => {
        await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
        setIsLoggedIn(false);
        setUserType(null);
        
        // Show message if provided
        if (message) {
            Alert.alert(
                "Session Expired",
                message,
                [{ text: "OK", style: "default" }]
            );
        }
    };

    // Register the logout callback with the API client
    useEffect(() => {
        setLogoutCallback(handleLogout);
    }, []);

    if (isLoggedIn === null) {
        // Show loading screen while checking AsyncStorage
        return (
            <View style={styles.fullCenter}>
                <ActivityIndicator size="large" color="#0A84FF" />
                <Text style={styles.text}>Loading user session...</Text>
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: BACKGROUND_COLOR },
                }}
            >
                {/* Conditional rendering based on authentication state */}
                {isLoggedIn ? (
                    <Stack.Group>
                        <Stack.Screen name="Home">
                            {props => <HomeScreen {...props} onLogout={handleLogout} />}
                        </Stack.Screen>
                        <Stack.Screen name="Sync" component={SyncScreen} /> 
                        <Stack.Screen name="Scan" component={ScanScreen} /> 
                        <Stack.Screen name="ScanHistory" component={ScanHistoryScreen} />
                        {/* Only show Admin if userType is 'admin' */}
                        {userType === "admin" && (
                            <Stack.Screen name="Admin" component={AdminConsoleScreen} />
                        )}
                    </Stack.Group>
                ) : (
                    <Stack.Group>
                        <Stack.Screen 
                            name="Auth" 
                            component={AuthScreen} 
                            // Pass the state update function to the Auth screen
                            initialParams={{ onAuthSuccess: handleAuthSuccess }} 
                        />
                    </Stack.Group>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    fullCenter: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: BACKGROUND_COLOR,
    },
    text: {
        color: "#fff",
        marginTop: 10,
    },
});

export default App;
