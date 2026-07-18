//! 测试共享模块：包含各 provider 的 mock server。
//!
//! 各 mock 仅被对应测试文件引用，在其它测试编译单元中视为未使用，
//! 故统一 `allow(dead_code)`。
#![allow(dead_code)]

pub mod mock_dashscope_server;
pub mod mock_glm_http_server;
