package com.dvdholic.holic;

import android.os.Bundle;

import androidx.annotation.Nullable;
import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Android 15+ edge-to-edge: SHORT_EDGES 컷아웃 모드·구형 activity EdgeToEdge API 대신
 * {@link WindowCompat#enableEdgeToEdge} 사용 (Play Console 지원 중단 경고 회피).
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.enableEdgeToEdge(getWindow());
    }
}
