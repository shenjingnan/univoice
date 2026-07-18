//! 音色类型定义
//!
//! 包含所有 TTS Provider 支持的音色列表、默认音色及分组信息。
//! 对齐自 TypeScript `src/types/voices/` 的类型定义。

// ============================================================================
// Doubao 音色
// ============================================================================
pub mod doubao {
    use crate::tts::types::TtsVoice;

    /// 豆包语音合成模型 2.0 默认音色
    pub const DEFAULT_VOICE: &str = "zh_female_tianmeixiaoyuan_moon_bigtts";

    /// V2 音色 —— uranus_bigtts / saturn_ 系列
    pub const V2_VOICES: &[(&str, &str, Option<&str>)] = &[
        ("zh_female_vv_uranus_bigtts", "vv", Some("zh-CN")),
        ("zh_female_xiaohe_uranus_bigtts", "小荷", Some("zh-CN")),
        ("zh_male_m191_uranus_bigtts", "m191", Some("zh-CN")),
        ("zh_male_taocheng_uranus_bigtts", "桃成", Some("zh-CN")),
        ("zh_male_liufei_uranus_bigtts", "刘飞", Some("zh-CN")),
        ("zh_male_sophie_uranus_bigtts", "Sophie", Some("zh-CN")),
        (
            "zh_female_qingxinnvsheng_uranus_bigtts",
            "清新女声",
            Some("zh-CN"),
        ),
        ("zh_female_cancan_uranus_bigtts", "灿灿", Some("zh-CN")),
        (
            "zh_female_sajiaoxuemei_uranus_bigtts",
            "撒娇雪妹",
            Some("zh-CN"),
        ),
        (
            "zh_female_tianmeixiaoyuan_uranus_bigtts",
            "甜美校园",
            Some("zh-CN"),
        ),
        (
            "zh_female_tianmeitaozi_uranus_bigtts",
            "甜美桃子",
            Some("zh-CN"),
        ),
        (
            "zh_female_shuangkuaisisi_uranus_bigtts",
            "爽快思思",
            Some("zh-CN"),
        ),
        ("zh_female_peiqi_uranus_bigtts", "沛琪", Some("zh-CN")),
        (
            "zh_female_linjianvhai_uranus_bigtts",
            "邻家女孩",
            Some("zh-CN"),
        ),
        (
            "zh_male_shaonianzixin_uranus_bigtts",
            "少年自信",
            Some("zh-CN"),
        ),
        ("zh_male_sunwukong_uranus_bigtts", "孙悟空", Some("zh-CN")),
        (
            "zh_female_yingyujiaoxue_uranus_bigtts",
            "英语教学",
            Some("zh-CN"),
        ),
        (
            "zh_female_kefunvsheng_uranus_bigtts",
            "客服女声",
            Some("zh-CN"),
        ),
        ("zh_female_xiaoxue_uranus_bigtts", "小雪", Some("zh-CN")),
        ("zh_male_dayi_uranus_bigtts", "大一", Some("zh-CN")),
        ("zh_female_mizai_uranus_bigtts", "米崽", Some("zh-CN")),
        ("zh_female_jitangnv_uranus_bigtts", "鸡汤女", Some("zh-CN")),
        (
            "zh_female_meilinvyou_uranus_bigtts",
            "美丽女友",
            Some("zh-CN"),
        ),
        (
            "zh_female_liuchangnvsheng_uranus_bigtts",
            "流畅女生",
            Some("zh-CN"),
        ),
        (
            "zh_male_ruyayichen_uranus_bigtts",
            "儒雅译辰",
            Some("zh-CN"),
        ),
        ("en_male_tim_uranus_bigtts", "Tim", Some("en-US")),
        ("en_female_dacey_uranus_bigtts", "Dacey", Some("en-US")),
        ("en_female_stokie_uranus_bigtts", "Stokie", Some("en-US")),
        (
            "saturn_zh_female_keainvsheng_tob",
            "可爱女生 (Saturn)",
            Some("zh-CN"),
        ),
        (
            "saturn_zh_female_tiaopigongzhu_tob",
            "调皮公主 (Saturn)",
            Some("zh-CN"),
        ),
        (
            "saturn_zh_male_shuanglangshaonian_tob",
            "爽朗少年 (Saturn)",
            Some("zh-CN"),
        ),
        (
            "saturn_zh_male_tiancaitongzhuo_tob",
            "天才同桌 (Saturn)",
            Some("zh-CN"),
        ),
        (
            "saturn_zh_female_cancan_tob",
            "灿灿 (Saturn)",
            Some("zh-CN"),
        ),
        (
            "saturn_zh_female_qingyingduoduo_cs_tob",
            "轻盈朵朵 (Saturn)",
            Some("zh-CN"),
        ),
        (
            "saturn_zh_female_wenwanshanshan_cs_tob",
            "温婉姗姗 (Saturn)",
            Some("zh-CN"),
        ),
        (
            "saturn_zh_female_reqingaina_cs_tob",
            "热情艾娜 (Saturn)",
            Some("zh-CN"),
        ),
    ];

    /// Jupiter 音色——端到端实时语音大模型-O 版本
    pub const JUPITER_VOICES: &[(&str, &str, Option<&str>)] = &[
        ("zh_female_vv_jupiter_bigtts", "vv (Jupiter)", Some("zh-CN")),
        (
            "zh_female_xiaohe_jupiter_bigtts",
            "小荷 (Jupiter)",
            Some("zh-CN"),
        ),
        (
            "zh_male_yunzhou_jupiter_bigtts",
            "云舟 (Jupiter)",
            Some("zh-CN"),
        ),
        (
            "zh_male_xiaotian_jupiter_bigtts",
            "小天 (Jupiter)",
            Some("zh-CN"),
        ),
    ];

    /// V1 多情感音色 —— emo_ 系列
    pub const V1_EMO_VOICES: &[(&str, &str, Option<&str>)] = &[
        (
            "zh_male_lengkugege_emo_v2_mars_bigtts",
            "冷酷哥哥 (emo_v2)",
            Some("zh-CN"),
        ),
        (
            "zh_female_tianxinxiaomei_emo_v2_mars_bigtts",
            "甜心小妹 (emo_v2)",
            Some("zh-CN"),
        ),
        (
            "zh_female_gaolengyujie_emo_v2_mars_bigtts",
            "高冷御姐 (emo_v2)",
            Some("zh-CN"),
        ),
        (
            "zh_male_aojiaobazong_emo_v2_mars_bigtts",
            "傲娇霸道 (emo_v2)",
            Some("zh-CN"),
        ),
        (
            "zh_male_guangzhoudege_emo_mars_bigtts",
            "广州的哥 (emo)",
            Some("zh-CN"),
        ),
        (
            "zh_male_jingqiangkanye_emo_mars_bigtts",
            "京腔侃爷 (emo)",
            Some("zh-CN"),
        ),
        (
            "zh_female_linjuayi_emo_v2_mars_bigtts",
            "林俊逸 (emo_v2)",
            Some("zh-CN"),
        ),
        (
            "zh_male_yourougongzi_emo_v2_mars_bigtts",
            "温柔公子 (emo_v2)",
            Some("zh-CN"),
        ),
        (
            "zh_male_ruyayichen_emo_v2_mars_bigtts",
            "儒雅译辰 (emo_v2)",
            Some("zh-CN"),
        ),
        (
            "zh_male_junlangnanyou_emo_v2_mars_bigtts",
            "俊朗男友 (emo_v2)",
            Some("zh-CN"),
        ),
        (
            "zh_male_beijingxiaoye_emo_v2_mars_bigtts",
            "北京小爷 (emo_v2)",
            Some("zh-CN"),
        ),
        (
            "zh_female_roumeinvyou_emo_v2_mars_bigtts",
            "柔美女友 (emo_v2)",
            Some("zh-CN"),
        ),
        (
            "zh_male_yangguangqingnian_emo_v2_mars_bigtts",
            "阳光青年 (emo_v2)",
            Some("zh-CN"),
        ),
        (
            "zh_female_meilinvyou_emo_v2_mars_bigtts",
            "美丽女友 (emo_v2)",
            Some("zh-CN"),
        ),
        (
            "zh_female_shuangkuaisisi_emo_v2_mars_bigtts",
            "爽快思思 (emo_v2)",
            Some("zh-CN"),
        ),
        (
            "en_female_candice_emo_v2_mars_bigtts",
            "Candice (emo_v2)",
            Some("en-US"),
        ),
        (
            "en_female_skye_emo_v2_mars_bigtts",
            "Skye (emo_v2)",
            Some("en-US"),
        ),
        (
            "en_male_glen_emo_v2_mars_bigtts",
            "Glen (emo_v2)",
            Some("en-US"),
        ),
        (
            "en_male_sylus_emo_v2_mars_bigtts",
            "Sylus (emo_v2)",
            Some("en-US"),
        ),
        (
            "en_male_corey_emo_v2_mars_bigtts",
            "Corey (emo_v2)",
            Some("en-US"),
        ),
        (
            "en_female_nadia_tips_emo_v2_mars_bigtts",
            "Nadia Tips (emo_v2)",
            Some("en-US"),
        ),
        (
            "zh_male_shenyeboke_emo_v2_mars_bigtts",
            "深夜波刻 (emo_v2)",
            Some("zh-CN"),
        ),
        (
            "zh_male_zhoujielun_emo_v2_mars_bigtts",
            "周杰伦 (emo_v2)",
            Some("zh-CN"),
        ),
    ];

