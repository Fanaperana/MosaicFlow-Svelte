// MosaicFlow ID Generation
//
// Centralized ID generation utilities

use uuid::Uuid;

/// Generate a new UUID v4
pub fn generate_uuid() -> String {
    Uuid::new_v4().to_string()
}

/// Generate a short ID (first 8 chars of UUID)
pub fn generate_short_id() -> String {
    Uuid::new_v4().to_string()[..8].to_string()
}

/// Generate a prefixed ID (e.g., "vault_abc123")
pub fn generate_prefixed_id(prefix: &str) -> String {
    format!("{}_{}", prefix, generate_short_id())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uuid_format() {
        let id = generate_uuid();
        assert_eq!(id.len(), 36);
        assert!(id.contains('-'));
    }

    #[test]
    fn test_short_id() {
        let id = generate_short_id();
        assert_eq!(id.len(), 8);
    }
}
