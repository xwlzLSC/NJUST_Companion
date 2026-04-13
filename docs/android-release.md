# 安卓正式版与覆盖更新

如果你准备把 APK 发给其他人长期使用，必须先把发包方式改成：

- 固定包名
- 固定签名证书
- 每次发版递增 `versionCode`
- 始终发布 `release APK`

这样用户后面安装新版本时，系统才会把它识别为“更新应用”，而不是另一份新安装包。

## 当前项目已经配好的内容

项目现在已经带了这些能力：

- [android/app/build.gradle](../android/app/build.gradle) 支持从环境变量或 `keystore.properties` 读取正式签名
- [scripts/build-android-release.cjs](../scripts/build-android-release.cjs) 可构建正式版 APK
- [`.github/workflows/android-release.yml`](../.github/workflows/android-release.yml) 可在 GitHub Actions 里自动打包并发布到 GitHub Releases
- 应用内会检查 GitHub Releases 的最新版本，并在安卓安装包里提示用户更新

## 一次性准备：生成你自己的签名证书

这一步只做一次，而且必须长期保存好。后面所有正式版 APK 都要用这一份证书签名。

在本机执行：

```bash
keytool -genkeypair -v ^
  -keystore android/release.keystore ^
  -alias njust-companion ^
  -keyalg RSA ^
  -keysize 2048 ^
  -validity 36500
```

生成后，不要把真实证书提交到 GitHub。

项目已经忽略了这些文件：

- `*.jks`
- `*.keystore`
- `android/keystore.properties`

## 本地 release 构建

### 1. 写签名配置文件

复制：

- [android/keystore.properties.example](../android/keystore.properties.example)

另存为：

```text
android/keystore.properties
```

填入真实内容，例如：

```properties
storeFile=release.keystore
storePassword=你的 store 密码
keyAlias=njust-companion
keyPassword=你的 key 密码
```

### 2. 指定版本号

正式版必须保证：

- `APP_VERSION_NAME` 可以改成 `2.0.1`
- `APP_VERSION_CODE` 必须是递增整数，例如 `2`

PowerShell 示例：

```powershell
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-21.0.8.9-hotspot"
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:APP_VERSION_NAME="2.0.1"
$env:APP_VERSION_CODE="2"
npm run apk:release
```

输出位置：

```text
android/app/build/outputs/apk/release/app-release.apk
```

## GitHub 自动发正式版

仓库已经带了工作流：

- [`.github/workflows/android-release.yml`](../.github/workflows/android-release.yml)

它会做这些事：

1. 取代码
2. 安装 Node / JDK / Android SDK
3. 还原你的 keystore
4. 构建正式版 APK
5. 上传到 GitHub Releases
6. 生成两个安装包文件名：
   - `NJUST_Companion-release.apk`
   - `NJUST_Companion-v版本号.apk`

### 需要配置的 GitHub Secrets

进入：

`Repository -> Settings -> Secrets and variables -> Actions`

添加：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

其中 `ANDROID_KEYSTORE_BASE64` 可以这样生成：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("android/release.keystore")) | Set-Clipboard
```

### 如何发一版

打开 GitHub：

1. 进入 `Actions`
2. 选择 `Android Release`
3. 点击 `Run workflow`
4. 输入：
   - `version_name`，例如 `2.0.1`
   - `version_code`，例如 `2`
   - `release_notes`，可选

完成后，用户可以直接从 GitHub Releases 下载新版 APK。

## 用户如何覆盖更新

用户不需要卸载，只要满足下面三点，直接安装新 APK 即可覆盖旧版：

- 包名不变
- 签名不变
- `versionCode` 更高

## 一个必须提前说清的点

如果你以前发给别人安装的是 `debug APK`，而现在改成正式 `release APK`，签名通常不同。

这意味着：

- 旧 `debug` 用户大概率需要先卸载一次
- 从正式版开始，之后的所有版本都可以直接覆盖安装

所以你现在应该尽快固定到正式签名，不要再长期发 `debug` 包。
