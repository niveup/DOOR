import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected && state.isInternetReachable !== false))));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24,
      retry: (failureCount, error) => {
        const status = (error as any)?.status;
        const msg = (error as any)?.message;
        if (
          status === 401 ||
          (typeof msg === "string" && msg.toLowerCase().includes("passcode"))
        ) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnReconnect: true,
    },
    mutations: { retry: 1, networkMode: "offlineFirst" },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "DOOR_QUERY_CACHE_V1",
  throttleTime: 1000,
});
