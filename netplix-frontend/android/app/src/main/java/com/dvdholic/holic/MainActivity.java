package com.dvdholic.holic;

import android.os.Bundle;
import android.view.Window;

import androidx.annotation.Nullable;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Edge-to-edge: {@link WindowCompat#enableEdgeToEdge} 는 Android 15 에서
 * setStatusBarColor·setNavigationBarColor·SHORT_EDGES 등 지원 중단 API 를 호출하므로 사용하지 않음.
 * {@link WindowCompat#setDecorFitsSystemWindows} + {@link WindowInsetsControllerCompat} 만 사용.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyEdgeToEdgeWithoutDeprecatedApis();
    }

    private void applyEdgeToEdgeWithoutDeprecatedApis() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        WindowInsetsControllerCompat controller =
                new WindowInsetsControllerCompat(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
    }
}
