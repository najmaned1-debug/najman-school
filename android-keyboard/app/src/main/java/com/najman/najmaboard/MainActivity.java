package com.najman.najmaboard;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Bundle;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.List;

/** Setup screen: enable and choose Najman School, plus a test field. */
public class MainActivity extends Activity {

    private TextView status;

    private int dp(float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private TextView text(String s, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        if (bold) {
            t.setTypeface(Typeface.DEFAULT_BOLD);
        }
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, dp(6), 0, dp(6));
        t.setLayoutParams(lp);
        return t;
    }

    private Button button(String label, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextColor(0xFF111111);
        b.setBackgroundColor(0xFFF5A623);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52));
        lp.setMargins(0, dp(8), 0, dp(8));
        b.setLayoutParams(lp);
        b.setOnClickListener(l);
        return b;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ScrollView sv = new ScrollView(this);
        sv.setBackgroundColor(0xFF0A1222);
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setPadding(dp(22), dp(36), dp(22), dp(36));
        sv.addView(l);

        l.addView(text("Najman School", 30, 0xFFF5A623, true));
        l.addView(text("Kibodi ya Najman Education Centre: herufi, namba na alama.", 15, 0xFFE2E8F0, false));
        l.addView(text("Hatua 1: Washa Najman School kwenye orodha ya kibodi, kisha rudi hapa.", 15, 0xFFE2E8F0, false));
        l.addView(button("1. Washa Najman School", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startActivity(new Intent(Settings.ACTION_INPUT_METHOD_SETTINGS));
            }
        }));
        l.addView(text("Hatua 2: Chagua Najman School kama kibodi ya sasa.", 15, 0xFFE2E8F0, false));
        l.addView(button("2. Chagua Najman School", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
                if (imm != null) {
                    imm.showInputMethodPicker();
                }
            }
        }));
        status = text("", 14, 0xFF86EFAC, true);
        l.addView(status);
        l.addView(text("Jaribu kuandika hapa:", 15, 0xFFE2E8F0, false));
        EditText et = new EditText(this);
        et.setHint("Andika hapa...");
        et.setHintTextColor(0xFF94A3B8);
        et.setTextColor(0xFFFFFFFF);
        et.setMinLines(3);
        et.setGravity(android.view.Gravity.TOP);
        l.addView(et);
        setContentView(sv);
    }

    @Override
    protected void onResume() {
        super.onResume();
        boolean enabled = false;
        InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (imm != null) {
            List<InputMethodInfo> list = imm.getEnabledInputMethodList();
            for (InputMethodInfo i : list) {
                if (getPackageName().equals(i.getPackageName())) {
                    enabled = true;
                }
            }
        }
        String def = Settings.Secure.getString(getContentResolver(), Settings.Secure.DEFAULT_INPUT_METHOD);
        boolean current = def != null && def.startsWith(getPackageName());
        if (current) {
            status.setText("\u2714 Najman School ndiyo kibodi yako ya sasa.");
        } else if (enabled) {
            status.setText("\u2714 Imewashwa. Sasa bonyeza hatua 2 kuichagua.");
        } else {
            status.setText("Bado haijawashwa. Bonyeza hatua 1.");
        }
    }
}
