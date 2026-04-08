语音听写（流式版）WebAPI 文档
#接口说明
语音听写流式接口，用于1分钟内的即时语音转文字技术，支持实时返回识别结果，达到一边上传音频一边获得识别文本的效果。
高阶功能-动态修正现在免费开放！多方言免切能力已上线！

语音听写流式API JAVA-SDK-DEMO调用视频说明请点击 这里 观看。

动态修正：可到这里 动态修正效果 在线体验

未开启动态修正：实时返回识别结果，每次返回的结果都是对之前结果的追加；
开启动态修正：实时返回识别结果，每次返回的结果有可能是对之前结果的追加，也有可能是要替换之前某次返回的结果（即修正）；
开启动态修正，相较于未开启，返回结果的颗粒度更小，视觉冲击效果更佳；
使用动态修正功能直接设置相应参数方可使用，参数设置方法详见 业务参数说明 ；
动态修正功能仅 中文 支持；
未开启与开启返回的结果格式不同，详见 动态修正返回结果 ；
小语种

支持的语种请到语音听写 页面或控制台查看；
使用少数民族语言和小语种时，URL和中英文URL不同，详见 接口要求 ；
小语种参数设置方法详见 业务参数说明 ；
多方言免切

支持四川话、河南话、东北话、粤语、闽南话、山东话、贵州话等在内的23种方言免切换识别，具体请到业务参数说明查看；
参数设置方法详见 业务参数说明 ；
该语音能力是通过Websocket API的方式给开发者提供一个通用的接口。Websocket API具备流式传输能力，适用于需要流式数据传输的AI服务场景，比如边说话边识别。相较于SDK，API具有轻量、跨语言的特点；相较于HTTP API，Websocket API协议有原生支持跨域的优势。

