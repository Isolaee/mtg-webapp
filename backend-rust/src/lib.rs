// Clippy lints that fight idiomatic axum/SQLx in this crate are allowed here so
// the rest of clippy can be enforced (-D warnings in CI). Handlers return
// `Result<_, Response>` (result_large_err), a few query helpers take many binds
// (too_many_arguments), and a couple of analysis return types are inherently
// nested (type_complexity).
#![allow(clippy::result_large_err)]
#![allow(clippy::too_many_arguments)]
#![allow(clippy::type_complexity)]

pub mod analysis;
pub mod db;
pub mod models;
pub mod phash;
pub mod rate_limit;
pub mod routes;
pub mod scrapers;
pub mod upgrades;
