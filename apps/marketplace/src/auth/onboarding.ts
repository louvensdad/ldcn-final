const STORAGE_KEY = "ldcn-onboarding-seen";

/** Fase I: "primeiro login" — this browser has never been through the onboarding choice screen. */
export function hasSeenOnboarding(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function markOnboardingSeen(): void {
  localStorage.setItem(STORAGE_KEY, "true");
}