原WebAPI普通版本接口(http[s]: //api.xfyun.cn/v1/service/v1/iat) 不再对外开放，已经使用WebAPI普通版本的用户仍可使用，同时也欢迎体验新版流式接口并尽快完成迁移~

注意：测试或正式使用前，请去对应产品页面获取免费额度或下单购买正式套餐（语音听写创建应用后默认有每日500次调用）；同时需要去控制台服务页面，获取API有效密钥（AppID、APIKey、APISecret）后再调用。
语音听写产品页面
语音听写服务页

#接口Demo
示例demo请点击 这里 下载。
目前仅提供部分开发语言的demo，其他语言请参照下方接口文档进行开发。
也欢迎热心的开发者到 讯飞开放平台社区 分享你们的demo。

#接口要求
集成语音听写流式API时，需按照以下要求。

内容	说明
请求协议	ws[s]（为提高安全性，强烈推荐wss）
请求地址	中英文(推荐使用)：ws[s]: //iat-api.xfyun.cn/v2/iat
中英文：ws[s]: //ws-api.xfyun.cn/v2/iat
小语种：ws[s]: //iat-niche-api.xfyun.cn/v2/iat
注：服务器IP不固定，为保证您的接口稳定，请勿通过指定IP的方式调用接口，使用域名方式调用
请求行	GET /v2/iat HTTP/1.1
接口鉴权	签名机制，详情请参照下方接口鉴权
字符编码	UTF-8
响应格式	统一采用JSON格式
开发语言	任意，只要可以向讯飞云服务发起Websocket请求的均可
操作系统	任意
音频属性	采样率16k或8K、位长16bit、单声道
音频格式	pcm
speex（8k）
speex-wb（16k）
mp3（仅中文普通话和英文支持，其他方言及小语种敬请期待）
样例音频请参照音频样例
音频长度	最长60s
语言种类	中文、英文、小语种以及中文方言，可在控制台-语音听写（流式版）-方言/语种处添加试用或购买
#接口调用流程
通过接口密钥基于hmac-sha256计算签名，向服务器端发送Websocket协议握手请求。详见下方 接口鉴权 。
握手成功后，客户端通过Websocket连接同时上传和接收数据。数据上传完毕，客户端需要上传一次数据结束标识。详见下方 接口数据传输与接收 。
接收到服务器端的结果全部返回标识后断开Websocket连接。
注： Websocket使用注意事项如下

服务端支持的websocket-version 为13，请确保客户端使用的框架支持该版本。
服务端返回的所有的帧类型均为TextMessage，对应于原生websocket的协议帧中opcode=1，请确保客户端解析到的帧类型一定为该类型，如果不是，请尝试升级客户端框架版本，或者更换技术框架。
如果出现分帧问题，即一个json数据包分多帧返回给了客户端，导致客户端解析json失败。出现这种问题大部分情况是客户端的框架对websocket协议解析存在问题，如果出现请先尝试升级框架版本，或者更换技术框架。
客户端会话结束后如果需要关闭连接，尽量保证传给服务端的错误码为websocket错误码1000（如果客户端框架没有提供关闭时传错误码的接口。则无需关注本条）。
#白名单
默认关闭IP白名单，即该服务不限制调用IP。
在调用该业务接口时

若关闭IP白名单，接口认为IP不限，不会校验IP。
若打开IP白名单，则服务端会检查调用方IP是否在讯飞开放平台配置的IP白名单中，对于没有配置到白名单中的IP发来的请求，服务端会拒绝服务。
IP白名单规则

在 控制台-相应服务的IP白名单处编辑，保存后五分钟左右生效。
不同Appid的不同服务都需要分别设置IP白名单。
IP白名单需设置为外网IP，请勿设置局域网IP。
如果握手阶段返回{"message":"Your IP address is not allowed"}，则表示由于IP白名单配置有误或还未生效，服务端拒绝服务。
#接口鉴权
在握手阶段，请求方需要对请求进行签名，服务端通过签名来校验请求的合法性。

#鉴权方法
通过在请求地址后面加上鉴权相关参数的方式。示例url：

wss://iat-api.xfyun.cn/v2/iat?authorization=YXBpX2tleT0ia2V5eHh4eHh4eHg4ZWUyNzkzNDg1MTlleHh4eHh4eHgiLCBhbGdvcml0aG09ImhtYWMtc2hhMjU2IiwgaGVhZGVycz0iaG9zdCBkYXRlIHJlcXVlc3QtbGluZSIsIHNpZ25hdHVyZT0iSHAzVHk0WmtTQm1MOGpLeU9McFFpdjlTcjVudm1lWUVIN1dzTC9aTzJKZz0i&date=Wed%2C%2010%20Jul%202019%2007%3A35%3A43%20GMT&host=iat-api.xfyun.cn
鉴权参数：

参数	类型	必须	说明	示例
host	string	是	请求主机	iat-api.xfyun.cn
date	string	是	当前时间戳，RFC1123格式	Wed, 10 Jul 2019 07:35:43 GMT
authorization	string	是	使用base64编码的签名相关信息(签名基于hmac-sha256计算)	参考下方authorization参数生成规则
· date参数生成规则

date必须是UTC+0或GMT时区，RFC1123格式(Wed, 10 Jul 2019 07:35:43 GMT)。
服务端会对Date进行时钟偏移检查，最大允许300秒的偏差，超出偏差的请求都将被拒绝。

· authorization参数生成规则

1）获取接口密钥APIKey 和 APISecret。
在讯飞开放平台控制台，创建WebAPI平台应用并添加语音听写（流式版）服务后即可查看，均为32位字符串。

2）参数authorization base64编码前（authorization_origin）的格式如下。

api_key="$api_key",algorithm="hmac-sha256",headers="host date request-line",signature="$signature"
其中 api_key 是在控制台获取的APIKey，algorithm 是加密算法（仅支持hmac-sha256），headers 是参与签名的参数（见下方注释）。
signature 是使用加密算法对参与签名的参数签名后并使用base64编码的字符串，详见下方。

注： headers是参与签名的参数，请注意是固定的参数名（"host date request-line"），而非这些参数的值。

3）signature的原始字段(signature_origin)规则如下。

signature原始字段由 host，date，request-line三个参数按照格式拼接成，
拼接的格式为(\n为换行符,’:’后面有一个空格)：

host: $host\ndate: $date\n$request-line
假设

请求url = wss://iat-api.xfyun.cn/v2/iat
date = Wed, 10 Jul 2019 07:35:43 GMT
那么 signature原始字段(signature_origin)则为：

host: iat-api.xfyun.cn
date: Wed, 10 Jul 2019 07:35:43 GMT
GET /v2/iat HTTP/1.1
4）使用hmac-sha256算法结合apiSecret对signature_origin签名，获得签名后的摘要signature_sha。

signature_sha=hmac-sha256(signature_origin,$apiSecret)
其中 apiSecret 是在控制台获取的APISecret

5）使用base64编码对signature_sha进行编码获得最终的signature。

signature=base64(signature_sha)
假设

APISecret = secretxxxxxxxx2df7900c09xxxxxxxx
date = Wed, 10 Jul 2019 07:35:43 GMT
则signature为

signature=Hp3Ty4ZkSBmL8jKyOLpQiv9Sr5nvmeYEH7WsL/ZO2Jg=
6）根据以上信息拼接authorization base64编码前（authorization_origin）的字符串，示例如下。

api_key="keyxxxxxxxx8ee279348519exxxxxxxx", algorithm="hmac-sha256", headers="host date request-line", signature="Hp3Ty4ZkSBmL8jKyOLpQiv9Sr5nvmeYEH7WsL/ZO2Jg="
注： headers是参与签名的参数，请注意是固定的参数名（"host date request-line"），而非这些参数的值。

7）最后再对authorization_origin进行base64编码获得最终的authorization参数。

authorization = base64(authorization_origin)
示例：
authorization=YXBpX2tleT0ia2V5eHh4eHh4eHg4ZWUyNzkzNDg1MTlleHh4eHh4eHgiLCBhbGdvcml0aG09ImhtYWMtc2hhMjU2IiwgaGVhZGVycz0iaG9zdCBkYXRlIHJlcXVlc3QtbGluZSIsIHNpZ25hdHVyZT0iSHAzVHk0WmtTQm1MOGpLeU9McFFpdjlTcjVudm1lWUVIN1dzTC9aTzJKZz0i
#鉴权url示例(golang)
    //@hosturl :  like  wss://iat-api.xfyun.cn/v2/iat
    //@apikey : apiKey
    //@apiSecret : apiSecret
    func assembleAuthUrl(hosturl string, apiKey, apiSecret string) string {
        ul, err := url.Parse(hosturl)
        if err != nil {
            fmt.Println(err)
        }
        //签名时间
        date := time.Now().UTC().Format(time.RFC1123)
        //参与签名的字段 host ,date, request-line
        signString := []string{"host: " + ul.Host, "date: " + date, "GET " + ul.Path + " HTTP/1.1"}
        //拼接签名字符串
        sgin := strings.Join(signString, "\n")
        //签名结果
        sha := HmacWithShaTobase64("hmac-sha256", sgin, apiSecret)
        //构建请求参数 此时不需要urlencoding
        authUrl := fmt.Sprintf("api_key=\"%s\", algorithm=\"%s\", headers=\"%s\", signature=\"%s\"", apiKey,
            "hmac-sha256", "host date request-line", sha)
        //将请求参数使用base64编码
        authorization:= base64.StdEncoding.EncodeToString([]byte(authUrl))
        v := url.Values{}
        v.Add("host", ul.Host)
        v.Add("date", date)
        v.Add("authorization", authorization)
        //将编码后的字符串url encode后添加到url后面
        callurl := hosturl + "?" + v.Encode()
        return callurl
    }
#鉴权结果
如果握手成功，会返回HTTP 101状态码，表示协议升级成功；如果握手失败，则根据不同错误类型返回不同HTTP Code状态码，同时携带错误描述信息，详细错误说明如下：

HTTP Code	说明	错误描述信息	解决方法
401	缺少authorization参数	{“message”:”Unauthorized”}	检查是否有authorization参数，详情见authorization参数详细生成规则
401	签名参数解析失败	{“message”:”HMAC signature cannot be verified”}	检查签名的各个参数是否有缺失是否正确，特别确认下复制的api_key是否正确
401	签名校验失败	{“message”:”HMAC signature does not match”}	签名验证失败，可能原因有很多。
1. 检查api_key,api_secret 是否正确
2.检查计算签名的参数host，date，request-line是否按照协议要求拼接。
3. 检查signature签名的base64长度是否正常(正常44个字节)。
403	时钟偏移校验失败	{“message”:”HMAC signature cannot be verified, a valid date or x-date header is required for HMAC Authentication”}	检查服务器时间是否标准，相差5分钟以上会报此错误
403	IP白名单校验失败	{"message":"Your IP address is not allowed"}	可在控制台关闭IP白名单，或者检查IP白名单设置的IP地址是否为本机外网IP地址
握手失败返回示例：

    HTTP/1.1 401 Forbidden
    Date: Thu, 06 Dec 2018 07:55:16 GMT
    Content-Length: 116
    Content-Type: text/plain; charset=utf-8
    {
        "message": "HMAC signature does not match"
    }
#接口数据传输与接收
握手成功后客户端和服务端会建立Websocket连接，客户端通过Websocket连接可以同时上传和接收数据。
当服务端有识别结果时，会通过Websocket连接推送识别结果到客户端。

发送数据时，如果间隔时间太短，可能会导致引擎识别有误。
建议每次发送音频间隔40ms，每次发送音频字节数（即java示例demo中的frameSize）为一帧音频大小的整数倍。

//连接成功，开始发送数据
int frameSize = 1280; //每一帧音频大小的整数倍，请注意不同音频格式一帧大小字节数不同，可参考下方建议
int intervel = 40;
int status = 0;  // 音频的状态
try (FileInputStream fs = new FileInputStream(file)) {
    byte[] buffer = new byte[frameSize];
    // 发送音频
请注意不同音频格式一帧大小的字节数不同，我们建议：

未压缩的PCM格式，每次发送音频间隔40ms，每次发送音频字节数1280B；
讯飞定制speex格式，每次发送音频间隔40ms，假如16k的压缩等级为7，则每次发送61B的整数倍；
标准开源speex格式，每次发送音频间隔40ms，假如16k的压缩等级为7，则每次发送60B的整数倍；
讯飞定制speex（压缩等级）	0	1	2	3	4	5	6	7	8	9	10
speex 8k	7	11	16	21	21	29	29	39	39	47	63
speex-wb 16k	11	16	21	26	33	43	53	61	71	87	107
标准开源speex（压缩等级）	0	1	2	3	4	5	6	7	8	9	10
speex 8k	6	10	15	20	20	28	28	38	38	46	62
speex-wb 16k	10	15	20	25	32	42	52	60	70	86	106
speex相关说明详见speex编码

整个会话时长最多持续60s，或者超过10s未发送数据，服务端会主动断开连接。
数据上传完毕，客户端需要上传一次数据结束标识表示会话已结束，详见下方data参数说明。

#请求参数
请求数据均为json字符串

参数名	类型	必传	描述
common	object	是	公共参数，仅在握手成功后首帧请求时上传，详见下方
business	object	是	业务参数，仅在握手成功后首帧请求时上传，详见下方
data	object	是	业务数据流参数，在握手成功后的所有请求中都需要上传，详见下方
#公共参数说明
common

参数名	类型	必传	描述
app_id	string	是	在平台申请的APPID信息
#业务参数
business

参数名	类型	必传	描述	示例
language	string	是	语种
zh_cn：中文（支持简单的英文识别）
en_us：英文
其他小语种：可到控制台-语音听写（流式版）-方言/语种处添加试用或购买，添加后会显示该小语种参数值，若未授权无法使用会报错11200。
另外，小语种接口URL与中英文不同，详见接口要求。	"zh_cn"
domain	string	是	应用领域
iat：日常用语
xfime-mianqie：方言免切（支持23种方言+中文普通话混合识别）
medical：医疗
gov-seat-assistant：政务坐席助手
seat-assistant：金融坐席助手
gov-ansys：政务语音分析
gov-nav：政务语音导航
fin-nav：金融语音导航
fin-ansys：金融语音分析
注：除日常用语领域外其他领域若未授权无法使用，可到控制台-语音听写（流式版）-高级功能处添加试用或购买；方言免切需在方言/语种处添加使用或购买；若未授权无法使用会报错11200。
坐席助手、语音导航、语音分析相关垂直领域仅适用于8k采样率的音频数据，另外三者的区别详见下方。
方言免切23种方言：四川话、河南话、东北话、粤语、闽南话、山东话、贵州话、云南话、客家话、天津话、河北话、太原话、上海话、合肥话、南京话、皖北话、台湾话、甘肃话、陕西话、宁夏话、长沙话、南昌话、武汉话。	"iat"
accent	string	是	方言，当前仅在language为中文时，支持方言选择。
mandarin：中文普通话、其他语种
其他方言：可到控制台-语音听写（流式版）-方言/语种处添加试用或购买，添加后会显示该方言参数值；方言若未授权无法使用会报错11200。	"mandarin"
eos	int	否	用于设置后端点检测的静默时间，单位是毫秒。
即静默多长时间后引擎认为音频结束。
默认2000（小语种除外，小语种不设置该参数默认为未开启VAD）。	3000
dwa	string	否	（仅中文普通话支持）动态修正
wpgs：开启流式结果返回功能
"wpgs"
ptt	int	否	（仅中文支持）是否开启标点符号添加
1：开启（默认值）
0：关闭	0
pcm	int	否	标点返回位置控制，开启后标点会缓存到下一句句首返回(返回标点更准确)
1：开启（默认值）
0：关闭
注：关闭之后标点会显示在上一句句尾	1
ltc	int	否	（仅中文引擎支持）是否进行中英文筛选
1：不进行筛选（默认值）
2：只出中文
3：只出英文	1
rlang	string	否	（仅中文支持）字体
zh-cn :简体中文（默认值）
zh-hk :繁体香港
"zh-cn"
vinfo	int	否	返回子句结果对应的起始和结束的端点帧偏移值。端点帧偏移值表示从音频开头起已过去的帧长度。
0：关闭（默认值）
1：开启
开启后返回的结果中会增加data.result.vad字段，详见下方返回结果。
注：若使用了动态修正功能，则该功能无法使用。	1
nunum	int	否	（中文普通话和日语支持）将返回结果的数字格式规则为阿拉伯数字格式，默认开启
0：关闭
1：开启	0
speex_size	int	否	speex音频帧长，仅在speex音频时使用
1 当speex编码为标准开源speex编码时必须指定
2 当speex编码为讯飞定制speex编码时不要设置
注：标准开源speex以及讯飞定制SPEEX编码工具请参考这里 speex编码 。	70
nbest	int	否	取值范围[1,5]，通过设置此参数，获取在发音相似时的句子多侯选结果。设置多候选会影响性能，响应时间延迟200ms左右。
3
wbest	int	否	取值范围[1,5]，通过设置此参数，获取在发音相似时的词语多侯选结果。设置多候选会影响性能，响应时间延迟200ms左右。
5
注： 多候选效果是由引擎决定的，并非绝对的。即使设置了多候选，如果引擎并没有识别出候选的词或句，返回结果也还是单个。
注： 以上common和business参数只需要在握手成功后的第一帧请求时带上。
注：
坐席助手：电话坐席助手，一般用于人与人对话的场景。
语音导航：电话语音导航，一般用于机器与人对话的场景。
语音分析：基于大量存量的电话客服录音做质检，即事后音频转文字的场景(识别率会优于前两者)。

#业务数据流参数
data

参数名	类型	必传	描述
status	int	是	音频的状态
0 :第一帧音频
1 :中间的音频
2 :最后一帧音频，最后一帧必须要发送
format	string	是	音频的采样率支持16k和8k
16k音频：audio/L16;rate=16000
8k音频：audio/L16;rate=8000
encoding	string	是	音频数据格式
raw：原生音频（支持单声道的pcm）
speex：speex压缩后的音频（8k）
speex-wb：speex压缩后的音频（16k）
请注意压缩前也必须是采样率16k或8k单声道的pcm。
lame：mp3格式（仅中文普通话和英文支持，方言及小语种暂不支持）
样例音频请参照音频样例
audio	string	是	音频内容，采用base64编码
请求参数示例：

    {
        "common":{
           // 公共请求参数
           "app_id":"123456"
        },
        "business":{
            "language":"zh_cn",
            "domain":"iat",
            "accent":"mandarin"
        },
        "data":{
                "status":0,
                "format":"audio/L16;rate=16000",
                "encoding":"raw",
                "audio":"exSI6ICJlbiIsCgkgICAgInBvc2l0aW9uIjogImZhbHNlIgoJf..."
        }
    }
数据上传结束标识示例：

    {
    "data":{
      "status":2
        }
    }
#返回参数
参数	类型	描述
sid	string	本次会话的id，只在握手成功后第一帧请求时返回
code	int	返回码，0表示成功，其它表示异常，详情请参考错误码
message	string	错误描述
data	object	听写结果信息
data.status	int	识别结果是否结束标识：
0：识别的第一块结果
1：识别中间结果
2：识别最后一块结果
data.result	object	听写识别结果
data.result.sn	int	返回结果的序号
data.result.ls	bool	是否是最后一片结果
data.result.bg	int	保留字段，无需关心
data.result.ed	int	保留字段，无需关心
data.result.ws	array	听写结果
data.result.ws.bg	int	起始的端点帧偏移值，单位：帧（1帧=10ms）
注：以下两种情况下bg=0，无参考意义：
1)返回结果为标点符号或者为空；2)本次返回结果过长。
data.result.ws.cw	array	中文分词
data.result.ws.cw.w	string	字词
data.result.ws.cw.其他字段
sc/wb/wc/we/wp	int/string	均为保留字段，无需关心。如果解析sc字段，建议float与int数据类型都做兼容
#动态修正返回参数
若开通了动态修正功能并设置了dwa=wpgs（仅中文支持），还有如下字段返回：
注：动态修正结果解析可参考页面下方的java demo。

