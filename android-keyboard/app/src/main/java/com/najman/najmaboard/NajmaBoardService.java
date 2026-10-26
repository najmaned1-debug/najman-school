package com.najman.najmaboard;

import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.inputmethodservice.InputMethodService;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/** Najman School keyboard (letters A-Z, numbers 0-9, symbols). */
public class NajmaBoardService extends InputMethodService {

    private static final int NAVY = 0xFF0A1222;
    private static final int KEY = 0xFF1F2B47;
    private static final int KEY_SPECIAL = 0xFF2A3A5E;
    private static final int GOLD = 0xFFF5A623;
    private static final int GOLD_DARK = 0xFFB87608;
    private static final int RED = 0xFF7F1D1D;
    private static final int TEXT = 0xFFF1F5F9;

    private LinearLayout root;
    private EditorInfo info;
    private boolean numeric;
    private boolean symbols;
    private boolean noCap;
    private int shift; // 0 = off, 1 = one letter, 2 = caps lock
    private long lastShiftTap;
    private final List<Button> letterKeys = new ArrayList<Button>();
    private Button shiftKey;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable repeater;

    @Override
    public boolean onEvaluateFullscreenMode() {
        return false;
    }

    @Override
    public View onCreateInputView() {
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(NAVY);
        root.setPadding(dp(4), dp(2), dp(4), dp(14));
        build();
        return root;
    }

    @Override
    public void onStartInputView(EditorInfo ei, boolean restarting) {
        super.onStartInputView(ei, restarting);
        info = ei;
        int cls = ei.inputType & InputType.TYPE_MASK_CLASS;
        int var = ei.inputType & InputType.TYPE_MASK_VARIATION;
        numeric = cls == InputType.TYPE_CLASS_NUMBER
                || cls == InputType.TYPE_CLASS_PHONE
                || cls == InputType.TYPE_CLASS_DATETIME;
        noCap = var == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
                || var == InputType.TYPE_TEXT_VARIATION_URI
                || var == InputType.TYPE_TEXT_VARIATION_PASSWORD
                || var == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
                || var == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS
                || var == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD;
        symbols = false;
        shift = (noCap || numeric) ? 0 : 2;
        if (root != null) {
            build();
        }
        updateAutoCap();
    }

    // ---------------------------------------------------------------- helpers

