/**
 * Minimax 中文（普通话）音色
 */
export type MinimaxChineseMandarinVoice =
  | 'male-qn-qingse'
  | 'male-qn-jingying'
  | 'male-qn-badao'
  | 'male-qn-daxuesheng'
  | 'female-shaonv'
  | 'female-yujie'
  | 'female-chengshu'
  | 'female-tianmei'
  | 'male-qn-qingse-jingpin'
  | 'male-qn-jingying-jingpin'
  | 'male-qn-badao-jingpin'
  | 'male-qn-daxuesheng-jingpin'
  | 'female-shaonv-jingpin'
  | 'female-yujie-jingpin'
  | 'female-chengshu-jingpin'
  | 'female-tianmei-jingpin'
  | 'clever_boy'
  | 'cute_boy'
  | 'lovely_girl'
  | 'cartoon_pig'
  | 'bingjiao_didi'
  | 'junlang_nanyou'
  | 'chunzhen_xuedi'
  | 'lengdan_xiongzhang'
  | 'badao_shaoye'
  | 'tianxin_xiaoling'
  | 'qiaopi_mengmei'
  | 'wumei_yujie'
  | 'diadia_xuemei'
  | 'danya_xuejie'
  | 'Chinese (Mandarin)_Reliable_Executive'
  | 'Chinese (Mandarin)_News_Anchor'
  | 'Chinese (Mandarin)_Mature_Woman'
  | 'Chinese (Mandarin)_Unrestrained_Young_Man'
  | 'Arrogant_Miss'
  | 'Robot_Armor'
  | 'Chinese (Mandarin)_Kind-hearted_Antie'
  | 'Chinese (Mandarin)_HK_Flight_Attendant'
  | 'Chinese (Mandarin)_Humorous_Elder'
  | 'Chinese (Mandarin)_Gentleman'
  | 'Chinese (Mandarin)_Warm_Bestie'
  | 'Chinese (Mandarin)_Male_Announcer'
  | 'Chinese (Mandarin)_Sweet_Lady'
  | 'Chinese (Mandarin)_Southern_Young_Man'
  | 'Chinese (Mandarin)_Wise_Women'
  | 'Chinese (Mandarin)_Gentle_Youth'
  | 'Chinese (Mandarin)_Warm_Girl'
  | 'Chinese (Mandarin)_Kind-hearted_Elder'
  | 'Chinese (Mandarin)_Cute_Spirit'
  | 'Chinese (Mandarin)_Radio_Host'
  | 'Chinese (Mandarin)_Lyrical_Voice'
  | 'Chinese (Mandarin)_Straightforward_Boy'
  | 'Chinese (Mandarin)_Sincere_Adult'
  | 'Chinese (Mandarin)_Gentle_Senior'
  | 'Chinese (Mandarin)_Stubborn_Friend'
  | 'Chinese (Mandarin)_Crisp_Girl'
  | 'Chinese (Mandarin)_Pure-hearted_Boy'
  | 'Chinese (Mandarin)_Soft_Girl';

/**
 * Minimax 中文（粤语）音色
 */
export type MinimaxChineseCantoneseVoice =
  | 'Cantonese_ProfessionalHost（F)'
  | 'Cantonese_GentleLady'
  | 'Cantonese_ProfessionalHost（M)'
  | 'Cantonese_PlayfulMan'
  | 'Cantonese_CuteGirl'
  | 'Cantonese_KindWoman';

/**
 * Minimax 英文音色
 */
export type MinimaxEnglishVoice =
  | 'Santa_Claus'
  | 'Grinch'
  | 'Rudolph'
  | 'Arnold'
  | 'Charming_Santa'
  | 'Charming_Lady'
  | 'Sweet_Girl'
  | 'Cute_Elf'
  | 'Attractive_Girl'
  | 'Serene_Woman'
  | 'English_Trustworthy_Man'
  | 'English_Graceful_Lady'
  | 'English_Aussie_Bloke'
  | 'English_Whispering_girl'
  | 'English_Diligent_Man'
  | 'English_Gentle-voiced_man';

/**
 * Minimax 日文音色
 */
export type MinimaxJapaneseVoice =
  | 'Japanese_IntellectualSenior'
  | 'Japanese_DecisivePrincess'
  | 'Japanese_LoyalKnight'
  | 'Japanese_DominantMan'
  | 'Japanese_SeriousCommander'
  | 'Japanese_ColdQueen'
  | 'Japanese_DependableWoman'
  | 'Japanese_GentleButler'
  | 'Japanese_KindLady'
  | 'Japanese_CalmLady'
  | 'Japanese_OptimisticYouth'
  | 'Japanese_GenerousIzakayaOwner'
  | 'Japanese_SportyStudent'
  | 'Japanese_InnocentBoy'
  | 'Japanese_GracefulMaiden';

