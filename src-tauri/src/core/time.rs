// MosaicFlow Time Utilities
//
// Centralized time handling - used everywhere for consistency

use chrono::Utc;

/// Get current timestamp as ISO 8601 string (RFC 3339)
pub fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

/// Get current timestamp as Unix milliseconds
pub fn now_timestamp() -> i64 {
    Utc::now().timestamp_millis()
}

/// Parse ISO 8601 string to timestamp
pub fn parse_iso(iso: &str) -> Option<i64> {
    chrono::DateTime::parse_from_rfc3339(iso)
        .ok()
        .map(|dt| dt.timestamp_millis())
}

/// Format relative time (e.g., "2 hours ago")
pub fn relative_time(iso: &str) -> String {
    let now = Utc::now();
    let then = match chrono::DateTime::parse_from_rfc3339(iso) {
        Ok(dt) => dt.with_timezone(&Utc),
        Err(_) => return iso.to_string(),
    };
    
    let diff = now.signed_duration_since(then);
    let seconds = diff.num_seconds();
    
    if seconds < 0 {
        return "in the future".to_string();
    }
    
    if seconds < 60 {
        return "just now".to_string();
    }
    
    let minutes = seconds / 60;
    if minutes < 60 {
        return format!("{} minute{} ago", minutes, if minutes == 1 { "" } else { "s" });
    }
    
    let hours = minutes / 60;
    if hours < 24 {
        return format!("{} hour{} ago", hours, if hours == 1 { "" } else { "s" });
    }
    
    let days = hours / 24;
    if days < 30 {
        return format!("{} day{} ago", days, if days == 1 { "" } else { "s" });
    }
    
    let months = days / 30;
    if months < 12 {
        return format!("{} month{} ago", months, if months == 1 { "" } else { "s" });
    }
    
    let years = months / 12;
    format!("{} year{} ago", years, if years == 1 { "" } else { "s" })
}
