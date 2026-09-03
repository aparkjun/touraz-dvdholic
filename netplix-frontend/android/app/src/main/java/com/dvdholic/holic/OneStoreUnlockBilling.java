package com.dvdholic.holic;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.gaa.sdk.iap.AcknowledgeListener;
import com.gaa.sdk.iap.AcknowledgeParams;
import com.gaa.sdk.iap.IapResult;
import com.gaa.sdk.iap.IapResultListener;
import com.gaa.sdk.iap.ProductDetail;
import com.gaa.sdk.iap.ProductDetailsListener;
import com.gaa.sdk.iap.ProductDetailsParams;
import com.gaa.sdk.iap.PurchaseClient;
import com.gaa.sdk.iap.PurchaseClientStateListener;
import com.gaa.sdk.iap.PurchaseData;
import com.gaa.sdk.iap.PurchaseFlowParams;
import com.gaa.sdk.iap.PurchasesUpdatedListener;
import com.gaa.sdk.iap.QueryPurchasesListener;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 원스토어 일회성 잠금 해제 {@code dvdholic_unlock}.
 */
final class OneStoreUnlockBilling implements PurchasesUpdatedListener {

    private final Plugin plugin;
    private final Handler main = new Handler(Looper.getMainLooper());
    private PurchaseClient client;
    private final AtomicBoolean connecting = new AtomicBoolean(false);
    private final List<Runnable> onReady = new CopyOnWriteArrayList<>();
    @Nullable
    private PluginCall pendingPurchase;

    OneStoreUnlockBilling(Plugin plugin) {
        this.plugin = plugin;
    }

    void load() {
        client = PurchaseClient.newBuilder(plugin.getContext())
                .setListener(this)
                .build();
        connect(null, false);
    }

    void destroy() {
        pendingPurchase = null;
        onReady.clear();
        if (client != null) {
            try {
                client.endConnection();
            } catch (Exception ignored) {
                /* already closed */
            }
        }
    }

    void isUnlocked(PluginCall call) {
        runWhenReady(call, false, () -> queryOwned(call, false));
    }

    void restore(PluginCall call) {
        runWhenReady(call, true, () -> queryOwned(call, true));
    }

    void getProduct(PluginCall call) {
        runWhenReady(call, false, () -> queryDetails(call, details -> {
            JSObject out = new JSObject();
            out.put("productId", AppUnlockPlugin.PRODUCT_ID);
            if (details != null) {
                String price = details.getPrice();
                if (price != null && !price.isEmpty()) out.put("price", price);
                out.put("title", details.getTitle());
            }
            call.resolve(out);
        }));
    }

    void purchase(PluginCall call) {
        call.setKeepAlive(true);
        runWhenReady(call, true, () -> queryDetails(call, details -> {
            if (details == null) {
                reject(call, "PRODUCT_UNAVAILABLE", "인앱 상품을 찾을 수 없습니다. 원스토어 상품 ID를 확인하세요.");
                return;
            }
            Activity activity = plugin.getActivity();
            if (activity == null) {
                reject(call, "NO_ACTIVITY", "결제 화면을 열 수 없습니다.");
                return;
            }
            PurchaseFlowParams flow = PurchaseFlowParams.newBuilder()
                    .setProductId(AppUnlockPlugin.PRODUCT_ID)
                    .setProductType(PurchaseClient.ProductType.INAPP)
                    .build();
            pendingPurchase = call;
            main.post(() -> {
                IapResult launched = client.launchPurchaseFlow(activity, flow);
                if (!launched.isSuccess()) {
                    pendingPurchase = null;
                    handleNeed(call, launched, true, () -> purchase(call));
                }
            });
        }));
    }