    /// V1 通用场景 / 教育场景音色
    pub const V1_GENERAL_VOICES: &[(&str, &str, Option<&str>)] = &[
        (
            "zh_female_yingyujiaoyu_mars_bigtts",
            "英语教育",
            Some("zh-CN"),
        ),
        ("zh_female_vv_mars_bigtts", "vv (Mars)", Some("zh-CN")),
        (
            "zh_female_qinqienvsheng_moon_bigtts",
            "亲切女生 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_male_qingyiyuxuan_mars_bigtts",
            "青衣宇轩 (Mars)",
            Some("zh-CN"),
        ),
        (
            "zh_male_xudong_conversation_wvae_bigtts",
            "旭东 (Conversation)",
            Some("zh-CN"),
        ),
        (
            "en_male_jason_conversation_wvae_bigtts",
            "Jason (Conversation)",
            Some("en-US"),
        ),
        (
            "zh_female_sophie_conversation_wvae_bigtts",
            "Sophie (Conversation)",
            Some("zh-CN"),
        ),
        (
            "zh_female_tianmeitaozi_mars_bigtts",
            "甜美桃子 (Mars)",
            Some("zh-CN"),
        ),
        (
            "zh_female_qingxinnvsheng_mars_bigtts",
            "清新女声 (Mars)",
            Some("zh-CN"),
        ),
        (
            "zh_female_zhixingnvsheng_mars_bigtts",
            "知性女生 (Mars)",
            Some("zh-CN"),
        ),
        (
            "zh_male_qingshuangnanda_mars_bigtts",
            "清爽难搭 (Mars)",
            Some("zh-CN"),
        ),
        (
            "zh_female_linjianvhai_moon_bigtts",
            "邻家女孩 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_male_yuanboxiaoshu_moon_bigtts",
            "远播小说 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_male_yangguangqingnian_moon_bigtts",
            "阳光青年 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_female_tianmeixiaoyuan_moon_bigtts",
            "甜美校园 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_female_qingchezizi_moon_bigtts",
            "清澈仔仔 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_male_jieshuoxiaoming_moon_bigtts",
            "解说小明 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_female_kailangjiejie_moon_bigtts",
            "开朗姐姐 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_male_linjiananhai_moon_bigtts",
            "邻家男孩 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_female_tianmeiyueyue_moon_bigtts",
            "甜美悦悦 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_female_xinlingjitang_moon_bigtts",
            "心灵鸡汤 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_male_wenrouxiaoge_mars_bigtts",
            "温柔小哥 (Mars)",
            Some("zh-CN"),
        ),
        ("zh_female_cancan_mars_bigtts", "灿灿 (Mars)", Some("zh-CN")),
        (
            "zh_female_shuangkuaisisi_moon_bigtts",
            "爽快思思 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_male_wennuanahu_moon_bigtts",
            "温暖大叔 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_male_shaonianzixin_moon_bigtts",
            "少年自信 (Moon)",
            Some("zh-CN"),
        ),
    ];

    /// V1 客服场景音色
    pub const V1_CUSTOMER_SERVICE_VOICES: &[(&str, &str, Option<&str>)] = &[(
        "zh_female_kefunvsheng_mars_bigtts",
        "客服女声",
        Some("zh-CN"),
    )];

    /// V1 角色扮演音色
    pub const V1_ROLEPLAY_VOICES: &[(&str, &str, Option<&str>)] = &[
        ("zh_male_naiqimengwa_mars_bigtts", "乃奇萌娃", Some("zh-CN")),
        ("zh_female_popo_mars_bigtts", "婆婆", Some("zh-CN")),
        (
            "zh_female_gaolengyujie_moon_bigtts",
            "高冷御姐 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_male_aojiaobazong_moon_bigtts",
            "傲娇霸道 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_female_meilinvyou_moon_bigtts",
            "美丽女友 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_male_shenyeboke_moon_bigtts",
            "深夜波刻 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_female_sajiaonvyou_moon_bigtts",
            "撒娇女友 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_female_yuanqinvyou_moon_bigtts",
            "元气女友 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_male_dongfanghaoran_moon_bigtts",
            "东方浩然 (Moon)",
            Some("zh-CN"),
        ),
    ];

    /// V1 IP 仿音音色
    pub const V1_IP_VOICES: &[(&str, &str, Option<&str>)] = &[
        ("zh_male_hupunan_mars_bigtts", "湖南 (Mars)", Some("zh-CN")),
        (
            "zh_male_lubanqihao_mars_bigtts",
            "鲁班七号 (Mars)",
            Some("zh-CN"),
        ),
        ("zh_female_yangmi_mars_bigtts", "杨幂 (Mars)", Some("zh-CN")),
        (
            "zh_female_linzhiling_mars_bigtts",
            "林志玲 (Mars)",
            Some("zh-CN"),
        ),
        (
            "zh_female_jiyejizi2_mars_bigtts",
            "极叶子2 (Mars)",
            Some("zh-CN"),
        ),
        ("zh_male_tangseng_mars_bigtts", "唐僧 (Mars)", Some("zh-CN")),
        (
            "zh_male_zhuangzhou_mars_bigtts",
            "庄周 (Mars)",
            Some("zh-CN"),
        ),
        (
            "zh_male_zhubajie_mars_bigtts",
            "猪八戒 (Mars)",
            Some("zh-CN"),
        ),
        (
            "zh_female_ganmaodianyin_mars_bigtts",
            "干猫电影 (Mars)",
            Some("zh-CN"),
        ),
        ("zh_female_naying_mars_bigtts", "那英 (Mars)", Some("zh-CN")),
        (
            "zh_female_leidian_mars_bigtts",
            "雷电 (Mars)",
            Some("zh-CN"),
        ),
    ];

    /// V1 趣味口音音色
    pub const V1_ACCENT_VOICES: &[(&str, &str, Option<&str>)] = &[
        (
            "zh_female_yueyunv_mars_bigtts",
            "粤语女 (Mars)",
            Some("zh-CN"),
        ),
        (
            "zh_male_yuzhouzixuan_moon_bigtts",
            "宇宙自选 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_female_daimengchuanmei_moon_bigtts",
            "戴蒙传媒 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_male_guangxiyuanzhou_moon_bigtts",
            "广西原舟 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_female_wanwanxiaohe_moon_bigtts",
            "弯弯小河 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_female_wanqudashu_moon_bigtts",
            "湾区大叔 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_male_guozhoudege_moon_bigtts",
            "果舟的哥 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_male_haoyuxiaoge_moon_bigtts",
            "好语小哥 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_male_beijingxiaoye_moon_bigtts",
            "北京小爷 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_male_jingqiangkanye_moon_bigtts",
            "京腔侃爷 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_female_meituojieer_moon_bigtts",
            "美拓洁儿 (Moon)",
            Some("zh-CN"),
        ),
    ];

    /// V1 多语种音色
    pub const V1_MULTILINGUAL_VOICES: &[(&str, &str, Option<&str>)] = &[
        (
            "en_female_lauren_moon_bigtts",
            "Lauren (Moon)",
            Some("en-US"),
        ),
        (
            "en_male_campaign_jamal_moon_bigtts",
            "Jamal (Moon)",
            Some("en-US"),
        ),
        ("en_male_chris_moon_bigtts", "Chris (Moon)", Some("en-US")),
        (
            "en_female_product_darcie_moon_bigtts",
            "Darcie (Moon)",
            Some("en-US"),
        ),
        (
            "en_female_emotional_moon_bigtts",
            "Emotional (Moon)",
            Some("en-US"),
        ),
        ("en_female_nara_moon_bigtts", "Nara (Moon)", Some("en-US")),
        ("en_male_bruce_moon_bigtts", "Bruce (Moon)", Some("en-US")),
        (
            "en_male_michael_moon_bigtts",
            "Michael (Moon)",
            Some("en-US"),
        ),
        (
            "zh_male_M100_conversation_wvae_bigtts",
            "M100 (Conversation)",
            Some("zh-CN"),
        ),
        (
            "en_female_dacey_conversation_wvae_bigtts",
            "Dacey (Conversation)",
            Some("en-US"),
        ),
        (
            "en_male_charlie_conversation_wvae_bigtts",
            "Charlie (Conversation)",
            Some("en-US"),
        ),
        (
            "en_female_sarah_new_conversation_wvae_bigtts",
            "Sarah (Conversation)",
            Some("en-US"),
        ),
        ("en_male_adam_mars_bigtts", "Adam (Mars)", Some("en-US")),
        (
            "en_female_amanda_mars_bigtts",
            "Amanda (Mars)",
            Some("en-US"),
        ),
        (
            "en_male_jackson_mars_bigtts",
            "Jackson (Mars)",
            Some("en-US"),
        ),
        ("en_female_daisy_moon_bigtts", "Daisy (Moon)", Some("en-US")),
        ("en_male_dave_moon_bigtts", "Dave (Moon)", Some("en-US")),
        ("en_male_hades_moon_bigtts", "Hades (Moon)", Some("en-US")),
        ("en_female_onez_moon_bigtts", "Onez (Moon)", Some("en-US")),
        ("en_female_emily_mars_bigtts", "Emily (Mars)", Some("en-US")),
        ("en_male_smith_mars_bigtts", "Smith (Mars)", Some("en-US")),
        ("en_female_anna_mars_bigtts", "Anna (Mars)", Some("en-US")),
        ("en_female_sarah_mars_bigtts", "Sarah (Mars)", Some("en-US")),
        ("en_male_dryw_mars_bigtts", "Dryw (Mars)", Some("en-US")),
        (
            "multi_female_maomao_conversation_wvae_bigtts",
            "毛毛 (Multi)",
            Some("zh-CN"),
        ),
        (
            "multi_male_M100_conversation_wvae_bigtts",
            "M100 (Multi)",
            Some("zh-CN"),
        ),
        (
            "multi_female_sophie_conversation_wvae_bigtts",
            "Sophie (Multi)",
            Some("zh-CN"),
        ),
        (
            "multi_male_xudong_conversation_wvae_bigtts",
            "旭东 (Multi)",
            Some("zh-CN"),
        ),
        (
            "multi_zh_male_youyoujunzi_moon_bigtts",
            "悠悠君子 (Multi)",
            Some("zh-CN"),
        ),
        (
            "multi_female_gaolengyujie_moon_bigtts",
            "高冷御姐 (Multi)",
            Some("zh-CN"),
        ),
        (
            "multi_male_jingqiangkanye_moon_bigtts",
            "京腔侃爷 (Multi)",
            Some("zh-CN"),
        ),
        (
            "multi_female_shuangkuaisisi_moon_bigtts",
            "爽快思思 (Multi)",
            Some("zh-CN"),
        ),
        (
            "multi_male_wanqudashu_moon_bigtts",
            "湾区大叔 (Multi)",
            Some("zh-CN"),
        ),
    ];

