package com.dvdholic.holic;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Google Play 일회성 상품 {@code dvdholic_unlock} (구매 옵션 ID: default).
 */
@CapacitorPlugin(name = "AppUnlock")
public class AppUnlockPlugin extends Plugin implements PurchasesUpdatedListener {

    public static final String PRODUCT_ID = "dvdholic_unlock";

    private BillingClient billingClient;
    private final AtomicBoolean connecting = new AtomicBoolean(false);
    private final List<Runnable> onReady = new CopyOnWriteArrayList<>();
    @Nullable
    private PluginCall pendingPurchase;
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        billingClient = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(
                        PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
        connect(null);
    }

    @PluginMethod
    public void isUnlocked(PluginCall call) {
        runWhenReady(call, () -> queryOwned(call, false));
    }

    @PluginMethod
    public void restore(PluginCall call) {
        runWhenReady(call, () -> queryOwned(call, true));
    }

    @PluginMethod
    public void getProduct(PluginCall call) {
        runWhenReady(call, () -> queryDetails(call, details -> {
            JSObject out = new JSObject();
            out.put("productId", PRODUCT_ID);
            if (details != null) {
                ProductDetails.OneTimePurchaseOfferDetails offer = pickOffer(details);
                if (offer != null) {
                    out.put("price", offer.getFormattedPrice());
                    out.put("priceAmountMicros", offer.getPriceAmountMicros());
                    out.put("currency", offer.getPriceCurrencyCode());
                }
                out.put("title", details.getTitle());
                out.put("description", details.getDescription());
            }
            call.resolve(out);
        }));
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        call.setKeepAlive(true);
        runWhenReady(call, () -> queryDetails(call, details -> {
            if (details == null) {
                reject(call, "PRODUCT_UNAVAILABLE", "인앱 상품을 찾을 수 없습니다. Play Console 상품 ID를 확인하세요.");
                return;
            }
            Activity activity = getActivity();
            if (activity == null) {
                reject(call, "NO_ACTIVITY", "결제 화면을 열 수 없습니다.");
                return;
            }
            ProductDetails.OneTimePurchaseOfferDetails offer = pickOffer(details);
            BillingFlowParams.ProductDetailsParams.Builder pd =
                    BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details);
            String offerToken = offerTokenOf(offer);
            if (offerToken != null) {
                pd.setOfferToken(offerToken);
            }
            BillingFlowParams flow = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(List.of(pd.build()))
                    .build();
            pendingPurchase = call;
            main.post(() -> {
                BillingResult launched = billingClient.launchBillingFlow(activity, flow);
                if (launched.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    pendingPurchase = null;
                    reject(call, "LAUNCH_FAILED", launched.getDebugMessage());
                }
            });
        }));
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, @Nullable List<Purchase> purchases) {
        PluginCall call = pendingPurchase;
        int code = billingResult.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            pendingPurchase = null;
            if (call != null) {
                JSObject out = new JSObject();
                out.put("unlocked", false);
                out.put("canceled", true);
                call.resolve(out);
            }
            return;
        }
        if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            pendingPurchase = null;
            if (call != null) {
                queryOwned(call, true);
            }
            return;
        }
        if (code != BillingClient.BillingResponseCode.OK || purchases == null) {
            pendingPurchase = null;
            if (call != null) {
                reject(call, "PURCHASE_FAILED", billingResult.getDebugMessage());
            }
            return;
        }
        acknowledgeAll(purchases);
        boolean unlocked = ownsUnlock(purchases);
        pendingPurchase = null;
        if (call != null) {
            JSObject out = new JSObject();
            out.put("unlocked", unlocked);
            call.resolve(out);
        }
    }

    private void connect(@Nullable Runnable then) {
        if (billingClient.isReady()) {
            if (then != null) then.run();
            return;
        }
        if (then != null) onReady.add(then);
        if (!connecting.compareAndSet(false, true)) return;
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                connecting.set(false);
                List<Runnable> queued = new ArrayList<>(onReady);
                onReady.clear();
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    for (Runnable r : queued) r.run();
                } else {
                    for (Runnable r : queued) {
                        // runWhenReady wraps PluginCall — failures handled by query methods
                        r.run();
                    }
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                connecting.set(false);
            }
        });
    }

    private void runWhenReady(PluginCall call, Runnable action) {
        connect(() -> {
            if (!billingClient.isReady()) {
                reject(call, "BILLING_UNAVAILABLE", "Google Play 결제를 사용할 수 없습니다.");
                return;
            }
            action.run();
        });
    }

    private interface DetailsCb {
        void accept(@Nullable ProductDetails details);
    }

    private void queryDetails(PluginCall call, DetailsCb cb) {
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(List.of(
                        QueryProductDetailsParams.Product.newBuilder()
                                .setProductId(PRODUCT_ID)
                                .setProductType(BillingClient.ProductType.INAPP)
                                .build()))
                .build();
        billingClient.queryProductDetailsAsync(params, (result, list) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                reject(call, "QUERY_FAILED", result.getDebugMessage());
                return;
            }
            ProductDetails found = null;
            if (list != null) {
                for (ProductDetails d : list) {
                    if (PRODUCT_ID.equals(d.getProductId())) {
                        found = d;
                        break;
                    }
                }
            }
            cb.accept(found);
        });
    }

    private void queryOwned(PluginCall call, boolean acknowledge) {
        billingClient.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder()
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build(),
                (result, purchases) -> {
                    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        reject(call, "QUERY_FAILED", result.getDebugMessage());
                        return;
                    }
                    List<Purchase> list = purchases != null ? purchases : List.of();
                    if (acknowledge) acknowledgeAll(list);
                    JSObject out = new JSObject();
                    out.put("unlocked", ownsUnlock(list));
                    call.resolve(out);
                });
    }

    private void acknowledgeAll(List<Purchase> purchases) {
        for (Purchase p : purchases) {
            if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
            if (p.isAcknowledged()) continue;
            AcknowledgePurchaseParams ack = AcknowledgePurchaseParams.newBuilder()
                    .setPurchaseToken(p.getPurchaseToken())
                    .build();
            billingClient.acknowledgePurchase(ack, ignored -> { });
        }
    }

    private static boolean ownsUnlock(List<Purchase> purchases) {
        for (Purchase p : purchases) {
            if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
            List<String> ids = p.getProducts();
            if (ids != null && ids.contains(PRODUCT_ID)) return true;
        }
        return false;
    }

    @Nullable
    private static String offerTokenOf(@Nullable ProductDetails.OneTimePurchaseOfferDetails offer) {
        if (offer == null) return null;
        try {
            java.lang.reflect.Method m = offer.getClass().getMethod("getOfferToken");
            Object token = m.invoke(offer);
            if (token instanceof String && !((String) token).isBlank()) {
                return (String) token;
            }
        } catch (Exception ignored) {
            /* Billing 7.1 OneTimePurchaseOfferDetails 에는 offerToken 이 없을 수 있음 */
        }
        return null;
    }

    @Nullable
    private static ProductDetails.OneTimePurchaseOfferDetails pickOffer(ProductDetails details) {
        try {
            java.lang.reflect.Method m = details.getClass().getMethod("getOneTimePurchaseOfferDetailsList");
            Object raw = m.invoke(details);
            if (raw instanceof List<?> list && !list.isEmpty()) {
                Object first = list.get(0);
                if (first instanceof ProductDetails.OneTimePurchaseOfferDetails) {
                    return (ProductDetails.OneTimePurchaseOfferDetails) first;
                }
            }
        } catch (Exception ignored) {
            /* Billing 7.0 이하는 목록 API 없음 */
        }
        return details.getOneTimePurchaseOfferDetails();
    }

    private static void reject(PluginCall call, String code, String message) {
        call.reject(message == null || message.isBlank() ? code : message, code);
    }
}
