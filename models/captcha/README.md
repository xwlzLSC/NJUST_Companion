# Captcha recognition model

Source: [sml2h3/ddddocr](https://github.com/sml2h3/ddddocr), PyPI release **1.6.1**.
Bundled asset: `ddddocr/common_old.onnx` (13,606,051 bytes), MIT license in `LICENSE`.
SHA-256: `b8f2ad9cbc1f2e3922a6cb9459e30824e7e2467f3fb4fd61420640e34ea0bf68`.

`js/captcha-ddddocr.js` implements grayscale resizing and CTC decoding for this
specific model. Its ASCII index mapping is derived from that release's old charset.
Do not replace the model without updating and testing the matching charset.
ONNX Runtime Web is pinned to 1.22.0; WASM runs single-threaded so Android WebView
and cloud functions do not require SharedArrayBuffer/cross-origin isolation.

Android builds copy the model and runtime into the APK. Web development serves
the runtime from `node_modules/onnxruntime-web/dist`; run `npm ci` first.
The model stays on the device (Android/Web), or inside your own cloud function
(mini program). No external OCR API or password transfer to an OCR provider is used.

The mini program counterpart is `E:/NJUST_companion/cloudfunctions/njustSync2`.
Shared adapters in its `lib/` must remain identical to the files in `js/`.
Its matching model is `ocr-data/common_old.onnx`.

Verification: `node scripts/test-captcha-flow.cjs`, `node scripts/test-mini-ocr.cjs`.
`node scripts/benchmark-captcha.cjs --fetch` optionally fetches eight public images
without attempting a login. Small samples are not a production accuracy guarantee.
