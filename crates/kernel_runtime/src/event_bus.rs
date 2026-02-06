//! Event Bus
//!
//! Pub/sub event system for kernel and plugin communication.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use parking_lot::RwLock;
use tokio::sync::broadcast;
use tracing::{debug, trace, warn};
use kernel_api::{KernelEvent, EventTopic, event::EventFilter};

/// Subscription ID
pub type SubscriptionId = u64;

/// Event bus for kernel events
pub struct EventBus {
    /// Broadcast sender for events
    sender: broadcast::Sender<KernelEvent>,
    
    /// Subscription counter
    next_subscription_id: AtomicU64,
    
    /// Active subscriptions (id -> filter)
    subscriptions: RwLock<HashMap<SubscriptionId, EventFilter>>,
    
    /// Total events emitted (for diagnostics)
    total_emitted: AtomicU64,
    
    /// Channel capacity
    capacity: usize,
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new(1024)
    }
}

impl EventBus {
    /// Create a new event bus with specified capacity
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self {
            sender,
            next_subscription_id: AtomicU64::new(1),
            subscriptions: RwLock::new(HashMap::new()),
            total_emitted: AtomicU64::new(0),
            capacity,
        }
    }

    /// Emit an event to all subscribers
    pub fn emit(&self, event: KernelEvent) {
        self.total_emitted.fetch_add(1, Ordering::Relaxed);
        trace!(topic = %event.topic, source = ?event.source, "Event emitted");
        // Ignore send errors (no active receivers is fine)
        let _ = self.sender.send(event);
    }

    /// Emit a kernel event with topic and payload
    pub fn emit_kernel(&self, topic: EventTopic, payload: serde_json::Value) {
        self.emit(KernelEvent::kernel(topic, payload));
    }

    /// Emit a plugin event
    pub fn emit_plugin(&self, topic: EventTopic, plugin_id: &str, payload: serde_json::Value) {
        self.emit(KernelEvent::plugin(topic, plugin_id, payload));
    }

    /// Subscribe to events
    pub fn subscribe(&self, filter: EventFilter) -> (SubscriptionId, broadcast::Receiver<KernelEvent>) {
        let id = self.next_subscription_id.fetch_add(1, Ordering::SeqCst);
        debug!(subscription_id = id, "New event subscription");
        self.subscriptions.write().insert(id, filter);
        (id, self.sender.subscribe())
    }

    /// Subscribe to all events
    pub fn subscribe_all(&self) -> (SubscriptionId, broadcast::Receiver<KernelEvent>) {
        self.subscribe(EventFilter::all())
    }

    /// Subscribe to specific topics
    pub fn subscribe_topics(&self, topics: Vec<EventTopic>) -> (SubscriptionId, broadcast::Receiver<KernelEvent>) {
        self.subscribe(EventFilter::topics(topics))
    }

    /// Unsubscribe
    pub fn unsubscribe(&self, id: SubscriptionId) {
        debug!(subscription_id = id, "Event unsubscription");
        self.subscriptions.write().remove(&id);
    }

    /// Get subscription filter
    pub fn get_filter(&self, id: SubscriptionId) -> Option<EventFilter> {
        self.subscriptions.read().get(&id).cloned()
    }

    /// Get number of active subscriptions
    pub fn subscription_count(&self) -> usize {
        self.subscriptions.read().len()
    }

    /// Get receiver count (actual active receivers)
    pub fn receiver_count(&self) -> usize {
        self.sender.receiver_count()
    }

    /// Get total events emitted since creation
    pub fn total_emitted(&self) -> u64 {
        self.total_emitted.load(Ordering::Relaxed)
    }

    /// Get channel capacity
    pub fn capacity(&self) -> usize {
        self.capacity
    }
}

/// Helper to create filtered event streams
pub struct FilteredEventStream {
    receiver: broadcast::Receiver<KernelEvent>,
    filter: EventFilter,
}

impl FilteredEventStream {
    /// Create a new filtered stream
    pub fn new(receiver: broadcast::Receiver<KernelEvent>, filter: EventFilter) -> Self {
        Self { receiver, filter }
    }

    /// Receive next matching event
    pub async fn recv(&mut self) -> Option<KernelEvent> {
        loop {
            match self.receiver.recv().await {
                Ok(event) => {
                    if self.filter.matches(&event) {
                        return Some(event);
                    }
                    // Continue waiting for matching event
                }
                Err(broadcast::error::RecvError::Closed) => return None,
                Err(broadcast::error::RecvError::Lagged(count)) => {
                    warn!(missed = count, "Event subscriber lagged, some events were missed");
                    continue;
                }
            }
        }
    }
}
