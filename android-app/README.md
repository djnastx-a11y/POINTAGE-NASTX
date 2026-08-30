# Mon Pointage Android

Ce dossier contient l'application Android installable de Mon Pointage.

Elle conserve l'application web V7.5 comme source unique et l'ouvre dans une WebView Android sécurisée. Les données Supabase restent donc les mêmes entre la version web et l'APK.

## APK

Le workflow GitHub Actions `Build Android APK` compile automatiquement un APK de test installable à chaque modification du dossier `android-app`.

Fichier généré : `app-debug.apk`

Nom de l'application : `Mon Pointage`
Package Android : `fr.nastx.monpointage`
Version : `1.0.0`

## Mise à jour

Les changements de l'application web publiés sur GitHub Pages apparaissent dans l'application Android sans avoir à reconstruire l'APK, sauf si le code Android lui-même change.