/**
 * Minimax 韩文音色
 */
export type MinimaxKoreanVoice =
  | 'Korean_SweetGirl'
  | 'Korean_CheerfulBoyfriend'
  | 'Korean_EnchantingSister'
  | 'Korean_ShyGirl'
  | 'Korean_ReliableSister'
  | 'Korean_StrictBoss'
  | 'Korean_SassyGirl'
  | 'Korean_ChildhoodFriendGirl'
  | 'Korean_PlayboyCharmer'
  | 'Korean_ElegantPrincess'
  | 'Korean_BraveFemaleWarrior'
  | 'Korean_BraveYouth'
  | 'Korean_CalmLady'
  | 'Korean_EnthusiasticTeen'
  | 'Korean_SoothingLady'
  | 'Korean_IntellectualSenior'
  | 'Korean_LonelyWarrior'
  | 'Korean_MatureLady'
  | 'Korean_InnocentBoy'
  | 'Korean_CharmingSister'
  | 'Korean_AthleticStudent'
  | 'Korean_BraveAdventurer'
  | 'Korean_CalmGentleman'
  | 'Korean_WiseElf'
  | 'Korean_CheerfulCoolJunior'
  | 'Korean_DecisiveQueen'
  | 'Korean_ColdYoungMan'
  | 'Korean_MysteriousGirl'
  | 'Korean_QuirkyGirl'
  | 'Korean_ConsiderateSenior'
  | 'Korean_CheerfulLittleSister'
  | 'Korean_DominantMan'
  | 'Korean_AirheadedGirl'
  | 'Korean_ReliableYouth'
  | 'Korean_FriendlyBigSister'
  | 'Korean_GentleBoss'
  | 'Korean_ColdGirl'
  | 'Korean_HaughtyLady'
  | 'Korean_CharmingElderSister'
  | 'Korean_IntellectualMan'
  | 'Korean_CaringWoman'
  | 'Korean_WiseTeacher'
  | 'Korean_ConfidentBoss'
  | 'Korean_AthleticGirl'
  | 'Korean_PossessiveMan'
  | 'Korean_GentleWoman'
  | 'Korean_CockyGuy'
  | 'Korean_ThoughtfulWoman'
  | 'Korean_OptimisticYouth';

/**
 * Minimax 西班牙文音色
 */
export type MinimaxSpanishVoice =
  | 'Spanish_SereneWoman'
  | 'Spanish_MaturePartner'
  | 'Spanish_CaptivatingStoryteller'
  | 'Spanish_Narrator'
  | 'Spanish_WiseScholar'
  | 'Spanish_Kind-heartedGirl'
  | 'Spanish_DeterminedManager'
  | 'Spanish_BossyLeader'
  | 'Spanish_ReservedYoungMan'
  | 'Spanish_ConfidentWoman'
  | 'Spanish_ThoughtfulMan'
  | 'Spanish_Strong-WilledBoy'
  | 'Spanish_SophisticatedLady'
  | 'Spanish_RationalMan'
  | 'Spanish_AnimeCharacter'
  | 'Spanish_Deep-tonedMan'
  | 'Spanish_Fussyhostess'
  | 'Spanish_SincereTeen'
  | 'Spanish_FrankLady'
  | 'Spanish_Comedian'
  | 'Spanish_Debator'
  | 'Spanish_ToughBoss'
  | 'Spanish_Wiselady'
  | 'Spanish_Steadymentor'
  | 'Spanish_Jovialman'
  | 'Spanish_SantaClaus'
  | 'Spanish_Rudolph'
  | 'Spanish_Intonategirl'
  | 'Spanish_Arnold'
  | 'Spanish_Ghost'
  | 'Spanish_HumorousElder'
  | 'Spanish_EnergeticBoy'
  | 'Spanish_WhimsicalGirl'
  | 'Spanish_StrictBoss'
  | 'Spanish_ReliableMan'
  | 'Spanish_SereneElder'
  | 'Spanish_AngryMan'
  | 'Spanish_AssertiveQueen'
  | 'Spanish_CaringGirlfriend'
  | 'Spanish_PowerfulSoldier'
  | 'Spanish_PassionateWarrior'
  | 'Spanish_ChattyGirl'
  | 'Spanish_RomanticHusband'
  | 'Spanish_CompellingGirl'
  | 'Spanish_PowerfulVeteran'
  | 'Spanish_SensibleManager'
  | 'Spanish_ThoughtfulLady';

