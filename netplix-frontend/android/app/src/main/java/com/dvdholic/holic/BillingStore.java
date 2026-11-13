package com.dvdholic.holic;

import android.content.Context;
import android.content.pm.InstallSourceInfo;
import android.content.pm.PackageManager;
import android.os.Build;

/**
 * Play 스토어에서 설치했으면 Google Play Billing, 그 외(원스토어·ADB)는 원스토어 IAP.
 */
final class BillingStore {

    private BillingStore() {}

    static boolean useGooglePlay(Context ctx) {
        return isPlayInstaller(installerOf(ctx));
    }

    private static boolean isPlayInstaller(String installer) {
        return "com.android.vending".equals(installer)
                || "com.google.android.feedback".equals(installer);
    }

    private static String installerOf(Context ctx) {
        try {
            PackageManager pm = ctx.getPackageManager();
            String pkg = ctx.getPackageName();
            if (Build.VERSION.SDK_INT >= 30) {
                InstallSourceInfo info = pm.getInstallSourceInfo(pkg);
                String installing = info.getInstallingPackageName();
                String initiating = info.getInitiatingPackageName();
                String originating = info.getOriginatingPackageName();
                if (isPlayInstaller(installing) || isPlayInstaller(initiating)
                        || isPlayInstaller(originating)) {
                    return "com.android.vending";
                }
                if (installing != null && !installing.isEmpty()) return installing;
                return initiating;
            }
            return pm.getInstallerPackageName(pkg);
        } catch (Exception ignored) {
            return null;
        }
    }
}
