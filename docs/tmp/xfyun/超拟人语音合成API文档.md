超拟人语音合成API文档
#接口说明
接口支持双向流式通信，即流式的方式输入文本，并流式获取文本合成的音频流。
在同一个会话中可以分段多次发送文本并获得音频，合成的音频可以实时播放并且具有低延迟的特点；适用于大语言模型的逐字输入型、流式文本入参形式的场景。

官网套餐按照字符调用量进行授权。授权字符总量，一个汉字、英文字母（无论大小写）、阿拉伯数字、标点符号（如逗号、句号、问号等）、空格及回车符，均分别计为一个字符。
面向高调用量业务场景，新增并发计费售卖套餐，不限制字符使用总量，仅对并发数进行限制，按需选购更灵活，点击咨询详情 。
注意：测试或正式使用前，请去对应产品页面获取免费额度或下单购买正式套餐；同时需要去控制台服务页面，获取API有效密钥（AppID、APIKey、APISecret）后再调用。
超拟人语音合成产品页面
超拟人语音合成服务页

#接口调用示例
部分开发语言Demo如下，其他开发语言请参照文档进行开发，欢迎大家到讯飞开放平台社区 交流集成经验。
技术咨询可直接提交工单

超拟人合成 Python demo

超拟人合成 Java demo

#接口与鉴权
#请求示例
调用地址

wss://cbm01.cn-huabei-1.xf-yun.com/v1/private/mcd9m97e6
鉴权示例代码（Python）

# build websocket auth request url
def assemble_ws_auth_url(requset_url, method="GET", api_key="", api_secret=""):
    u = parse_url(requset_url)
    host = u.host
    path = u.path
    now = datetime.now()
    date = format_date_time(mktime(now.timetuple()))
    print(date)
    # date = "Thu, 12 Dec 2019 01:57:27 GMT"
    signature_origin = "host: {}\ndate: {}\n{} {} HTTP/1.1".format(host, date, method, path)
    print(signature_origin)
    signature_sha = hmac.new(api_secret.encode('utf-8'), signature_origin.encode('utf-8'),
                             digestmod=hashlib.sha256).digest()
    signature_sha = base64.b64encode(signature_sha).decode(encoding='utf-8')
    authorization_origin = "api_key=\"%s\", algorithm=\"%s\", headers=\"%s\", signature=\"%s\"" % (
        api_key, "hmac-sha256", "host date request-line", signature_sha)
    authorization = base64.b64encode(authorization_origin.encode('utf-8')).decode(encoding='utf-8')
    print(authorization_origin)
    values = {
        "host": host,
        "date": date,
        "authorization": authorization
    }

    return requset_url + "?" + urlencode(values)
Note:

详细鉴权参考: ws接口鉴权
请求体示例
{
    "header": {
        "app_id": "123456",
        "status": 2,
    },
    "parameter": {
        "oral": {
            "oral_level":"mid"
        },
        "tts": {
            "vcn": "x5_lingfeiyi_flow",//参考发音人列表，正式调用前需要在控制台开通对应发音人的权限
            "speed": 50,
            "volume": 50,
            "pitch": 50,
            "bgs": 0,
            "reg": 0,
            "rdn": 0,
            "rhy": 0,
            "audio": {
                "encoding": "lame",
                "sample_rate": 24000,
                "channels": 1,
                "bit_depth": 16,
                "frame_size": 0
            }
        }
    },
    "payload": {
        "text": {
            "encoding": "utf8",
            "compress": "raw",
            "format": "plain",
            "status": 2,
            "seq": 0,
            "text": "xxxxxxx"
        }
    }
}

协议结构说明