/**
 * Minimax 葡萄牙文音色
 */
export type MinimaxPortugueseVoice =
  | 'Portuguese_SentimentalLady'
  | 'Portuguese_BossyLeader'
  | 'Portuguese_Wiselady'
  | 'Portuguese_Strong-WilledBoy'
  | 'Portuguese_Deep-VoicedGentleman'
  | 'Portuguese_UpsetGirl'
  | 'Portuguese_PassionateWarrior'
  | 'Portuguese_AnimeCharacter'
  | 'Portuguese_ConfidentWoman'
  | 'Portuguese_AngryMan'
  | 'Portuguese_CaptivatingStoryteller'
  | 'Portuguese_Godfather'
  | 'Portuguese_ReservedYoungMan'
  | 'Portuguese_SmartYoungGirl'
  | 'Portuguese_Kind-heartedGirl'
  | 'Portuguese_Pompouslady'
  | 'Portuguese_Grinch'
  | 'Portuguese_Debator'
  | 'Portuguese_SweetGirl'
  | 'Portuguese_AttractiveGirl'
  | 'Portuguese_ThoughtfulMan'
  | 'Portuguese_PlayfulGirl'
  | 'Portuguese_GorgeousLady'
  | 'Portuguese_LovelyLady'
  | 'Portuguese_SereneWoman'
  | 'Portuguese_SadTeen'
  | 'Portuguese_MaturePartner'
  | 'Portuguese_Comedian'
  | 'Portuguese_NaughtySchoolgirl'
  | 'Portuguese_Narrator'
  | 'Portuguese_ToughBoss'
  | 'Portuguese_Fussyhostess'
  | 'Portuguese_Dramatist'
  | 'Portuguese_Steadymentor'
  | 'Portuguese_Jovialman'
  | 'Portuguese_CharmingQueen'
  | 'Portuguese_SantaClaus'
  | 'Portuguese_Rudolph'
  | 'Portuguese_Arnold'
  | 'Portuguese_CharmingSanta'
  | 'Portuguese_CharmingLady'
  | 'Portuguese_Ghost'
  | 'Portuguese_HumorousElder'
  | 'Portuguese_CalmLeader'
  | 'Portuguese_GentleTeacher'
  | 'Portuguese_EnergeticBoy'
  | 'Portuguese_ReliableMan'
  | 'Portuguese_SereneElder'
  | 'Portuguese_GrimReaper'
  | 'Portuguese_AssertiveQueen'
  | 'Portuguese_WhimsicalGirl'
  | 'Portuguese_StressedLady'
  | 'Portuguese_FriendlyNeighbor'
  | 'Portuguese_CaringGirlfriend'
  | 'Portuguese_PowerfulSoldier'
  | 'Portuguese_FascinatingBoy'
  | 'Portuguese_RomanticHusband'
  | 'Portuguese_StrictBoss'
  | 'Portuguese_InspiringLady'
  | 'Portuguese_PlayfulSpirit'
  | 'Portuguese_ElegantGirl'
  | 'Portuguese_CompellingGirl'
  | 'Portuguese_PowerfulVeteran'
  | 'Portuguese_SensibleManager'
  | 'Portuguese_ThoughtfulLady'
  | 'Portuguese_TheatricalActor'
  | 'Portuguese_FragileBoy'
  | 'Portuguese_ChattyGirl'
  | 'Portuguese_Conscientiousinstructor'
  | 'Portuguese_RationalMan'
  | 'Portuguese_WiseScholar'
  | 'Portuguese_FrankLady'
  | 'Portuguese_DeterminedManager';

/**
 * Minimax 法文音色
 */
export type MinimaxFrenchVoice =
  | 'French_Male_Speech_New'
  | 'French_Female_News Anchor'
  | 'French_CasualMan'
  | 'French_MovieLeadFemale'
  | 'French_FemaleAnchor'
  | 'French_MaleNarrator';

/**
 * Minimax 印尼文音色
 */
export type MinimaxIndonesianVoice =
  | 'Indonesian_SweetGirl'
  | 'Indonesian_ReservedYoungMan'
  | 'Indonesian_CharmingGirl'
  | 'Indonesian_CalmWoman'
  | 'Indonesian_ConfidentWoman'
  | 'Indonesian_CaringMan'
  | 'Indonesian_BossyLeader'
  | 'Indonesian_DeterminedBoy'
  | 'Indonesian_GentleGirl';

