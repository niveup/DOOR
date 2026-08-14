import { Redirect } from "expo-router";
import { LoadingApp } from "@/app/_layout";
import { useAuth } from "@/src/providers/auth-provider";

export default function Index() {
  const { ready, unlocked } = useAuth();
  if (!ready) return <LoadingApp />;
  return <Redirect href={unlocked ? "/(tabs)" : "/passcode"} />;
}
