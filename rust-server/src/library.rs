//! Isolated, anonymous catalogue proxy. Only two fixed OPAC endpoints are
//! allowed; user-supplied URLs and academic authentication cookies are not used.
use std::time::Duration;
use axum::{extract::Query, Json};
use reqwest::{redirect::Policy, Client, Url};
use serde::Deserialize;
use serde_json::{json, Value};

// 图书代理单独建无认证 HTTP 客户端，只访问固定路径，不复用教务 Session 的 Cookie。
// 修改 BASE 前同时更新 js/library-core.js 与 njustLibrary；契约改变需递增 REVISION。
const BASE: &str = "http://202.119.83.14:8080/uopac/opac/";
const REVISION: &str = "2026-10-02-library-1";
const MAX_BYTES: usize = 2 * 1024 * 1024;

#[derive(Deserialize)]
pub struct Search {
    query: String,
    #[serde(rename = "searchType", default = "default_type")]
    search_type: String,
    #[serde(default = "default_doctype")]
    doctype: String,
    #[serde(default = "default_page")]
    page: u32,
    #[serde(rename = "onlyAvailable", default)]
    only_available: String,
}
fn default_type() -> String { "title".into() }
fn default_doctype() -> String { "ALL".into() }
fn default_page() -> u32 { 1 }

#[derive(Deserialize)]
pub struct Detail { id: String }

fn search_url(p: &Search) -> Result<Url, &'static str> {
    let query = p.query.split_whitespace().collect::<Vec<_>>().join(" ");
    if query.is_empty() || query.encode_utf16().count() > 100 { return Err("请输入 1～100 个字符的检索内容"); }
    if !["title", "author", "isbn", "keyword", "callno", "publisher"].contains(&p.search_type.as_str())
        || !["ALL", "01", "02", "11"].contains(&p.doctype.as_str())
        || !(1..=500).contains(&p.page) { return Err("图书检索参数不正确"); }
    let mut url = Url::parse(&format!("{BASE}openlink.php")).expect("static catalogue URL");
    url.query_pairs_mut().extend_pairs([
        ("strSearchType", p.search_type.as_str()), ("strText", query.as_str()),
        ("historyCount", "1"), ("doctype", p.doctype.as_str()), ("lang_code", "ALL"),
        ("displaypg", "20"), ("sort", "CATA_DATE"), ("orderby", "DESC"),
        ("location", "ALL"), ("showmode", "list"), ("match_flag", "forward"),
        ("with_ebook", "on"), ("onlylendable", if p.only_available == "true" { "yes" } else { "no" }),
    ]).append_pair("page", &p.page.to_string());
    Ok(url)
}

fn detail_url(id: &str) -> Result<Url, &'static str> {
    if id.is_empty() || id.len() > 64 || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-') {
        return Err("无效的图书编号");
    }
    let mut url = Url::parse(&format!("{BASE}item.php")).expect("static catalogue URL");
    url.query_pairs_mut().append_pair("marc_no", id);
    Ok(url)
}

async fn fetch_page(url: Url) -> Result<String, &'static str> {
    // Building an independent client deliberately avoids Session's Cookie Jar
    // and global session lock, so querying books cannot interrupt SSO login.
    let client = Client::builder().redirect(Policy::none())
        .connect_timeout(Duration::from_secs(6)).timeout(Duration::from_secs(14))
        .build().map_err(|_| "图书检索组件初始化失败")?;
    let mut response = client.get(url).header("Accept", "text/html").send().await
        .map_err(|err| if err.is_timeout() { "图书馆连接超时，请稍后重试" } else { "暂时无法连接学校图书馆，请稍后重试" })?;
    if !response.status().is_success() { return Err("学校图书馆暂时不可用，请稍后重试"); }
    if response.content_length().is_some_and(|n| n > MAX_BYTES as u64) { return Err("图书馆响应过大"); }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "图书馆响应中断，请重试")? {
        if bytes.len() + chunk.len() > MAX_BYTES { return Err("图书馆响应过大"); }
        bytes.extend_from_slice(&chunk);
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

async fn response(url: Result<Url, &'static str>) -> Json<Value> {
    let url = match url {
        Ok(url) => url,
        Err(error) => return Json(json!({"ok": false, "error": error, "libraryRevision": REVISION})),
    };
    match fetch_page(url.clone()).await {
        Ok(html) => Json(json!({"ok": true, "html": html, "sourceUrl": url.as_str(), "libraryRevision": REVISION})),
        Err(error) => Json(json!({"ok": false, "error": error, "libraryRevision": REVISION})),
    }
}

pub async fn search(Query(params): Query<Search>) -> Json<Value> { response(search_url(&params)).await }
pub async fn detail(Query(params): Query<Detail>) -> Json<Value> { response(detail_url(&params.id)).await }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn catalogue_urls_are_restricted() {
        assert!(detail_url("http://127.0.0.1/").is_err());
        assert!(detail_url("abc&url=evil").is_err());
        assert!(detail_url("abc123").unwrap().as_str().ends_with("marc_no=abc123"));
        let mut p = Search { query: "高等数学 & 数学".into(), search_type: "title".into(), doctype: "ALL".into(), page: 2, only_available: "true".into() };
        let u = search_url(&p).unwrap();
        assert_eq!(u.host_str(), Some("202.119.83.14"));
        assert!(u.query_pairs().any(|(k,v)| k == "strText" && v == "高等数学 & 数学"));
        assert!(u.query_pairs().any(|(k,v)| k == "onlylendable" && v == "yes"));
        p.page = 0;
        assert!(search_url(&p).is_err());
        p.page = 1;
        p.search_type = "../reader/login.php".into();
        assert!(search_url(&p).is_err());
    }
}
