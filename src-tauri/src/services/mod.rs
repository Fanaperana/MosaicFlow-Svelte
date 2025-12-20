// MosaicFlow Services
//
// Business logic layer - clean separation from commands
// All heavy computation and I/O operations happen here

pub mod vault_service;
pub mod canvas_service;
pub mod history_service;
pub mod workspace_service;
pub mod state_service;
pub mod migration_service;
pub mod config_service;

// Re-export services
pub use vault_service::VaultService;
pub use canvas_service::CanvasService;
pub use history_service::HistoryService;
pub use workspace_service::WorkspaceService;
pub use state_service::StateService;
pub use migration_service::MigrationService;
pub use config_service::ConfigService;
