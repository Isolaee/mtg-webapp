import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { activatePremium } from "../api";
import { useAuth } from "../context/AuthContext";

const PRODUCT_ID = "remove_ads";

// cordova-plugin-purchase injects CdvPurchase into window at runtime
declare const CdvPurchase: any;

export interface IAPState {
  ready: boolean;
  price: string | null;
  purchasing: boolean;
  restoring: boolean;
  error: string | null;
  purchase: () => Promise<void>;
  restore: () => Promise<void>;
  clearError: () => void;
}

export function useIAP(): IAPState {
  const { refreshPremium } = useAuth();
  const [ready, setReady] = useState(false);
  const [price, setPrice] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (initialized.current) return;
    initialized.current = true;

    const { store, ProductType, Platform } = CdvPurchase;

    store.register([{
      id: PRODUCT_ID,
      type: ProductType.NON_CONSUMABLE,
      platform: Platform.GOOGLE_PLAY,
    }]);

    store.when()
      .productUpdated((product: any) => {
        if (product.id === PRODUCT_ID) {
          const ph = product.offers?.[0]?.pricingPhases?.[0];
          if (ph?.price) setPrice(ph.price);
        }
      })
      .approved(async (transaction: any) => {
        const hasProduct = transaction.products?.some((p: any) => p.id === PRODUCT_ID);
        if (!hasProduct) return;
        try {
          const token = transaction.purchaseId ?? transaction.transactionId ?? "purchased";
          await activatePremium(token);
          refreshPremium();
        } catch {
          // backend call failed — still finish the transaction to avoid re-triggering
        } finally {
          await transaction.finish();
          setPurchasing(false);
        }
      })
      .finished(() => {
        setPurchasing(false);
        setRestoring(false);
      });

    store.initialize([Platform.GOOGLE_PLAY]).then(() => setReady(true));
  }, [refreshPremium]);

  const purchase = async () => {
    if (!Capacitor.isNativePlatform()) return;
    setError(null);
    setPurchasing(true);
    try {
      const { store, Platform } = CdvPurchase;
      const product = store.get(PRODUCT_ID, Platform.GOOGLE_PLAY);
      const offer = product?.getOffer();
      if (!offer) {
        setError("Product not available. Please try again later.");
        setPurchasing(false);
        return;
      }
      const err = await offer.order();
      if (err) {
        setError(err.message ?? "Purchase failed.");
        setPurchasing(false);
      }
      // success handled in .approved() callback above
    } catch {
      setError("Purchase failed. Please try again.");
      setPurchasing(false);
    }
  };

  const restore = async () => {
    if (!Capacitor.isNativePlatform()) return;
    setError(null);
    setRestoring(true);
    try {
      const err = await CdvPurchase.store.restorePurchases();
      if (err) setError(err.message ?? "Restore failed.");
    } catch {
      setError("Restore failed. Please try again.");
    } finally {
      setRestoring(false);
    }
  };

  return {
    ready,
    price,
    purchasing,
    restoring,
    error,
    purchase,
    restore,
    clearError: () => setError(null),
  };
}
