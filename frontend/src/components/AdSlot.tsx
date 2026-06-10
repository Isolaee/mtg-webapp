import React, { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../context/AuthContext";

interface AdSlotProps {
  slotId: string;
  style?: React.CSSProperties;
}

// AdSense publisher ID comes from the build env (GHA variable); when unset
// (dev, forks, pre-approval builds) AdSlot renders nothing.
const AD_CLIENT = process.env.REACT_APP_ADSENSE_CLIENT || "";

// Load the adsbygoogle script once, lazily, so the client ID can be env-driven
// (a static tag in index.html can't be — CRA leaves unset %VARS% as literal text).
function ensureAdSenseScript() {
  if (document.querySelector("script[data-adsbygoogle-loader]")) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
  script.crossOrigin = "anonymous";
  script.setAttribute("data-adsbygoogle-loader", "");
  document.head.appendChild(script);
}

const AdSlot: React.FC<AdSlotProps> = ({ slotId, style }) => {
  const { isPremium } = useAuth();

  // No ads on Android (AdSense ToS), in dev, without real IDs, or for premium users
  if (Capacitor.isNativePlatform()) return null;
  if (process.env.NODE_ENV === "development") return null;
  if (!AD_CLIENT || !slotId) return null;
  if (isPremium) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    try {
      ensureAdSenseScript();
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {}
  }, []);

  return (
    <div style={{ textAlign: "center", margin: "0.5em 0", ...style }}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
};

export default AdSlot;