    /// V1 视频配音音色
    pub const V1_DUBBING_VOICES: &[(&str, &str, Option<&str>)] = &[
        (
            "zh_female_maomao_conversation_wvae_bigtts",
            "毛毛 (Dubbing)",
            Some("zh-CN"),
        ),
        (
            "zh_female_wenrouxiaoya_moon_bigtts",
            "温柔小雅 (Moon)",
            Some("zh-CN"),
        ),
        (
            "zh_male_tiancaitongsheng_mars_bigtts",
            "天才童声 (Mars)",
            Some("zh-CN"),
        ),
        (
            "zh_male_sunwukong_mars_bigtts",
            "孙悟空 (Mars)",
            Some("zh-CN"),
        ),
        ("zh_male_xionger_mars_bigtts", "熊二 (Mars)", Some("zh-CN")),
        ("zh_female_peiqi_mars_bigtts", "佩琪 (Mars)", Some("zh-CN")),
        (
            "zh_female_wuzetian_mars_bigtts",
            "武则天 (Mars)",
            Some("zh-CN"),
        ),
        ("zh_female_gujie_mars_bigtts", "古姐 (Mars)", Some("zh-CN")),
        (
            "zh_female_yingtaowanzi_mars_bigtts",
            "樱桃丸子 (Mars)",
            Some("zh-CN"),
        ),
        ("zh_male_chunhui_mars_bigtts", "春晖 (Mars)", Some("zh-CN")),
        (
            "zh_female_shaoergushi_mars_bigtts",
            "少儿故事 (Mars)",
            Some("zh-CN"),
        ),
        ("zh_male_silang_mars_bigtts", "四郎 (Mars)", Some("zh-CN")),
        (
            "zh_female_qiaopinvsheng_mars_bigtts",
            "俏皮女生 (Mars)",
            Some("zh-CN"),
        ),
        (
            "zh_male_lanxiaoyang_mars_bigtts",
            "懒小羊 (Mars)",
            Some("zh-CN"),
        ),
        (
            "zh_male_dongmanhaimian_mars_bigtts",
            "动漫海绵 (Mars)",
            Some("zh-CN"),
        ),
        (
            "zh_male_jieshuonansheng_mars_bigtts",
            "解说男生 (Mars)",
            Some("zh-CN"),
        ),
        (
            "zh_female_jitangmeimei_mars_bigtts",
            "鸡汤妹妹 (Mars)",
            Some("zh-CN"),
        ),
        (
            "zh_female_tiexinnvsheng_mars_bigtts",
            "贴心女生 (Mars)",
            Some("zh-CN"),
        ),
        (
            "zh_female_mengyatou_mars_bigtts",
            "萌丫头 (Mars)",
            Some("zh-CN"),
        ),
    ];

    /// 常用音色列表（部分精选，完整列表见官方文档）
    pub const ALL: &[(&str, &str, Option<&str>)] = &[];

    /// 构建 Doubao 音色列表
    pub fn list_voices() -> Vec<TtsVoice> {
        let mut voices = Vec::new();
        for group in [
            V2_VOICES,
            JUPITER_VOICES,
            V1_EMO_VOICES,
            V1_GENERAL_VOICES,
            V1_CUSTOMER_SERVICE_VOICES,
            V1_ROLEPLAY_VOICES,
            V1_IP_VOICES,
            V1_ACCENT_VOICES,
            V1_MULTILINGUAL_VOICES,
            V1_DUBBING_VOICES,
        ] {
            for &(id, name, lang) in group {
                voices.push(TtsVoice {
                    id: id.to_string(),
                    name: name.to_string(),
                    language: lang.unwrap_or("zh-CN").to_string(),
                    gender: None,
                });
            }
        }
        voices
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn test_d1_voices_not_empty() {
            let voices = list_voices();
            assert!(!voices.is_empty());
        }

        #[test]
        fn test_d2_all_voices_have_id() {
            let voices = list_voices();
            for v in &voices {
                assert!(!v.id.is_empty());
            }
        }

        #[test]
        fn test_d3_default_is_known() {
            assert!(!DEFAULT_VOICE.is_empty());
        }

        #[test]
        fn test_d4_v2_voices_count() {
            assert!(!V2_VOICES.is_empty());
        }
    }
}

// ============================================================================
// GLM 音色
// ============================================================================
pub mod glm {
    use crate::tts::types::TtsVoice;

    /// 默认音色
    pub const DEFAULT_VOICE: &str = "tongtong";

    /// GLM 系统音色
    pub const ALL: &[(&str, &str, &str)] = &[
        ("tongtong", "彤彤", "zh-CN"),
        ("chuichui", "锤锤", "zh-CN"),
        ("xiaochen", "小陈", "zh-CN"),
        ("jam", "动动动物圈 jam", "zh-CN"),
        ("kazi", "动动动物圈 kazi", "zh-CN"),
        ("douji", "动动动物圈 douji", "zh-CN"),
        ("luodo", "动动动物圈 luodo", "zh-CN"),
    ];

    /// 构建 GLM 音色列表
    pub fn list_voices() -> Vec<TtsVoice> {
        ALL.iter()
            .map(|&(id, name, lang)| TtsVoice {
                id: id.to_string(),
                name: name.to_string(),
                language: lang.to_string(),
                gender: None,
            })
            .collect()
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn test_g1_voices_count() {
            let voices = list_voices();
            assert_eq!(voices.len(), 7);
        }

        #[test]
        fn test_g2_default_in_list() {
            let voices = list_voices();
            assert!(voices.iter().any(|v| v.id == DEFAULT_VOICE));
        }
    }
}

// ============================================================================
// Minimax 音色
// ============================================================================
pub mod minimax {
    use crate::tts::types::TtsVoice;

    /// 默认音色
    pub const DEFAULT_VOICE: &str = "male-qn-qingse";