字段	含义	类型	说明	是否必传
header	协议头部	Object	协议头部，用于描述平台特性的参数	是
parameter	能力参数	Object	AI 能力功能参数，用于控制 AI 引擎特性的开关。	是
parameter.oral	服务别名	Object	oral能力功能参数	是
parameter.tts	服务别名	Object	tts能力功能参数	是
parameter.tts.audio	期望输出	Object	期望输出	是
payload	输入数据段	Object	数据段，携带请求的数据。	是
payload.text	输入数据	Object	待合成文本	是
header参数

字段	含义	类型	限制	是否必传
app_id	在平台申请的app id信息	string	"maxLength":50	是
status	请求状态，可选值为：0:开始, 1:中间, 2:结束	int	0,1,2	是
口语化配置参数 parameter.oral
注意：发音人列表 中，仅x4系列发音人支持parameter.oral部分的口语化配置参数

功能标识	功能描述	数据类型	取值范围	必填	默认值
oral_level	口语化等级	string	高:high, 中:mid, 低:low	否	mid
spark_assist	是否通过大模型进行口语化	int	开启:1, 关闭:0	否	1
stop_split	关闭服务端拆句	int	不关闭：0，关闭：1	否	0
remain	是否保留原书面语的样子	int	保留:1, 不保留:0	否	0
remain=1, 保留书面语，即移除所有新增填充语、重复语、语气词和话语符号，保留原书面语的样子。
remain=0, 不保留书面语，即包含所有新增填充语、重复语、语气词和话语符号，不保留原书面语的样子。

功能参数 parameter.tts

功能标识	功能描述	数据类型	必填	默认值
vcn	发音人参数，具体可参考发音人列表	string	是	x5_lingxiaoxuan_flow
watermask	音频显性水印，0:无音频显性水印，1:显性水印插到句首，2:显性水印插到句尾	int	否	0
implicit_watermark	音频隐性水印（仅合成mp3音频时支持），true:音频隐性水印打开,false:音频隐性水印关闭	boolean	否	false
speed	语速：0对应默认语速的1/2，100对应默认语速的2倍	int	否	50
volume	音量：0是静音，1对应默认音量1/2，100对应默认音量的2倍	int	否	50
pitch	语调：0对应默认语调的1/2，100对应默认语调的2倍	int	否	50
bgs	背景音：0无背景音（默认值），1有背景音	int	否	0
reg	英文发音方式，0:自动判断处理，如果不确定将按照英文词语拼写处理（缺省）, 1:所有英文按字母发音, 2:自动判断处理，如果不确定将按照字母朗读	int	否	0
rdn	合成音频数字发音方式，0:自动判断, 1:完全数值, 2:完全字符串, 3:字符串优先	int	否	0
rhy	是否返回拼音标注，0:不返回拼音, 1:返回拼音（纯文本格式，utf8编码）	int	否	0
音频格式控制参数 parameter.tts.audio

字段	含义	数据类型	取值范围	默认值	说明	必填
encoding	音频编码	string	raw,lame, speex, opus, opus-wb, opus-swb, speex-wb	speex-wb	音频编码，可枚举	否
sample_rate	采样率	int	16000, 8000, 24000	24000	音频采样率，可枚举	否
channels	声道数	int	1	1	声道数	否
bit_depth	位深	int	16	16	单位bit	否
frame_size	帧大小	int	最小值:0, 最大值:1024	0	帧大小，默认0	否
推荐使用 lame、raw编解码格式（lame对应mp3格式音频，raw对应pcm格式音频），24000的采样率。

请求数据

字段	含义	数据类型	取值范围	默认值	说明	必填
encoding	文本编码	string	utf8	utf8	必须是 utf8	是
compress	文本压缩格式	string	raw	raw	取值范围可枚举	是
format	文本格式	string	plain, json	plain	取值范围可枚举	是
status	数据状态	int	0:开始, 1:中间, 2:结束		0,1,2 流式传输 (一次性合成直接传2)	是
seq	数据序号	int	最小值:0, 最大值:9999999		数据序号，比如1,2,3,4...	是
text	单次发送文本数据，注：接口支持双向流式通信，在同一个会话中可以分段多次发送文本	string	具体参考流式合成对输入文本的要求			是

