plugins {
    id("com.android.application")
}

android {
    namespace = "fr.nastx.monpointage"
    compileSdk = 36

    defaultConfig {
        applicationId = "fr.nastx.monpointage"
        minSdk = 24
        targetSdk = 36
        versionCode = 3
        versionName = "1.1.0"
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