    /// 中文（普通话）音色
    pub const CHINESE_MANDARIN: &[(&str, &str, &str)] = &[
        ("male-qn-qingse", "male-qn-qingse", "zh-CN"),
        ("male-qn-jingying", "male-qn-jingying", "zh-CN"),
        ("male-qn-badao", "male-qn-badao", "zh-CN"),
        ("male-qn-daxuesheng", "male-qn-daxuesheng", "zh-CN"),
        ("female-shaonv", "female-shaonv", "zh-CN"),
        ("female-yujie", "female-yujie", "zh-CN"),
        ("female-chengshu", "female-chengshu", "zh-CN"),
        ("female-tianmei", "female-tianmei", "zh-CN"),
        ("male-qn-qingse-jingpin", "male-qn-qingse-jingpin", "zh-CN"),
        (
            "male-qn-jingying-jingpin",
            "male-qn-jingying-jingpin",
            "zh-CN",
        ),
        ("male-qn-badao-jingpin", "male-qn-badao-jingpin", "zh-CN"),
        (
            "male-qn-daxuesheng-jingpin",
            "male-qn-daxuesheng-jingpin",
            "zh-CN",
        ),
        ("female-shaonv-jingpin", "female-shaonv-jingpin", "zh-CN"),
        ("female-yujie-jingpin", "female-yujie-jingpin", "zh-CN"),
        (
            "female-chengshu-jingpin",
            "female-chengshu-jingpin",
            "zh-CN",
        ),
        ("female-tianmei-jingpin", "female-tianmei-jingpin", "zh-CN"),
        ("clever_boy", "clever_boy", "zh-CN"),
        ("cute_boy", "cute_boy", "zh-CN"),
        ("lovely_girl", "lovely_girl", "zh-CN"),
        ("cartoon_pig", "cartoon_pig", "zh-CN"),
        ("bingjiao_didi", "bingjiao_didi", "zh-CN"),
        ("junlang_nanyou", "junlang_nanyou", "zh-CN"),
        ("chunzhen_xuedi", "chunzhen_xuedi", "zh-CN"),
        ("lengdan_xiongzhang", "lengdan_xiongzhang", "zh-CN"),
        ("badao_shaoye", "badao_shaoye", "zh-CN"),
        ("tianxin_xiaoling", "tianxin_xiaoling", "zh-CN"),
        ("qiaopi_mengmei", "qiaopi_mengmei", "zh-CN"),
        ("wumei_yujie", "wumei_yujie", "zh-CN"),
        ("diadia_xuemei", "diadia_xuemei", "zh-CN"),
        ("danya_xuejie", "danya_xuejie", "zh-CN"),
        (
            "Chinese (Mandarin)_Reliable_Executive",
            "Chinese (Mandarin)_Reliable_Executive",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_News_Anchor",
            "Chinese (Mandarin)_News_Anchor",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Mature_Woman",
            "Chinese (Mandarin)_Mature_Woman",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Unrestrained_Young_Man",
            "Chinese (Mandarin)_Unrestrained_Young_Man",
            "zh-CN",
        ),
        ("Arrogant_Miss", "Arrogant_Miss", "zh-CN"),
        ("Robot_Armor", "Robot_Armor", "zh-CN"),
        (
            "Chinese (Mandarin)_Kind-hearted_Antie",
            "Chinese (Mandarin)_Kind-hearted_Antie",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_HK_Flight_Attendant",
            "Chinese (Mandarin)_HK_Flight_Attendant",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Humorous_Elder",
            "Chinese (Mandarin)_Humorous_Elder",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Gentleman",
            "Chinese (Mandarin)_Gentleman",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Warm_Bestie",
            "Chinese (Mandarin)_Warm_Bestie",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Male_Announcer",
            "Chinese (Mandarin)_Male_Announcer",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Sweet_Lady",
            "Chinese (Mandarin)_Sweet_Lady",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Southern_Young_Man",
            "Chinese (Mandarin)_Southern_Young_Man",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Wise_Women",
            "Chinese (Mandarin)_Wise_Women",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Gentle_Youth",
            "Chinese (Mandarin)_Gentle_Youth",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Warm_Girl",
            "Chinese (Mandarin)_Warm_Girl",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Kind-hearted_Elder",
            "Chinese (Mandarin)_Kind-hearted_Elder",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Cute_Spirit",
            "Chinese (Mandarin)_Cute_Spirit",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Radio_Host",
            "Chinese (Mandarin)_Radio_Host",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Lyrical_Voice",
            "Chinese (Mandarin)_Lyrical_Voice",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Straightforward_Boy",
            "Chinese (Mandarin)_Straightforward_Boy",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Sincere_Adult",
            "Chinese (Mandarin)_Sincere_Adult",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Gentle_Senior",
            "Chinese (Mandarin)_Gentle_Senior",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Stubborn_Friend",
            "Chinese (Mandarin)_Stubborn_Friend",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Crisp_Girl",
            "Chinese (Mandarin)_Crisp_Girl",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Pure-hearted_Boy",
            "Chinese (Mandarin)_Pure-hearted_Boy",
            "zh-CN",
        ),
        (
            "Chinese (Mandarin)_Soft_Girl",
            "Chinese (Mandarin)_Soft_Girl",
            "zh-CN",
        ),
    ];

    /// 中文（粤语）音色
    pub const CHINESE_CANTONESE: &[(&str, &str, &str)] = &[
        (
            "Cantonese_ProfessionalHost（F)",
            "Cantonese_ProfessionalHost（F)",
            "yue-CN",
        ),
        ("Cantonese_GentleLady", "Cantonese_GentleLady", "yue-CN"),
        (
            "Cantonese_ProfessionalHost（M)",
            "Cantonese_ProfessionalHost（M)",
            "yue-CN",
        ),
        ("Cantonese_PlayfulMan", "Cantonese_PlayfulMan", "yue-CN"),
        ("Cantonese_CuteGirl", "Cantonese_CuteGirl", "yue-CN"),
        ("Cantonese_KindWoman", "Cantonese_KindWoman", "yue-CN"),
    ];

    /// 英文音色
    pub const ENGLISH: &[(&str, &str, &str)] = &[
        ("Santa_Claus", "Santa_Claus", "en-US"),
        ("Grinch", "Grinch", "en-US"),
        ("Rudolph", "Rudolph", "en-US"),
        ("Arnold", "Arnold", "en-US"),
        ("Charming_Santa", "Charming_Santa", "en-US"),
        ("Charming_Lady", "Charming_Lady", "en-US"),
        ("Sweet_Girl", "Sweet_Girl", "en-US"),
        ("Cute_Elf", "Cute_Elf", "en-US"),
        ("Attractive_Girl", "Attractive_Girl", "en-US"),
        ("Serene_Woman", "Serene_Woman", "en-US"),
        (
            "English_Trustworthy_Man",
            "English_Trustworthy_Man",
            "en-US",
        ),
        ("English_Graceful_Lady", "English_Graceful_Lady", "en-US"),
        ("English_Aussie_Bloke", "English_Aussie_Bloke", "en-US"),
        (
            "English_Whispering_girl",
            "English_Whispering_girl",
            "en-US",
        ),
        ("English_Diligent_Man", "English_Diligent_Man", "en-US"),
        (
            "English_Gentle-voiced_man",
            "English_Gentle-voiced_man",
            "en-US",
        ),
    ];

    /// 日文音色
    pub const JAPANESE: &[(&str, &str, &str)] = &[
        (
            "Japanese_IntellectualSenior",
            "Japanese_IntellectualSenior",
            "ja-JP",
        ),
        (
            "Japanese_DecisivePrincess",
            "Japanese_DecisivePrincess",
            "ja-JP",
        ),
        ("Japanese_LoyalKnight", "Japanese_LoyalKnight", "ja-JP"),
        ("Japanese_DominantMan", "Japanese_DominantMan", "ja-JP"),
        (
            "Japanese_SeriousCommander",
            "Japanese_SeriousCommander",
            "ja-JP",
        ),
        ("Japanese_ColdQueen", "Japanese_ColdQueen", "ja-JP"),
        (
            "Japanese_DependableWoman",
            "Japanese_DependableWoman",
            "ja-JP",
        ),
        ("Japanese_GentleButler", "Japanese_GentleButler", "ja-JP"),
        ("Japanese_KindLady", "Japanese_KindLady", "ja-JP"),
        ("Japanese_CalmLady", "Japanese_CalmLady", "ja-JP"),
        (
            "Japanese_OptimisticYouth",
            "Japanese_OptimisticYouth",
            "ja-JP",
        ),
        (
            "Japanese_GenerousIzakayaOwner",
            "Japanese_GenerousIzakayaOwner",
            "ja-JP",
        ),
        ("Japanese_SportyStudent", "Japanese_SportyStudent", "ja-JP"),
        ("Japanese_InnocentBoy", "Japanese_InnocentBoy", "ja-JP"),
        (
            "Japanese_GracefulMaiden",
            "Japanese_GracefulMaiden",
            "ja-JP",
        ),
    ];

