plugins {
    id("com.android.application")
}

android {
    namespace = "fr.nastx.australiastreet.equipe"
    compileSdk = 36

    defaultConfig {
        applicationId = "fr.nastx.australiastreet.equipe"
        minSdk = 24
        targetSdk = 36
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