#响应示例
响应体
{
    "header": {
        "code": 0,
        "message": "success",
        "sid": "aso000ede92@dx18caf514baab832882",
        "status": 1
    },
    "payload": {
        "audio": {
            "encoding": "lame",
            "sample_rate": 24000,
            "channels": 1,
            "bit_depth": 16,
            "status": 0,
            "seq": 0,
            "frame_size": 0,
            "audio": "xxxxx",
        },
        "pybuf": {
            "encoding": "utf8",
            "compress": "raw",
            "format": "plain",
            "status": 0,
            "seq": 0,
            "text": "xxxxx"
        }
    }
}

返回结构说明

字段	含义	类型	说明
header	协议头部	Object	协议头部，用于描述平台特性的参数
payload	响应数据块	Object	数据段，携带响应的数据。
audio	响应数据块	Object	输出数据
pybuf	响应数据块	Object	输出数据
header参数

字段	含义	类型
code	返回码，0表示成功，其它表示异常	int
message	错误描述	string
sid	本次会话的id	string
payload.audio响应数据参数

字段	含义	数据类型	取值范围	默认值	说明
encoding	音频编码	string	lame, raw	--	--
sample_rate	采样率	int	16000, 8000, 24000	24000	音频采样率，可枚举
channels	声道数	int	1	1	声道数
bit_depth	位深	int	16	16	单位bit
status	数据状态	int	0:开始, 1:中间, 2:结束		流式传输
seq	数据序号	int	最小值:0, 最大值:9999999	0	标明数据为第几块
audio	base64编码后的音频数据	string	最小尺寸:0B, 最大尺寸:10485760B		音频大小：0-10M
frame_size	帧大小	int	最小值:0, 最大值:1024	0	帧大小，默认0
ced	合成音频对应的文本进度	string	xxx		ced的单位是字节
pybuf, 当 rhy = 1 时返回。

字段	含义	数据类型	取值范围	默认值	说明
encoding	文本编码	string	utf8	utf8	--
compress	文本压缩格式	string	raw	raw	--
format	文本格式	string	plain, json	plain	--
status	数据状态	int	0:开始, 1:中间, 2:结束(一次性合成直接传2)		流式传输
seq	数据序号	int	最小值:0, 最大值:9999999		数据序号
text	base64编码后的文本数据	string	最小尺寸:0B, 最大尺寸:1048576B		文本大小：0-1M
text解码后的数据包含音素信息。注：如果文本中包含英文，英文音素目前不带声调信息；音素时长的单位是5毫秒。

例如：输入的待合成的文本”科大讯飞语音合成系统“，text解码后得到信息如下

sil:6;欢[=huan1]-h1:16;@-uan1:24;迎[=ying2]-ing2:20;使[=shi3]-sh3:24;@-iii3:14;用[=yong4]-iong4:24;科[=ke1]-k1:20;@-e1:14;大[=da4]-d4:12;@-a4:24;讯[=xun4]-x4:22;@-vn4:20;飞[=fei1]-f1:16;@-ei1:22;语[=yu3]-v3:32;音[=yin1]-in1:26;合[=he2]-h2:26;@-e2:18;成[=cheng2]-ch2:18;@-eng2:14;系[=xi4]-x4:20;@-i4:12;统[=tong3]*-t3:20;@-ong3:12;sil:82;

符号	解释
;	音素分割符，将不同的音素分割开
:	音素时长分割符，后的数字为该音素的帧数（目前1帧代表5ms）。例如"sil:8"表示音素sil的发音时长为8*5=40毫秒
-	音节分割符，将音素和该音素对应的音节分割开。例如"欢[=huan1]-h1:16"中‘-’之后的"h1"表示音素
@	表示当前音素和前一个是一个文本
*	L1韵律的分割符。L1韵律分割符放在音节信息后面。
[]	音节信息。例如"科"--->[=ke1]是该音素对应的音节和词。
sil	表示句首和句末的清音, sil不带声调信息
sp	是句中的清音, sp的声调信息和前一个音素一致
{}	保留字段，例如{0：147}，可忽略

