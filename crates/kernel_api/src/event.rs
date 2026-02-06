//! Kernel event types
//!
//! Defines the event bus types for communication between kernel, plugins, and frontend.

use serde::{Deserialize, Serialize};

/// Event topics for the kernel event bus
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum EventTopic {
    /// Plugin lifecycle events
    PluginLoaded,
    PluginUnloaded,
    PluginEnabled,
    PluginDisabled,
    PluginError,

    /// Registry events
    NodeTypeRegistered,
    NodeTypeUnregistered,
    PanelRegistered,
    PanelUnregistered,
    CommandRegistered,
    CommandUnregistered,

    /// Workspace events
    WorkspaceCreated,
    WorkspaceOpened,
    WorkspaceSaved,
    WorkspaceClosed,

    /// Canvas events
    CanvasCreated,
    CanvasOpened,
    CanvasSaved,
    CanvasClosed,

    /// Node events
    NodeCreated,
    NodeUpdated,
    NodeDeleted,
    NodeSelected,
    NodeDeselected,

    /// Edge events
    EdgeCreated,
    EdgeUpdated,
    EdgeDeleted,

    /// Custom plugin events
    Custom(String),
}

impl std::fmt::Display for EventTopic {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EventTopic::Custom(name) => write!(f, "custom:{}", name),
            other => {
                let s = serde_json::to_string(other).unwrap_or_default();
                // Remove quotes from serialized string
                write!(f, "{}", s.trim_matches('"'))
            }
        }
    }
}

/// A kernel event that can be emitted and subscribed to
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KernelEvent {
    /// Event topic for filtering
    pub topic: EventTopic,
    
    /// Source plugin ID (None for kernel events)
    pub source: Option<String>,
    
    /// Event payload as JSON value
    pub payload: serde_json::Value,
    
    /// Timestamp of the event (Unix milliseconds)
    pub timestamp: u64,
}

impl KernelEvent {
    /// Create a new kernel event
    pub fn new(topic: EventTopic, source: Option<String>, payload: serde_json::Value) -> Self {
        Self {
            topic,
            source,
            payload,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
        }
    }

    /// Create a kernel-originated event
    pub fn kernel(topic: EventTopic, payload: serde_json::Value) -> Self {
        Self::new(topic, None, payload)
    }

    /// Create a plugin-originated event
    pub fn plugin(topic: EventTopic, plugin_id: impl Into<String>, payload: serde_json::Value) -> Self {
        Self::new(topic, Some(plugin_id.into()), payload)
    }
}

/// Event subscription filter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventFilter {
    /// Topics to subscribe to (empty means all)
    pub topics: Vec<EventTopic>,
    
    /// Source plugin IDs to filter (empty means all)
    pub sources: Vec<String>,
}

impl Default for EventFilter {
    fn default() -> Self {
        Self {
            topics: Vec::new(),
            sources: Vec::new(),
        }
    }
}

impl EventFilter {
    /// Subscribe to all events
    pub fn all() -> Self {
        Self::default()
    }

    /// Subscribe to specific topics
    pub fn topics(topics: Vec<EventTopic>) -> Self {
        Self {
            topics,
            sources: Vec::new(),
        }
    }

    /// Subscribe to events from specific plugins
    pub fn from_plugins(sources: Vec<String>) -> Self {
        Self {
            topics: Vec::new(),
            sources,
        }
    }

    /// Check if an event matches this filter
    pub fn matches(&self, event: &KernelEvent) -> bool {
        let topic_match = self.topics.is_empty() || self.topics.contains(&event.topic);
        let source_match = self.sources.is_empty()
            || event.source.as_ref().map_or(true, |s| self.sources.contains(s));
        topic_match && source_match
    }
}
