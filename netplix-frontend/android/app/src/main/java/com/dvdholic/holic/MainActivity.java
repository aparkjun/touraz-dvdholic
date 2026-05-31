package com.dvdholic.holic;

import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;

import androidx.annotation.Nullable;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Edge-to-edge (targetSdk 35+ / Android 15):
 * <ul>
 *   <li>targetSdk 36 이므로 Android 15+ 에서는 시스템이 edge-to-edge 를 강제 적용한다(앱 코드 불필요).</li>
 *   <li>콘텐츠 인셋은 웹에서 {@code viewport-fit=cover} + CSS {@code env(safe-area-inset-*)} 로 처리.</li>
 *   <li>Play Console '지원 중단 API' 경고를 피하려고 deprecated API
 *       ({@code setDecorFitsSystemWindows}, {@code setStatusBarColor}, {@code SHORT_EDGES},
 *       androidx.activity {@code EdgeToEdge})는 일절 사용하지 않는다.
 *       디스플레이 컷아웃은 지원 중단되지 않은 {@code ALWAYS} 모드만 명시한다.</li>
 * </ul>
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();

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
