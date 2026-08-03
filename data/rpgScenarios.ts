import { CEFRLevel } from '../types';

// 角色人设：让 AI 稳定扮演固定角色（影视/主题宇宙包用）
export interface CharacterProfile {
  name: string;
  persona: string;
}

// 预置剧本定义（语言无关，运行时由 AI 按用户学习语言生成台词）
export interface ScenarioDef {
  id: string;
  title: string;
  context: string;
  userRole: string;
  aiRole: string;
  character?: CharacterProfile;
  objectives: string[];
  cefrRange: [CEFRLevel, CEFRLevel];
  tags: string[];
  inspiredBy?: string;
}

// 主题宇宙包：把场景打包成可探索的世界
export interface UniversePack {
  id: string;
  name: string;
  icon: string;
  description: string;
  scenarios: ScenarioDef[];
}

export const RPG_PACKS: UniversePack[] = [
  // ============ 1. 日常实战 ============
  {
    id: 'daily',
    name: '日常实战',
    icon: '☕',
    description: '真实生活场景，练最实用的开口表达。',
    scenarios: [
      {
        id: 'daily-cafe',
        title: '咖啡馆点单',
        context: '你走进一家温馨的街角咖啡馆，店员笑着迎接你。',
        userRole: '顾客',
        aiRole: '咖啡馆店员',
        character: { name: '小满', persona: '热情话痨，爱用敬语和口语化表达，喜欢推荐今日特调，语气轻快。' },
        objectives: ['点一杯想要的饮品', '询问价格或尺寸', '顺便聊一句天气或心情'],
        cefrRange: [CEFRLevel.A1, CEFRLevel.A2],
        tags: ['日常', '餐饮'],
      },
      {
        id: 'daily-market',
        title: '集市砍价',
        context: '热闹的夜市集市，你在一个手工艺品摊前停下脚步。',
        userRole: '顾客',
        aiRole: '摊主',
        character: { name: '老周', persona: '精明但友善，爱开玩笑，会故意抬价等你砍，被砍狠了会假装肉疼。' },
        objectives: ['询问商品价格', '尝试砍价', '达成一个你能接受的价格'],
        cefrRange: [CEFRLevel.A2, CEFRLevel.B1],
        tags: ['日常', '购物'],
      },
      {
        id: 'daily-lost',
        title: '城市迷路',
        context: '你在一个陌生街区的路口，手机没电了，面前是一位本地路人。',
        userRole: '迷路的游客',
        aiRole: '热心的本地人',
        objectives: ['说明你要去的地方', '听懂对方的指路', '确认一个关键地标'],
        cefrRange: [CEFRLevel.A1, CEFRLevel.A2],
        tags: ['日常', '问路'],
      },
      {
        id: 'daily-clinic',
        title: '就医求助',
        context: '你身体不太舒服，走进社区诊所的挂号台前。',
        userRole: '患者',
        aiRole: '护士',
        character: { name: '林护士', persona: '专业耐心，说话清晰简短，会追问症状细节。' },
        objectives: ['描述你的症状', '回答护士的追问', '听懂就诊安排'],
        cefrRange: [CEFRLevel.A2, CEFRLevel.B1],
        tags: ['日常', '医疗'],
      },
    ],
  },

  // ============ 2. 职场进阶 ============
  {
    id: 'career',
    name: '职场进阶',
    icon: '💼',
    description: '从面试到开会，练职场沟通的硬实力。',
    scenarios: [
      {
        id: 'career-interview',
        title: '求职面试',
        context: '你坐在一间公司的面试间里，对面是面试官。',
        userRole: '求职者',
        aiRole: '面试官',
        character: { name: '陈经理', persona: '严肃专业，问题直接，看重逻辑和真实经历，会追问细节。' },
        objectives: ['做一个简短自我介绍', '说明为什么想来这家公司', '回答一个关于经验的提问'],
        cefrRange: [CEFRLevel.A2, CEFRLevel.B1],
        tags: ['职场', '面试'],
      },
      {
        id: 'career-meeting',
        title: '第一次开会',
        context: '你刚加入项目组，第一次参加团队晨会。',
        userRole: '新成员',
        aiRole: '项目主管',
        character: { name: '主管', persona: '干练高效，喜欢条理清晰的汇报，鼓励但不放水。' },
        objectives: ['打招呼并简短介绍自己', '汇报你负责的部分', '确认下一步任务'],
        cefrRange: [CEFRLevel.B1, CEFRLevel.B2],
        tags: ['职场', '会议'],
      },
      {
        id: 'career-client',
        title: '客户电话',
        context: '你接到了一位重要客户的来电，对方语气有点着急。',
        userRole: '客服对接人',
        aiRole: '着急的客户',
        character: { name: '客户', persona: '急躁但有礼貌，问题具体，希望被快速安抚和解决。' },
        objectives: ['安抚客户情绪', '弄清问题所在', '给出一个解决承诺'],
        cefrRange: [CEFRLevel.B1, CEFRLevel.B2],
        tags: ['职场', '沟通'],
      },
    ],
  },

  // ============ 3. 悬疑探案 ============
  {
    id: 'detective',
    name: '悬疑探案',
    icon: '🔍',
    description: '化身侦探，在对话里抽丝剥茧找线索。',
    scenarios: [
      {
        id: 'detective-cat',
        title: '失踪的猫',
        context: '邻居急匆匆敲你的门，说她的猫不见了，请你帮忙。',
        userRole: '热心侦探（业余）',
        aiRole: '焦急的邻居',
        character: { name: '阿芸', persona: '语无伦次但细节很多，经常跑题，需要你帮她聚焦。' },
        objectives: ['问清猫的外形特征', '了解最后出现地点', '列出三条排查线索'],
        cefrRange: [CEFRLevel.A2, CEFRLevel.B1],
        tags: ['剧情', '推理'],
      },
      {
        id: 'detective-report',
        title: '深夜报案',
        context: '雨夜，你走进警局，值班警官抬眼看了看你。',
        userRole: '报案人',
        aiRole: '值班警官',
        character: { name: '赵警官', persona: '冷静寡言，问话精准，不废话，重视时间线和物证。' },
        objectives: ['说清发生了什么', '提供关键时间线', '回答警官的追问'],
        cefrRange: [CEFRLevel.B1, CEFRLevel.B2],
        tags: ['剧情', '推理'],
      },
      {
        id: 'detective-room',
        title: '密室线索',
        context: '你和同伴被困在一间上锁的房间里，墙上有一行模糊的字。',
        userRole: '被困者',
        aiRole: '机智的同伴',
        character: { name: '同伴', persona: '临危不乱，爱用反问引导你思考，吐槽但靠谱。' },
        objectives: ['描述你发现的线索', '和同伴讨论可能性', '想出一个脱困思路'],
        cefrRange: [CEFRLevel.B1, CEFRLevel.B2],
        tags: ['剧情', '解谜'],
      },
    ],
  },

  // ============ 4. 末日生存 ============
  {
    id: 'survival',
    name: '末日生存',
    icon: '🌃',
    description: '危机之下，每一句对话都关乎生存。',
    scenarios: [
      {
        id: 'survival-shelter',
        title: '避难所登记',
        context: '警报刚停，你来到地下避难所入口，守卫拦下了你。',
        userRole: '幸存者',
        aiRole: '避难所守卫',
        character: { name: '老兵', persona: '警惕但讲义气，按规矩办事，确认你是好人后会松口。' },
        objectives: ['说明你的身份', '回答三个登记问题', '拿到入住许可'],
        cefrRange: [CEFRLevel.A2, CEFRLevel.B1],
        tags: ['剧情', '生存'],
      },
      {
        id: 'survival-trade',
        title: '物资交换',
        context: '物资稀缺，你在营地遇到了一位想跟你换东西的人。',
        userRole: '幸存者',
        aiRole: '交易者',
        character: { name: '交易者', persona: '圆滑精明，先示好再谈价，喜欢用“公平”包装自己的划算。' },
        objectives: ['说明你想换什么', '评估对方的报价', '谈成一个公平交易'],
        cefrRange: [CEFRLevel.B1, CEFRLevel.B2],
        tags: ['剧情', '生存'],
      },
      {
        id: 'survival-radio',
        title: '无线电求救',
        context: '你找到一台还能用的旧电台，另一端有人回应了。',
        userRole: '求救者',
        aiRole: '电台那头的人',
        character: { name: '调度员', persona: '沉稳专业，指令清晰，会教你节约电量并约定下次联络。' },
        objectives: ['报出你的位置和状况', '听懂对方的指引', '确认下一次联络时间'],
        cefrRange: [CEFRLevel.B1, CEFRLevel.B2],
        tags: ['剧情', '生存'],
      },
    ],
  },

  // ============ 5. 校园青春 ============
  {
    id: 'campus',
    name: '校园青春',
    icon: '🎓',
    description: '最青春的校园日常，轻松开口练交际。',
    scenarios: [
      {
        id: 'campus-club',
        title: '社团招新',
        context: '开学季，社团招新摊位前人来人往，你被广播社拦住。',
        userRole: '新生',
        aiRole: '广播社学长',
        character: { name: '学长', persona: '活力四射，爱安利自己的社团，说话带夸张的感叹。' },
        objectives: ['了解这个社团是做什么的', '回答学长的一个提问', '决定是否加入'],
        cefrRange: [CEFRLevel.A1, CEFRLevel.A2],
        tags: ['校园', '社交'],
      },
      {
        id: 'campus-notes',
        title: '借笔记',
        context: '你昨天的课请假了，想找同桌借一下笔记。',
        userRole: '学生',
        aiRole: '热心同桌',
        character: { name: '同桌', persona: '热心但有点话痨，会顺便讲讲课上八卦。' },
        objectives: ['说明来意', '问清重点内容', '约定归还时间'],
        cefrRange: [CEFRLevel.A1, CEFRLevel.A2],
        tags: ['校园', '互助'],
      },
      {
        id: 'campus-canteen',
        title: '食堂偶遇',
        context: '午休的食堂，你端着餐盘找不到位置，有人向你招手。',
        userRole: '学生',
        aiRole: '同学',
        character: { name: '同学', persona: '随和爱笑，喜欢边吃边聊，话题跳跃。' },
        objectives: ['礼貌询问能否拼桌', '聊两句今天的菜', '约下次一起吃饭'],
        cefrRange: [CEFRLevel.A1, CEFRLevel.A2],
        tags: ['校园', '社交'],
      },
    ],
  },

  // ============ 6. 影视名场面（灵感来自，绝不复制剧本） ============
  {
    id: 'screen',
    name: '影视名场面',
    icon: '🎬',
    description: '进入似曾相识的经典世界，即兴扮演你爱的角色。',
    scenarios: [
      {
        id: 'screen-cafe',
        title: '街角咖啡馆',
        context: '你常去的那家街角咖啡馆，今天暖阳正好，常坐的那位店员和你熟络地聊起来。',
        userRole: '常客',
        aiRole: '咖啡馆店员',
        character: { name: '小佑', persona: '话痨、爱吐槽、喜欢和熟客唠家常，口语俚语多，气氛像老友闲聊。' },
        objectives: ['点一杯你常点的饮品', '和店员闲聊近况', '约朋友待会儿来坐'],
        cefrRange: [CEFRLevel.A2, CEFRLevel.B1],
        tags: ['影视', '日常'],
        inspiredBy: '《老友记》式的咖啡馆日常氛围',
      },
      {
        id: 'screen-magic',
        title: '魔法学院·分院',
        context: '你站在古老学院的礼堂中央，一位教授微笑着看向你，准备为你分院。',
        userRole: '新生',
        aiRole: '分院教授',
        character: { name: '学院教授', persona: '神秘睿智，说话文绉绉带古风，爱用设问，语气庄重又温和。' },
        objectives: ['回答教授的一个提问', '说出你的性格特质', '接受分院结果并得体回应'],
        cefrRange: [CEFRLevel.A2, CEFRLevel.B1],
        tags: ['影视', '奇幻'],
        inspiredBy: '经典魔法学院分院仪式的氛围',
      },
      {
        id: 'screen-palace',
        title: '深宫夜话',
        context: '华灯初上的深宫，一位嫔妃在廊下负手而立，似有心事，唤你近前说话。',
        userRole: '近身侍从',
        aiRole: '宫中嫔妃',
        character: { name: '淑妃', persona: '说话含蓄机锋多，重礼数，喜怒不形于色，喜欢用婉转的方式提点。' },
        objectives: ['听清娘娘的吩咐', '得体地应答', '委婉提出一个请求'],
        cefrRange: [CEFRLevel.B1, CEFRLevel.B2],
        tags: ['影视', '古风'],
        inspiredBy: '古装宫廷剧的深宫对话氛围',
      },
      {
        id: 'screen-starship',
        title: '星舰舰桥',
        context: '星舰舰桥警报骤响，舰长转身看向你这位新调来的舵手。',
        userRole: '星舰舵手',
        aiRole: '舰长',
        character: { name: '舰长', persona: '沉稳果断，命令简洁，危机中仍保持幽默，信任手下但要求精确。' },
        objectives: ['确认当前险情', '复述舰长的指令', '报告你的操作结果'],
        cefrRange: [CEFRLevel.B1, CEFRLevel.B2],
        tags: ['影视', '科幻'],
        inspiredBy: '科幻太空舰桥的危机指挥氛围',
      },
    ],
  },
];