    /// 韩文音色
    pub const KOREAN: &[(&str, &str, &str)] = &[
        ("Korean_SweetGirl", "Korean_SweetGirl", "ko-KR"),
        (
            "Korean_CheerfulBoyfriend",
            "Korean_CheerfulBoyfriend",
            "ko-KR",
        ),
        (
            "Korean_EnchantingSister",
            "Korean_EnchantingSister",
            "ko-KR",
        ),
        ("Korean_ShyGirl", "Korean_ShyGirl", "ko-KR"),
        ("Korean_ReliableSister", "Korean_ReliableSister", "ko-KR"),
        ("Korean_StrictBoss", "Korean_StrictBoss", "ko-KR"),
        ("Korean_SassyGirl", "Korean_SassyGirl", "ko-KR"),
        (
            "Korean_ChildhoodFriendGirl",
            "Korean_ChildhoodFriendGirl",
            "ko-KR",
        ),
        ("Korean_PlayboyCharmer", "Korean_PlayboyCharmer", "ko-KR"),
        ("Korean_ElegantPrincess", "Korean_ElegantPrincess", "ko-KR"),
        (
            "Korean_BraveFemaleWarrior",
            "Korean_BraveFemaleWarrior",
            "ko-KR",
        ),
        ("Korean_BraveYouth", "Korean_BraveYouth", "ko-KR"),
        ("Korean_CalmLady", "Korean_CalmLady", "ko-KR"),
        (
            "Korean_EnthusiasticTeen",
            "Korean_EnthusiasticTeen",
            "ko-KR",
        ),
        ("Korean_SoothingLady", "Korean_SoothingLady", "ko-KR"),
        (
            "Korean_IntellectualSenior",
            "Korean_IntellectualSenior",
            "ko-KR",
        ),
        ("Korean_LonelyWarrior", "Korean_LonelyWarrior", "ko-KR"),
        ("Korean_MatureLady", "Korean_MatureLady", "ko-KR"),
        ("Korean_InnocentBoy", "Korean_InnocentBoy", "ko-KR"),
        ("Korean_CharmingSister", "Korean_CharmingSister", "ko-KR"),
        ("Korean_AthleticStudent", "Korean_AthleticStudent", "ko-KR"),
        ("Korean_BraveAdventurer", "Korean_BraveAdventurer", "ko-KR"),
        ("Korean_CalmGentleman", "Korean_CalmGentleman", "ko-KR"),
        ("Korean_WiseElf", "Korean_WiseElf", "ko-KR"),
        (
            "Korean_CheerfulCoolJunior",
            "Korean_CheerfulCoolJunior",
            "ko-KR",
        ),
        ("Korean_DecisiveQueen", "Korean_DecisiveQueen", "ko-KR"),
        ("Korean_ColdYoungMan", "Korean_ColdYoungMan", "ko-KR"),
        ("Korean_MysteriousGirl", "Korean_MysteriousGirl", "ko-KR"),
        ("Korean_QuirkyGirl", "Korean_QuirkyGirl", "ko-KR"),
        (
            "Korean_ConsiderateSenior",
            "Korean_ConsiderateSenior",
            "ko-KR",
        ),
        (
            "Korean_CheerfulLittleSister",
            "Korean_CheerfulLittleSister",
            "ko-KR",
        ),
        ("Korean_DominantMan", "Korean_DominantMan", "ko-KR"),
        ("Korean_AirheadedGirl", "Korean_AirheadedGirl", "ko-KR"),
        ("Korean_ReliableYouth", "Korean_ReliableYouth", "ko-KR"),
        (
            "Korean_FriendlyBigSister",
            "Korean_FriendlyBigSister",
            "ko-KR",
        ),
        ("Korean_GentleBoss", "Korean_GentleBoss", "ko-KR"),
        ("Korean_ColdGirl", "Korean_ColdGirl", "ko-KR"),
        ("Korean_HaughtyLady", "Korean_HaughtyLady", "ko-KR"),
        (
            "Korean_CharmingElderSister",
            "Korean_CharmingElderSister",
            "ko-KR",
        ),
        ("Korean_IntellectualMan", "Korean_IntellectualMan", "ko-KR"),
        ("Korean_CaringWoman", "Korean_CaringWoman", "ko-KR"),
        ("Korean_WiseTeacher", "Korean_WiseTeacher", "ko-KR"),
        ("Korean_ConfidentBoss", "Korean_ConfidentBoss", "ko-KR"),
        ("Korean_AthleticGirl", "Korean_AthleticGirl", "ko-KR"),
        ("Korean_PossessiveMan", "Korean_PossessiveMan", "ko-KR"),
        ("Korean_GentleWoman", "Korean_GentleWoman", "ko-KR"),
        ("Korean_CockyGuy", "Korean_CockyGuy", "ko-KR"),
        ("Korean_ThoughtfulWoman", "Korean_ThoughtfulWoman", "ko-KR"),
        ("Korean_OptimisticYouth", "Korean_OptimisticYouth", "ko-KR"),
    ];

    /// 西班牙文音色
    pub const SPANISH: &[(&str, &str, &str)] = &[
        ("Spanish_SereneWoman", "Spanish_SereneWoman", "es-ES"),
        ("Spanish_MaturePartner", "Spanish_MaturePartner", "es-ES"),
        (
            "Spanish_CaptivatingStoryteller",
            "Spanish_CaptivatingStoryteller",
            "es-ES",
        ),
        ("Spanish_Narrator", "Spanish_Narrator", "es-ES"),
        ("Spanish_WiseScholar", "Spanish_WiseScholar", "es-ES"),
        (
            "Spanish_Kind-heartedGirl",
            "Spanish_Kind-heartedGirl",
            "es-ES",
        ),
        (
            "Spanish_DeterminedManager",
            "Spanish_DeterminedManager",
            "es-ES",
        ),
        ("Spanish_BossyLeader", "Spanish_BossyLeader", "es-ES"),
        (
            "Spanish_ReservedYoungMan",
            "Spanish_ReservedYoungMan",
            "es-ES",
        ),
        ("Spanish_ConfidentWoman", "Spanish_ConfidentWoman", "es-ES"),
        ("Spanish_ThoughtfulMan", "Spanish_ThoughtfulMan", "es-ES"),
        (
            "Spanish_Strong-WilledBoy",
            "Spanish_Strong-WilledBoy",
            "es-ES",
        ),
        (
            "Spanish_SophisticatedLady",
            "Spanish_SophisticatedLady",
            "es-ES",
        ),
        ("Spanish_RationalMan", "Spanish_RationalMan", "es-ES"),
        ("Spanish_AnimeCharacter", "Spanish_AnimeCharacter", "es-ES"),
        ("Spanish_Deep-tonedMan", "Spanish_Deep-tonedMan", "es-ES"),
        ("Spanish_Fussyhostess", "Spanish_Fussyhostess", "es-ES"),
        ("Spanish_SincereTeen", "Spanish_SincereTeen", "es-ES"),
        ("Spanish_FrankLady", "Spanish_FrankLady", "es-ES"),
        ("Spanish_Comedian", "Spanish_Comedian", "es-ES"),
        ("Spanish_Debator", "Spanish_Debator", "es-ES"),
        ("Spanish_ToughBoss", "Spanish_ToughBoss", "es-ES"),
        ("Spanish_Wiselady", "Spanish_Wiselady", "es-ES"),
        ("Spanish_Steadymentor", "Spanish_Steadymentor", "es-ES"),
        ("Spanish_Jovialman", "Spanish_Jovialman", "es-ES"),
        ("Spanish_SantaClaus", "Spanish_SantaClaus", "es-ES"),
        ("Spanish_Rudolph", "Spanish_Rudolph", "es-ES"),
        ("Spanish_Intonategirl", "Spanish_Intonategirl", "es-ES"),
        ("Spanish_Arnold", "Spanish_Arnold", "es-ES"),
        ("Spanish_Ghost", "Spanish_Ghost", "es-ES"),
        ("Spanish_HumorousElder", "Spanish_HumorousElder", "es-ES"),
        ("Spanish_EnergeticBoy", "Spanish_EnergeticBoy", "es-ES"),
        ("Spanish_WhimsicalGirl", "Spanish_WhimsicalGirl", "es-ES"),
        ("Spanish_StrictBoss", "Spanish_StrictBoss", "es-ES"),
        ("Spanish_ReliableMan", "Spanish_ReliableMan", "es-ES"),
        ("Spanish_SereneElder", "Spanish_SereneElder", "es-ES"),
        ("Spanish_AngryMan", "Spanish_AngryMan", "es-ES"),
        ("Spanish_AssertiveQueen", "Spanish_AssertiveQueen", "es-ES"),
        (
            "Spanish_CaringGirlfriend",
            "Spanish_CaringGirlfriend",
            "es-ES",
        ),
        (
            "Spanish_PowerfulSoldier",
            "Spanish_PowerfulSoldier",
            "es-ES",
        ),
        (
            "Spanish_PassionateWarrior",
            "Spanish_PassionateWarrior",
            "es-ES",
        ),
        ("Spanish_ChattyGirl", "Spanish_ChattyGirl", "es-ES"),
        (
            "Spanish_RomanticHusband",
            "Spanish_RomanticHusband",
            "es-ES",
        ),
        ("Spanish_CompellingGirl", "Spanish_CompellingGirl", "es-ES"),
        (
            "Spanish_PowerfulVeteran",
            "Spanish_PowerfulVeteran",
            "es-ES",
        ),
        (
            "Spanish_SensibleManager",
            "Spanish_SensibleManager",
            "es-ES",
        ),
        ("Spanish_ThoughtfulLady", "Spanish_ThoughtfulLady", "es-ES"),
    ];