#流式合成对输入文本的要求
#流式合成的特点
每个语音合成请求的文本并非一次性完整输入，而是分多次流式输入，但引擎输出的语音能依然保持流畅连贯，更适配上游LLM的流式输出。同时能达到降低语音系统首次响应时间的要求。

#流式输入时的首响
针对用户的流式文本输入，首次合成的时机有如下两种情况：1.满足最低文本长度，要求输入文本大于10个字；2. 不满足最低长度要求，但是输入文本结束。如：

“你好！”：收到输入结束标志即开始合成。
“欢迎来到科大讯飞股份有限公司”：见到第11个字开始进行合成。 在满足以上开始合成时机的情况下，记时刻为T0；接受到返回的首帧音频的时间，记为T1；则实际引擎推理的首次响应时间（首响）=T1-T0。 因此，当T0越小时，T1也越小。端到端感受音频返回越快
#对输入文本的要求
文本输入速度：文本输入的实时速率必须大于15字（词）每秒，否则可能会导致合成音频卡顿。
文本总长度：流式输入的待合成文本的总字节数（不含输入协议中的字段字符、控制字符等）不能超过 64K。
文本内容：用户输入的文本中不含制表符\t, emoj符号，不可见字符，html, markdwon等格式控制字符。用户流式输入的文本经过拼接后，应当语义完整、连贯，便于播报。
#发音人列表
正式调用前，需要在控制台 开通对应的发音人权限
注意：
1、以下列表仅展示最新版发音人，音质更自然、表现力更强，推荐升级至最新版本，以获得更优质的语音合成体验
2、仅x4系列发音人支持parameter.oral部分的口语化配置参数 3、聆小糖、Grant、Lila发音人暂不支持音频显性标识