参数	类型	描述
data.result.pgs	string	开启wpgs会有此字段
取值为 "apd"时表示该片结果是追加到前面的最终结果；取值为"rpl" 时表示替换前面的部分结果，替换范围为rg字段
data.result.rg	array	替换范围，开启wpgs会有此字段
假设值为[2,5]，则代表要替换的是第2次到第5次返回的结果
#vinfo返回参数
若设置了vinfo=1，还有如下字段返回（若同时开通并设置了dwa=wpgs，则vinfo失效）：

参数	类型	描述
data.result.vad	object	端点帧偏移值信息
data.result.vad.ws	array	端点帧偏移值结果
data.result.vad.bg	int	起始的端点帧偏移值，单位：帧（1帧=10ms）
data.result.vad.ed	int	结束的端点帧偏移值，单位：帧（1帧=10ms）
data.result.vad.eg	number	无需关心
返回参数示例（动态修正dwa=wpgs）
注：动态修正结果解析可参考页面下方的java demo。

	{
	  "code": 0,
	  "message": "success",
	  "sid": "iatxxxxxxxxxxxxx",
	  "data": {
	    "result": {
	      "bg": 0,
	      "ed": 0,
	      "ls": false,
	      "pgs": "rpl",
	      "rg": [
	        1,
	        1
	      ],
	      "sn": 2,
	      "ws": [
	        {
	          "bg": 0,
	          "cw": [
	            {
	              "sc": 0,
	              "w": "测试"
	            }
	          ]
	        },
	        {
	          "bg": 0,
	          "cw": [
	            {
	              "sc": 0,
	              "w": "一下"
	            }
	          ]
	        }
	      ]
	    },
	    "status": 1
	  }
	}
