// 默认网页代理后端，由 npm start -> scripts/run-rust.cjs 启动。
// 当前 Session 是个人单账号状态；新增多人服务必须另设计隔离，不能复用同一个 Jar。
// 学校链路分为智慧理工/CAS、教务业务页；HTML 解析与联网错误需分别处理。
// 与 server.js、js/native-sync.js、小程序云函数保持 API 返回契约一致。
use std::{env, net::SocketAddr, path::{Path, PathBuf}, sync::{Arc, OnceLock}, time::Duration};

use anyhow::{anyhow, Context, Result};
use aes::Aes128;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use cbc::cipher::{block_padding::Pkcs7, BlockEncryptMut, KeyIvInit};
use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use encoding_rs::{GB18030, GBK};
use keyring::Entry;
use regex::Regex;
use rand::{rngs::OsRng, RngCore};
use reqwest::{cookie::Jar, redirect::Policy, Client};
use scraper::{ElementRef, Html, Selector};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use tokio::{fs, sync::Mutex, time::sleep};
use tower_http::{services::{ServeDir, ServeFile}, trace::TraceLayer};
use tracing::info;

mod library;
mod academic_review;

const APP_VERSION: &str = "3.0.2-rust-cas";
const ENTRY_ORIGIN: &str = "http://202.119.81.113:8080";
const ENTRY_ORIGINS: [&str; 2] = [
    "http://202.119.81.113:8080",
    "http://202.119.81.112:8080",
];
const PROFILE_LABEL: &str = "智慧理工统一认证（Rust）";
const OFFICIAL_BUSINESS_BASE: &str = "https://bkjw.njust.edu.cn/njlgdx/";
const IDS_ORIGIN: &str = "https://ids.njust.edu.cn";
const SHARDS: [&str; 2] = [
    "http://202.119.81.113:9080/njlgdx/",
    "http://202.119.81.112:9080/njlgdx/",
];

const GLM_API_URL: &str = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const GLM_MODEL: &str = "glm-4.6v-flash";

static GLM_API_KEY: OnceLock<Option<String>> = OnceLock::new();

#[derive(Clone)]
struct AppState {
    session: Arc<Mutex<Session>>,
    started_at: std::time::Instant,
    storage_dir: PathBuf,
}

