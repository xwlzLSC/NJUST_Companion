//! Extract the official review table verbatim; do not calculate graduation credit.
use anyhow::{anyhow, Result};
use regex::Regex;
use scraper::{ElementRef, Html, Selector};

/// 将表格单元格提取为二维文本，保留重复指标与 br 换行，供共享前端解析器处理。
/// 总学分字段缺失/非法意味着可能是错误页，不允许当作有效空表覆盖缓存。
pub(super) fn rows(raw: &str) -> Result<Vec<Vec<String>>> {
    let document = Html::parse_document(raw);
    let selector = Selector::parse("tr").unwrap();
    let br = Regex::new(r"(?i)<br\s*/?>").unwrap();
    let unsafe_nodes = Regex::new(r"(?is)<(?:script|style)\b[^>]*>.*?</(?:script|style)>").unwrap();
    let result: Vec<Vec<String>> = document.select(&selector).take(256).map(|row| {
        row.children().filter_map(ElementRef::wrap).filter(|cell| matches!(cell.value().name(), "td" | "th"))
            .map(|cell| {
                let fragment = unsafe_nodes.replace_all(&cell.inner_html(), "").into_owned();
                let fragment = br.replace_all(&fragment, "\n");
                let text = Html::parse_fragment(&fragment).root_element().text().collect::<String>();
                text.trim().chars().take(12000).collect()
            }).collect()
    }).filter(|row: &Vec<String>| row.len() > 1 && row.len() <= 16).collect();
    let has_total = result.iter().any(|row| row.len() == 2 && row[0].split_whitespace().collect::<String>() == "已获课程总学分"
        && row[1].trim().parse::<f64>().map(|n| n.is_finite() && n >= 0.0).unwrap_or(false));
    if !has_total { return Err(anyhow!("未读取到主修学业审查表，可能是登录失效、页面无权限或页面结构变化；旧数据已保留")); }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_duplicate_rows_and_line_breaks() {
        let html = "<table><tr><td>已获课程总学分</td><td>148.1</td></tr><tr><td>已获专业基础课学分</td><td>0.0</td></tr><tr><td>已获专业基础课学分</td><td>0.0</td></tr><tr><td>未获得课程明细</td><td>必修:19.9<br>限选:22<script>doNotExpose()</script></td></tr></table>";
        let parsed = rows(html).unwrap();
        assert_eq!(parsed.len(), 4);
        assert_eq!(parsed[3][1], "必修:19.9\n限选:22");
    }
    #[test]
    fn rejects_login_error_and_empty_tables() {
        assert!(rows("<form id='pwdFromId'>登录</form>").is_err());
        assert!(rows("<table><tr><td>没有权限</td><td>查询失败</td></tr></table>").is_err());
    }
}