/**
 * Minimax 德文音色
 */
export type MinimaxGermanVoice = 'German_FriendlyMan' | 'German_SweetLady' | 'German_PlayfulMan';

/**
 * Minimax 俄文音色
 */
export type MinimaxRussianVoice =
  | 'Russian_HandsomeChildhoodFriend'
  | 'Russian_BrightHeroine'
  | 'Russian_AmbitiousWoman'
  | 'Russian_ReliableMan'
  | 'Russian_CrazyQueen'
  | 'Russian_PessimisticGirl'
  | 'Russian_AttractiveGuy'
  | 'Russian_Bad-temperedBoy';

/**
 * Minimax 意大利文音色
 */
export type MinimaxItalianVoice =
  | 'Italian_BraveHeroine'
  | 'Italian_Narrator'
  | 'Italian_WanderingSorcerer'
  | 'Italian_DiligentLeader';

/**
 * Minimax 阿拉伯文音色
 */
export type MinimaxArabicVoice = 'Arabic_CalmWoman' | 'Arabic_FriendlyGuy';

/**
 * Minimax 土耳其文音色
 */
export type MinimaxTurkishVoice = 'Turkish_CalmWoman' | 'Turkish_Trustworthyman';

/**
 * Minimax 乌克兰文音色
 */
export type MinimaxUkrainianVoice = 'Ukrainian_CalmWoman' | 'Ukrainian_WiseScholar';

/**
 * Minimax 荷兰文音色
 */
export type MinimaxDutchVoice = 'Dutch_kindhearted_girl' | 'Dutch_bossy_leader';

/**
 * Minimax 越南文音色
 */
export type MinimaxVietnameseVoice = 'Vietnamese_kindhearted_girl';

/**
 * Minimax 泰文音色
 */
export type MinimaxThaiVoice =
  | 'Thai_male_1_sample8'
  | 'Thai_male_2_sample2'
  | 'Thai_female_1_sample1'
  | 'Thai_female_2_sample2';

/**
 * Minimax 波兰文音色
 */
export type MinimaxPolishVoice =
  | 'Polish_male_1_sample4'
  | 'Polish_male_2_sample3'
  | 'Polish_female_1_sample1'
  | 'Polish_female_2_sample3';

/**
 * Minimax 罗马尼亚文音色
 */
export type MinimaxRomanianVoice =
  | 'Romanian_male_1_sample2'
  | 'Romanian_male_2_sample1'
  | 'Romanian_female_1_sample4'
  | 'Romanian_female_2_sample1';

/**
 * Minimax 希腊文音色
 */
export type MinimaxGreekVoice =
  | 'greek_male_1a_v1'
  | 'Greek_female_1_sample1'
  | 'Greek_female_2_sample3';

/**
 * Minimax 捷克文音色
 */
export type MinimaxCzechVoice = 'czech_male_1_v1' | 'czech_female_5_v7' | 'czech_female_2_v2';

/**
 * Minimax 芬兰文音色
 */
export type MinimaxFinnishVoice = 'finnish_male_3_v1' | 'finnish_male_1_v2' | 'finnish_female_4_v1';

/**
 * Minimax 印地文音色
 */
export type MinimaxHindiVoice = 'hindi_male_1_v2' | 'hindi_female_2_v1' | 'hindi_female_1_v2';

/**
 * Minimax 全部音色（所有语言合集）
 */
export type MinimaxVoice =
  | MinimaxChineseMandarinVoice
  | MinimaxChineseCantoneseVoice
  | MinimaxEnglishVoice
  | MinimaxJapaneseVoice
  | MinimaxKoreanVoice
  | MinimaxSpanishVoice
  | MinimaxPortugueseVoice
  | MinimaxFrenchVoice
  | MinimaxIndonesianVoice
  | MinimaxGermanVoice
  | MinimaxRussianVoice
  | MinimaxItalianVoice
  | MinimaxArabicVoice
  | MinimaxTurkishVoice
  | MinimaxUkrainianVoice
  | MinimaxDutchVoice
  | MinimaxVietnameseVoice
  | MinimaxThaiVoice
  | MinimaxPolishVoice
  | MinimaxRomanianVoice
  | MinimaxGreekVoice
  | MinimaxCzechVoice
  | MinimaxFinnishVoice
  | MinimaxHindiVoice;
