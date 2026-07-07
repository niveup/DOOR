export function getBackendUrl() {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      // If accessed via a network IP, rewrite localhost or 127.0.0.1 to that IP
      return envUrl.replace("localhost", hostname).replace("127.0.0.1", hostname);
    }
  }
  return envUrl;
}