姓名	vcn	性别	语言	场景推荐
温暖磁性男声	x6_wennuancixingnansheng_mini	成年男	中文普通话	角色配音
小奶狗弟弟	x6_xiaonaigoudidi_mini	成年男	中文普通话	角色配音
士兵女声	x6_shibingnvsheng_mini	成年女	中文普通话	角色配音
恐怖女声	x6_kongbunvsheng_mini	成年女	中文普通话	旁白配音_悬疑恐怖
娱乐新闻女声	x6_yulexinwennvsheng_mini	成年女	中文普通话	娱乐新闻
温柔男声	x6_wenrounansheng_mini	成年男	中文普通话	售后客服
景区导览女声	x6_jingqudaolannvsheng_mini	成年女	中文普通话	景区导览解说
大气宣传片男声	x6_daqixuanchuanpiannansheng_mini	成年男	中文普通话	广告宣传片
催收女声	x6_cuishounvsheng_pro	成年女	中文普通话	催收客服
营销女声	x6_yingxiaonv_pro	成年女	中文普通话	营销客服
海绵宝宝	x6_huanlemianbao_pro	童年男	中文普通话	IP模仿
商务殷语	x6_xiangruiyingyu_pro	成年男	中文普通话	IP模仿
台湾腔温柔男声	x6_taiqiangnuannan_pro	成年男	台湾话	台湾话
妩媚姐姐	x6_wumeinv_pro	成年女	中文普通话	角色配音
聆伯松	x6_lingbosong_pro	成年男	中文普通话	角色配音
少女可莉	x6_dudulibao_pro	童年女	中文普通话	IP模仿
滑稽大妈	x6_huajidama_pro	成年女	中文普通话	角色配音
活泼少年	x6_huoposhaonian_pro	成年男	中文普通话	角色配音
聆小雪	x6_lingxiaoxue_pro	成年女	中文普通话	角色配音
古风侠女	x6_gufengxianv_mini	成年女	中文普通话	角色配音
午夜电台	x6_wuyediantai_mini	成年女	中文普通话	角色配音
贴心男友	x6_tiexinnanyou_mini	成年男	中文普通话	角色配音
聆小璃	x6_lingxiaoli_pro	成年女	中文普通话	交互聊天
聆小琪	x6_xiaoqiChat_pro	成年女	中文普通话	交互聊天
聆飞逸	x6_lingfeiyi_pro	成年男	中文普通话	交互聊天
聆飞哲	x6_feizheChat_pro	成年男	中文普通话	交互聊天
聆小玥	x6_lingxiaoyue_pro	成年女	中文普通话	交互聊天
聆小璇	x6_lingxiaoxuan_pro	成年女	中文普通话	交互聊天
聆玉言	x6_lingyuyan_pro	成年女	中文普通话	交互聊天
旁白男声	x6_pangbainan1_pro	成年男	中文普通话	旁白配音
旁白女声	x6_pangbainv1_pro	成年女	中文普通话	旁白配音
聆飞瀚	x6_lingfeihan_pro	成年男	中文普通话	纪录片
聆飞皓	x6_lingfeihao_pro	成年男	中文普通话	广告促销
古风旁白	x6_gufengpangbai_pro	成年男	中文普通话	旁白配音
聆园儿	x6_lingyuaner_pro	成年女	中文普通话	儿童绘本
干练女性	x6_ganliannvxing_pro	成年女	中文普通话	角色配音
儒雅大叔	x6_ruyadashu_pro	成年男	中文普通话	角色配音
聆玉菲	x6_lingyufei_pro	成年女	中文普通话	时政新闻
聆小珊	x6_lingxiaoshan_pro	成年女	中文普通话	时政新闻
聆小芸	x6_lingxiaoyun_pro	成年女	中文普通话	角色配音
聆佑佑	x6_lingyouyou_pro	童年女	中文普通话	交互聊天
聆小颖	x6_lingxiaoying_pro	成年女	中文普通话	交互聊天
聆小瑱	x6_lingxiaozhen_pro	成年女	中文普通话	直播带货
聆飞博	x6_lingfeibo_pro	成年男	中文普通话	时政新闻
外国大叔	x6_waiguodashu_pro	成年男	中文普通话（外国人说中文）	角色配音
高冷男神	x6_gaolengnanshen_pro	成年男	中文普通话	角色配音
动漫少女	x6_dongmanshaonv_pro	成年女	中文普通话	动漫角色
聆小糖	x5_lingxiaotang_flow	成年女	中文普通话	语音助手
聆玉昭	x5_lingyuzhao_flow	成年女	中文普通话	交互聊天
子津	x4_zijin_oral	成年男	天津话	交互聊天
子阳	x4_ziyang_oral	成年男	东北话	交互聊天
Grant	x5_EnUs_Grant_flow	成年女	英文美式口音	交互聊天
Lila	x5_EnUs_Lila_flow	成年女	英文美式口音	交互聊天
默认免费发音人

姓名	vcn	性别	语言
聆小璇	x5_lingxiaoxuan_flow	成年女	中文普通话
聆飞逸	x5_lingfeiyi_flow	成年男	中文普通话
聆小玥	x5_lingxiaoyue_flow	成年女	中文普通话
聆玉昭	x5_lingyuzhao_flow	成年女	中文普通话
聆玉言	x5_lingyuyan_flow	成年女	中文普通话
#合成接口-静音停顿、多音字读法
合成时，加入静音停顿
1、格式： [p] (=无符号整数)
2、参数： * – 静音的时间长度，单位：毫秒(ms)
文本举例：你好[p500]科大讯飞
该句合成时，将会在“你好”后加入500ms的静音。
注意：合成文本中的标点符号、空格、回车符号均会在音频播放中形成静音停顿效果。