    /// 葡萄牙文音色
    pub const PORTUGUESE: &[(&str, &str, &str)] = &[
        (
            "Portuguese_SentimentalLady",
            "Portuguese_SentimentalLady",
            "pt-PT",
        ),
        ("Portuguese_BossyLeader", "Portuguese_BossyLeader", "pt-PT"),
        ("Portuguese_Wiselady", "Portuguese_Wiselady", "pt-PT"),
        (
            "Portuguese_Strong-WilledBoy",
            "Portuguese_Strong-WilledBoy",
            "pt-PT",
        ),
        (
            "Portuguese_Deep-VoicedGentleman",
            "Portuguese_Deep-VoicedGentleman",
            "pt-PT",
        ),
        ("Portuguese_UpsetGirl", "Portuguese_UpsetGirl", "pt-PT"),
        (
            "Portuguese_PassionateWarrior",
            "Portuguese_PassionateWarrior",
            "pt-PT",
        ),
        (
            "Portuguese_AnimeCharacter",
            "Portuguese_AnimeCharacter",
            "pt-PT",
        ),
        (
            "Portuguese_ConfidentWoman",
            "Portuguese_ConfidentWoman",
            "pt-PT",
        ),
        ("Portuguese_AngryMan", "Portuguese_AngryMan", "pt-PT"),
        (
            "Portuguese_CaptivatingStoryteller",
            "Portuguese_CaptivatingStoryteller",
            "pt-PT",
        ),
        ("Portuguese_Godfather", "Portuguese_Godfather", "pt-PT"),
        (
            "Portuguese_ReservedYoungMan",
            "Portuguese_ReservedYoungMan",
            "pt-PT",
        ),
        (
            "Portuguese_SmartYoungGirl",
            "Portuguese_SmartYoungGirl",
            "pt-PT",
        ),
        (
            "Portuguese_Kind-heartedGirl",
            "Portuguese_Kind-heartedGirl",
            "pt-PT",
        ),
        ("Portuguese_Pompouslady", "Portuguese_Pompouslady", "pt-PT"),
        ("Portuguese_Grinch", "Portuguese_Grinch", "pt-PT"),
        ("Portuguese_Debator", "Portuguese_Debator", "pt-PT"),
        ("Portuguese_SweetGirl", "Portuguese_SweetGirl", "pt-PT"),
        (
            "Portuguese_AttractiveGirl",
            "Portuguese_AttractiveGirl",
            "pt-PT",
        ),
        (
            "Portuguese_ThoughtfulMan",
            "Portuguese_ThoughtfulMan",
            "pt-PT",
        ),
        ("Portuguese_PlayfulGirl", "Portuguese_PlayfulGirl", "pt-PT"),
        (
            "Portuguese_GorgeousLady",
            "Portuguese_GorgeousLady",
            "pt-PT",
        ),
        ("Portuguese_LovelyLady", "Portuguese_LovelyLady", "pt-PT"),
        ("Portuguese_SereneWoman", "Portuguese_SereneWoman", "pt-PT"),
        ("Portuguese_SadTeen", "Portuguese_SadTeen", "pt-PT"),
        (
            "Portuguese_MaturePartner",
            "Portuguese_MaturePartner",
            "pt-PT",
        ),
        ("Portuguese_Comedian", "Portuguese_Comedian", "pt-PT"),
        (
            "Portuguese_NaughtySchoolgirl",
            "Portuguese_NaughtySchoolgirl",
            "pt-PT",
        ),
        ("Portuguese_Narrator", "Portuguese_Narrator", "pt-PT"),
        ("Portuguese_ToughBoss", "Portuguese_ToughBoss", "pt-PT"),
        (
            "Portuguese_Fussyhostess",
            "Portuguese_Fussyhostess",
            "pt-PT",
        ),
        ("Portuguese_Dramatist", "Portuguese_Dramatist", "pt-PT"),
        (
            "Portuguese_Steadymentor",
            "Portuguese_Steadymentor",
            "pt-PT",
        ),
        ("Portuguese_Jovialman", "Portuguese_Jovialman", "pt-PT"),
        (
            "Portuguese_CharmingQueen",
            "Portuguese_CharmingQueen",
            "pt-PT",
        ),
        ("Portuguese_SantaClaus", "Portuguese_SantaClaus", "pt-PT"),
        ("Portuguese_Rudolph", "Portuguese_Rudolph", "pt-PT"),
        ("Portuguese_Arnold", "Portuguese_Arnold", "pt-PT"),
        (
            "Portuguese_CharmingSanta",
            "Portuguese_CharmingSanta",
            "pt-PT",
        ),
        (
            "Portuguese_CharmingLady",
            "Portuguese_CharmingLady",
            "pt-PT",
        ),
        ("Portuguese_Ghost", "Portuguese_Ghost", "pt-PT"),
        (
            "Portuguese_HumorousElder",
            "Portuguese_HumorousElder",
            "pt-PT",
        ),
        ("Portuguese_CalmLeader", "Portuguese_CalmLeader", "pt-PT"),
        (
            "Portuguese_GentleTeacher",
            "Portuguese_GentleTeacher",
            "pt-PT",
        ),
        (
            "Portuguese_EnergeticBoy",
            "Portuguese_EnergeticBoy",
            "pt-PT",
        ),
        ("Portuguese_ReliableMan", "Portuguese_ReliableMan", "pt-PT"),
        ("Portuguese_SereneElder", "Portuguese_SereneElder", "pt-PT"),
        ("Portuguese_GrimReaper", "Portuguese_GrimReaper", "pt-PT"),
        (
            "Portuguese_AssertiveQueen",
            "Portuguese_AssertiveQueen",
            "pt-PT",
        ),
        (
            "Portuguese_WhimsicalGirl",
            "Portuguese_WhimsicalGirl",
            "pt-PT",
        ),
        (
            "Portuguese_StressedLady",
            "Portuguese_StressedLady",
            "pt-PT",
        ),
        (
            "Portuguese_FriendlyNeighbor",
            "Portuguese_FriendlyNeighbor",
            "pt-PT",
        ),
        (
            "Portuguese_CaringGirlfriend",
            "Portuguese_CaringGirlfriend",
            "pt-PT",
        ),
        (
            "Portuguese_PowerfulSoldier",
            "Portuguese_PowerfulSoldier",
            "pt-PT",
        ),
        (
            "Portuguese_FascinatingBoy",
            "Portuguese_FascinatingBoy",
            "pt-PT",
        ),
        (
            "Portuguese_RomanticHusband",
            "Portuguese_RomanticHusband",
            "pt-PT",
        ),
        ("Portuguese_StrictBoss", "Portuguese_StrictBoss", "pt-PT"),
        (
            "Portuguese_InspiringLady",
            "Portuguese_InspiringLady",
            "pt-PT",
        ),
        (
            "Portuguese_PlayfulSpirit",
            "Portuguese_PlayfulSpirit",
            "pt-PT",
        ),
        ("Portuguese_ElegantGirl", "Portuguese_ElegantGirl", "pt-PT"),
        (
            "Portuguese_CompellingGirl",
            "Portuguese_CompellingGirl",
            "pt-PT",
        ),
        (
            "Portuguese_PowerfulVeteran",
            "Portuguese_PowerfulVeteran",
            "pt-PT",
        ),
        (
            "Portuguese_SensibleManager",
            "Portuguese_SensibleManager",
            "pt-PT",
        ),
        (
            "Portuguese_ThoughtfulLady",
            "Portuguese_ThoughtfulLady",
            "pt-PT",
        ),
        (
            "Portuguese_TheatricalActor",
            "Portuguese_TheatricalActor",
            "pt-PT",
        ),
        ("Portuguese_FragileBoy", "Portuguese_FragileBoy", "pt-PT"),
        ("Portuguese_ChattyGirl", "Portuguese_ChattyGirl", "pt-PT"),
        (
            "Portuguese_Conscientiousinstructor",
            "Portuguese_Conscientiousinstructor",
            "pt-PT",
        ),
        ("Portuguese_RationalMan", "Portuguese_RationalMan", "pt-PT"),
        ("Portuguese_WiseScholar", "Portuguese_WiseScholar", "pt-PT"),
        ("Portuguese_FrankLady", "Portuguese_FrankLady", "pt-PT"),
        (
            "Portuguese_DeterminedManager",
            "Portuguese_DeterminedManager",
            "pt-PT",
        ),
    ];

    /// 法文音色
    pub const FRENCH: &[(&str, &str, &str)] = &[
        ("French_Male_Speech_New", "French_Male_Speech_New", "fr-FR"),
        (
            "French_Female_News Anchor",
            "French_Female_News Anchor",
            "fr-FR",
        ),
        ("French_CasualMan", "French_CasualMan", "fr-FR"),
        ("French_MovieLeadFemale", "French_MovieLeadFemale", "fr-FR"),
        ("French_FemaleAnchor", "French_FemaleAnchor", "fr-FR"),
        ("French_MaleNarrator", "French_MaleNarrator", "fr-FR"),
    ];

    /// 印尼文音色
    pub const INDONESIAN: &[(&str, &str, &str)] = &[
        ("Indonesian_SweetGirl", "Indonesian_SweetGirl", "id-ID"),
        (
            "Indonesian_ReservedYoungMan",
            "Indonesian_ReservedYoungMan",
            "id-ID",
        ),
        (
            "Indonesian_CharmingGirl",
            "Indonesian_CharmingGirl",
            "id-ID",
        ),
        ("Indonesian_CalmWoman", "Indonesian_CalmWoman", "id-ID"),
        (
            "Indonesian_ConfidentWoman",
            "Indonesian_ConfidentWoman",
            "id-ID",
        ),
        ("Indonesian_CaringMan", "Indonesian_CaringMan", "id-ID"),
        ("Indonesian_BossyLeader", "Indonesian_BossyLeader", "id-ID"),
        (
            "Indonesian_DeterminedBoy",
            "Indonesian_DeterminedBoy",
            "id-ID",
        ),
        ("Indonesian_GentleGirl", "Indonesian_GentleGirl", "id-ID"),
    ];

    /// 德文音色
    pub const GERMAN: &[(&str, &str, &str)] = &[
        ("German_FriendlyMan", "German_FriendlyMan", "de-DE"),
        ("German_SweetLady", "German_SweetLady", "de-DE"),
        ("German_PlayfulMan", "German_PlayfulMan", "de-DE"),
    ];

