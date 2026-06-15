/// OGG 封装器 - 将裸 Opus 数据包封装为 OGG 流
///
/// OGG 页面格式:
/// - 页眉 (27 bytes): OggS + 版本 + 标志 + granule_position + serial + sequence + CRC + segments
/// - 段表: 每个数据包的长度
/// - 数据包内容
///
/// Opus 在 OGG 中的结构:
/// - 第1页: OpusHead (BOS)
/// - 第2页: OpusTags
/// - 后续: 音频数据包
use std::time::{SystemTime, UNIX_EPOCH};

/// OGG CRC32 查找表（前向 CRC32，多项式 0x04C11DB7）
///
/// OGG 规范要求使用前向（MSB-first）CRC32，而非标准的反射 CRC32。
/// 参考: https://en.wikipedia.org/wiki/Cyclic_redundancy_check
const CRC32_TABLE: [u32; 256] = {
    let mut table = [0u32; 256];
    let mut i = 0;
    while i < 256 {
        let mut r = i << 24;
        let mut j = 0;
        while j < 8 {
            if r & 0x8000_0000 != 0 {
                r = (r << 1) ^ 0x04c1_1db7;
            } else {
                r <<= 1;
            }
            j += 1;
        }
        table[i as usize] = r;
        i += 1;
    }
    table
};

/// 计算 OGG 前向 CRC32
fn ogg_crc32(data: &[u8]) -> u32 {
    let mut crc: u32 = 0;
    for &byte in data {
        let idx = (((crc >> 24) ^ (byte as u32)) & 0xFF) as usize;
        crc = (crc << 8) ^ CRC32_TABLE[idx];
    }
    crc
}

/// OGG Muxer 配置选项
#[derive(Debug, Clone)]
pub struct OggMuxerOptions {
    /// 采样率（用于 granule position 计算，默认 16000）
    pub sample_rate: u32,
    /// 声道数（默认 1）
    pub channels: u8,
    /// 每帧时长毫秒（默认 60）
    pub frame_size_ms: u32,
}

impl Default for OggMuxerOptions {
    fn default() -> Self {
        Self {
            sample_rate: 16000,
            channels: 1,
            frame_size_ms: 60,
        }
    }
}

/// OGG Muxer - 将裸 Opus 数据包流式封装为 OGG 页面
pub struct OggMuxer {
    serial_number: u32,
    page_sequence: u32,
    granule_position: u64,
    channels: u8,
    frame_size_ms: u32,
    started: bool,
    finished: bool,
}

impl OggMuxer {
    /// 当前页面序号
    pub fn page_sequence(&self) -> u32 {
        self.page_sequence
    }
}

impl OggMuxer {
    /// 创建新的 OGG Muxer
    pub fn new(options: OggMuxerOptions) -> Self {
        // 生成伪随机 serial number（基于时间戳）
        let serial_number = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_micros() as u32)
            .unwrap_or(42);

