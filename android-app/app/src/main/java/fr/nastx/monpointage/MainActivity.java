package fr.nastx.monpointage;

import android.app.Activity;
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
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {

    private static final String APP_URL = "https://djnastx-a11y.github.io/POINTAGE-NASTX/?native=1";
    private static final String APP_HOST = "djnastx-a11y.github.io";
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(245, 247, 251));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
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

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        WebView.setWebContentsDebuggingEnabled(false);
        webView.addJavascriptInterface(new AndroidDownloader(), "AndroidDownloader");

        webView.setWebViewClient(new WebViewClient() {
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
                if (url != null && url.startsWith("https://" + APP_HOST + "/POINTAGE-NASTX/")) {
                    installNativeDownloadBridge(view);
                }
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (failingUrl != null && failingUrl.startsWith(APP_URL.substring(0, APP_URL.indexOf("?")))) {
                    Toast.makeText(MainActivity.this, "Connexion impossible. Vérifie Internet puis relance Mon Pointage.", Toast.LENGTH_LONG).show();
                }
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void installNativeDownloadBridge(WebView view) {
        String js = "(function(){"
                + "if(!window.AndroidDownloader){return;}"
                + "window.downloadBlob=function(blob,name){"
                + "try{"
                + "var reader=new FileReader();"
                + "reader.onloadend=function(){"
                + "try{AndroidDownloader.saveBase64File(reader.result,name||'mon-pointage.pdf');}catch(e){console.error(e);}"
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
            if (dataUrl == null || fileName == null) {
                showError("Fichier invalide");
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
                    mimeType = header.substring(typeStart + 1, typeEnd);
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

    private String sanitizeFileName(String name) {
        String cleaned = name.replaceAll("[\\\\/:*?\"<>|]", "-").trim();
        return cleaned.isEmpty() ? "mon-pointage.pdf" : cleaned;
    }

    private void saveToDownloads(byte[] bytes, String fileName, String mimeType) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Mon Pointage");
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new Exception("Impossible de créer le fichier");

            try (OutputStream out = resolver.openOutputStream(uri)) {
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
                    "Récap téléchargé dans Téléchargements > Mon Pointage",
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
                    "Récap téléchargé : " + file.getAbsolutePath(),
                    Toast.LENGTH_LONG
            ).show());
        }
    }

    private boolean handleNavigation(Uri uri) {
        if (uri == null) return false;

        String scheme = uri.getScheme();
        String host = uri.getHost();

        if (("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme))
                && host != null
                && host.equals(APP_HOST)) {
            return false;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(intent);
            return true;
        } catch (Exception ignored) {
            return false;
        }
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
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.stopLoading();
            webView.removeJavascriptInterface("AndroidDownloader");
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