    /// 俄文音色
    pub const RUSSIAN: &[(&str, &str, &str)] = &[
        (
            "Russian_HandsomeChildhoodFriend",
            "Russian_HandsomeChildhoodFriend",
            "ru-RU",
        ),
        ("Russian_BrightHeroine", "Russian_BrightHeroine", "ru-RU"),
        ("Russian_AmbitiousWoman", "Russian_AmbitiousWoman", "ru-RU"),
        ("Russian_ReliableMan", "Russian_ReliableMan", "ru-RU"),
        ("Russian_CrazyQueen", "Russian_CrazyQueen", "ru-RU"),
        (
            "Russian_PessimisticGirl",
            "Russian_PessimisticGirl",
            "ru-RU",
        ),
        ("Russian_AttractiveGuy", "Russian_AttractiveGuy", "ru-RU"),
        (
            "Russian_Bad-temperedBoy",
            "Russian_Bad-temperedBoy",
            "ru-RU",
        ),
    ];

    /// 意大利文音色
    pub const ITALIAN: &[(&str, &str, &str)] = &[
        ("Italian_BraveHeroine", "Italian_BraveHeroine", "it-IT"),
        ("Italian_Narrator", "Italian_Narrator", "it-IT"),
        (
            "Italian_WanderingSorcerer",
            "Italian_WanderingSorcerer",
            "it-IT",
        ),
        ("Italian_DiligentLeader", "Italian_DiligentLeader", "it-IT"),
    ];

    /// 其他语言音色合集
    pub const OTHER: &[(&str, &str, &str)] = &[
        ("Arabic_CalmWoman", "Arabic_CalmWoman", "ar-SA"),
        ("Arabic_FriendlyGuy", "Arabic_FriendlyGuy", "ar-SA"),
        ("Turkish_CalmWoman", "Turkish_CalmWoman", "tr-TR"),
        ("Turkish_Trustworthyman", "Turkish_Trustworthyman", "tr-TR"),
        ("Ukrainian_CalmWoman", "Ukrainian_CalmWoman", "uk-UA"),
        ("Ukrainian_WiseScholar", "Ukrainian_WiseScholar", "uk-UA"),
        ("Dutch_kindhearted_girl", "Dutch_kindhearted_girl", "nl-NL"),
        ("Dutch_bossy_leader", "Dutch_bossy_leader", "nl-NL"),
        (
            "Vietnamese_kindhearted_girl",
            "Vietnamese_kindhearted_girl",
            "vi-VN",
        ),
        ("Thai_male_1_sample8", "Thai_male_1_sample8", "th-TH"),
        ("Thai_male_2_sample2", "Thai_male_2_sample2", "th-TH"),
        ("Thai_female_1_sample1", "Thai_female_1_sample1", "th-TH"),
        ("Thai_female_2_sample2", "Thai_female_2_sample2", "th-TH"),
        ("Polish_male_1_sample4", "Polish_male_1_sample4", "pl-PL"),
        ("Polish_male_2_sample3", "Polish_male_2_sample3", "pl-PL"),
        (
            "Polish_female_1_sample1",
            "Polish_female_1_sample1",
            "pl-PL",
        ),
        (
            "Polish_female_2_sample3",
            "Polish_female_2_sample3",
            "pl-PL",
        ),
        (
            "Romanian_male_1_sample2",
            "Romanian_male_1_sample2",
            "ro-RO",
        ),
        (
            "Romanian_male_2_sample1",
            "Romanian_male_2_sample1",
            "ro-RO",
        ),
        (
            "Romanian_female_1_sample4",
            "Romanian_female_1_sample4",
            "ro-RO",
        ),
        (
            "Romanian_female_2_sample1",
            "Romanian_female_2_sample1",
            "ro-RO",
        ),
        ("greek_male_1a_v1", "greek_male_1a_v1", "el-GR"),
        ("Greek_female_1_sample1", "Greek_female_1_sample1", "el-GR"),
        ("Greek_female_2_sample3", "Greek_female_2_sample3", "el-GR"),
        ("czech_male_1_v1", "czech_male_1_v1", "cs-CZ"),
        ("czech_female_5_v7", "czech_female_5_v7", "cs-CZ"),
        ("czech_female_2_v2", "czech_female_2_v2", "cs-CZ"),
        ("finnish_male_3_v1", "finnish_male_3_v1", "fi-FI"),
        ("finnish_male_1_v2", "finnish_male_1_v2", "fi-FI"),
        ("finnish_female_4_v1", "finnish_female_4_v1", "fi-FI"),
        ("hindi_male_1_v2", "hindi_male_1_v2", "hi-IN"),
        ("hindi_female_2_v1", "hindi_female_2_v1", "hi-IN"),
        ("hindi_female_1_v2", "hindi_female_1_v2", "hi-IN"),
    ];

    /// 所有音色的迭代器（用于构建完整列表）
    const ALL_GROUPS: &[&[(&str, &str, &str)]] = &[
        CHINESE_MANDARIN,
        CHINESE_CANTONESE,
        ENGLISH,
        JAPANESE,
        KOREAN,
        SPANISH,
        PORTUGUESE,
        FRENCH,
        INDONESIAN,
        GERMAN,
        RUSSIAN,
        ITALIAN,
        OTHER,
    ];

    /// 构建 Minimax 音色列表
    pub fn list_voices() -> Vec<TtsVoice> {
        let mut voices = Vec::new();
        for group in ALL_GROUPS {
            for &(id, name, lang) in *group {
                voices.push(TtsVoice {
                    id: id.to_string(),
                    name: name.to_string(),
                    language: lang.to_string(),
                    gender: None,
                });
            }
        }
        voices
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn test_m1_voices_count() {
            let voices = list_voices();
            assert!(!voices.is_empty());
            // 中文+粤语+英文+日文+韩文+西文+葡文+法文+印尼+德文+俄文+意文+其他
            assert!(
                voices.len() > 100,
                "expected >100 voices, got {}",
                voices.len()
            );
        }

        #[test]
        fn test_m2_default_in_list() {
            let voices = list_voices();
            assert!(voices.iter().any(|v| v.id == DEFAULT_VOICE));
        }

        #[test]
        fn test_m3_chinese_mandarin_not_empty() {
            assert!(!CHINESE_MANDARIN.is_empty());
        }
    }
}

// ============================================================================
// Qwen / CosyVoice 音色
// ============================================================================
pub mod qwen {
    use crate::tts::types::TtsVoice;

    /// 默认模型
    pub const DEFAULT_MODEL: &str = "cosyvoice-v3-flash";
    /// 默认音色
    pub const DEFAULT_VOICE: &str = "longxiaochun_v3";

    /// CosyVoice 模型类型
    pub const TT_MODELS: &[&str] = &[
        "cosyvoice-v1",
        "cosyvoice-v2",
        "cosyvoice-v3-flash",
        "cosyvoice-v3-plus",
    ];

    /// cosyvoice-v1 音色（不支持方言）
    pub const V1_VOICES: &[&str] = &[
        "longwan",
        "longcheng",
        "longhua",
        "longxiaochun",
        "longxiaoxia",
        "longxiaocheng",
        "longxiaobai",
        "longlaotie",
        "longshu",
        "longshuo",
        "longjing",
        "longmiao",
        "longyue",
        "longyuan",
        "longfei",
        "longjielidou",
        "longtong",
        "longxiang",
        "loongstella",
        "loongbella",
    ];

    /// cosyvoice-v2 音色
    pub const V2_VOICES: &[&str] = &[
        "longyingxiao",
        "longjiqi",
        "longhouge",
        "longjixin",
        "longanyue",
        "longshange",
        "longanmin",
        "longdaiyu",
        "longgaoseng",
        "longanli",
        "longanlang",
        "longanwen",
        "longanyun",
        "longyumi_v2",
        "longxiaochun_v2",
        "longxiaoxia_v2",
        "longyichen",
        "longwanjun",
        "longlaobo",
        "longlaoyi",
        "longbaizhi",
        "longsanshu",
        "longxiu_v2",
        "longmiao_v2",
        "longyue_v2",
        "longnan_v2",
        "longyuan_v2",
        "longanqin",
        "longanya",
        "longanshuo",
        "longanling",
        "longanzhi",
        "longanrou",
        "longqiang_v2",
        "longhan_v2",
        "longxing_v2",
        "longhua_v2",
        "longwan_v2",
        "longcheng_v2",
        "longfeifei_v2",
        "longxiaocheng_v2",
        "longzhe_v2",
        "longyan_v2",
        "longtian_v2",
        "longze_v2",
        "longshao_v2",
        "longhao_v2",
        "kabuleshen_v2",
        "longhuhu",
        "longanpei",
        "longwangwang",
        "longpaopao",
        "longshanshan",
        "longniuniu",
        "longyingmu",
        "longyingxun",
        "longyingcui",
        "longyingda",
        "longyingjing",
        "longyingyan",
        "longyingtian",
        "longyingbing",
        "longyingtao",
        "longyingling",
        "longanran",
        "longanxuan",
        "longanchong",
        "longanping",
        "longjielidou_v2",
        "longling_v2",
        "longke_v2",
        "longxian_v2",
        "longlaotie_v2",
        "longjiayi_v2",
        "longtao_v2",
        "longfei_v2",
        "libai_v2",
        "longjin_v2",
        "longshu_v2",
        "loongbella_v2",
        "longshuo_v2",
        "longxiaobai_v2",
        "longjing_v2",
        "loongstella_v2",
        "loongyuuna_v2",
        "loongyuuma_v2",
        "loongjihun_v2",
        "loongeva_v2",
        "loongbrian_v2",
        "loongluna_v2",
        "loongluca_v2",
        "loongemily_v2",
        "loongeric_v2",
        "loongabby_v2",
        "loongannie_v2",
        "loongandy_v2",
        "loongava_v2",
        "loongbeth_v2",
        "loongbetty_v2",
        "loongcindy_v2",
        "loongcally_v2",
        "loongdavid_v2",
        "loongdonna_v2",
        "loongkyong_v2",
        "loongtomoka_v2",
        "loongtomoya_v2",
    ];