指定汉字发音
1、格式： [=] (=拼音/音标)
2、参数： * – 为前一个汉字/单词设定的拼音/音标
3、说明： 汉字：声调用后接一位数字15分别表示阴平、阳平、上声、去声和轻声5个声调。
文本举例：着[=zhuo2]手
其中，“着”字将读作“zhuó”

#错误码
错误码示例：
{
    "code":10003, // 平台通用错误码，详细信息请参照 5.1 平台通用错误码
    "message":"WrapperInitErr;errno=101",
    "sid":"ocr00088c7d@dx170194697e9a11d902"
}


错误码	说明	处理策略
10009	输入数据非法	检查输入数据
10010	没有授权许可或授权数已满	提交工单
10019	session超时	检查是否数据发送完毕但未关闭连接
10043	音频解码失败	检查aue参数，如果为speex，请确保音频是speex音频并分段压缩且与帧大小一致
10114	session 超时	会话时间超时，检查是否发送数据时间超过了60s
10139	参数错误	检查参数是否正确
10160	请求数据格式非法	检查请求数据是否是合法的json
10161	base64解码失败	检查发送的数据是否使用base64编码了
10163	参数校验失败	具体原因见详细的描述
10200	读取数据超时	检查是否累计10s未发送数据并且未关闭连接
10222	1.上传的数据超过了接口上限； 2.SSL证书无效；	1.检查接口上传的数据（文本、音频、图片等）是否超越了接口的最大限制，可到相应的接口文档查询具体的上限； 2. 请将log导出发到工单：https://console.xfyun.cn/workorder/commit；
10223	lb 找不到节点	提交工单
10313	appid和apikey不匹配	检查appid是否合法
10317	版本非法	请到控制台提交工单联系技术人员
10700	引擎异常	按照报错原因的描述，对照开发文档检查输入输出，如果仍然无法排除问题，请提供sid以及接口返回的错误信息，到控制台提交工单联系技术人员排查。
11200	功能未授权	请先检查appid是否正确，并且确保该appid下添加开通了相关服务。点击控制台 按照如下方法排查。 1. 确认余量是否充值，或者服务量授权已到期。 2. 查看发音人是否开通权限，注意发音人功能和服务量为两个独立的授权
11201	该APPID的每日交互次数超过限制	根据自身情况提交应用审核进行服务量提额，或者联系商务购买企业级正式接口，获得海量服务量权限以便商用。
11503	服务内部响应数据错误	提交工单
11502	服务配置错误	提交工单
100001~100010	调用引擎时出现错误	请提供sid以及接口返回的错误信息，到控制台提交工单联系技术人员排查。
26005	上行数据超时，超过14s没收到客户端的数据	检查客户端代码或网络
26006	下行数据超时，服务内部下发数据超时	请到控制台提交工单联系技术人员
#常见问题
#超拟人语音合成和传统语音合成的区别是什么？
答：在传统语音合成的基础上，进一步提升了语音的自然度和表现力，精准模拟人类的副语言现象，如呼吸、叹气、语速变化等，使得语音不仅流畅自然，更富有情感和生命力。

#超拟人语音合成支持合成什么格式的音频？
答：支持合成pcm（对应音频编码是raw）、mp3（对应音频编码是lame）、speex、opus格式的音频。可根据自身需求选择FFmpeg、Audacity等音频编解码工具。

#如何查看合成音频的隐性标识？
答：implicit_watermark参数设置为true。音频编码设置为lame，查看mp3的元数据信息会有
Metadata: {"AIGC:{"Label":"1","ContentProducer":"001191340000711771143J00000","ProduceID":"ase00018773@dx19c4b750907b867772","ContentPropagator":"001191340000711771143J00000","PropagateID":"%!s(MISSING)"}}
这里面除了ProduceID是本次请求对应的sid，其他都是固定的。