返回参数示例（vinfo=1）

{
  "code": 0,
  "message": "success",
  "sid": "iatxxxxxxxxxxxxxx",
  "data": {
    "result": {
      "bg": 0,
      "ed": 0,
      "ls": false,
      "sn": 1,
      "vad": {
        "ws": [
          {
            "bg": 40,
            "ed": 366,
            "eg": 63.58
          }
        ]
      },
      "ws": [
        {
          "bg": 53,
          "cw": [
            {
              "sc": 0,
              "w": "4月"
            }
          ]
        },
        {...},
        {
          "bg": 293,
          "cw": [
            {
              "sc": 0,
              "w": "选手"
            }
          ]
        }
      ]
    },
    "status": 1
  }
}
返回参数示例（句子多候选nbest）

{
  "code": 0,
  "message": "success",
  "sid": "iatxxxxxxxxxxxxx",
  "data": {
    "result": {
      "bg": 0,
      "ed": 0,
      "ls": false,
      "sn": 1,
      "ws": [
        {
          "bg": 35,
          "cw": [
            {
              "sc": 0,
              "w": "打电话给梁玉生"
            },
            {
              "sc": 0,
              "w": "打电话给梁玉升"
            }
          ]
        }
      ]
    },
    "status": 0
  }
}
返回参数示例（词级多候选wbest）