    @Override
    public void onPurchasesUpdated(IapResult iapResult, @Nullable List<PurchaseData> purchases) {
        PluginCall call = pendingPurchase;
        if (iapResult.getResponseCode() == PurchaseClient.ResponseCode.RESULT_USER_CANCELED) {
            pendingPurchase = null;
            if (call != null) {
                JSObject out = new JSObject();
                out.put("unlocked", false);
                out.put("canceled", true);
                call.resolve(out);
            }
            return;
        }
        if (iapResult.getResponseCode() == PurchaseClient.ResponseCode.RESULT_ITEM_ALREADY_OWNED) {
            pendingPurchase = null;
            if (call != null) queryOwned(call, true);
            return;
        }
        if (!iapResult.isSuccess() || purchases == null) {
            pendingPurchase = null;
            if (call != null) {
                handleNeed(call, iapResult, true, () -> purchase(call));
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

    private void connect(@Nullable Runnable then, boolean promptLogin) {
        if (client != null && client.isReady()) {
            if (then != null) then.run();
            return;
        }
        if (then != null) onReady.add(then);
        if (!connecting.compareAndSet(false, true)) return;
        client.startConnection(new PurchaseClientStateListener() {
            @Override
            public void onSetupFinished(IapResult iapResult) {
                connecting.set(false);
                List<Runnable> queued = new ArrayList<>(onReady);
                onReady.clear();
                if (iapResult.isSuccess()) {
                    for (Runnable r : queued) r.run();
                    return;
                }
                if (promptLogin && isNeedLogin(iapResult)) {
                    launchLogin(() -> {
                        for (Runnable r : queued) r.run();
                    }, () -> {
                        for (Runnable r : queued) r.run();
                    });
                    return;
                }
                if (isNeedUpdate(iapResult)) {
                    launchUpdate(() -> {
                        for (Runnable r : queued) r.run();
                    }, () -> {
                        for (Runnable r : queued) r.run();
                    });
                    return;
                }
                for (Runnable r : queued) r.run();
            }

            @Override
            public void onServiceDisconnected() {
                connecting.set(false);
            }
        });
    }

    private void runWhenReady(PluginCall call, boolean promptLogin, Runnable action) {
        connect(() -> {
            if (client == null || !client.isReady()) {
                if (promptLogin) {
                    reject(call, "BILLING_UNAVAILABLE", "원스토어 결제를 사용할 수 없습니다. 원스토어 앱 로그인과 업데이트를 확인해 주세요.");
                } else {
                    JSObject out = new JSObject();
                    out.put("unlocked", false);
                    out.put("productId", AppUnlockPlugin.PRODUCT_ID);
                    call.resolve(out);
                }
                return;
            }
            action.run();
        }, promptLogin);
    }

    private interface DetailsCb {
        void accept(@Nullable ProductDetail details);
    }

    private void queryDetails(PluginCall call, DetailsCb cb) {
        ProductDetailsParams params = ProductDetailsParams.newBuilder()
                .setProductIdList(Collections.singletonList(AppUnlockPlugin.PRODUCT_ID))
                .setProductType(PurchaseClient.ProductType.INAPP)
                .build();
        client.queryProductDetailsAsync(params, new ProductDetailsListener() {
            @Override
            public void onProductDetailsResponse(IapResult result, @Nullable List<ProductDetail> list) {
                if (isNeedLogin(result) || isNeedUpdate(result)) {
                    handleNeed(call, result, false, () -> queryDetails(call, cb));
                    return;
                }
                if (!result.isSuccess()) {
                    reject(call, "QUERY_FAILED", result.getMessage());
                    return;
                }
                ProductDetail found = null;
                if (list != null) {
                    for (ProductDetail d : list) {
                        if (AppUnlockPlugin.PRODUCT_ID.equals(d.getProductId())) {
                            found = d;
                            break;
                        }
                    }
                }
                cb.accept(found);
            }
        });
    }

    private void queryOwned(PluginCall call, boolean acknowledge) {
        client.queryPurchasesAsync(PurchaseClient.ProductType.INAPP, new QueryPurchasesListener() {
            @Override
            public void onPurchasesResponse(IapResult result, @Nullable List<PurchaseData> purchases) {
                if (isNeedLogin(result) || isNeedUpdate(result)) {
                    if (acknowledge) {
                        handleNeed(call, result, true, () -> queryOwned(call, true));
                    } else {
                        JSObject out = new JSObject();
                        out.put("unlocked", false);
                        call.resolve(out);
                    }
                    return;
                }
                if (!result.isSuccess()) {
                    reject(call, "QUERY_FAILED", result.getMessage());
                    return;
                }
                List<PurchaseData> list = purchases != null ? purchases : List.of();
                if (acknowledge) acknowledgeAll(list);
                JSObject out = new JSObject();
                out.put("unlocked", ownsUnlock(list));
                call.resolve(out);
            }
        });
    }

    private void acknowledgeAll(List<PurchaseData> purchases) {
        for (PurchaseData p : purchases) {
            if (p.getPurchaseState() != PurchaseData.PurchaseState.PURCHASED) continue;
            if (p.isAcknowledged()) continue;
            AcknowledgeParams ack = AcknowledgeParams.newBuilder()
                    .setPurchaseData(p)
                    .build();
            client.acknowledgeAsync(ack, new AcknowledgeListener() {
                @Override
                public void onAcknowledgeResponse(IapResult iapResult, PurchaseData purchaseData) {
                    /* ownership already granted locally */
                }
            });
        }
    }

    private static boolean ownsUnlock(List<PurchaseData> purchases) {
        for (PurchaseData p : purchases) {
            if (p.getPurchaseState() != PurchaseData.PurchaseState.PURCHASED) continue;
            if (AppUnlockPlugin.PRODUCT_ID.equals(p.getProductId())) return true;
        }
        return false;
    }

    private void handleNeed(PluginCall call, IapResult result, boolean failIfNotNeed, Runnable retry) {
        if (isNeedLogin(result)) {
            launchLogin(retry, () -> reject(call, "NEED_LOGIN", "원스토어에 로그인해 주세요."));
            return;
        }
        if (isNeedUpdate(result)) {
            launchUpdate(retry, () -> reject(call, "NEED_UPDATE", "원스토어 앱을 업데이트해 주세요."));
            return;
        }
        if (failIfNotNeed) {
            reject(call, "PURCHASE_FAILED", result.getMessage());
        } else {
            reject(call, "QUERY_FAILED", result.getMessage());
        }
    }

    private void launchLogin(Runnable onOk, Runnable onFail) {
        Activity activity = plugin.getActivity();
        if (activity == null) {
            onFail.run();
            return;
        }
        main.post(() -> client.launchLoginFlowAsync(activity, new IapResultListener() {
            @Override
            public void onResponse(@NonNull IapResult iapResult) {
                if (iapResult.isSuccess()) onOk.run();
                else onFail.run();
            }
        }));
    }

    private void launchUpdate(Runnable onOk, Runnable onFail) {
        Activity activity = plugin.getActivity();
        if (activity == null) {
            onFail.run();
            return;
        }
        main.post(() -> client.launchUpdateOrInstallFlow(activity, new IapResultListener() {
            @Override
            public void onResponse(@NonNull IapResult iapResult) {
                if (iapResult.isSuccess()) onOk.run();
                else onFail.run();
            }
        }));
    }

    private static boolean isNeedLogin(IapResult result) {
        return result.getResponseCode() == PurchaseClient.ResponseCode.RESULT_NEED_LOGIN;
    }

    private static boolean isNeedUpdate(IapResult result) {
        return result.getResponseCode() == PurchaseClient.ResponseCode.RESULT_NEED_UPDATE;
    }

    private static void reject(PluginCall call, String code, String message) {
        call.reject(message == null || message.isBlank() ? code : message, code);
    }
}
