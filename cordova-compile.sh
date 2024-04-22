# Changing Archlinux default Java
sudo archlinux-java set java-8-openjdk

# Building Mobile APK
cd aea
cordova build android
cd ..

# Changing back to personal defaults
sudo archlinux-java set java-20-openjdk


read -p "If CORDOVA build failed, kill the script CTRL+C" unusedb

# Installing apk onto the connected device
adb install aea/platforms/android/app/build/outputs/apk/debug/app-debug.apk
