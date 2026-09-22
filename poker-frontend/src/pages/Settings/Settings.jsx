import { useState, useEffect } from "react";
import { Layout } from "../../components/Layout";
import { getUserData, getStorageUsage } from "../../api/user";
import { useTheme } from "../../context/ThemeContext";
import { AccountSection } from "./AccountSection";
import { AppearanceSection } from "./AppearanceSection";
import "./Settings.css";

// One scrolling page rather than tabs: with two sections, tabs would hide
// exactly one card behind a click. The #account / #appearance anchors cover
// deep-linking, and components/ui/Tabs.jsx is there if a third section lands.
export function Settings() {
  const [user, setUser] = useState(null);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);
  const { syncFromServer } = useTheme();

  useEffect(() => {
    (async () => {
      try {
        const [uData, sData] = await Promise.all([
          getUserData(),
          getStorageUsage().catch(() => null),
        ]);
        if (uData?.userData) {
          setUser(uData.userData);
          // The server is the source of truth for preferences; ThemeContext
          // seeds itself from a local cache so the first paint is right, and
          // this reconciles it without costing an extra round trip.
          syncFromServer(uData.userData.preferences);
        }
        setStorage(sData ?? null);
      } catch (e) {
        console.error("Settings fetch:", e);
      } finally {
        setLoading(false);
      }
    })();
    // syncFromServer is a stable useCallback; this runs once on mount.
  }, [syncFromServer]);

  return (
    <Layout title="Settings" subtitle="Manage your account and appearance">
      <div className="settings-page">
        <AccountSection
          user={user}
          loading={loading}
          storage={storage}
          onUserChange={setUser}
        />
        <AppearanceSection />
      </div>
    </Layout>
  );
}

export default Settings;
