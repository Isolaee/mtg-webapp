// Shared IP-keyed rate limiter, applied per-route via `route_layer`.
// Extracted from routes/auth.rs so multiple route modules can reuse it
// (e.g. auth login/register and the card-duel vote endpoint). Each
// `RateLimiter::new(..)` allocates its own counter map, so limiters attached
// to different routers are independent.
//
// Requires the server to be served with connection info, which `main.rs` does
// via `.into_make_service_with_connect_info::<SocketAddr>()`.

use axum::{
    extract::{ConnectInfo, State},
    http::StatusCode,
    middleware::Next,
    response::IntoResponse,
    Json,
};
use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::Instant;

#[derive(Clone)]
pub struct RateLimiter {
    map: Arc<Mutex<HashMap<IpAddr, (u32, Instant)>>>,
    max_requests: u32,
    window_secs: u64,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window_secs: u64) -> Self {
        Self {
            map: Arc::new(Mutex::new(HashMap::new())),
            max_requests,
            window_secs,
        }
    }

    fn check_and_increment(&self, ip: IpAddr) -> bool {
        let mut map = self.map.lock().unwrap();
        let now = Instant::now();
        let entry = map.entry(ip).or_insert((0, now));
        if now.duration_since(entry.1).as_secs() >= self.window_secs {
            *entry = (1, now);
            true
        } else if entry.0 < self.max_requests {
            entry.0 += 1;
            true
        } else {
            false
        }
    }
}

pub async fn rate_limit_middleware(
    State(limiter): State<RateLimiter>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    req: axum::extract::Request,
    next: Next,
) -> axum::response::Response {
    if limiter.check_and_increment(addr.ip()) {
        next.run(req).await
    } else {
        (
            StatusCode::TOO_MANY_REQUESTS,
            Json(serde_json::json!({"msg": "Too many requests, please try again later"})),
        )
            .into_response()
    }
}
