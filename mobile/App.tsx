import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "./src/screens/HomeScreen";
import SyncScreen from "./src/screens/SyncScreen";
import ScanScreen from "./src/screens/ScanScreen";
import AdminConsoleScreen from "./src/screens/AdminConsoleScreen";
import ScanHistoryScreen from "./src/screens/ScanHistoryScreen";
import { StyleSheet, View, Text } from "react-native";

const Stack = createNativeStackNavigator();

const screens = {
  Home: HomeScreen,
  Sync: SyncScreen,
  Scan: ScanScreen,
  Admin: AdminConsoleScreen,
  ScanHistory: ScanHistoryScreen,
};

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0b0d12" },
        }}
        initialRouteName="Home"
      >
        {Object.entries(screens).map(([name, component]) => (
          <Stack.Screen key={name} name={name} component={component} />
        ))}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  fullCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#fff",
  },
});

export default App;