{
  "code": 0,
  "message": "success",
  "sid": "iatxxxxxxxxxxxxxx",
  "data": {
    "result": {
      "bg": 0,
      "ed": 0,
      "ls": false,
      "sn": 1,
      "ws": [
        {...},
        {
          "bg": 159,
          "cw": [
            {
              "sc": 0,
              "w": "梁"
            }
          ]
        },
        {
          "bg": 191,
          "cw": [
            {
              "sc": 0,
              "w": "玉"
            },
            {
              "sc": 0,
              "w": "育"
            }
          ]
        },
        {
          "bg": 215,
          "cw": [
            {
              "sc": 0,
              "w": "生"
            },
            {
              "sc": 0,
              "w": "升"
            }
          ]
        }
      ]
    },
    "status": 0
  }
}
#错误码
备注：如出现下述列表中没有的错误码，可到 这里 查询。

错误码	错误描述	处理方案
10005	appid授权失败	说明: appid授权失败
处理方式: 确认appid是否正确，是否开通了听写服务
10006	采样率参数获取失败	根据具体返回错误码，确认那些参数

说明: 获取某个参数失败
处理方式: 检查报错信息中的参数是否正确上传
10007	采样率非法	说明: 参数值不合法
处理方式: 检查报错信息中的参数值是否在取值范围内
10009	输入数据非法	参考接口文档，按照协议传输数据
10010/10110	引擎授权不足	说明: 引擎授权不足
处理方式: 请到控制台提交工单联系技术人员
10014	会话超时	说明: 会话超时
处理方式: 会话超时请重试
10019	session超时	说明: session超时
处理方式: 检查是否数据发送完毕但未关闭连接，或者存在多次空音频
10043	音频解码失败	说明: 音频解码失败
处理方式: 检查aue参数，如果为speex，请确保音频是speex音频并分段压缩且与帧大小，建议使用ffprobe 命令查看样例
10044	重置采样率失败（8K/16K互相转码）	获取音频，确认音频是否存在问题
10047	结果json格式化失败	查看日志，确认结果无法格式化原因
10050	不支持的内核方法	代码错误，需要修改代码
10101	引擎会话已结束	说明: 引擎会话已结束
处理方式: 检查是否引擎已结束会话但客户端还在发送数据，比如音频数据虽然发送完毕但并未关闭websocket连接，还在发送空的音频等
10109	无效的数据	1、上传数据无效，听写热词文件、命令词识别语法文件上传等;2、上传的音频过长;可首先观察告警，一般情况下会稍后恢复；如长时间、大面积出现，则及时获取告警appid，通知业务线沟通客户。
10114	会话超时	说明: 会话超时
处理方式: 检查整个会话是否已经超过了60s
10139	参数错误	说明: 参数错误
处理方式: 引擎编解码错误
10160	请求数据格式非法	说明: 请求数据格式非法
处理方式: 检查请求数据是否是合法的json
10161	base64解码失败	说明: base64解码失败
处理方式: 检查发送的数据是否使用了base64编码
10163	缺少必传参数，或者参数不合法	说明: 缺少必传参数，或者参数不合法
处理方式: 检查报错信息中的参数是否正确上传
10164	根据映射响应结果失败	如果出现需要看看最近是否有变更，有变更的话确认可以回滚则回滚。
10165	客户端帧可能乱序，status非法	说明: 无效的句柄
处理方式: 检查下传入第一帧音频时，是否上传了status=0
10200	读取数据超时	说明: 读取数据超时
处理方式: 检查是否累计10s未发送数据并且未关闭连接
10222	网络异常	说明：网络异常
处理方式: 请到控制台提交工单联系技术人员
10303	协议解析失败，缺少参数	说明：协议解析异常
处理方式: 请到控制台提交工单联系技术人员
10313	appid为空	说明: appid不能为空
处理方式: 检查common参数是否正确上传，或common中的app_id参数是否正确上传或是否为空
10317	版本非法	说明: 版本非法
处理方式: 联系技术人员
10404	无效三元组no category route found	说明：无效三元组
处理方法：传入错误三元组，导致无法找到引擎
10500	内部同步错误	说明: 内部同步错误
处理方式: 联系技术人员
10600	事件异常错误	说明: 事件异常错误
处理方式: 联系技术人员
10700	引擎访问超时	说明: 引擎访问超时
处理方式: 联系技术人员
11200	总调用量超过上限、功能未授权或授权已过期	说明: 没有权限
处理方式: 查看当前套餐用量是否已到上线
11201	日流控超限	说明: 日流控超限
处理方式: 可联系商务提高每日调用次数
11202	秒级流控超限	说明: 日流控超限
处理方式: 可联系商务提高每日调用次数
11203	授权过期	说明: 授权过期
处理方式: 查看当前套餐授权日期是否已到上限
#调用示例
注: demo只是一个简单的调用示例，不适合直接放在复杂多变的生产环境使用