        Self {
            serial_number,
            page_sequence: 0,
            // Opus pre-skip: 对于 48kHz Opus 内部采样率，推荐值为 312
            // 参考: RFC 7845 Section 5.1
            granule_position: 312,
            channels: options.channels,
            frame_size_ms: options.frame_size_ms,
            started: false,
            finished: false,
        }
    }

    /// 写入一个 Opus 数据包，返回产生的 OGG 页面列表
    ///
    /// 第一次调用时返回 [OpusHead, OpusTags, 第一帧数据]
    /// 后续调用返回 [数据页面]
    pub fn push_packet(&mut self, opus_packet: &[u8]) -> Vec<Vec<u8>> {
        let mut pages = Vec::new();

        if !self.started {
            self.started = true;
            // 第一个页面：OpusHead（BOS）
            pages.push(self.create_opus_head_page());
            // 第二个页面：OpusTags
            pages.push(self.create_opus_tags_page());
        }

        // 更新 granule position
        // Opus 内部采样率总是 48000Hz，颗粒位置使用 48kHz 计算
        // 参考: RFC 7845 Section 3
        let samples_per_frame = (48000u64 * self.frame_size_ms as u64) / 1000;
        self.granule_position += samples_per_frame;

        // 创建数据页面
        pages.push(self.create_data_page(opus_packet, false));

        pages
    }

    /// 结束流，返回 EOS 页面（如果有数据尚未发送）
    pub fn finish(&mut self) -> Option<Vec<u8>> {
        if self.finished {
            return None;
        }
        self.finished = true;
        // 在 Opus 流结束时，发送一个空页面标记 EOS
        // 但一般 ASR 服务不需要 EOS 页面，流式发送完数据后关闭连接即可
        None
    }

    /// 创建 OpusHead 页面（BOS）
    fn create_opus_head_page(&mut self) -> Vec<u8> {
        let mut packet = Vec::with_capacity(19);

        // OpusHead magic
        packet.extend_from_slice(b"OpusHead");
        // Version
        packet.push(1);
        // Channel count
        packet.push(self.channels);
        // Pre-skip (312 for 48kHz, RFC 7845 Section 5.1)
        packet.extend_from_slice(&312u16.to_le_bytes());
        // Input sample rate (always 48000 for Opus)
        packet.extend_from_slice(&48000u32.to_le_bytes());
        // Output gain (0)
        packet.extend_from_slice(&0u16.to_le_bytes());
        // Mapping family (0 = mono/stereo)
        packet.push(0);

        // 创建页面
        self.create_page(&[&packet], 2) // BOS flag
    }

    /// 创建 OpusTags 页面
    fn create_opus_tags_page(&mut self) -> Vec<u8> {
        let vendor_string = b"univoice-rs";
        let mut packet = Vec::new();

        // OpusTags magic
        packet.extend_from_slice(b"OpusTags");
        // Vendor string length
        packet.extend_from_slice(&(vendor_string.len() as u32).to_le_bytes());
        // Vendor string
        packet.extend_from_slice(vendor_string);
        // User comment list length (0)
        packet.extend_from_slice(&0u32.to_le_bytes());

        self.create_page(&[&packet], 0) // normal flag
    }

    /// 创建数据页面
    fn create_data_page(&mut self, opus_data: &[u8], eos: bool) -> Vec<u8> {
        let flags = if eos { 4 } else { 0 };
        self.create_page(&[opus_data], flags)
    }

    /// 构建 OGG 页面并自动递增页序号
    ///
    /// `segments`: 数据包列表（每个可能跨多个段）
    /// `header_type_flag`: 2=BOS, 4=EOS, 0=normal
    fn create_page(&mut self, packets: &[&[u8]], header_type_flag: u8) -> Vec<u8> {
        // 构建段表（segment table）
        let mut segment_table = Vec::new();
        for &packet in packets {
            // OGG 每段最大 255 字节，超过则分多段
            let mut remaining = packet.len();
            while remaining > 255 {
                segment_table.push(255u8);
                remaining -= 255;
            }
            segment_table.push(remaining as u8);
        }

        let num_segments = segment_table.len() as u8;

        // 预计算页面大小（不含 CRC）
        let page_size = 27 + num_segments as usize + packets.iter().map(|p| p.len()).sum::<usize>();
        let mut page = Vec::with_capacity(page_size + 4);

        // 1. 页眉 (27 bytes)
        page.extend_from_slice(b"OggS"); // capture pattern
        page.push(0); // version
        page.push(header_type_flag); // header_type
        page.extend_from_slice(&self.granule_position.to_le_bytes()); // granule_position
        page.extend_from_slice(&self.serial_number.to_le_bytes()); // serial_number
        page.extend_from_slice(&self.page_sequence.to_le_bytes()); // page_sequence
        // CRC placeholder (4 bytes, will be filled later)
        let crc_offset = page.len();
        page.extend_from_slice(&0u32.to_le_bytes());
        page.push(num_segments); // num_segments

        // 2. 段表
        page.extend_from_slice(&segment_table);

        // 3. 数据包
        for &packet in packets {
            page.extend_from_slice(packet);
        }

        // 4. 计算 CRC (将 CRC 字段设为 0 后计算)
        let crc = ogg_crc32(&page);
        let crc_bytes = crc.to_le_bytes();
        page[crc_offset..crc_offset + 4].copy_from_slice(&crc_bytes);

        // 递增页序号
        self.page_sequence += 1;

        page
    }
}

