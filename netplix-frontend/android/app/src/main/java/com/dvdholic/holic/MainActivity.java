package com.dvdholic.holic;

import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;

import androidx.annotation.Nullable;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Edge-to-edge (targetSdk 35+ / Android 15):
 * <ul>
 *   <li>{@link androidx.activity.EdgeToEdge#enable} 는 {@code SHORT_EDGES} 를 써서 Play 지원 중단 경고 발생 → 사용 안 함</li>
 *   <li>{@link WindowCompat#setDecorFitsSystemWindows} + {@code LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS}</li>
 *   <li>웹: {@code viewport-fit=cover} + CSS {@code env(safe-area-inset-*)}</li>
 * </ul>
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyEdgeToEdge();
    }

    private void applyEdgeToEdge() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
            window.setAttributes(lp);
        }

        WindowInsetsControllerCompat controller =
                new WindowInsetsControllerCompat(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
    }
}
