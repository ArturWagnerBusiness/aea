# Clear Past Cordova Build
rm -rf aea/www/*

# Compile React App
cd aea-base
npm run build
cd ..

# Exit if build fails
read -p "If REACT build failed, kill the script CTRL+C" unuseda

# Changing Archlinux default Java
sudo archlinux-java set java-8-openjdk

# Move React Build to Cordova
mv aea-base/build/* aea/www/

# Building Mobile APK
cd aea
cordova build android
cd ..

# Changing back to personal defaults
sudo archlinux-java set java-20-openjdk


read -p "If CORDOVA build failed, kill the script CTRL+C" unusedb

# Installing apk onto the connected device
adb install aea/platforms/android/app/build/outputs/apk/debug/app-debug.apk