    private int dp(float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private static int lighten(int c) {
        int a = (c >> 24) & 0xFF;
        int r = (c >> 16) & 0xFF;
        int g = (c >> 8) & 0xFF;
        int b = c & 0xFF;
        r = r + (255 - r) / 4;
        g = g + (255 - g) / 4;
        b = b + (255 - b) / 4;
        return (a << 24) | (r << 16) | (g << 8) | b;
    }

    private GradientDrawable shape(int color) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(8));
        return d;
    }

    private StateListDrawable keyBg(int color) {
        StateListDrawable s = new StateListDrawable();
        s.addState(new int[]{android.R.attr.state_pressed}, shape(lighten(color)));
        s.addState(new int[0], shape(color));
        return s;
    }

    private void startRepeat(final Runnable action) {
        stopRepeat();
        repeater = new Runnable() {
            @Override
            public void run() {
                action.run();
                handler.postDelayed(this, 70);
            }
        };
        handler.postDelayed(repeater, 420);
    }

    private void stopRepeat() {
        if (repeater != null) {
            handler.removeCallbacks(repeater);
            repeater = null;
        }
    }

    private Button makeKey(String label, int color, float weight, int heightDp, final boolean repeat, final Runnable action) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextColor(color == GOLD ? 0xFF111111 : TEXT);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setPadding(0, 0, 0, 0);
        b.setMinHeight(0);
        b.setMinimumHeight(0);
        b.setMinWidth(0);
        b.setMinimumWidth(0);
        b.setIncludeFontPadding(false);
        b.setStateListAnimator(null);
        b.setBackground(keyBg(color));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(heightDp), weight);
        lp.setMargins(dp(2), dp(3), dp(2), dp(3));
        b.setLayoutParams(lp);
        b.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent e) {
                switch (e.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        v.setPressed(true);
                        v.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
                        action.run();
                        if (repeat) {
                            startRepeat(action);
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        v.setPressed(false);
                        stopRepeat();
                        return true;
                    default:
                        return true;
                }
            }
        });
        return b;
    }

    private LinearLayout newRow() {
        LinearLayout r = new LinearLayout(this);
        r.setOrientation(LinearLayout.HORIZONTAL);
        r.setGravity(Gravity.CENTER);
        r.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        return r;
    }

    private View spacer(float weight) {
        View v = new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(0, 1, weight));
        return v;
    }

    // ---------------------------------------------------------------- layout

    private void build() {
        root.removeAllViews();
        letterKeys.clear();
        shiftKey = null;
        root.addView(header());
        if (numeric) {
            buildNumeric();
        } else if (symbols) {
            buildSymbols();
        } else {
            buildLetters();
        }
    }

    private View header() {
        LinearLayout h = newRow();
        h.setPadding(dp(6), dp(4), dp(6), dp(2));
        TextView brand = new TextView(this);
        brand.setText("\u2328  Najman School");
        brand.setTextColor(GOLD);
        brand.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        brand.setTypeface(Typeface.DEFAULT_BOLD);
        brand.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        h.addView(brand);
        TextView hide = new TextView(this);
        hide.setText("Funga  \u25BE");
        hide.setTextColor(0xFFCBD5E1);
        hide.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        hide.setPadding(dp(12), dp(4), dp(6), dp(4));
        hide.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                requestHideSelf(0);
            }
        });
        h.addView(hide);
        return h;
    }

    private void addCharRow(String chars, boolean letters, float pad) {
        LinearLayout r = newRow();
        if (pad > 0) {
            r.addView(spacer(pad));
        }
        for (int i = 0; i < chars.length(); i++) {
            r.addView(charKey(chars.charAt(i), letters));
        }
        if (pad > 0) {
            r.addView(spacer(pad));
        }
        root.addView(r);
    }

    private Button charKey(final char c, final boolean letter) {
        Button b = makeKey(String.valueOf(c), KEY, 1f, 46, false, new Runnable() {
            @Override
            public void run() {
                if (letter) {
                    typeLetter(c);
                } else {
                    commit(String.valueOf(c));
                    afterCommit();
                }
            }
        });
        if (letter) {
            b.setTag(Character.valueOf(c));
            letterKeys.add(b);
            b.setText(shift > 0 ? String.valueOf(Character.toUpperCase(c)) : String.valueOf(c));
        }
        return b;
    }

    private Button backspaceKey(float weight, int h) {
        return makeKey("\u232B", RED, weight, h, true, new Runnable() {
            @Override
            public void run() {
                backspace();
            }
        });
    }

    private Button enterKey(float weight, int h) {
        return makeKey(enterLabel(), GOLD, weight, h, false, new Runnable() {
            @Override
            public void run() {
                enter();
            }
        });
    }

    private Button spaceKey(float weight) {
        Button b = makeKey("Najman School", KEY, weight, 46, false, new Runnable() {
            @Override
            public void run() {
                commit(" ");
                afterCommit();
            }
        });
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        return b;
    }

    private void buildLetters() {
        addCharRow("1234567890", false, 0);
        addCharRow("qwertyuiop", true, 0);
        addCharRow("asdfghjkl", true, 0);

        LinearLayout r3 = newRow();
        shiftKey = makeKey("\u21E7", KEY_SPECIAL, 2f, 46, false, new Runnable() {
            @Override
            public void run() {
                shift = shift > 0 ? 0 : 2;
                refreshShift();
            }
        });
        r3.addView(shiftKey);
        String z = "zxcvbnm";
        for (int i = 0; i < z.length(); i++) {
            r3.addView(charKey(z.charAt(i), true));
        }
        r3.addView(backspaceKey(2f, 46));
        root.addView(r3);
        refreshShift();

        LinearLayout r4 = newRow();
        r4.addView(makeKey("?123", KEY_SPECIAL, 2f, 46, false, new Runnable() {
            @Override
            public void run() {
                symbols = true;
                build();
            }
        }));
        r4.addView(charKey(',', false));
        r4.addView(spaceKey(4f));
        r4.addView(charKey('.', false));
        r4.addView(enterKey(2f, 46));
        root.addView(r4);
    }

    private void buildSymbols() {
        addCharRow("0123456789", false, 0);
        addCharRow("@#%&*-+()/", false, 0);
        addCharRow("!?:;\"'_=~", false, 0.5f);

        LinearLayout r3 = newRow();
        r3.addView(charKey('$', false));
        String s = "<>[]{}\\";
        for (int i = 0; i < s.length(); i++) {
            r3.addView(charKey(s.charAt(i), false));
        }
        r3.addView(backspaceKey(2f, 46));
        root.addView(r3);

        LinearLayout r4 = newRow();
        r4.addView(makeKey("ABC", KEY_SPECIAL, 2f, 46, false, new Runnable() {
            @Override
            public void run() {
                symbols = false;
                build();
            }
        }));
        r4.addView(charKey(',', false));
        r4.addView(spaceKey(4f));
        r4.addView(charKey('.', false));
        r4.addView(enterKey(2f, 46));
        root.addView(r4);
    }

    private void buildNumeric() {
        int cls = info == null ? InputType.TYPE_CLASS_NUMBER : (info.inputType & InputType.TYPE_MASK_CLASS);
        char s1 = '.';
        char s2 = '-';
        char s3 = ',';
        if (cls == InputType.TYPE_CLASS_PHONE) {
            s1 = '+';
            s2 = '*';
            s3 = '#';
        } else if (cls == InputType.TYPE_CLASS_DATETIME) {
            s1 = '/';
            s2 = ':';
            s3 = '-';
        }
        LinearLayout r0 = newRow();
        r0.addView(numKey('1'));
        r0.addView(numKey('2'));
        r0.addView(numKey('3'));
        r0.addView(backspaceKey(1f, 54));
        root.addView(r0);

        LinearLayout r1 = newRow();
        r1.addView(numKey('4'));
        r1.addView(numKey('5'));
        r1.addView(numKey('6'));
        r1.addView(numKey(s1));
        root.addView(r1);

        LinearLayout r2 = newRow();
        r2.addView(numKey('7'));
        r2.addView(numKey('8'));
        r2.addView(numKey('9'));
        r2.addView(numKey(s2));
        root.addView(r2);

        LinearLayout r3 = newRow();
        r3.addView(numKey('0'));
        r3.addView(makeKey("00", KEY, 1f, 54, false, new Runnable() {
            @Override
            public void run() {
                commit("00");
                afterCommit();
            }
        }));
        r3.addView(numKey(s3));
        r3.addView(enterKey(1f, 54));
        root.addView(r3);
    }

    private Button numKey(final char c) {
        return makeKey(String.valueOf(c), KEY, 1f, 54, false, new Runnable() {
            @Override
            public void run() {
                commit(String.valueOf(c));
            }
        });
    }

    // ---------------------------------------------------------------- shift / caps

    private void refreshShift() {
        for (Button b : letterKeys) {
            Object t = b.getTag();
            if (t instanceof Character) {
                char c = ((Character) t).charValue();
                b.setText(shift > 0 ? String.valueOf(Character.toUpperCase(c)) : String.valueOf(c));
            }
        }
        if (shiftKey != null) {
            int color = shift == 2 ? GOLD_DARK : (shift == 1 ? GOLD : KEY_SPECIAL);
            shiftKey.setBackground(keyBg(color));
            shiftKey.setTextColor(shift == 1 ? 0xFF111111 : TEXT);
        }
    }

    private void updateAutoCap() {
        // Capitals are the default; the shift key switches to lowercase.
    }

    // ---------------------------------------------------------------- input

    private void commit(String s) {
        InputConnection ic = getCurrentInputConnection();
        if (ic != null) {
            ic.commitText(s, 1);
        }
    }

    private void afterCommit() {
        updateAutoCap();
    }

    private void typeLetter(char c) {
        String s = String.valueOf(c);
        if (shift > 0) {
            s = s.toUpperCase();
        }
        commit(s);
        if (shift == 1) {
            shift = 0;
            refreshShift();
        }
        updateAutoCap();
    }

    private void backspace() {
        InputConnection ic = getCurrentInputConnection();
        if (ic == null) {
            return;
        }
        CharSequence sel = ic.getSelectedText(0);
        if (sel != null && sel.length() > 0) {
            ic.commitText("", 1);
        } else {
            sendDownUpKeyEvents(KeyEvent.KEYCODE_DEL);
        }
        updateAutoCap();
    }

    private String enterLabel() {
        if (info == null) {
            return "\u21B5";
        }
        boolean multi = (info.inputType & InputType.TYPE_TEXT_FLAG_MULTI_LINE) != 0;
        if ((info.imeOptions & EditorInfo.IME_FLAG_NO_ENTER_ACTION) != 0 || multi) {
            return "\u21B5";
        }
        switch (info.imeOptions & EditorInfo.IME_MASK_ACTION) {
            case EditorInfo.IME_ACTION_GO:
                return "Go";
            case EditorInfo.IME_ACTION_SEARCH:
                return "Search";
            case EditorInfo.IME_ACTION_SEND:
                return "Send";
            case EditorInfo.IME_ACTION_NEXT:
                return "Next";
            case EditorInfo.IME_ACTION_DONE:
                return "Done";
            default:
                return "\u21B5";
        }
    }

    private void enter() {
        InputConnection ic = getCurrentInputConnection();
        if (ic == null || info == null) {
            return;
        }
        int act = info.imeOptions & EditorInfo.IME_MASK_ACTION;
        boolean multi = (info.inputType & InputType.TYPE_TEXT_FLAG_MULTI_LINE) != 0;
        boolean noAction = (info.imeOptions & EditorInfo.IME_FLAG_NO_ENTER_ACTION) != 0;
        if (!noAction && !multi && act != EditorInfo.IME_ACTION_NONE && act != EditorInfo.IME_ACTION_UNSPECIFIED) {
            ic.performEditorAction(act);
        } else {
            sendDownUpKeyEvents(KeyEvent.KEYCODE_ENTER);
        }
        updateAutoCap();
    }
}
