import { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { NewsFeed } from "@/components/feed/NewsFeed";
import { ScriptPanel } from "@/components/script/ScriptPanel";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { useConfigStore } from "@/store/configStore";
import { useFeedStore } from "@/store/feedStore";
import { useNewsFeed } from "@/hooks/useNewsFeed";

export default function App() {
  const { isOnboarded } = useConfigStore();
  const { selectedNews } = useFeedStore();
  const { startPolling } = useNewsFeed();

  useEffect(() => {
    if (isOnboarded) startPolling();
  }, [isOnboarded]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left sidebar */}
      <Sidebar />

      {/* Center: feed */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <NewsFeed />
      </div>

      {/* Right: script panel */}
      <div className="w-[308px] shrink-0 border-l border-border/60 flex flex-col overflow-hidden">
        <ScriptPanel news={selectedNews} />
      </div>

      <SettingsModal />
      {!isOnboarded && <OnboardingModal />}
    </div>
  );
}
