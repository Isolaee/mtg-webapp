import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { AdMob, BannerAdSize, BannerAdPosition } from "@capacitor-community/admob";
import { useAuth } from "../context/AuthContext";

// Replace with your AdMob Banner Ad Unit ID from admob.google.com
const ADMOB_BANNER_ID = "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX";

const AndroidBanner: React.FC = () => {
  const { isPremium } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (isPremium) {
      AdMob.removeBanner().catch(() => {});
      return;
    }

    AdMob.showBanner({
      adId: ADMOB_BANNER_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: false,
    }).catch(() => {});

    return () => { AdMob.removeBanner().catch(() => {}); };
  }, [isPremium]);

  return null;
};

export default AndroidBanner;