语音听写流式API demo java语言

语音听写流式API demo python3语言

语音听写流式API demo js语言

语音听写流式API demo go语言

语音听写流式API demo nodejs语言

语音听写流式API PYTHON-SDK-DEMO

语音听写流式API JAVA-SDK-DEMO

语音听写流式API JAVA-SDK-DEMO 麦克风版本一分钟调用视频如下：

语音听写流式API JAVA-SDK-DEMO一分钟调用视频如下：

讯飞开放平台AI能力-PYTHONSDK: Github地址

讯飞开放平台AI能力-JAVASDK: Github地址

注： 其他开发语言请参照 接口调用流程 进行开发，也欢迎热心的开发者到 讯飞开放平台社区 分享你们的demo。

#音频样例
语音听写流式 音频样例 中文普通话 PCM文件 采样率16k

语音听写流式 音频样例 中文普通话 PCM文件 采样率8k

语音听写流式 音频样例 中文普通话 MP3文件 采样率16k

语音听写流式 音频样例 中文普通话 MP3文件 采样率8k

语音听写流式 音频样例 中文普通话 SPEEX文件（标准开源SPEEX编码） 采样率8k 7级压缩

语音听写流式 音频样例 中文普通话 SPEEX文件（标准开源SPEEX编码） 采样率16k 7级压缩

