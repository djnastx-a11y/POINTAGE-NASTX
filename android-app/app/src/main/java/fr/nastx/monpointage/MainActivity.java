package fr.nastx.monpointage;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Set;

public class MainActivity extends Activity {

    private static final String APP_URL = "https://djnastx-a11y.github.io/POINTAGE-NASTX/?native=5";
    private static final String APP_HOST = "djnastx-a11y.github.io";
    private static final String APP_PATH_PREFIX = "/POINTAGE-NASTX/";
    private static final String NATIVE_UI_CSS = "https://djnastx-a11y.github.io/POINTAGE-NASTX/native-v8.css?v=1.2.1";
    private static final int FILE_CHOOSER_REQUEST_CODE = 4102;
    private static final int MAX_DATA_URL_LENGTH = 32 * 1024 * 1024;
    private static final Set<String> ALLOWED_EXPORT_MIME_TYPES = Set.of(
            "application/pdf",
            "image/png",
            "application/json",
            "text/json",
            "text/csv",
            "text/calendar"
    );

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private volatile boolean trustedPage = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(238, 229, 216));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(true);
        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, false);

        WebView.setWebContentsDebuggingEnabled(false);
        webView.addJavascriptInterface(new AndroidDownloader(), "AndroidDownloader");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                if (!isTrustedAppUrl(url)) {
                    result.cancel();
                    return true;
                }
                runOnUiThread(() -> {
                    AlertDialog dialog = new AlertDialog.Builder(MainActivity.this)
                            .setMessage(message)
                            .setCancelable(false)
                            .setPositiveButton("OK", (d, which) -> result.confirm())
                            .setNegativeButton("ANNULER", (d, which) -> result.cancel())
                            .create();
                    dialog.setOnCancelListener(d -> result.cancel());
                    dialog.show();
                });
                return true;
            }

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> newFilePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (!trustedPage) {
                    newFilePathCallback.onReceiveValue(null);
                    return false;
                }
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = newFilePathCallback;
                try {
                    startActivityForResult(fileChooserParams.createIntent(), FILE_CHOOSER_REQUEST_CODE);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "Impossible d'ouvrir le sélecteur de fichier", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                trustedPage = isTrustedAppUrl(url);
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleNavigation(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                trustedPage = isTrustedAppUrl(url);
                if (trustedPage) {
                    installNativeEnhancements(view);
                    view.postDelayed(() -> installNativeEnhancements(view), 500);
                    view.postDelayed(() -> installNativeEnhancements(view), 1500);
                }
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (isTrustedAppUrl(failingUrl)) {
                    Toast.makeText(MainActivity.this, "Connexion impossible. Les données locales restent disponibles si elles ont déjà été chargées.", Toast.LENGTH_LONG).show();
                }
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void installNativeEnhancements(WebView view) {
        if (view == null || !trustedPage) return;
        String js = "(function(){"
                + "if(typeof AndroidDownloader==='undefined'){return;}"
                + "window.__MON_POINTAGE_NATIVE__=true;"
                + "document.documentElement.classList.add('native-v8');"
                + "var theme=document.querySelector('meta[name=theme-color]');if(theme){theme.setAttribute('content','#eee5d8');}"
                + "if(!document.getElementById('mon-pointage-native-v8')){"
                + "var link=document.createElement('link');link.id='mon-pointage-native-v8';link.rel='stylesheet';link.href='" + NATIVE_UI_CSS + "';document.head.appendChild(link);"
                + "}"
                + "window.downloadBlob=function(blob,name){"
                + "try{"
                + "if(!blob){AndroidDownloader.showError('Fichier vide');return;}"
                + "var reader=new FileReader();"
                + "reader.onloadend=function(){"
                + "try{AndroidDownloader.saveBase64File(String(reader.result||''),name||'mon-pointage.pdf');}catch(e){AndroidDownloader.showError(e.message||'Téléchargement impossible');}"
                + "};"
                + "reader.onerror=function(){try{AndroidDownloader.showError('Impossible de préparer le fichier');}catch(e){}};"
                + "reader.readAsDataURL(blob);"
                + "}catch(e){try{AndroidDownloader.showError(e.message||'Téléchargement impossible');}catch(_){}}"
                + "};"
                + "})();";
        view.evaluateJavascript(js, null);
    }

    public class AndroidDownloader {
        @JavascriptInterface
        public void saveBase64File(String dataUrl, String fileName) {
            if (!trustedPage) {
                showError("Téléchargement refusé hors de Mon Pointage");
                return;
            }
            if (dataUrl == null || dataUrl.isEmpty() || fileName == null) {
                showError("Fichier invalide");
                return;
            }
            if (dataUrl.length() > MAX_DATA_URL_LENGTH) {
                showError("Fichier trop volumineux");
                return;
            }

            try {
                int comma = dataUrl.indexOf(',');
                if (comma < 0) throw new IllegalArgumentException("Données du fichier invalides");

                String header = dataUrl.substring(0, comma);
                String base64Data = dataUrl.substring(comma + 1);
                String mimeType = "application/octet-stream";
                int typeStart = header.indexOf(':');
                int typeEnd = header.indexOf(';');
                if (typeStart >= 0 && typeEnd > typeStart) {
                    mimeType = header.substring(typeStart + 1, typeEnd).toLowerCase();
                }
                if (!ALLOWED_EXPORT_MIME_TYPES.contains(mimeType)) {
                    throw new IllegalArgumentException("Type de fichier non autorisé");
                }

                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                saveToDownloads(bytes, sanitizeFileName(fileName), mimeType);
            } catch (Exception e) {
                showError("Téléchargement impossible : " + e.getMessage());
            }
        }

        @JavascriptInterface
        public void showError(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show());
        }
    }

    private boolean isTrustedAppUrl(String url) {
        if (url == null) return false;
        try {
            return isTrustedAppUri(Uri.parse(url));
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean isTrustedAppUri(Uri uri) {
        if (uri == null) return false;
        return "https".equalsIgnoreCase(uri.getScheme())
                && APP_HOST.equalsIgnoreCase(uri.getHost())
                && uri.getPath() != null
                && uri.getPath().startsWith(APP_PATH_PREFIX);
    }

    private String sanitizeFileName(String name) {
        String cleaned = name.replaceAll("[\\\\/:*?\"<>|]", "-").trim();
        return cleaned.isEmpty() ? "mon-pointage.pdf" : cleaned;
    }

    private void saveToDownloads(byte[] bytes, String fileName, String mimeType) throws Exception {
        if (bytes == null || bytes.length == 0) throw new Exception("Le fichier est vide");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Mon Pointage");
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new Exception("Impossible de créer le fichier");

            try (OutputStream out = resolver.openOutputStream(uri, "w")) {
                if (out == null) throw new Exception("Impossible d'écrire le fichier");
                out.write(bytes);
                out.flush();
            } catch (Exception e) {
                resolver.delete(uri, null, null);
                throw e;
            }

            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, values, null, null);

            runOnUiThread(() -> Toast.makeText(
                    MainActivity.this,
                    "Fichier enregistré dans Téléchargements > Mon Pointage",
                    Toast.LENGTH_LONG
            ).show());
        } else {
            File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (dir == null) throw new Exception("Dossier de téléchargement indisponible");
            if (!dir.exists() && !dir.mkdirs()) throw new Exception("Impossible de créer le dossier");

            File file = new File(dir, fileName);
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(bytes);
                out.flush();
            }

            runOnUiThread(() -> Toast.makeText(
                    MainActivity.this,
                    "Fichier téléchargé : " + file.getAbsolutePath(),
                    Toast.LENGTH_LONG
            ).show());
        }
    }

    private boolean handleNavigation(Uri uri) {
        if (uri == null) return false;
        if (isTrustedAppUri(uri)) return false;

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(intent);
            return true;
        } catch (Exception e) {
            Toast.makeText(this, "Impossible d'ouvrir ce lien", Toast.LENGTH_SHORT).show();
            return true;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST_CODE || filePathCallback == null) return;
        Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        trustedPage = false;
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
        }
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.stopLoading();
            webView.removeJavascriptInterface("AndroidDownloader");
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
