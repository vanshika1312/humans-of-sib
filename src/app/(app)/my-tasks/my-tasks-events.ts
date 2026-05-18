"use client";

type Listener = () => void;

const assignedByMeListeners = new Set<Listener>();

export function subscribeAssignedByMeRefresh(listener: Listener) {
  assignedByMeListeners.add(listener);
  return () => {
    assignedByMeListeners.delete(listener);
  };
}

export function notifyAssignedByMeRefresh() {
  for (const listener of Array.from(assignedByMeListeners)) listener();
}

