//! Policy Checker
//!
//! Validates plugin permissions and enforces security policies.

use std::collections::HashSet;
use parking_lot::RwLock;
use tracing::{debug, warn};
use kernel_api::{PluginPermission, KernelError, KernelResult};

/// Policy checker for plugin permissions
pub struct PolicyChecker {
    /// Granted permissions per plugin
    granted_permissions: RwLock<std::collections::HashMap<String, HashSet<PluginPermission>>>,
    
    /// Global policy settings
    policy: RwLock<Policy>,
}

/// Global policy configuration
#[derive(Debug, Clone)]
pub struct Policy {
    /// Whether to allow network access by default
    pub allow_network: bool,
    
    /// Whether to allow file system access by default
    pub allow_filesystem: bool,
    
    /// Whether to allow shell access (dangerous)
    pub allow_shell: bool,
    
    /// Whether core plugins bypass permission checks
    pub core_bypass_checks: bool,
}

impl Default for Policy {
    fn default() -> Self {
        Self {
            allow_network: true,
            allow_filesystem: true,
            allow_shell: false,
            core_bypass_checks: true,
        }
    }
}

impl Default for PolicyChecker {
    fn default() -> Self {
        Self::new()
    }
}

impl PolicyChecker {
    /// Create a new policy checker
    pub fn new() -> Self {
        Self {
            granted_permissions: RwLock::new(std::collections::HashMap::new()),
            policy: RwLock::new(Policy::default()),
        }
    }

    /// Create with custom policy
    pub fn with_policy(policy: Policy) -> Self {
        Self {
            granted_permissions: RwLock::new(std::collections::HashMap::new()),
            policy: RwLock::new(policy),
        }
    }

    /// Grant a permission to a plugin
    pub fn grant_permission(&self, plugin_id: &str, permission: PluginPermission) {
        debug!(plugin_id = %plugin_id, permission = ?permission, "Granting permission");
        self.granted_permissions
            .write()
            .entry(plugin_id.to_string())
            .or_default()
            .insert(permission);
    }

    /// Revoke a permission from a plugin
    pub fn revoke_permission(&self, plugin_id: &str, permission: &PluginPermission) {
        debug!(plugin_id = %plugin_id, permission = ?permission, "Revoking permission");
        if let Some(perms) = self.granted_permissions.write().get_mut(plugin_id) {
            perms.remove(permission);
        }
    }

    /// Check if a plugin has a specific permission
    pub fn has_permission(&self, plugin_id: &str, permission: &PluginPermission) -> bool {
        self.granted_permissions
            .read()
            .get(plugin_id)
            .map(|perms| perms.contains(permission))
            .unwrap_or(false)
    }

    /// Check permission and return result
    pub fn check_permission(
        &self,
        plugin_id: &str,
        permission: &PluginPermission,
        operation: &str,
    ) -> KernelResult<()> {
        if self.has_permission(plugin_id, permission) {
            Ok(())
        } else {
            warn!(
                plugin_id = %plugin_id,
                permission = ?permission,
                operation = %operation,
                "Permission denied"
            );
            Err(KernelError::PermissionDenied {
                operation: operation.to_string(),
                permission: format!("{:?}", permission),
            })
        }
    }

    /// Grant all permissions from a list
    pub fn grant_permissions(&self, plugin_id: &str, permissions: &[PluginPermission]) {
        for perm in permissions {
            self.grant_permission(plugin_id, perm.clone());
        }
    }

    /// Check if core plugins should bypass checks
    pub fn should_bypass_for_core(&self) -> bool {
        self.policy.read().core_bypass_checks
    }

    /// Check a permission for a core plugin
    pub fn check_permission_for_core(
        &self,
        plugin_id: &str,
        is_core: bool,
        permission: &PluginPermission,
        operation: &str,
    ) -> KernelResult<()> {
        if is_core && self.should_bypass_for_core() {
            return Ok(());
        }
        self.check_permission(plugin_id, permission, operation)
    }

    /// Update the global policy
    pub fn set_policy(&self, policy: Policy) {
        *self.policy.write() = policy;
    }

    /// Get current policy
    pub fn get_policy(&self) -> Policy {
        self.policy.read().clone()
    }

    /// Get all permissions for a plugin
    pub fn get_plugin_permissions(&self, plugin_id: &str) -> Vec<PluginPermission> {
        self.granted_permissions
            .read()
            .get(plugin_id)
            .map(|set| set.iter().cloned().collect())
            .unwrap_or_default()
    }
}
