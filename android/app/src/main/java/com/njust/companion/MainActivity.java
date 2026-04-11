package com.njust.companion;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NJUSTWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
