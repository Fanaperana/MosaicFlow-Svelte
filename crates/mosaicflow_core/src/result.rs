// MosaicFlow Result Type
//
// Unified result type for all operations

use crate::error::MosaicError;

/// Unified result type for all MosaicFlow operations
pub type MosaicResult<T> = Result<T, MosaicError>;