语音听写流式 音频样例 中文普通话 SPEEX文件（讯飞定制SPEEX编码） 采样率16k 7级压缩

语音听写流式 音频样例 中文普通话 SPEEX文件（讯飞定制SPEEX编码） 采样率8k 7级压缩

注： 音频文件的录制和格式确认（推荐使用Cool Edit Pro工具），以及讯飞定制SPEEX编码工具请参考这里： 音频格式说明

#视频教程
语音听写-WebAPI接口详解

#常见问题
#语音听写的APIKey在哪里查询到？
答：控制台--我的应用---找到对应应用的语音听写（流式）服务---即能查看到。

#webapi流式听写能获取到语音听写结果为空或错误内容或者不全，原因是什么？
答：原因可能如下；
1、音频格式不正确，请使用Cool Edit Pro工具（网页搜索下载即可）查看音频格式，webapi听写流式版：支持的格式是pcm、speex、speex-wb，其中中文普通话和英文还支持mp3格式
音频采样率要是 16k 或者 8k、采样精度16 位、单声道音频。样例音频请参照音频样例
2、音频中间有静音或者杂音音频超过了后端点（不设置默认为2000ms）的设置，此时请使用Cool Edit Pro工具查看音频内容，并且设置后端点（eos）为最大值10000ms
包含超过后端点最大值的静音或者杂音时，音频识别不完整是正常的

#语音听写WebAPI支持的音频格式有哪些？
答：支持8k和16k采样率、16bit、单声道的pcm、mp3、speex格式的音频。需注意mp3格式的音频仅支持中文普通话和英文。

#语音听写最长支持多少秒之内的音频？
答：听写支持识别60s之内的音频。

#语音听写Webapi支持多少路并发？如何提高并发？
答：默认支持50路并发，如需更多并发可提交工单进行咨询。

#听写报错10163，length of $.data.audio must be between 0,13000是什么原因？
答：听写frameSize传的音频大小base64编码后不能超出13000B，默认传1280B不建议传值过大。

#为什么每隔一段时间不发送数据就会断开连接？
答：听写eos为支持的最长静音时间，超过这个时间会认为音频结束自动断开连接。

#最多支持多少热词，是否可以扩容？
答：控制台最多支持2000个应用级热词，暂不支持扩容。

#如何限制IP？
答：可通过在IP白名单设置自己服务的IP地址，限制其他IP地址访问。
