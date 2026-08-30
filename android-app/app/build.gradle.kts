plugins {
    id("com.android.application")
}

android {
    namespace = "fr.nastx.monpointage"
    compileSdk = 35

    defaultConfig {
        applicationId = "fr.nastx.monpointage"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
