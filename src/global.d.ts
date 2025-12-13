export {};

declare global {
  interface Window {
    OuraRingExtension?: unknown;
    roamAlphaAPI?: {
      constants?: {
        corsAnywhereProxyUrl?: string;
      };
    };
  }
}

