import React, { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../context/AuthContext";

interface AdSlotProps {
  slotId: string;
  style?: React.CSSProperties;
}

const AD_CLIENT = "ca-pub-XXXXXXXXXXXXXXXX"; // replace with your AdSense publisher ID

const AdSlot: React.FC<AdSlotProps> = ({ slotId, style }) => {
  const { isPremium } = useAuth();

  // No ads on Android (AdSense ToS), in dev, or for premium users
  if (Capacitor.isNativePlatform()) return null;
  if (process.env.NODE_ENV === "development") return null;
  if (isPremium) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    try {
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