    /// cosyvoice-v3-flash 音色
    pub const V3_FLASH_VOICES: &[&str] = &[
        "longanyang",
        "longanhuan",
        "longhuhu_v3",
        "longpaopao_v3",
        "longjielidou_v3",
        "longxian_v3",
        "longling_v3",
        "longshanshan_v3",
        "longniuniu_v3",
        "longjiaxin_v3",
        "longjiayi_v3",
        "longanyue_v3",
        "longlaotie_v3",
        "longshange_v3",
        "longanmin_v3",
        "loongkyong_v3",
        "loongriko_v3",
        "loongtomoka_v3",
        "longfei_v3",
        "longyingxiao_v3",
        "longyingxun_v3",
        "longyingjing_v3",
        "longyingling_v3",
        "longyingtao_v3",
        "longxiaochun_v3",
        "longxiaoxia_v3",
        "longyumi_v3",
        "longanyun_v3",
        "longanwen_v3",
        "longanli_v3",
        "longanlang_v3",
        "longyingmu_v3",
        "longantai_v3",
        "longhua_v3",
        "longcheng_v3",
        "longze_v3",
        "longzhe_v3",
        "longyan_v3",
        "longxing_v3",
        "longtian_v3",
        "longwan_v3",
        "longqiang_v3",
        "longfeifei_v3",
        "longhao_v3",
        "longanrou_v3",
        "longhan_v3",
        "longanzhi_v3",
        "longanling_v3",
        "longanya_v3",
        "longanqin_v3",
        "longmiao_v3",
        "longsanshu_v3",
        "longyuan_v3",
        "longyue_v3",
        "longxiu_v3",
        "longnan_v3",
        "longwanjun_v3",
        "longyichen_v3",
        "longlaobo_v3",
        "longlaoyi_v3",
        "longjiqi_v3",
        "longhouge_v3",
        "longdaiyu_v3",
        "longanran_v3",
        "longanxuan_v3",
        "longshuo_v3",
        "longshu_v3",
        "loongbella_v3",
    ];

    /// cosyvoice-v3-plus 音色
    pub const V3_PLUS_VOICES: &[&str] = &["longanyang", "longanhuan"];

    /// 所有音色的分组名称列表
    pub const ALL_VOICE_NAMES: &[&str] = &[];

    /// 构建 Qwen/CosyVoice 音色列表
    pub fn list_voices_for_model(model: Option<&str>) -> Vec<TtsVoice> {
        let model = model.unwrap_or(DEFAULT_MODEL);
        let voice_names: &[&str] = match model {
            "cosyvoice-v1" => V1_VOICES,
            "cosyvoice-v2" => V2_VOICES,
            "cosyvoice-v3-plus" => V3_PLUS_VOICES,
            _ => V3_FLASH_VOICES, // v3-flash 作为默认
        };
        voice_names
            .iter()
            .map(|&name| TtsVoice {
                id: name.to_string(),
                name: name.to_string(),
                language: "zh-CN".to_string(),
                gender: None,
            })
            .collect()
    }

    /// 列出所有 CosyVoice 音色（所有模型版本合集）
    pub fn list_voices() -> Vec<TtsVoice> {
        let mut voices: Vec<TtsVoice> = Vec::new();
        for &name in V1_VOICES
            .iter()
            .chain(V2_VOICES.iter())
            .chain(V3_FLASH_VOICES.iter())
            .chain(V3_PLUS_VOICES.iter())
        {
            voices.push(TtsVoice {
                id: name.to_string(),
                name: name.to_string(),
                language: "zh-CN".to_string(),
                gender: None,
            });
        }
        voices
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn test_q1_v1_voices_count() {
            assert_eq!(V1_VOICES.len(), 20);
        }

        #[test]
        fn test_q2_v2_voices_count() {
            assert!(V2_VOICES.len() > 80);
        }

        #[test]
        fn test_q3_v3_flash_count() {
            assert!(V3_FLASH_VOICES.len() > 60);
        }

        #[test]
        fn test_q4_default_in_list() {
            let voices = list_voices();
            assert!(voices.iter().any(|v| v.id == DEFAULT_VOICE));
        }

        #[test]
        fn test_q5_list_for_model() {
            let v1 = list_voices_for_model(Some("cosyvoice-v1"));
            assert_eq!(v1.len(), V1_VOICES.len());

            let v3 = list_voices_for_model(Some("cosyvoice-v3-flash"));
            assert_eq!(v3.len(), V3_FLASH_VOICES.len());
        }

        #[test]
        fn test_q6_all_models() {
            for m in TT_MODELS {
                let voices = list_voices_for_model(Some(m));
                assert!(!voices.is_empty(), "model {m} should have voices");
            }
        }
    }
}

// ============================================================================
// Qwen Realtime TTS 音色
// ============================================================================
pub mod qwen_realtime {
    use crate::tts::types::TtsVoice;

    /// 默认音色
    pub const DEFAULT_VOICE: &str = "Cherry";

    /// Qwen Realtime TTS 全部音色
    pub const ALL: &[(&str, &str, &str)] = &[
        ("Cherry", "Cherry", "en-US"),
        ("Serena", "Serena", "en-US"),
        ("Ethan", "Ethan", "en-US"),
        ("Chelsie", "Chelsie", "en-US"),
        ("Momo", "Momo", "en-US"),
        ("Vivian", "Vivian", "en-US"),
        ("Moon", "Moon", "en-US"),
        ("Maia", "Maia", "en-US"),
        ("Kai", "Kai", "en-US"),
        ("Nofish", "Nofish", "en-US"),
        ("Bella", "Bella", "en-US"),
        ("Jennifer", "Jennifer", "en-US"),
        ("Ryan", "Ryan", "en-US"),
        ("Katerina", "Katerina", "en-US"),
        ("Aiden", "Aiden", "en-US"),
        ("Eldric Sage", "Eldric Sage", "en-US"),
        ("Mia", "Mia", "en-US"),
        ("Mochi", "Mochi", "en-US"),
        ("Bellona", "Bellona", "en-US"),
        ("Vincent", "Vincent", "en-US"),
        ("Bunny", "Bunny", "en-US"),
        ("Neil", "Neil", "en-US"),
        ("Elias", "Elias", "en-US"),
        ("Arthur", "Arthur", "en-US"),
        ("Nini", "Nini", "en-US"),
        ("Seren", "Seren", "en-US"),
        ("Pip", "Pip", "en-US"),
        ("Stella", "Stella", "en-US"),
        ("Bodega", "Bodega", "en-US"),
        ("Sonrisa", "Sonrisa", "en-US"),
        ("Alek", "Alek", "en-US"),
        ("Dolce", "Dolce", "en-US"),
        ("Sohee", "Sohee", "en-US"),
        ("Ono Anna", "Ono Anna", "en-US"),
        ("Lenn", "Lenn", "en-US"),
        ("Emilien", "Emilien", "en-US"),
        ("Andre", "Andre", "en-US"),
        ("Radio Gol", "Radio Gol", "en-US"),
        ("Jada", "Jada", "en-US"),
        ("Dylan", "Dylan", "en-US"),
        ("Li", "Li", "en-US"),
        ("Marcus", "Marcus", "en-US"),
        ("Roy", "Roy", "en-US"),
        ("Peter", "Peter", "en-US"),
        ("Sunny", "Sunny", "en-US"),
        ("Eric", "Eric", "en-US"),
        ("Rocky", "Rocky", "en-US"),
        ("Kiki", "Kiki", "en-US"),
    ];

    /// 构建 Qwen Realtime TTS 音色列表
    pub fn list_voices() -> Vec<TtsVoice> {
        ALL.iter()
            .map(|&(id, name, lang)| TtsVoice {
                id: id.to_string(),
                name: name.to_string(),
                language: lang.to_string(),
                gender: None,
            })
            .collect()
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn test_r1_voices_count() {
            let voices = list_voices();
            assert_eq!(voices.len(), 48);
        }

        #[test]
        fn test_r2_default_in_list() {
            let voices = list_voices();
            assert!(voices.iter().any(|v| v.id == DEFAULT_VOICE));
        }
    }
}
