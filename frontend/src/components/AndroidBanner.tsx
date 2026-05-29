import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { AdMob, BannerAdSize, BannerAdPosition } from "@capacitor-community/admob";
import { useAuth } from "../context/AuthContext";

// Replace with your AdMob Banner Ad Unit ID from admob.google.com
const ADMOB_BANNER_ID = "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX";

// Initialize the AdMob SDK exactly once. The native banner plugin only sets up
// its container ViewGroup inside initialize(); calling showBanner() before that
// resolves throws a NullPointerException (addView on a null parent) and crashes
// the app on launch. Guarding behind a shared promise guarantees ordering even
// though React fires this child's effect before the parent's init effect.
let initPromise: Promise<void> | null = null;
function ensureAdMobInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = AdMob.initialize({ initializeForTesting: true }).catch((err) => {
      // Allow a retry on a later mount if initialization failed.
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

const AndroidBanner: React.FC = () => {
  const { isPremium } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (isPremium) {
      AdMob.removeBanner().catch(() => {});
      return;
    }

    let cancelled = false;
    ensureAdMobInitialized()
      .then(() => {
        if (cancelled) return undefined;
        return AdMob.showBanner({
          adId: ADMOB_BANNER_ID,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
          isTesting: false,
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      AdMob.removeBanner().catch(() => {});
    };
  }, [isPremium]);

  return null;
};

export default AndroidBanner;
