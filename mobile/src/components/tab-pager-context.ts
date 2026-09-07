import { createContext, useContext } from "react";

export interface TabPagerLockApi {
  setLocked: (locked: boolean) => void;
  setIntercept: (fn: (() => boolean) | null) => void;
}

export const TabPagerLockContext = createContext<TabPagerLockApi>({
  setLocked: () => {},
  setIntercept: () => {},
});

export function useTabPagerLock(): TabPagerLockApi {
  return useContext(TabPagerLockContext);
}