struct Session {
    client: Client,
    cas_client: Client,
    _jar: Arc<Jar>,
    pending_captcha: bool,
    pending_entry_origin: String,
    pending_cas: Option<(CasLoginForm, String, std::time::Instant)>,
    state: StoredState,
    storage_file: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
struct StoredState {
    logged_in: bool,
    syncing: bool,
    auto_sync_enabled: bool,
    username: String,
    remember_password: bool,
    business_base: String,
    last_sync_at: String,
    last_error: String,
    session_checked_at: String,
    data: Value,
}

impl Default for StoredState {
    fn default() -> Self {
        Self {
            logged_in: false,
            syncing: false,
            auto_sync_enabled: true,
            username: String::new(),
            remember_password: false,
            business_base: String::new(),
            last_sync_at: String::new(),
            last_error: String::new(),
            session_checked_at: String::new(),
            data: empty_data(),
        }
    }
}

#[derive(Debug, Deserialize)]
struct LoginRequest {
    username: String,
    password: String,
    captcha: Option<String>,
    #[serde(rename = "casCaptcha")]
    cas_captcha: Option<String>,
    #[serde(rename = "rememberPassword")]
    remember_password: bool,
}

#[derive(Clone)]
struct CasLoginForm {
    action_url: reqwest::Url,
    page_url: String,
    salt: String,
    fields: Vec<(String, String)>,
}

#[derive(Debug, Deserialize)]
struct SemesterRequest {
    #[serde(rename = "semesterStart")]
    semester_start: String,
}

#[derive(Debug, Deserialize)]
struct StatusQuery {
    check: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CaptchaQuery {
    username: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClassroomOptionsQuery {
    campus: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClassroomRequest {
    semester: Option<String>,
    campus: Option<String>,
    building: Option<String>,
    week: Option<u32>,
    weekday: Option<u32>,
    #[serde(rename = "startPeriodCode")]
    start_period_code: Option<String>,
    #[serde(rename = "endPeriodCode")]
    end_period_code: Option<String>,
    #[serde(rename = "dayLabel")]
    day_label: Option<String>,
    #[serde(rename = "periodLabel")]
    period_label: Option<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(env::var("RUST_LOG").unwrap_or_else(|_| "njust_companion_server=info,tower_http=info".into()))
        .init();

    let root = env::current_dir().context("无法读取项目目录")?;
    init_glm_key(&root);
    let glm_key_ready = GLM_API_KEY.get().and_then(|value| value.as_ref()).is_some();
    info!(glm_key_ready, "GLM captcha auto-recognition configured");
    let storage_dir = env::var("APP_STORAGE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| root.join("storage"));
    fs::create_dir_all(&storage_dir).await?;
    let session = Session::load(storage_dir.join("rust-server-state.json")).await?;
    let app_state = AppState {
        session: Arc::new(Mutex::new(session)),
        started_at: std::time::Instant::now(),
        storage_dir,
    };
    start_saved_session_restore(app_state.clone());
    start_session_keep_alive(app_state.clone());

    let static_files = ServeDir::new(&root)
        .not_found_service(ServeFile::new(root.join("index.html")));
    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/status", get(status))
        .route("/api/auth/captcha", get(captcha))
        .route("/api/auth/cas-captcha", get(cas_captcha))
        .route("/api/auth/login", post(login))
        .route("/api/auth/logout", post(logout))
        .route("/api/sync/now", post(sync_now))
        .route("/api/settings/semester-start", post(save_semester_start))
        .route("/api/classrooms/options", get(classroom_options))
        .route("/api/classrooms/query", post(classroom_query))
        .route("/api/library/search", get(library::search))
        .route("/api/library/detail", get(library::detail))
        .route("/api/academic-review", get(academic_review_page))
        .fallback_service(static_files)
        .layer(TraceLayer::new_for_http())
        .with_state(app_state);

    let host = env::var("HOST").unwrap_or_else(|_| "127.0.0.1".into());
    let port = env::var("PORT").ok().and_then(|value| value.parse().ok()).unwrap_or(3030);
    let address: SocketAddr = format!("{host}:{port}").parse().context("HOST 或 PORT 无效")?;
    info!(%address, "NJUST Rust backend is listening");
    let listener = tokio::net::TcpListener::bind(address).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

impl Session {
    async fn load(storage_file: PathBuf) -> Result<Self> {
        let state = match fs::read_to_string(&storage_file).await {
            Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => StoredState::default(),
            Err(error) => return Err(error.into()),
        };
        let jar = Arc::new(Jar::default());
        let client = Client::builder()
            .cookie_provider(jar.clone())
            .redirect(Policy::limited(8))
            .timeout(Duration::from_secs(20))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/135 Safari/537.36")
            .build()?;
        let cas_client = Client::builder()
            .cookie_provider(jar.clone())
            .redirect(Policy::none())
            .connect_timeout(Duration::from_secs(8))
            .timeout(Duration::from_secs(20))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/135 Safari/537.36")
            .build()?;
        // reqwest's in-memory jar intentionally isn't serialized.  On a server
        // restart the app asks for a fresh captcha rather than writing session
        // cookies to disk; no credential or cookie ends up in the state JSON.
        let mut session = Self {
            client,
            cas_client,
            _jar: jar,
            pending_captcha: false,
            pending_entry_origin: ENTRY_ORIGIN.to_string(),
            pending_cas: None,
            state: StoredState { logged_in: false, ..state },
            storage_file,
        };
        if remove_placeholder_schedule_items(&mut session.state.data) {
            session.save().await?;
        }
        Ok(session)
    }

    async fn save(&self) -> Result<()> {
        let mut safe = self.state.clone();
        safe.syncing = false;
        let content = serde_json::to_vec_pretty(&safe)?;
        let temporary = self.storage_file.with_extension("tmp");
        fs::write(&temporary, content).await?;
        fs::rename(temporary, &self.storage_file).await?;
        Ok(())
    }

    fn status(&self) -> Value {
        json!({
            "available": true,
            "version": APP_VERSION,
            "loggedIn": self.state.logged_in,
            "syncing": self.state.syncing,
            "autoSyncEnabled": self.state.auto_sync_enabled,
            "username": self.state.username,
            "rememberPassword": self.state.remember_password,
            "profile": "rust-8080",
            "profileLabel": PROFILE_LABEL,
            "businessBase": self.state.business_base,
            "lastSyncAt": self.state.last_sync_at,
            "lastError": self.state.last_error,
            "sessionCheckedAt": self.state.session_checked_at,
            "transport": "rust",
            "casCaptchaRequired": self.pending_cas.is_some(),
            "counts": {
                "schedule": array_len(&self.state.data, "schedule"),
                "grades": array_len(&self.state.data, "grades"),
                "certs": array_len(&self.state.data, "certs"),
                "exams": array_len(&self.state.data, "exams")
            }
        })
    }

    async fn request_text(&self, request: reqwest::RequestBuilder) -> Result<(String, String)> {
        let response = request.send().await?.error_for_status()?;
        let final_url = response.url().to_string();
        let headers = response.headers().clone();
        let bytes = response.bytes().await?;
        let charset = headers.get(header::CONTENT_TYPE).and_then(|value| value.to_str().ok()).unwrap_or("").to_ascii_lowercase();
        let text = if charset.contains("gb") {
            let (decoded, _, _) = GBK.decode(&bytes);
            decoded.into_owned()
        } else {
            match String::from_utf8(bytes.to_vec()) {
                Ok(text) => text,
                Err(_) => {
                    let (decoded, _, _) = GB18030.decode(&bytes);
                    decoded.into_owned()
                }
            }
        };
        Ok((text, final_url))
    }

    async fn request_cas_text(&self, request: reqwest::RequestBuilder) -> Result<(String, String)> {
        let mut request = request.build()?;
        for _ in 0..10 {
            let current = request.url().clone();
            if !allowed_cas_url(&current) { return Err(anyhow!("统一认证跳转地址异常，已停止请求")); }
            let method = request.method().clone();
            let retry = request.try_clone().ok_or_else(|| anyhow!("统一认证请求无法保留"))?;
            let response = self.cas_client.execute(request).await.map_err(cas_network_error)?;
            let status = response.status();
            let location = response.headers().get(header::LOCATION).and_then(|value| value.to_str().ok()).map(str::to_owned);
            let html = response.text().await.map_err(cas_network_error)?;
            let next = if status.is_redirection() { location } else if method == reqwest::Method::GET && !is_cas_login_page(&html) {
                Regex::new(r#"(?:window|top|self)\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]"#)?.captures(&html)
                    .and_then(|caps| caps.get(1)).map(|value| value.as_str().to_string())
            } else { None };
            if let Some(next) = next {
                let target = current.join(&next)?;
                if !allowed_cas_url(&target) { return Err(anyhow!("统一认证跳转地址异常，已停止请求")); }
                if method == reqwest::Method::GET || [301, 302, 303].contains(&status.as_u16()) {
                    request = self.cas_client.get(target).header(header::REFERER, current.as_str()).build()?;
                } else {
                    if target.origin() != current.origin() || target.origin() != reqwest::Url::parse(IDS_ORIGIN)?.origin() {
                        return Err(anyhow!("统一认证要求向其他站点重复提交密码，已停止请求"));
                    }
                    request = retry;
                    *request.url_mut() = target;
                }
                continue;
            }
            if status.is_redirection() { return Err(anyhow!("统一认证跳转缺少目标地址")); }
            // CAS returns validation pages with 401 as well as 200. Inspect
            // the form before converting status codes into generic errors.
            if status.is_client_error() || status.is_server_error() {
                if current.host_str() == Some("ids.njust.edu.cn") && is_cas_login_page(&html) {
                    return Ok((html, current.to_string()));
                }
                return Err(anyhow!("学校登录服务返回 HTTP {}，请稍后重试", status.as_u16()));
            }
            return Ok((html, current.to_string()));
        }
        Err(anyhow!("统一认证跳转次数过多，请重新登录"))
    }

    async fn prepare_captcha(&mut self, origin: &str) -> Result<()> {
        self.client.get(format!("{origin}/"))
            .timeout(Duration::from_secs(8))
            .send().await?.error_for_status()?;
        self.pending_entry_origin = origin.to_string();
        self.pending_captcha = true;
        Ok(())
    }

    async fn fetch_captcha(&mut self) -> Result<Vec<u8>> {
        let mut last_error = String::new();
        let mut origins = vec![self.pending_entry_origin.clone()];
        for origin in ENTRY_ORIGINS {
            if !origins.iter().any(|candidate| candidate == origin) {
                origins.push(origin.to_string());
            }
        }
        for origin in origins {
            if let Err(error) = self.prepare_captcha(&origin).await {
                last_error = error.to_string();
                continue;
            }
            let result = self.client.get(format!("{origin}/verifycode.servlet?t={}", Utc::now().timestamp_millis()))
                .timeout(Duration::from_secs(8))
                .send().await
                .and_then(reqwest::Response::error_for_status);
            let response = match result {
                Ok(response) => response,
                Err(error) => {
                    last_error = error.to_string();
                    self.pending_captcha = false;
                    continue;
                }
            };
            let content_type = response.headers().get(header::CONTENT_TYPE).and_then(|value| value.to_str().ok()).unwrap_or_default().to_owned();
            let image = match response.bytes().await {
                Ok(image) => image.to_vec(),
                Err(error) => {
                    last_error = error.to_string();
                    self.pending_captcha = false;
                    continue;
                }
            };
            if !content_type.starts_with("image/") || image.len() < 256 {
                last_error = format!("教务系统未返回有效验证码图片（Content-Type: {content_type}）");
                self.pending_captcha = false;
                continue;
            }
            return Ok(image);
        }
        self.pending_captcha = false;
        Err(anyhow!("两个教务入口均无法获取验证码：{}", if last_error.is_empty() { "网络异常" } else { &last_error }))
    }

    async fn verify_session(&mut self) -> Result<bool> {
        if self.state.business_base.is_empty() {
            self.state.logged_in = false;
            return Ok(false);
        }
        let url = build_url(&self.state.business_base, "framework/main.jsp")?;
        match self.request_text(self.client.get(url)).await {
            Ok((html, final_url)) => {
                self.state.session_checked_at = now();
                self.state.logged_in = is_academic_authenticated(&html)
                    && !final_url.contains("/authserver/login");
                if !self.state.logged_in { self.state.last_error = "会话已失效，请通过智慧理工重新登录".into(); }
                self.save().await?;
                Ok(self.state.logged_in)
            }
            Err(error) => {
                self.state.logged_in = false;
                self.state.session_checked_at = now();
                self.state.last_error = format!("会话检查失败：{error}");
                self.save().await?;
                Ok(false)
            }
        }
    }

    async fn login_cas(&mut self, username: &str, password: &str, remember_password: bool, captcha: &str) -> Result<()> {
        self.state.logged_in = false;
        self.state.last_error = "正在通过智慧理工统一认证登录".into();
        let mut form = if !captcha.is_empty() {
            match self.pending_cas.take() {
                Some((form, account, created)) if account == username && created.elapsed() < Duration::from_secs(180) => form,
                _ => return Err(anyhow!("验证码会话已过期或账号已改变，请重新点击登录")),
            }
        } else {
            self.pending_cas = None;
            let entry_url = build_url(OFFICIAL_BUSINESS_BASE, "indexsso.jsp")?;
            let (login_html, page_url) = self.request_cas_text(self.cas_client.get(&entry_url)).await
                .map_err(|error| anyhow!("教务 SSO 入口无法访问：{error}"))?;
            parse_cas_login_form(&login_html, &page_url)?
        };

        if captcha.is_empty() {
            let fingerprint = random_cas_bytes(16).iter().map(|byte| format!("{byte:02X}")).collect::<String>();
            self.client.get(format!("{IDS_ORIGIN}/authserver/bfp/info?bfp={fingerprint}"))
                .header(header::REFERER, &form.page_url)
                .send().await?.error_for_status()?;
            let captcha_status: Value = self.client.get(format!("{IDS_ORIGIN}/authserver/checkNeedCaptcha.htl"))
                .query(&[("username", username)])
                .header(header::REFERER, &form.page_url)
                .send().await?.error_for_status()?.json().await
                .context("统一认证验证码状态无法确认")?;
            match captcha_status.get("isNeed").and_then(Value::as_bool) {
                Some(false) => {},
                Some(true) => {
                    self.pending_cas = Some((form, username.into(), std::time::Instant::now()));
                    return Err(anyhow!("学校要求验证码，请填写下方图片中的字符后再次登录"));
                },
                None => return Err(anyhow!("统一认证验证码状态无法确认，请稍后重试")),
            }
        }

        set_cas_field(&mut form.fields, "username", username);
        set_cas_field(&mut form.fields, "password", &encrypt_cas_password(password, &form.salt)?);
        set_cas_field(&mut form.fields, "captcha", captcha);
        if !form.fields.iter().any(|(key, _)| key == "_eventId") {
            set_cas_field(&mut form.fields, "_eventId", "submit");
        }
        form.fields.retain(|(key, _)| !["rememberMe", "passwordText", "userPassword"].contains(&key.as_str()));
        let (response_html, final_url) = self.request_cas_text(
            self.cas_client.post(form.action_url.clone())
                .header(header::ORIGIN, IDS_ORIGIN)
                .header(header::REFERER, &form.page_url)
                .form(&form.fields)
        ).await.map_err(|error| anyhow!("统一认证提交失败：{error}"))?;
        if final_url.contains("/authserver/login") || is_cas_login_page(&response_html) {
            let message = cas_login_error(&response_html);
            if message.contains("验证码") || Regex::new(r#"needCaptcha\s*=\s*["']?true"#)?.is_match(&response_html) {
                if let Ok(next_form) = parse_cas_login_form(&response_html, &final_url) {
                    self.pending_cas = Some((next_form, username.into(), std::time::Instant::now()));
                }
            }
            return Err(anyhow!(message));
        }

        self.state.business_base = OFFICIAL_BUSINESS_BASE.into();
        if !self.verify_session().await? {
            return Err(anyhow!("统一认证已响应，但教务系统会话未建立"));
        }
        self.state.username = username.into();
        self.state.remember_password = remember_password;
        self.pending_captcha = false;
        if remember_password {
            match credential(username) {
                Ok(entry) => if let Err(error) = entry.set_password(password) {
                    info!(%error, "system credential store unavailable; password will not be persisted");
                    self.state.remember_password = false;
                },
                Err(error) => {
                    info!(%error, "system credential store unavailable; password will not be persisted");
                    self.state.remember_password = false;
                },
            }
        } else {
            let _ = credential(username).and_then(|entry| entry.delete_credential().map_err(Into::into));
        }
        self.state.last_error.clear();
        self.save().await?;
        Ok(())
    }

    async fn login(&mut self, payload: LoginRequest) -> Result<()> {
        let username = clean(&payload.username);
        if username.is_empty() || payload.password.is_empty() { return Err(anyhow!("用户名、密码不能为空")); }
        let password = payload.password.clone();
        let remember_password = payload.remember_password;
        let manual_captcha = clean(payload.captcha.as_deref().unwrap_or_default());
        if manual_captcha.is_empty() {
            return self.login_cas(&username, &password, remember_password, payload.cas_captcha.as_deref().unwrap_or_default().trim()).await;
        }
        let glm_key = GLM_API_KEY.get().and_then(|value| value.clone());

        // 网页/安卓使用本地 ddddocr；此处仅保留已配置的后台 GLM 兼容路径。
        // 限制重试，避免长时间持有会话锁，阻塞用户刷新和手动登录。
        let auto_solve = manual_captcha.is_empty() && glm_key.is_some();
        if !auto_solve && manual_captcha.is_empty() {
            return Err(anyhow!("请输入验证码；验证码与当前会话绑定，请先刷新验证码"));
        }

        let max_attempts = if auto_solve { 3usize } else { 1usize };
        let mut attempt = 0usize;
        let mut last_error = String::new();

        while attempt < max_attempts {
            attempt += 1;
            self.state.logged_in = false;
            self.state.last_error = if auto_solve {
                format!("登录中... 正在智能识别验证码 (尝试 {attempt}/{max_attempts})")
            } else {
                "登录中...".into()
            };

            let captcha = if auto_solve {
                let image = self.fetch_captcha().await?;
                solve_captcha_glm(&image, glm_key.as_deref().unwrap_or_default()).await
                    .context("后台识别失败，请在登录页使用自动识别或手动输入验证码")?
            } else {
                if !self.pending_captcha { return Err(anyhow!("验证码已失效，请刷新后重试")); }
                manual_captcha.clone()
            };

            let form = [
                ("USERNAME", username.as_str()), ("PASSWORD", password.as_str()),
                ("RANDOMCODE", captcha.as_str()), ("useDogCode", ""),
            ];
            let (html, final_url) = match self.request_text(
                self.client.post(format!("{}/Logon.do?method=logon", self.pending_entry_origin))
                    .header(header::ORIGIN, self.pending_entry_origin.as_str())
                    .header(header::REFERER, format!("{}/", self.pending_entry_origin))
                    .form(&form)
            ).await {
                Ok(pair) => pair,
                Err(error) => {
                    last_error = error.to_string();
                    if max_attempts > 1 {
                        self.pending_entry_origin = next_entry_origin(&self.pending_entry_origin).to_string();
                        sleep(Duration::from_millis(500)).await;
                        continue;
                    }
                    return Err(error);
                }
            };
            self.pending_captcha = false;

            if let Some(message) = login_error(&html) {
                last_error = message.clone();
                if message.contains("验证码") && max_attempts > 1 {
                    self.pending_entry_origin = next_entry_origin(&self.pending_entry_origin).to_string();
                    continue;
                }
                return Err(anyhow!(message));
            }

            self.state.username = username.clone();
            self.state.remember_password = remember_password;
            let preferred_base = business_base_from_url(&final_url).unwrap_or_else(|| shard_for(&username).to_string());
            let mut candidates = vec![preferred_base.clone()];
            for base in SHARDS {
                if base != preferred_base {
                    candidates.push(base.to_string());
                }
            }
            let mut session_verified = false;
            for base in candidates {
                self.state.business_base = base.to_string();
                if self.verify_session().await? {
                    session_verified = true;
                    break;
                }
            }
            if !session_verified {
                last_error = "登录未建立有效会话，请检查账号、密码、验证码或校园网环境".into();
                if max_attempts > 1 {
                    self.pending_entry_origin = next_entry_origin(&self.pending_entry_origin).to_string();
                    continue;
                }
                return Err(anyhow!(last_error));
            }
            if remember_password {
                // A desktop host uses Windows Credential Manager.  Some minimal
                // Linux hosts intentionally provide no keyring; login must still
                // work there, but those hosts cannot restore credentials later.
                match credential(&username) {
                    Ok(entry) => if let Err(error) = entry.set_password(&password) {
                        info!(%error, "system credential store unavailable; password will not be persisted");
                        self.state.remember_password = false;
                    },
                    Err(error) => {
                        info!(%error, "system credential store unavailable; password will not be persisted");
                        self.state.remember_password = false;
                    },
                }
            } else {
                let _ = credential(&username).and_then(|entry| entry.delete_credential().map_err(Into::into));
            }
            self.state.last_error.clear();
            self.save().await?;
            return Ok(());
        }

        self.state.last_error = if last_error.is_empty() {
            "尝试自动登录次数超限，请检查学号密码".into()
        } else {
            last_error.clone()
        };
        Err(anyhow!(self.state.last_error.clone()))
    }

    async fn ensure_session(&mut self) -> Result<()> {
        if self.state.logged_in && self.verify_session().await? { return Ok(()); }
        Err(anyhow!("当前未登录，请通过智慧理工统一认证登录"))
    }

    async fn keep_alive(&mut self) -> Result<bool> {
        if !self.state.logged_in || self.state.business_base.is_empty() { return Ok(false); }
        let url = build_url(&self.state.business_base, "framework/blankPage.jsp")?;
        match self.request_text(self.client.get(url)).await {
            Ok((html, _)) if !is_unauthenticated(&html) => {
                self.state.session_checked_at = now();
                self.state.last_error.clear();
                self.save().await?;
                Ok(true)
            }
            Ok(_) => {
                self.state.logged_in = false;
                self.state.last_error = "会话已失效，请通过智慧理工重新登录".into();
                self.save().await?;
                Ok(false)
            }
            Err(error) => {
                self.state.last_error = format!("会话保活失败：{error}");
                self.save().await?;
                Err(error)
            }
        }
    }

    async fn fetch_page(&mut self, path: &str) -> Result<(String, String)> {
        self.ensure_session().await?;
        let url = build_url(&self.state.business_base, path)?;
        let result = self.request_text(self.client.get(&url)).await?;
        if is_unauthenticated(&result.0) {
            self.state.logged_in = false;
            self.state.last_error = "会话已失效，请通过智慧理工重新登录".into();
            self.save().await?;
            return Err(anyhow!("会话已失效，请重新登录"));
        }
        Ok(result)
    }

    async fn post_form(&mut self, path: &str, form: &[(&str, String)], referer: &str) -> Result<String> {
        self.ensure_session().await?;
        let url = build_url(&self.state.business_base, path)?;
        let (html, _) = self.request_text(
            self.client.post(&url)
                .header(header::ORIGIN, business_origin(&self.state.business_base)?)
                .header(header::REFERER, referer)
                .form(form)
        ).await?;
        if is_unauthenticated(&html) { return Err(anyhow!("会话已失效，请重新登录")); }
        Ok(html)
    }

    async fn sync_all(&mut self) -> Result<Value> {
        if self.state.syncing { return Ok(self.state.data.clone()); }
        self.state.syncing = true;
        self.state.last_error.clear();
        self.save().await?;
        let result = self.sync_all_inner().await;
        self.state.syncing = false;
        match result {
            Ok(data) => {
                self.state.data = data.clone();
                self.state.last_sync_at = now();
                self.state.session_checked_at = self.state.last_sync_at.clone();
                self.state.last_error.clear();
                self.save().await?;
                Ok(data)
            }
            Err(error) => {
                self.state.last_error = error.to_string();
                self.save().await?;
                Err(error)
            }
        }
    }

    async fn sync_all_inner(&mut self) -> Result<Value> {
        let (schedule_html, schedule_url) = self.fetch_page("xskb/xskb_list.do?Ves632DSdyV=NEW_XSD_PYGL").await?;
        let schedule = parse_schedule(&schedule_html);
        let schedule_semester = selected_option(&schedule_html, "#xnxq01id");

        let (grades_query, grades_url) = self.fetch_page("kscj/cjcx_query?Ves632DSdyV=NEW_XSD_XJCJ").await?;
        let grade_semesters = option_values(&grades_query, "#kksj");
        let mut grades = Vec::new();
        for semester in grade_semesters.into_iter().take(12) {
            let form = vec![("kksj", semester), ("kcxz", String::new()), ("kcmc", String::new()), ("xsfs", "max".into())];
            let html = self.post_form("kscj/cjcx_list", &form, &grades_url).await?;
            grades.extend(parse_grades(&html));
        }
        deduplicate(&mut grades, |item| json_key(item, &["semester", "code", "name", "credit", "score", "scoreText"]));
        repair_grade_course_names(&schedule, &mut grades);

        let (certs_html, certs_url) = self.fetch_page("kscj/djkscj_list").await?;
        let certs = parse_certs(&certs_html);

        let (exam_query, exam_url) = self.fetch_page("xsks/xsksap_query?Ves632DSdyV=NEW_XSD_KSBM").await?;
        let exam_semesters = nearby_semesters(&exam_query, "#xnxqid", 6);
        let mut exams = Vec::new();
        for semester in exam_semesters.iter() {
            let form = vec![("xnxqid", semester.clone())];
            let html = self.post_form("xsks/xsksap_list", &form, &exam_url).await?;
            exams.extend(parse_exams(&html, semester));
        }
        deduplicate(&mut exams, |item| json_key(item, &["semester", "name", "date", "time", "room", "seat"]));

        let previous_start = self.state.data.pointer("/meta/semesterStart").and_then(Value::as_str).unwrap_or_default();
        let imported = now();
        Ok(json!({
            "schedule": schedule, "grades": grades, "certs": certs, "exams": exams,
            "meta": {
                "semester": if schedule_semester.is_empty() { selected_option(&grades_query, "#kksj") } else { schedule_semester },
                "semesterStart": previous_start,
                "importedAt": imported,
                "sources": {
                    "schedule": source_meta(schedule.len(), &schedule_url, "自动同步课表"),
                    "grades": source_meta(grades.len(), &grades_url, "自动同步成绩"),
                    "certs": source_meta(certs.len(), &certs_url, "自动同步等级考试"),
                    "exams": source_meta(exams.len(), &exam_url, "自动同步考试")
                }
            }
        }))
    }
}

fn init_glm_key(root: &Path) {
    // 优先取真实环境变量，其次读根目录 .env（与 Node legacy 的行为保持一致，
    // 避免把 API key 硬编码进代码或提交到仓库）
    let env_key = env::var("GLM_API_KEY").ok().filter(|value| !value.trim().is_empty());
    let key = env_key.or_else(|| {
        let path = root.join(".env");
        let content = std::fs::read_to_string(path).ok()?;
        content.lines().find_map(|line| {
            let line = line.trim();
            if !line.starts_with("GLM_API_KEY=") { return None; }
            let value = line["GLM_API_KEY=".len()..].trim().trim_matches('"').trim_matches('\'');
            if value.is_empty() { None } else { Some(value.to_string()) }
        })
    });
    let _ = GLM_API_KEY.set(key);
}

async fn solve_captcha_glm(image: &[u8], api_key: &str) -> Result<String> {
    let encoded = BASE64.encode(image);
    let body = json!({
        "model": GLM_MODEL,
        "messages": [{
            "role": "user",
            "content": [
                { "type": "image_url", "image_url": { "url": format!("data:image/jpeg;base64,{encoded}") } },
                { "type": "text", "text": "这是一个验证码图片，请按图片实际内容识别全部字符，只返回识别出的字符，不要有任何其他说明文字。验证码通常为4到6个字符，可能包含数字和字母（大小写）。" }
            ]
        }],
        "temperature": 0.1,
        "max_tokens": 10
    });

    let client = Client::builder()
        .timeout(Duration::from_secs(8))
        .build()?;

    let data: Value = client.post(GLM_API_URL)
        .bearer_auth(api_key)
        .json(&body)
        .send().await?
        .error_for_status()?
        .json().await?;
    if !data["error"].is_null() { return Err(anyhow!("GLM 识别服务暂不可用")); }
    let text = data["choices"][0]["message"]["content"].as_str().unwrap_or("").trim();
    if (4..=6).contains(&text.len()) && text.chars().all(|character| character.is_ascii_alphanumeric()) {
        return Ok(text.to_string());
    }
    Err(anyhow!("GLM 未返回有效验证码，请使用登录页的本地识别"))
}

fn start_session_keep_alive(app: AppState) {
    let interval_ms = env::var("KEEP_ALIVE_INTERVAL_MS")
        .ok().and_then(|value| value.parse::<u64>().ok()).filter(|value| *value > 0).unwrap_or(8 * 60 * 1000);
    tokio::spawn(async move {
        loop {
            sleep(Duration::from_millis(interval_ms)).await;
            let mut session = app.session.lock().await;
            if session.state.logged_in {
                if let Err(error) = session.keep_alive().await {
                    info!(%error, "session keep-alive failed");
                }
            }
        }
    });
}

fn start_saved_session_restore(app: AppState) {
    tokio::spawn(async move {
        let (username, should_restore) = {
            let session = app.session.lock().await;
            (session.state.username.clone(), session.state.remember_password)
        };
        if !should_restore || username.is_empty() || GLM_API_KEY.get().and_then(|value| value.as_ref()).is_none() {
            return;
        }
        let password = match credential(&username).and_then(|entry| entry.get_password().map_err(Into::into)) {
            Ok(password) if !password.is_empty() => password,
            Ok(_) => return,
            Err(error) => {
                info!(%error, "saved credential unavailable; session restore skipped");
                return;
            }
        };
        let mut session = app.session.lock().await;
        let payload = LoginRequest {
            username,
            password,
            captcha: None,
            cas_captcha: None,
            remember_password: true,
        };
        match session.login(payload).await {
            Ok(()) => {
                if let Err(error) = session.sync_all().await {
                    info!(%error, "saved session restored but initial sync failed");
                }
            }
            Err(error) => info!(%error, "saved session restore failed"),
        }
    });
}

async fn health(State(app): State<AppState>) -> Json<Value> {
    let session = app.session.lock().await;
    Json(json!({
        "ok": true, "version": APP_VERSION,
        "storageDir": app.storage_dir, "uptimeSeconds": app.started_at.elapsed().as_secs(),
        "status": session.status()
    }))
}

async fn status(State(app): State<AppState>, Query(query): Query<StatusQuery>) -> Json<Value> {
    let mut session = app.session.lock().await;
    if query.check.as_deref() == Some("1") && session.state.logged_in { let _ = session.verify_session().await; }
    Json(json!({"ok": true, "status": session.status(), "data": session.state.data}))
}

async fn captcha(State(app): State<AppState>, Query(query): Query<CaptchaQuery>) -> Response {
    if clean(query.username.as_deref().unwrap_or_default()).is_empty() { return api_error(StatusCode::BAD_REQUEST, "请先输入学号，再刷新验证码"); }
    let mut session = app.session.lock().await;
    match session.fetch_captcha().await {
        Ok(image) => {
            let mut response = Response::new(Body::from(image));
            // The school currently serves JPEG.  Keeping its real MIME type
            // lets WebView and browser render it instead of showing a blank box.
            response.headers_mut().insert(header::CONTENT_TYPE, HeaderValue::from_static("image/jpeg"));
            response.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
            response
        }
        Err(error) => api_error(StatusCode::BAD_GATEWAY, format!("获取验证码失败：{error}")),
    }
}

async fn cas_captcha(State(app): State<AppState>) -> Response {
    let mut session = app.session.lock().await;
    let page_url = match &session.pending_cas {
        Some((form, _, created)) if created.elapsed() < Duration::from_secs(180) => form.page_url.clone(),
        _ => {
            session.pending_cas = None;
            return api_error(StatusCode::BAD_REQUEST, "验证码会话已过期，请重新点击登录");
        }
    };
    let result = async {
        let response = session.cas_client.get(format!("{IDS_ORIGIN}/authserver/getCaptcha.htl?t={}", Utc::now().timestamp_millis()))
            .header(header::REFERER, page_url).send().await.map_err(cas_network_error)?;
        let mime = response.headers().get(header::CONTENT_TYPE).and_then(|value| value.to_str().ok())
            .unwrap_or_default().split(';').next().unwrap_or_default().to_string();
        if !response.status().is_success() || !mime.starts_with("image/") { return Err(anyhow!("学校验证码图片加载失败，请重试")); }
        let bytes = response.bytes().await.map_err(cas_network_error)?;
        Ok(format!("data:{mime};base64,{}", BASE64.encode(bytes)))
    }.await;
    match result {
        Ok(image) => ([(header::CACHE_CONTROL, "no-store")], Json(json!({"ok": true, "imageDataUrl": image}))).into_response(),
        Err(error) => api_error(StatusCode::BAD_GATEWAY, error.to_string()),
    }
}

async fn login(State(app): State<AppState>, Json(payload): Json<LoginRequest>) -> Response {
    let mut session = app.session.lock().await;
    if let Err(error) = session.login(payload).await {
        session.state.logged_in = false;
        session.state.last_error = error.to_string();
        let _ = session.save().await;
        return api_error_with_status(StatusCode::BAD_REQUEST, error.to_string(), &session);
    }
    let data = match session.sync_all().await {
        Ok(data) => data,
        Err(error) => return Json(json!({"ok": true, "status": session.status(), "data": session.state.data, "warning": error.to_string()})).into_response(),
    };
    Json(json!({"ok": true, "status": session.status(), "data": data})).into_response()
}

async fn logout(State(app): State<AppState>) -> Response {
    let mut session = app.session.lock().await;
    if session.state.remember_password && !session.state.username.is_empty() { let _ = credential(&session.state.username).and_then(|entry| entry.delete_credential().map_err(Into::into)); }
    session.state = StoredState::default();
    session.pending_captcha = false;
    session.pending_cas = None;
    if let Err(error) = session.save().await { return api_error(StatusCode::INTERNAL_SERVER_ERROR, error.to_string()); }
    Json(json!({"ok": true, "status": session.status(), "data": session.state.data})).into_response()
}

async fn sync_now(State(app): State<AppState>) -> Response {
    let mut session = app.session.lock().await;
    match session.sync_all().await {
        Ok(data) => Json(json!({"ok": true, "status": session.status(), "data": data})).into_response(),
        Err(error) => api_error_with_status(StatusCode::BAD_REQUEST, error.to_string(), &session),
    }
}

async fn save_semester_start(State(app): State<AppState>, Json(payload): Json<SemesterRequest>) -> Response {
    let mut session = app.session.lock().await;
    ensure_object_path(&mut session.state.data, "meta").insert("semesterStart".into(), Value::String(clean(&payload.semester_start)));
    if let Err(error) = session.save().await { return api_error_with_status(StatusCode::INTERNAL_SERVER_ERROR, error.to_string(), &session); }
    Json(json!({"ok": true, "status": session.status(), "data": session.state.data})).into_response()
}

async fn classroom_options(State(app): State<AppState>, Query(query): Query<ClassroomOptionsQuery>) -> Response {
    let mut session = app.session.lock().await;
    let campus = clean(query.campus.as_deref().unwrap_or("01"));
    match classroom_options_inner(&mut session, if campus.is_empty() { "01" } else { &campus }).await {
        Ok(options) => Json(json!({"ok": true, "options": options, "status": session.status()})).into_response(),
        Err(error) => api_error_with_status(StatusCode::BAD_REQUEST, error.to_string(), &session),
    }
}

// 读取学校原表，而不是用缓存成绩推算。先验证会话，失败返回错误且不清空旧数据。
async fn academic_review_page(State(app): State<AppState>) -> Response {
    let mut session = app.session.lock().await;
    let expected_owner = session.state.username.clone();
    let result = async {
        let (html, _) = session.fetch_page("xsxj/zxsc.do").await?;
        let rows = academic_review::rows(&html)?;
        if expected_owner != session.state.username { return Err(anyhow!("登录账号已变化，请重新打开学业审查")); }
        Ok::<_, anyhow::Error>(json!({"ok": true, "rows": rows, "fetchedAt": now(), "owner": session.state.username, "status": session.status()}))
    }.await;
    match result {
        Ok(payload) => Json(payload).into_response(),
        Err(error) => api_error_with_status(StatusCode::BAD_REQUEST, error.to_string(), &session),
    }
}

async fn classroom_query(State(app): State<AppState>, Json(payload): Json<ClassroomRequest>) -> Response {
    let mut session = app.session.lock().await;
    match classroom_query_inner(&mut session, payload).await {
        Ok(result) => Json(json!({"ok": true, "result": result, "status": session.status()})).into_response(),
        Err(error) => api_error_with_status(StatusCode::BAD_REQUEST, error.to_string(), &session),
    }
}

async fn classroom_options_inner(session: &mut Session, campus: &str) -> Result<Value> {
    let (html, _) = session.fetch_page("kbxx/jsjy_query").await?;
    let semester = selected_option(&html, "#xnxqh");
    let campuses = options_json(&html, "#xqbh");
    let form = vec![("xqid", campus.to_string())];
    let referer = build_url(&session.state.business_base, "kbxx/kbxx_classroom")?;
    let raw = session.post_form("kbcx/getJxlByAjax", &form, &referer).await?;
    let buildings = serde_json::from_str::<Value>(&raw).ok().and_then(|value| value.as_array().cloned()).unwrap_or_default()
        .into_iter().filter_map(|item| Some(json!({"value": clean(item.get("dm")?.as_str()?), "label": clean(item.get("dmmc")?.as_str()?)}))).collect::<Vec<_>>();
    Ok(json!({"semester": semester, "campus": campus, "campuses": campuses, "buildings": buildings}))
}

async fn classroom_query_inner(session: &mut Session, payload: ClassroomRequest) -> Result<Value> {
    let campus = clean(payload.campus.as_deref().unwrap_or("01"));
    let options = classroom_options_inner(session, if campus.is_empty() { "01" } else { &campus }).await?;
    let semester = clean(payload.semester.as_deref().unwrap_or_else(|| options.get("semester").and_then(Value::as_str).unwrap_or_default()));
    let building = clean(payload.building.as_deref().unwrap_or_default());
    let start = clean(payload.start_period_code.as_deref().unwrap_or_default());
    let end = clean(payload.end_period_code.as_deref().unwrap_or_default());
    if semester.is_empty() || building.is_empty() || start.is_empty() || end.is_empty() { return Err(anyhow!("请完整选择学期、楼栋和节次")); }
    let form = vec![
        ("typewhere", "jszq".into()), ("xnxqh", semester.clone()), ("xqbh", campus.clone()),
        ("jxqbh", String::new()), ("jxlbh", building.clone()), ("jsbh", String::new()), ("bjfh", String::new()),
        ("rnrs", String::new()), ("jszt", String::new()), ("zc", payload.week.unwrap_or(1).to_string()),
        ("zc2", payload.week.unwrap_or(1).to_string()), ("xq", payload.weekday.unwrap_or(1).to_string()),
        ("xq2", payload.weekday.unwrap_or(1).to_string()), ("jc", start), ("jc2", end),
    ];
    let referer = build_url(&session.state.business_base, "kbxx/jsjy_query")?;
    let html = session.post_form("kbxx/jsjy_query2", &form, &referer).await?;
    let parsed = parse_classroom_rows(&html);
    Ok(json!({
        "semester": semester, "campus": campus, "building": building,
        "week": payload.week.unwrap_or(1), "weekday": payload.weekday.unwrap_or(1),
        "weekdayLabel": payload.day_label.unwrap_or_else(|| parsed.weekday_label.clone()),
        "periodLabel": payload.period_label.unwrap_or_else(|| parsed.period_label.clone()),
        "totalRooms": parsed.rows.len(), "busyCount": parsed.rows.len() - parsed.free_rooms.len(),
        "freeCount": parsed.free_rooms.len(), "rooms": parsed.free_rooms, "rows": parsed.rows
    }))
}

fn empty_data() -> Value { json!({"schedule": [], "grades": [], "certs": [], "exams": [], "meta": {"semester": "", "semesterStart": "", "importedAt": "", "sources": {}}}) }
fn now() -> String { Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true) }
fn clean(value: &str) -> String { value.replace('\u{a0}', " ").split_whitespace().collect::<Vec<_>>().join(" ") }
fn random_cas_bytes(length: usize) -> Vec<u8> {
    let mut bytes = vec![0u8; length];
    OsRng.fill_bytes(&mut bytes);
    bytes
}
fn random_cas_string(length: usize) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678";
    random_cas_bytes(length).iter().map(|byte| ALPHABET[*byte as usize % ALPHABET.len()] as char).collect()
}
fn encrypt_cas_password(password: &str, salt: &str) -> Result<String> {
    if salt.as_bytes().len() != 16 { return Err(anyhow!("统一认证加密盐已变化，请更新应用")); }
    let iv = random_cas_string(16);
    let message = format!("{}{}", random_cas_string(64), password);
    let mut buffer = message.into_bytes();
    let plain_len = buffer.len();
    buffer.resize((plain_len / 16 + 1) * 16, 0);
    let encryptor = cbc::Encryptor::<Aes128>::new_from_slices(salt.as_bytes(), iv.as_bytes())
        .map_err(|_| anyhow!("统一认证加密参数无效"))?;
    let encrypted = encryptor.encrypt_padded_mut::<Pkcs7>(&mut buffer, plain_len)
        .map_err(|_| anyhow!("统一认证密码加密失败"))?;
    Ok(BASE64.encode(encrypted))
}
fn set_cas_field(fields: &mut Vec<(String, String)>, name: &str, value: &str) {
    if let Some((_, current)) = fields.iter_mut().find(|(key, _)| key == name) {
        *current = value.into();
    } else {
        fields.push((name.into(), value.into()));
    }
}
fn allowed_cas_url(url: &reqwest::Url) -> bool {
    if !url.username().is_empty() || url.password().is_some() { return false; }
    matches!((url.scheme(), url.host_str(), url.port()),
        ("https", Some("ids.njust.edu.cn" | "bkjw.njust.edu.cn"), None)
        | ("http", Some("bkjw.njust.edu.cn"), None)
        | ("http", Some("202.119.81.112" | "202.119.81.113"), Some(8080 | 9080)))
}
fn cas_network_error(error: reqwest::Error) -> anyhow::Error {
    // Never include a redirect URL: its query may contain a one-time ticket.
    if error.is_timeout() { anyhow!("学校响应超时，请稍后重试") }
    else if error.is_connect() { anyhow!("无法连接学校认证服务，请检查网络后重试") }
    else { anyhow!("学校认证连接中断，请重新登录") }
}
// 表单 action、service 与盐字段共同绑定这次 CAS 登录；只接受已知学校目标。
// 如果找不到表单，先检查重定向/错误页；不能替换为旧教务验证码入口强行提交。
fn parse_cas_login_form(html: &str, page_url: &str) -> Result<CasLoginForm> {
    let document = Html::parse_document(html);
    let input_selector = selector("input[name]");
    let form = document.select(&selector("form"))
        .find(|node| node.select(&input_selector).any(|input| matches!(input.value().attr("name"), Some("passwordText" | "userPassword"))))
        .ok_or_else(|| anyhow!("统一认证表单未找到：教务入口可能返回了中间跳转页"))?;
    let source_url = reqwest::Url::parse(page_url)?;
    let mut action_url = source_url.join(form.value().attr("action").unwrap_or("/authserver/login"))?;
    if action_url.scheme() != "https" || action_url.host_str() != Some("ids.njust.edu.cn")
        || !action_url.path().starts_with("/authserver/login") {
        return Err(anyhow!("统一认证登录地址异常，已停止提交密码"));
    }
    let mut service = action_url.query_pairs().find(|(key, _)| key == "service").map(|(_, value)| value.into_owned());
    if service.is_none() {
        service = source_url.query_pairs().find(|(key, _)| key == "service").map(|(_, value)| value.into_owned());
    }
    if service.is_none() {
        service = Regex::new(r#"\bvar\s+service\s*=\s*['\"]([^'\"]+)['\"]"#)?
            .captures(html).and_then(|matches| matches.get(1))
            .map(|value| value.as_str().replace("\\/", "/"));
    }
    let service = service.ok_or_else(|| anyhow!("统一认证目标地址缺失，请稍后重试"))?;
    if reqwest::Url::parse(&service)?.host_str() != Some("bkjw.njust.edu.cn") {
        return Err(anyhow!("统一认证目标地址异常，已停止提交密码"));
    }
    if !action_url.query_pairs().any(|(key, _)| key == "service") {
        action_url.query_pairs_mut().append_pair("service", &service);
    }
    let salt = document.select(&selector("#pwdEncryptSalt"))
        .next().and_then(|node| node.value().attr("value")).unwrap_or_default().to_string();
    let fields = form.select(&input_selector)
        .filter_map(|node| node.value().attr("name").map(|name| (name.to_string(), node.value().attr("value").unwrap_or_default().to_string())))
        .collect::<Vec<_>>();
    if salt.as_bytes().len() != 16 || !fields.iter().any(|(key, value)| key == "execution" && !value.is_empty()) {
        return Err(anyhow!("统一认证表单已变化，请更新应用后重试"));
    }
    Ok(CasLoginForm { action_url, page_url: page_url.into(), salt, fields })
}
fn is_cas_login_page(html: &str) -> bool {
    html.contains("pwdFromId") && (html.contains("passwordText") || html.contains("userPassword"))
}
fn cas_login_error(html: &str) -> String {
    let document = Html::parse_document(html);
    for selector_text in ["#showErrorTip", "#formErrorTip", "#showWarnTip", ".item-error-tip", ".error-tip", "#pwdErrorTip", "#nameErrorTip", "#captchaErrorTip", ".alert-danger"] {
        for node in document.select(&selector(selector_text)) {
            let message = text(&node);
            if !message.is_empty() { return message; }
        }
    }
    if html.contains("密码错误") || html.contains("账号或密码") { return "智慧理工账号或密码错误".into(); }
    "智慧理工未接受登录，请检查账号密码或认证要求".into()
}
fn is_academic_authenticated(html: &str) -> bool {
    !is_unauthenticated(html) && !is_cas_login_page(html)
        && ["学生个人中心", "理论课表", "xs_main.jsp", "个人中心"].iter().any(|marker| html.contains(marker))
}
fn array_len(value: &Value, key: &str) -> usize { value.get(key).and_then(Value::as_array).map_or(0, Vec::len) }
fn selector(value: &str) -> Selector { Selector::parse(value).expect("fixed CSS selector") }
fn text(node: &ElementRef<'_>) -> String { clean(&node.text().collect::<Vec<_>>().join(" ")) }
fn build_url(base: &str, path: &str) -> Result<String> { Ok(reqwest::Url::parse(base)?.join(path)?.to_string()) }
fn business_origin(base: &str) -> Result<String> { let url = reqwest::Url::parse(base)?; Ok(format!("{}://{}", url.scheme(), url.host_str().unwrap_or_default())) }
fn next_entry_origin(current: &str) -> &'static str { if current == ENTRY_ORIGINS[0] { ENTRY_ORIGINS[1] } else { ENTRY_ORIGINS[0] } }
fn shard_for(username: &str) -> &'static str { username.parse::<u128>().map(|id| SHARDS[(id % 2) as usize]).unwrap_or(SHARDS[0]) }
fn business_base_from_url(value: &str) -> Option<String> { Regex::new(r"(http://202\.119\.81\.(?:112|113):9080/njlgdx/)").ok()?.captures(value).and_then(|caps| caps.get(1)).map(|m| m.as_str().to_string()) }
fn is_unauthenticated(html: &str) -> bool { Regex::new(r#"登录个人中心|用户登录|verifycode\.servlet|Verifyservlet|name=\"USERNAME\"|请先登录系统|用户没有登录|强智科技教务系统概念版"#).unwrap().is_match(html) }
fn login_error(html: &str) -> Option<String> {
    let plain = strip_html(html);
    if plain.contains("验证码") { return Some("验证码错误或已过期".into()); }
    if plain.contains("密码") && (plain.contains("错误") || plain.contains("不正确")) { return Some("用户名或密码错误".into()); }
    Regex::new(r#"(?is)<font[^>]*color=["']?red["']?[^>]*>(.*?)</font>"#).unwrap().captures(html).map(|caps| clean(&strip_html(caps.get(1).map_or("", |m| m.as_str())))).filter(|value| !value.is_empty())
}
fn credential(username: &str) -> Result<Entry> { Entry::new("njust-companion-rust", username).map_err(Into::into) }
fn api_error(status: StatusCode, message: impl Into<String>) -> Response { (status, Json(json!({"ok": false, "error": message.into()}))).into_response() }
fn api_error_with_status(status: StatusCode, message: impl Into<String>, session: &Session) -> Response { (status, Json(json!({"ok": false, "error": message.into(), "status": session.status(), "data": session.state.data}))).into_response() }
fn ensure_object_path<'a>(value: &'a mut Value, key: &str) -> &'a mut Map<String, Value> { if !value.is_object() { *value = Value::Object(Map::new()); } let object = value.as_object_mut().unwrap(); if !object.get(key).is_some_and(Value::is_object) { object.insert(key.into(), Value::Object(Map::new())); } object.get_mut(key).and_then(Value::as_object_mut).unwrap() }
fn source_meta(count: usize, url: &str, title: &str) -> Value { json!({"importedAt": now(), "count": count, "sourceUrl": url, "pageTitle": title}) }
fn json_key(value: &Value, keys: &[&str]) -> String { keys.iter().map(|key| value.get(*key).map(Value::to_string).unwrap_or_default()).collect::<Vec<_>>().join("|") }
fn deduplicate(items: &mut Vec<Value>, key: impl Fn(&Value) -> String) { let mut found = std::collections::HashSet::new(); items.retain(|item| found.insert(key(item))); }

fn strip_html(html: &str) -> String {
    let br = Regex::new(r"(?is)<br\s*/?>").unwrap().replace_all(html, "\n");
    clean(&Regex::new(r"(?is)<[^>]+>").unwrap().replace_all(&br, " "))
}

// Empty cells in the current teaching-system timetable are rendered as the
// literal entity `&nbsp;` inside a `.kbcontent` node. `scraper::Html::html`
// preserves that source text, so it must not be treated as a course name.
fn is_empty_schedule_name(value: &str) -> bool {
    value
        .replace("&nbsp;", "")
        .replace("&#160;", "")
        .replace("&#xA0;", "")
        .replace("&#xa0;", "")
        .replace('\u{a0}', "")
        .trim()
        .is_empty()
}

fn remove_placeholder_schedule_items(data: &mut Value) -> bool {
    let Some(courses) = data.get_mut("schedule").and_then(Value::as_array_mut) else { return false; };
    let before = courses.len();
    courses.retain(|course| !is_empty_schedule_name(course.get("name").and_then(Value::as_str).unwrap_or_default()));
    courses.len() != before
}

fn looks_like_course_code(value: &str) -> bool {
    let text = clean(value);
    text.len() >= 6
        && text.chars().any(|ch| ch.is_ascii_digit())
        && text.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '-')
}

fn repair_grade_course_names(schedule: &[Value], grades: &mut [Value]) {
    let names_by_code = schedule.iter().filter_map(|course| {
        let code = course.get("code").and_then(Value::as_str).map(clean)?.to_ascii_uppercase();
        let name = course.get("name").and_then(Value::as_str).map(clean)?;
        (!code.is_empty() && !name.is_empty() && !looks_like_course_code(&name)).then_some((code, name))
    }).collect::<std::collections::HashMap<_, _>>();

    for grade in grades {
        let current_name = grade.get("name").and_then(Value::as_str).unwrap_or_default();
        if !looks_like_course_code(current_name) { continue; }
        let code = grade.get("code").and_then(Value::as_str).unwrap_or(current_name).to_ascii_uppercase();
        let Some(name) = names_by_code.get(&code) else { continue; };
        if let Some(object) = grade.as_object_mut() {
            object.insert("name".into(), Value::String(name.clone()));
        }
    }
}

fn week_info(value: &str) -> (u32, u32, String) {
    let range = Regex::new(r"(\d+)\s*[-~]\s*(\d+)").unwrap();
    let single = Regex::new(r"(?:^|[^\d])(\d+)\s*\((?:周|单周|双周)\)").unwrap();
    let (start, end) = if let Some(caps) = range.captures(value) { (caps[1].parse().unwrap_or(1), caps[2].parse().unwrap_or(20)) } else if let Some(caps) = single.captures(value) { let week = caps[1].parse().unwrap_or(1); (week, week) } else { (1, 20) };
    (start, end, if value.contains('单') { "单".into() } else if value.contains('双') { "双".into() } else { String::new() })
}

fn parse_schedule(html: &str) -> Vec<Value> {
    let document = Html::parse_document(html);
    let table_selector = selector("#kbtable");
    let Some(table) = document.select(&table_selector).next() else { return Vec::new(); };
    let row_selector = selector("tr"); let cell_selector = selector("td"); let content_selector = selector(".kbcontent");
    let period_map: [&[u32]; 6] = [&[1, 2, 3], &[4, 5], &[6, 7], &[8, 9, 10], &[11, 12, 13], &[14]];
    let mut courses = Vec::new();
    for (row_index, row) in table.select(&row_selector).skip(1).enumerate() {
        let periods = period_map.get(row_index).copied().unwrap_or(&[14]);
        // The period label is a <th>; the seven <td>s already start at Monday.
        for (day_index, cell) in row.select(&cell_selector).take(7).enumerate() {
            for content in cell.select(&content_selector) {
                courses.extend(parse_schedule_cell(&content.html(), day_index as u32 + 1, periods));
            }
        }
    }
    courses
}

fn parse_schedule_cell(html: &str, weekday: u32, periods: &[u32]) -> Vec<Value> {
    html.split("----------------").filter_map(|fragment| {
        let line_html = Regex::new(r"(?is)<br\s*/?>").unwrap().replace_all(fragment, "\n");
        let name = line_html.lines().map(strip_html).map(|line| clean(&line)).find(|line| !line.is_empty() && !line.contains("周次") && !line.contains("老师") && !line.contains("教室"))?;
        if is_empty_schedule_name(&name) { return None; }
        let field = |title: &str| Regex::new(&format!(r#"(?is)<font[^>]*title=['"][^'"]*{title}[^'"]*['"][^>]*>(.*?)</font>"#)).ok()?.captures(fragment).and_then(|caps| caps.get(1)).map(|m| clean(&strip_html(m.as_str())));
        let week_text = field("周次").unwrap_or_default();
        let (start_week, end_week, odd_even) = week_info(&week_text);
        Some(json!({
            "id": "", "name": name, "teacher": field("老师").unwrap_or_default(), "room": field("教室").unwrap_or_default(),
            "weekday": weekday, "periods": periods, "startWeek": start_week, "endWeek": end_week, "oddEven": odd_even, "weekText": week_text,
            "credit": 0, "code": "", "sequence": "", "attribute": "", "stage": "", "groupName": field("分组").unwrap_or_default()
        }))
    }).flat_map(|course| {
        let text = course["weekText"].as_str().unwrap_or_default()
            .replace(['，', '、', '；', ';'], ",").replace(['～', '—', '–', '－'], "-");
        let expression = Regex::new(r"(\d+\s*(?:[-~]\s*\d+)?(?:\s*,\s*\d+\s*(?:[-~]\s*\d+)?)*)\s*(?:[（(]\s*)?(?:单周|双周|周)").unwrap();
        let Some(captures) = expression.captures(&text) else { return vec![course]; };
        let ranges = captures[1].split(',').filter_map(|part| {
            let bounds = part.split(['-', '~']).map(|v| v.trim().parse::<u32>().ok()).collect::<Option<Vec<_>>>()?;
            let start = *bounds.first()?;
            let end = *bounds.get(1).unwrap_or(&start);
            if start == 0 || end < start { return None; }
            let mut item = course.clone();
            item["startWeek"] = json!(start);
            item["endWeek"] = json!(end);
            Some(item)
        }).collect::<Vec<_>>();
        if ranges.is_empty() { vec![course] } else { ranges }
    }).collect()
}

fn pick_table<'a>(document: &'a Html) -> Option<ElementRef<'a>> {
    let table = selector("#dataList");
    document.select(&table).next().or_else(|| document.select(&selector("table")).max_by_key(|item| item.select(&selector("tr")).count()))
}
fn rows(table: ElementRef<'_>) -> Vec<Vec<String>> {
    let row = selector("tr"); let cell = selector("th, td");
    table.select(&row).map(|row| row.select(&cell).map(|cell| text(&cell)).collect()).filter(|row: &Vec<String>| !row.is_empty()).collect()
}
fn header_index(headers: &[String], alternatives: &[&str]) -> Option<usize> { headers.iter().position(|header| alternatives.iter().any(|item| header.contains(item))) }
fn course_name_index(headers: &[String], code_index: Option<usize>) -> Option<usize> {
    ["课程名称", "课程名", "课程"].iter()
        .find_map(|target| headers.iter().position(|header| header == target))
        .or_else(|| headers.iter().enumerate().find_map(|(index, header)| {
            let excluded = header.contains("编号") || header.contains("代码") || header.contains("性质") || header.contains("属性") || header.contains("类别");
            (Some(index) != code_index && header.contains("课程") && !excluded).then_some(index)
        }))
}
fn cell(row: &[String], index: Option<usize>) -> String { index.and_then(|index| row.get(index)).cloned().unwrap_or_default() }
fn number_or_null(value: &str) -> Value { value.parse::<f64>().map(|number| json!(number)).unwrap_or(Value::Null) }

fn parse_grades(html: &str) -> Vec<Value> {
    let document = Html::parse_document(html); let Some(table) = pick_table(&document) else { return Vec::new() }; let values = rows(table); if values.len() < 2 { return Vec::new() }
    let headers = &values[0];
    let code = header_index(headers, &["课程编号", "课程代码"]); let name = course_name_index(headers, code); let credit = header_index(headers, &["学分"]); let hours = header_index(headers, &["总学时", "学时"]); let score = header_index(headers, &["成绩", "期末"]); let flag = header_index(headers, &["成绩标识"]); let assessment = header_index(headers, &["考核方式"]); let attribute = header_index(headers, &["课程属性"]); let category = header_index(headers, &["课程性质"]); let gpa = header_index(headers, &["绩点", "学分绩点"]); let semester = header_index(headers, &["学年", "学期"]);
    values.into_iter().skip(1).filter_map(|row| { let course_name = cell(&row, name).if_empty_then(|| row.first().cloned().unwrap_or_default()); if course_name.is_empty() { return None; } let score_text = cell(&row, score); let numeric = score_text.parse::<f64>().ok(); Some(json!({"name": course_name, "code": cell(&row, code), "credit": cell(&row, credit).parse::<f64>().unwrap_or(0.0), "hours": cell(&row, hours).parse::<f64>().unwrap_or(0.0), "score": numeric, "scoreText": if numeric.is_none() { score_text } else { String::new() }, "flag": cell(&row, flag), "assessment": cell(&row, assessment), "attribute": cell(&row, attribute), "category": cell(&row, category), "type": cell(&row, category), "gpa": number_or_null(&cell(&row, gpa)), "semester": cell(&row, semester).replace('~', "-")})) }).collect()
}

trait IfEmpty { fn if_empty_then(self, fallback: impl FnOnce() -> String) -> String; }
impl IfEmpty for String { fn if_empty_then(self, fallback: impl FnOnce() -> String) -> String { if self.is_empty() { fallback() } else { self } } }

fn parse_certs(html: &str) -> Vec<Value> {
    let document = Html::parse_document(html); let Some(table) = pick_table(&document) else { return Vec::new() }; let values = rows(table);
    values.into_iter().skip(2).filter_map(|row| { let name = row.get(1).cloned().unwrap_or_default(); if name.is_empty() { return None; } let kind = if name.to_ascii_uppercase().contains("CET4") || name.contains("四级") { "CET4" } else if name.to_ascii_uppercase().contains("CET6") || name.contains("六级") { "CET6" } else { "" }; Some(json!({"name": name, "kind": kind, "totalScore": number_or_null(row.get(4).map(String::as_str).unwrap_or_default()), "writtenScore": number_or_null(row.get(2).map(String::as_str).unwrap_or_default()), "computerScore": number_or_null(row.get(3).map(String::as_str).unwrap_or_default()), "date": row.get(8).or_else(|| row.last()).cloned().unwrap_or_default()})) }).collect()
}

fn parse_exams(html: &str, semester: &str) -> Vec<Value> {
    let document = Html::parse_document(html); let Some(table) = pick_table(&document) else { return Vec::new() }; let values = rows(table); if values.len() < 2 { return Vec::new() }; let headers = &values[0]; let name = course_name_index(headers, header_index(headers, &["课程编号", "课程代码"])); let date = header_index(headers, &["考试日期", "日期"]); let time = header_index(headers, &["考试时间", "时间"]); let room = header_index(headers, &["考场", "地点", "教室"]); let seat = header_index(headers, &["座位", "位号"]);
    values.into_iter().skip(1).filter_map(|row| { let course_name = cell(&row, name).if_empty_then(|| row.first().cloned().unwrap_or_default()); if course_name.is_empty() { return None; } let raw_date = cell(&row, date); let raw_time = cell(&row, time); Some(json!({"name": course_name, "date": extract_date(&raw_date).or_else(|| extract_date(&raw_time)).unwrap_or_default(), "time": strip_date(&raw_time).if_empty_then(|| strip_date(&raw_date)), "room": cell(&row, room), "seat": cell(&row, seat), "semester": semester})) }).collect()
}
fn extract_date(value: &str) -> Option<String> { let caps = Regex::new(r"(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})").unwrap().captures(value)?; Some(format!("{}-{:0>2}-{:0>2}", &caps[1], &caps[2], &caps[3])) }
fn strip_date(value: &str) -> String { clean(&Regex::new(r"\d{4}[年./-]\d{1,2}[月./-]\d{1,2}日?|[（(]?\s*(?:星期|周)[一二三四五六日天]\s*[)）]?").unwrap().replace_all(value, " ")) }

fn selected_option(html: &str, selector_text: &str) -> String { options_with_selected(html, selector_text).into_iter().find(|item| item.2).map(|item| item.1).unwrap_or_default() }
fn option_values(html: &str, selector_text: &str) -> Vec<String> { let options = options_with_selected(html, selector_text); let start = options.iter().position(|item| item.2).unwrap_or(0); options.into_iter().skip(start).map(|item| item.0).filter(|item| !item.is_empty()).collect() }
fn options_json(html: &str, selector_text: &str) -> Vec<Value> { options_with_selected(html, selector_text).into_iter().map(|(value, label, selected)| json!({"value": value, "label": label, "selected": selected})).filter(|item| !item.get("value").and_then(Value::as_str).unwrap_or_default().is_empty()).collect() }
fn options_with_selected(html: &str, selector_text: &str) -> Vec<(String, String, bool)> { let document = Html::parse_document(html); let Ok(select) = Selector::parse(selector_text) else { return Vec::new() }; let option = selector("option"); document.select(&select).next().map(|node| node.select(&option).map(|item| (clean(item.value().attr("value").unwrap_or_default()), text(&item), item.value().attr("selected").is_some())).collect()).unwrap_or_default() }
fn nearby_semesters(html: &str, selector_text: &str, limit: usize) -> Vec<String> { option_values(html, selector_text).into_iter().take(limit).collect() }

#[derive(Default)]
struct ClassroomRows { weekday_label: String, period_label: String, rows: Vec<Value>, free_rooms: Vec<Value> }
fn parse_classroom_rows(html: &str) -> ClassroomRows { let document = Html::parse_document(html); let table = selector("#dataList"); let Some(table) = document.select(&table).next() else { return ClassroomRows::default() }; let all_rows = rows(table); let weekday_label = all_rows.first().and_then(|row| row.get(1)).cloned().unwrap_or_default(); let period_label = all_rows.get(1).and_then(|row| row.get(1)).cloned().unwrap_or_default(); let row_selector = selector("tr[jsbh]"); let cell_selector = selector("td"); let mut result = ClassroomRows { weekday_label, period_label, ..Default::default() }; for row in table.select(&row_selector) { let cells = row.select(&cell_selector).map(|item| text(&item)).collect::<Vec<_>>(); let Some(first) = cells.first() else { continue }; let name = Regex::new(r"^(.*?)(?:\(([^()]*)\))?$").unwrap().captures(first).and_then(|caps| caps.get(1)).map(|item| clean(item.as_str())).unwrap_or_default(); if name.is_empty() { continue; } let markers = cells.iter().skip(1).filter(|item| !item.is_empty()).cloned().collect::<Vec<_>>(); let item = json!({"id": row.value().attr("jsbh").unwrap_or_default(), "label": first, "name": name, "capacityText": "", "markers": markers}); if cells.iter().skip(1).all(|item| item.is_empty()) { result.free_rooms.push(item.clone()); } result.rows.push(item); } result }

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore = "contacts the school using an empty username, no real account"]
    async fn cas_anonymous_login_reports_school_message() {
        let file = std::env::temp_dir().join(format!("njust-anonymous-cas-{}.json", std::process::id()));
        let mut session = Session::load(file).await.unwrap();
        let error = session.login_cas("", "", false, "").await.unwrap_err().to_string();
        assert!(error.contains("用户名") || error.contains("账号"), "unexpected anonymous response: {error}");
    }

    #[test]
    fn cas_mobile_errors_and_redirect_destinations() {
        let html = r#"<form id="pwdFromId" action="/authserver/login"><input name="userPassword"><input name="password"><input name="execution" value="e2s1"><input id="pwdEncryptSalt" value="1234567890abcdef"><div id="formErrorTip">验证码错误，请重新输入</div></form>"#;
        let form = parse_cas_login_form(html, "https://ids.njust.edu.cn/authserver/login?service=http%3A%2F%2Fbkjw.njust.edu.cn%2Fnjlgdx%2Findexsso.jsp").unwrap();
        assert_eq!(form.fields.iter().find(|(key, _)| key == "execution").unwrap().1, "e2s1");
        assert!(is_cas_login_page(html));
        assert_eq!(cas_login_error(html), "验证码错误，请重新输入");
        assert!(allowed_cas_url(&reqwest::Url::parse("https://ids.njust.edu.cn:443/authserver/login").unwrap()));
        assert!(!allowed_cas_url(&reqwest::Url::parse("https://ids.njust.edu.cn.evil.example/login").unwrap()));
        assert!(!allowed_cas_url(&reqwest::Url::parse("http://ids.njust.edu.cn/authserver/login").unwrap()));
    }

    #[test]
    fn cas_form_preserves_academic_service_and_encrypted_password() {
        use cbc::cipher::BlockDecryptMut;
        let html = r#"<form id="pwdFromId" action="/authserver/login"><input name="passwordText"><input name="execution" value="e1s1"><input name="_eventId" value="submit"></form><input id="pwdEncryptSalt" value="1234567890abcdef"><script>var service = 'https://bkjw.njust.edu.cn/njlgdx/indexsso.jsp';</script>"#;
        let form = parse_cas_login_form(html, "https://ids.njust.edu.cn/authserver/login").unwrap();
        assert_eq!(form.action_url.host_str(), Some("ids.njust.edu.cn"));
        assert!(form.action_url.query().unwrap_or_default().contains("service="));
        let encrypted = encrypt_cas_password("example-password", &form.salt).unwrap();
        assert_ne!(encrypted, "example-password");
        let mut ciphertext = BASE64.decode(encrypted).unwrap();
        let decryptor = cbc::Decryptor::<Aes128>::new_from_slices(form.salt.as_bytes(), &[0u8; 16]).unwrap();
        let decrypted = decryptor.decrypt_padded_mut::<Pkcs7>(&mut ciphertext).unwrap();
        assert!(decrypted.ends_with(b"example-password"));
    }

    #[test]
    fn parses_the_real_schedule_grid_fixture() {
        let html = r#"<table id="kbtable"><tr><th>周次</th></tr><tr><th>第一大节</th><td><div class="kbcontent">通信系统<br><font title="周次">8-16(周)</font></div></td></tr></table>"#;
        let courses = parse_schedule(&html);
        assert!(!courses.is_empty(), "the modern #kbtable fixture must yield courses");
        let communication = courses.iter().find(|course| course.get("name").and_then(Value::as_str) == Some("通信系统")).expect("通信系统");
        assert_eq!(communication.get("startWeek").and_then(Value::as_u64), Some(8));
        assert_eq!(communication.get("endWeek").and_then(Value::as_u64), Some(16));
        assert_eq!(communication.get("weekday").and_then(Value::as_u64), Some(1));
    }

    #[test]
    fn skips_empty_nbsp_schedule_cells() {
        assert!(parse_schedule_cell("&nbsp;", 1, &[1, 2, 3]).is_empty());
        assert!(parse_schedule_cell("&#160;", 1, &[1, 2, 3]).is_empty());
    }

    #[test]
    fn only_the_selected_semester_and_following_options_are_queried() {
        let html = r#"<select id='kksj'><option value='old'>旧</option><option value='now' selected>当前</option><option value='new'>新</option></select>"#;
        assert_eq!(option_values(html, "#kksj"), vec!["now", "new"]);
    }

    #[test]
    fn schedule_preserves_discontinuous_weeks() {
        let html = r#"科技论文写作<br><font title="周次">4-5,8-12(周)</font><br><font title="教室">IV-C105</font>"#;
        let courses = parse_schedule_cell(html, 1, &[4, 5]);
        assert_eq!(courses.len(), 2);
        assert_eq!(courses[0]["startWeek"], 4);
        assert_eq!(courses[0]["endWeek"], 5);
        assert_eq!(courses[1]["startWeek"], 8);
        assert_eq!(courses[1]["endWeek"], 12);
        assert_eq!(courses[1]["room"], "IV-C105");
    }
}
