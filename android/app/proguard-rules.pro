# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# ====== REACT NATIVE RULES ======

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# React Native 0.60+
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Vector icons
-keep class com.oblador.vectoricons.** { *; }

# Your app package
-keep class com.treeenum.** { *; }

# React Native new architecture
-keep class com.facebook.fbreact.specs.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }

# BlurView
-keep class com.reactnativecommunity.blur.** { *; }

# Axios or networking
-keep class com.facebook.react.modules.network.** { *; }

# ====== PREVENT OBFUSCATION FOR CRITICAL CLASSES ======

# Don't obfuscate methods in React Native that are called from JS
-keepclassmembers class ** {
  @com.facebook.react.uimanager.annotations.ReactProp <methods>;
  @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

# React Native modules
-keepclassmembers class * extends com.facebook.react.bridge.JavaScriptModule {
    *;
}

-keepclassmembers class * extends com.facebook.react.bridge.NativeModule {
    *;
}

# React Native View Managers
-keep public class com.facebook.react.uimanager.** {
  public protected *;
}

# React Native Bridge
-keep class com.facebook.react.bridge.** { *; }

# Don't warn about missing classes for libraries
-dontwarn com.facebook.react.**

# Hermes (if enabled)
-dontwarn com.facebook.hermes.**
-keep class com.facebook.hermes.** { *; }