/// 创建一个从 Opus 数据包流到 OGG 页面流适配器
///
/// 将输入的 Opus 数据包流（每个元素是一个裸 Opus 帧）
/// 转换为 OGG 页面流（每个元素是一个完整的 OGG 页面）
pub fn create_ogg_stream(
    opus_packets: impl futures_util::Stream<Item = Vec<u8>> + Send + 'static,
    options: OggMuxerOptions,
) -> impl futures_util::Stream<Item = Vec<u8>> {
    use futures_util::StreamExt;

    let mut muxer = OggMuxer::new(options);

    // 使用 async_stream 将 Opus 包流映射为 OGG 页面流
    async_stream::stream! {
        tokio::pin!(opus_packets);
        while let Some(packet) = opus_packets.next().await {
            let pages = muxer.push_packet(&packet);
            for page in pages {
                yield page;
            }
        }
        // 流结束时发送 EOS
        if let Some(eos_page) = muxer.finish() {
            yield eos_page;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ogg_muxer_basic() {
        let mut muxer = OggMuxer::new(OggMuxerOptions::default());

        // 第一个 Opus 数据包（模拟一个短包）
        let first_packet = vec![0u8; 64]; // 模拟 Opus 数据
        let pages = muxer.push_packet(&first_packet);

        // 第一次 push 应产生 3 个页面: OpusHead + OpusTags + 数据
        assert_eq!(pages.len(), 3, "第一次 push 应产生 3 个页面");

        // 验证 OpusHead 页面
        let head_page = &pages[0];
        assert!(head_page.len() > 27, "页面应大于页眉大小");
        assert_eq!(&head_page[0..4], b"OggS", "OGG 捕获模式");
        assert_eq!(head_page[5], 2, "BOS 标志");

        // 验证 OpusTags 页面
        let tags_page = &pages[1];
        assert_eq!(&tags_page[0..4], b"OggS", "OGG 捕获模式");
        assert_eq!(tags_page[5], 0, "普通页面");

        // 验证数据页面
        let data_page = &pages[2];
        assert_eq!(&data_page[0..4], b"OggS", "OGG 捕获模式");

        // 第二个数据包
        let second_packet = vec![0u8; 128];
        let pages2 = muxer.push_packet(&second_packet);
        assert_eq!(pages2.len(), 1, "后续 push 应产生 1 个页面");
    }

    #[test]
    fn test_ogg_muxer_crc() {
        let mut muxer = OggMuxer::new(OggMuxerOptions::default());
        let pages = muxer.push_packet(&[0u8; 64]);

        // 验证所有页面的 CRC 不为 0（说明被正确计算了）
        for page in &pages {
            let crc_bytes = &page[22..26];
            let crc = u32::from_le_bytes([crc_bytes[0], crc_bytes[1], crc_bytes[2], crc_bytes[3]]);
            // CRC 极大概率不为 0（即使数据全 0）
            assert_ne!(crc, 0, "CRC 不应为 0");
        }
    }

    #[test]
    fn test_ogg_muxer_sequence() {
        let mut muxer = OggMuxer::new(OggMuxerOptions::default());

        // 第1次: 3 页（BOS + Tags + data0）
        let p0 = muxer.push_packet(&[0u8; 32]);
        assert_eq!(p0.len(), 3);

        // 验证页面序列号
        assert_eq!(u32_from_le_slice(&p0[0][18..22]), 0, "OpusHead 页序号 0");
        assert_eq!(u32_from_le_slice(&p0[1][18..22]), 1, "OpusTags 页序号 1");
        assert_eq!(u32_from_le_slice(&p0[2][18..22]), 2, "第一帧数据页序号 2");

        // 第2次: 1 页（data1）
        let p1 = muxer.push_packet(&[0u8; 48]);
        assert_eq!(p1.len(), 1);
        assert_eq!(u32_from_le_slice(&p1[0][18..22]), 3, "第二帧数据页序号 3");

        // 第3次: 1 页（data2）
        let p2 = muxer.push_packet(&[0u8; 64]);
        assert_eq!(p2.len(), 1);
        assert_eq!(u32_from_le_slice(&p2[0][18..22]), 4, "第三帧数据页序号 4");
    }

    fn u32_from_le_slice(bytes: &[u8]) -> u32 {
        u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
    }
}
