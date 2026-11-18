/* ============================================================
   data.js — 2.0 素材总表 / 场景-剧情一一对应
   67 场景 · 12 立绘 · 10 粒子 · 章节索引
   全部素材取自《场景·角色·粒子图集》翻版
   ============================================================ */
(function () {
  'use strict';
  const V = (window.V2DATA = {});

  /* ---------- 角色：12 名 ---------- */
  V.CAST = {
    carl:    { file: 'CH-01', name: '卡尔',   sub: 'K-07 · 锈蚀猎人' },
    sylusB:  { file: 'CH-02', name: '塞勒斯', sub: 'MK-ECO-01 · 酒吧' },
    sylusG:  { file: 'CH-03', name: '塞勒斯', sub: 'MK-ECO-01 · 温室' },
    anvil:   { file: 'CH-04', name: '铁砧',   sub: 'ENG-09 · 工程机' },
    sparrow: { file: 'CH-05', name: '灰雀',   sub: 'MED-02 · 医护' },
    reed:    { file: 'CH-06', name: '芦苇',   sub: 'CHD-11 · 孩子型号' },
    wax:     { file: 'CH-07', name: '蜡',     sub: '穹顶居民' },
    lan:     { file: 'CH-08', name: '岚',     sub: 'K-11 · 猎人' },
    azhu:    { file: 'CH-09', name: '阿竹',   sub: '锈街 · 地下诊所' },
    boss:    { file: 'CH-10', name: '上司',   sub: '创生集团 · 地脉事业部' },
    resident:{ file: 'CH-11', name: '拾荒者', sub: '旧城区居民' },
    guard:   { file: 'CH-12', name: '企业肃卫', sub: '白鲸私保' },
  };

  /* ---------- 粒子：10 张 ---------- */
  V.PARTICLES = {
    petal:  'PT-01', pollen: 'PT-02', leaf:   'PT-03', fall:  'PT-04',
    rain:   'PT-05', dust:   'PT-06', rust:   'PT-07', ember: 'PT-08',
    snow:   'PT-09', neon:   'PT-10',
  };

  /* ---------- 调色预设（电影级） ---------- */
  V.GRADE = {
    void:     { exposure: .78, contrast: 1.18, sat: .20, temp: -.02, tint: '#05070b', vignette: .82 },
    rust:     { exposure: .96, contrast: 1.14, sat: 1.12, temp: .16,  tint: '#E2762B', vignette: .62 },
    neon:     { exposure: .94, contrast: 1.20, sat: 1.24, temp: -.08, tint: '#c0308c', vignette: .66 },
    noir:     { exposure: .86, contrast: 1.22, sat: .52,  temp: -.04, tint: '#111820', vignette: .74 },
    memory:   { exposure: .92, contrast: 1.16, sat: 1.06,  temp: .30,  tint: '#d8622a', vignette: .72 },
    dome:     { exposure: 1.02, contrast: 1.06, sat: .80,  temp: -.05, tint: '#6B7F52', vignette: .54 },
    overcast: { exposure: 1.06, contrast: 1.04, sat: .62,  temp: -.08, tint: '#8FA3A8', vignette: .50 },
    green:    { exposure: 1.06, contrast: 1.08, sat: 1.04, temp: .12,  tint: '#D9B36C', vignette: .48 },
    bright:   { exposure: 1.20, contrast: 1.02, sat: 1.02, temp: .10,  tint: '#cfe0c0', vignette: .36 },
    cold:     { exposure: .94, contrast: 1.14, sat: .58,  temp: -.22, tint: '#4b88b8', vignette: .70 },
    fire:     { exposure: .98, contrast: 1.22, sat: 1.22, temp: .30,  tint: '#e0531c', vignette: .68 },
    archive:  { exposure: 1.02, contrast: 1.08, sat: .44,  temp: -.02, tint: '#8d9aa0', vignette: .56 },
    /* 第三幕拔枪之后：场内灯全灭。底图本身已提黑位做成淡色，这里只轻压暗角 */
    dim:      { exposure: 1.00, contrast: 1.04, sat: .78,  temp: .06,  tint: '#c8b49a', vignette: .44 },
    log:      { exposure: .70, contrast: 1.02, sat: .06,  temp: 0,    tint: '#050505', vignette: .90 },
  };

  /* ---------- 天气/氛围预设（真实粒子贴图） ---------- */
  V.WEATHER = {
    rain:     { layers: [['rain', 1.0, 1.0], ['dust', .22, .5]], wind: -.16, fog: .10, wet: .82 },
    storm:    { layers: [['rain', 1.5, 1.2], ['rust', .35, .6]], wind: -.34, fog: .18, wet: .94 },
    neonrain: { layers: [['rain', .9, 1.0], ['neon', .8, 1.0], ['dust', .2, .5]], wind: -.18, fog: .12, wet: .88 },
    drizzle:  { layers: [['rain', .40, .7], ['dust', .18, .4]], wind: -.08, fog: .08, wet: .55 },
    dome:     { layers: [['pollen', .55, .8], ['dust', .28, .5]], wind: .06, fog: .06, wet: .20 },
    greenhouse:{ layers: [['pollen', .72, 1.0], ['petal', .40, .8], ['leaf', .22, .6]], wind: .05, fog: .05, wet: .14 },
    bloom:    { layers: [['petal', .85, 1.0], ['pollen', .9, 1.0], ['leaf', .3, .7]], wind: .10, fog: .04, wet: .10 },
    ember:    { layers: [['ember', 1.0, 1.0], ['rust', .6, .9], ['dust', .4, .6]], wind: .18, fog: .22, wet: .10 },
    dust:     { layers: [['dust', .9, .9], ['rust', .2, .5]], wind: .04, fog: .10, wet: .05 },
    smoke:    { layers: [['dust', 1.1, .6], ['ember', .22, .5]], wind: .03, fog: .20, wet: .08 },
    snowfall: { layers: [['snow', .8, .9]], wind: .02, fog: .12, wet: .2 },
    none:     { layers: [], wind: 0, fog: 0, wet: 0 },
  };

  /* ---------- 镜头预设 ---------- */
  V.CAM = {
    static:   { z: 1.04, drift: .006, push: .000, sway: .004 },
    push:     { z: 1.06, drift: .010, push: .012, sway: .006 },
    pull:     { z: 1.02, drift: .008, push: -.010, sway: .005 },
    pan:      { z: 1.10, drift: .016, push: .004, sway: .010, pan: .5 },
    handheld: { z: 1.08, drift: .022, push: .006, sway: .018 },
    drift:    { z: 1.05, drift: .014, push: .003, sway: .008 },
    close:    { z: 1.24, drift: .010, push: .010, sway: .006 },
    epic:     { z: 1.02, drift: .008, push: -.006, sway: .004 },
    shake:    { z: 1.08, drift: .030, push: .000, sway: .030 },
  };

  /* ---------- 67 场景：编号 → 剧情节点（一一对应） ---------- */
  /* g=调色 w=天气 c=镜头 m=配乐 act=所属章节 */
  const SCN = [
    ['SC-01','序章 · 屏幕上的第一行字','void','none','static','void','序章'],
    ['SC-02','锈街巷道 · 暴雨夜','rust','neonrain','handheld','alley','第一幕'],
    ['SC-03','破玻璃窗口 · 接头','noir','rain','close','alley','第一幕'],
    ['SC-04','记忆残片 01 · 排水管','memory','ember','close','memory','第一幕'],
    ['SC-05','霓虹照不到的灰色深处 · 通话','noir','rain','drift','alley','第二幕'],
    ['SC-06','鲸落 · 初遇','neon','smoke','drift','bar','第二幕'],
    /* 拔枪之后全场灯灭：低饱和暖暗、灯球停转、浮尘静止 —— 用 dim + dust */
    ['SC-07','鲸落 · 次日 · 刀与枪','dim','dust','push','bar','第三幕'],
    ['SC-08','鲸落 · 暗门与通道','noir','dust','push','bar','第三幕'],
    ['SC-09','锈街 · 组织联络点','rust','drizzle','static','bar','第七幕 A'],
    ['SC-10','锈街 · 地下诊所','archive','drizzle','static','room','第七幕 B'],
    ['SC-11','锈街 · 垃圾压缩站后的围堵','rust','dust','handheld','room','第七幕 B'],
    ['SC-12','上层区 · 带虚拟花园的公寓','bright','none','static','room','结局一'],
    ['SC-13','城市档案馆 · 地下三层','archive','dust','static','room','结局三'],
    ['SC-14','全球 · 三十七块屏幕','cold','none','pull','tower','结局二'],
    ['SC-15','穹顶外沿 · 门洞初见','dome','drizzle','pull','dome','第四幕'],
    ['SC-16','穹顶 · 生活区','dome','dome','pan','dome','第四幕'],
    ['SC-17','穹顶 · 酸雨','overcast','storm','close','rain','第四幕'],
    ['SC-18','温室 · 初入','green','greenhouse','push','green','第四幕'],
    ['SC-19','廊下 · 她第一次','overcast','drizzle','static','dome','第四幕'],
    ['SC-20','储藏间 · 收音机','noir','dust','close','room','间章'],
    ['SC-21','温室 · 花','green','bloom','static','green','间章'],
    ['SC-22','门前走廊 · 门','noir','drizzle','static','room','间章'],
    ['SC-23','温室深处 · 一个词','green','greenhouse','close','green','间章'],
    ['SC-24','温室 · 半个月后夜','green','greenhouse','drift','night','第五幕'],
    ['SC-25','蓄水池 · 铁砧','dome','dome','static','water','第五幕'],
    ['SC-26','三号渠 · 焊渠','noir','drizzle','close','water','第五幕'],
    ['SC-27','议事棚 · 分裂','dome','dust','static','room','第五幕'],
    ['SC-28','住处 · 假背叛','noir','rain','shake','tense','第五幕'],
    ['SC-29','蓄水池 · 探照灯 · 叫停','cold','rain','close','tense','第五幕'],
    ['SC-30','工具间 · 蜡的手','noir','dust','close','room','第五幕'],
    ['SC-31','住处 · 第 17 天 · 锈','noir','rain','handheld','tense','第五幕'],
    ['SC-32','温室 · 坦白','green','greenhouse','close','green','第五幕'],
    ['SC-33','温室 · 手术灯','cold','none','close','surgery','第五幕'],
    ['SC-34','温室深处 · 灌溉','green','bloom','close','green','第五幕'],
    ['SC-35','观测塔外 · 目标置换','overcast','drizzle','pull','tower','第五幕'],
    ['SC-36','观测塔内 · 地籍','archive','dust','close','archive','第六幕'],
    ['SC-37','温室 · 崩塌','green','greenhouse','shake','green','第六幕'],
    ['SC-38','观测塔内 · 服务器','archive','dust','static','archive','第六幕'],
    ['SC-39','温室深处 · 我杀不了人','green','greenhouse','close','green','第六幕'],
    ['SC-40','温室 · 雨夜 · 写计划','noir','rain','static','night','第七幕 A'],
    ['SC-41','穹顶外沿 · 雨中 · 赴约','noir','storm','close','rain','第七幕 A'],
    ['SC-42','穹顶外沿 · 取核心','noir','rain','close','rain','第七幕 A'],
    ['SC-43','住处 · 抽屉与枪','noir','none','close','tense','第七幕 B'],
    ['SC-44','穹顶入口 · 火','fire','ember','shake','battle','第七幕 B'],
    ['SC-45','温室 · 六天后 · 忘词','green','greenhouse','static','green','第七幕 B'],
    ['SC-46','渠边 · 她第二次','overcast','rain','static','dome','第七幕 B'],
    ['SC-47','温室 · 岚','noir','rain','close','tense','第八幕'],
    ['SC-48','温室 · 枪声之后','fire','rain','close','tense','第九幕'],
    ['SC-49','温室 · 黎明前 · 自毁','cold','none','close','surgery','第九幕'],
    ['SC-50','温室 · 种子','cold','none','close','surgery','第九幕'],
    ['SC-51','温室 · 四十一盏灯 · 分流','green','bloom','pull','tide','隐藏结局'],
    ['SC-52','温室 · 晨曦 · 代价','bright','bloom','static','tide','隐藏结局'],
    ['SC-53','温室 · 春天 · 一首诗','bright','bloom','pull','tide','隐藏结局'],
    ['SC-54','温室 · 枪声之前 · 放下枪','noir','rain','handheld','tense','结局三'],
    ['SC-55','温室 · 血','fire','rain','close','tense','结局三'],
    ['SC-56','温室 · 第二年春天','bright','bloom','pull','tide','结局二'],
    ['SC-57','穹顶外沿 · 渠边（卷零）','overcast','rain','static','dome','卷零'],
    ['SC-58','穹顶外沿 · 渠边 · 天将亮（跋）','overcast','drizzle','pull','dome','跋'],
    ['SC-59','数据塔 · 接入室','cold','none','push','tower','终章'],
    ['SC-60','数据塔顶层 · 警报与心跳','fire','ember','shake','battle','终章'],
    ['SC-61','卷首 · 黑屏调频','log','none','static','void','第二周目'],
    ['SC-62','日志层 · 纯黑等宽界面','log','none','static','void','第二周目'],
    /* 合诗是全剧情绪的顶点，不该落在黑屏的 void 里：给它 duet（两列字互相等） */
    ['SC-63','合诗 · 双列同屏','log','none','static','duet','第二周目'],
    ['SC-64','倒带 · 雪花字定格','log','dust','static','void','第二周目'],
    ['SC-65','主菜单 · 渠边循环','overcast','rain','static','dome','主菜单'],
    ['SC-66','作者手记 · 旧平板','archive','dust','static','void','作者手记'],
    ['SC-67','存档 · 心电图纸','noir','none','static','void','存档'],
    /* Question 批次新素材：卡尔与塞勒斯同框（写实双人立绘合成，背景带舞台与吧台）。
       剧本里第二、三幕的酒吧对白直接用它做底图，不再叠两个 CSS 立绘。 */
    ['SC-68','鲸落 · 两个人','neon','smoke','drift','bar','第二幕'],
  ];
  V.SCENES = {};
  SCN.forEach(r => {
    V.SCENES[r[0]] = { code:r[0], name:r[1], grade:r[2], weather:r[3], cam:r[4], music:r[5], act:r[6] };
  });
  V.SCENE_LIST = SCN.map(r => r[0]);

  /* ---------- 章节索引（全章节，含未制作章节） ---------- */
  V.CHAPTERS = [
    { id:'ch00',  label:'卷零',       title:'渠边说（一）',     day:'—',        group:'第一周目' },
    { id:'chP',   label:'序 章',     title:'屏幕上的第一行字', day:'第 0 天',  group:'第一周目' },
    { id:'ch01',  label:'第 一 幕',  title:'冷雨与赏金',       day:'第 0 天',  group:'第一周目' },
    { id:'ch02',  label:'第 二 幕',  title:'钴蓝色的酒',       day:'第 1 天',  group:'第一周目' },
    { id:'ch03',  label:'第 三 幕',  title:'刀与手',           day:'第 2 天',  group:'第一周目' },
    { id:'ch04',  label:'第 四 幕',  title:'门后的穹顶',       day:'第 3 天',  group:'第一周目' },
    { id:'chInt', label:'间 章',     title:'没有记录的日子',   day:'第 4—16 天', group:'第一周目' },
    { id:'ch05',  label:'第 五 幕',  title:'温室里的叛徒',     day:'第 15—23 天', group:'第一周目' },
    { id:'ch06',  label:'第 六 幕',  title:'母亲的地籍',       day:'第 23 天', group:'第一周目' },
    { id:'ch07a', label:'第七幕 A',  title:'带路',             day:'第 44 天', group:'分支 · 离开' },
    { id:'end1',  label:'结局一',    title:'《锈》',           day:'第 47 天', group:'结局' },
    { id:'ch07b', label:'第七幕 B',  title:'火',               day:'第 31 天', group:'分支 · 留下' },
    { id:'ch08',  label:'第 八 幕',  title:'旧友',             day:'第 44 天', group:'分支 · 留下' },
    { id:'ch09',  label:'第 九 幕',  title:'白噪声',           day:'第 44 天', group:'分支 · 留下' },
    { id:'chFin', label:'终 章',     title:'数据塔',           day:'第 47 天', group:'分支 · 留下' },
    { id:'end2',  label:'结局二',    title:'《白噪声》',       day:'第 47 天', group:'结局' },
    { id:'end3',  label:'结局三',    title:'《未寄出的信》',   day:'第 44 天', group:'结局' },
    { id:'endT',  label:'隐藏结局',  title:'《潮汐》',         day:'第二年春', group:'结局' },
    { id:'wk2',   label:'第二周目',  title:'《维护日志》',     day:'记录 00—15', group:'第二周目' },
    { id:'duet',  label:'终章 · 合诗',title:'两列字',          day:'第 47 天', group:'第二周目' },
    { id:'epi',   label:'跋',        title:'渠边说（三）',     day:'天将亮',   group:'跋' },
    { id:'notes', label:'附录',      title:'作者手记',         day:'—',        group:'附录' },
  ];

  /* ---------- 心电诗集：12 联 + 4 首结局诗 ---------- */
  V.POEMS = [
    { tag:'序章',    lines:['一条线从黑幕里爬出来。','它还不知道，自己要爬多久。'] },
    { tag:'第一幕',  lines:['他拧紧一只不属于他的龙头。','雨没有停。水没有再漏。'] },
    { tag:'第二幕',  lines:['两只杯子碰了一下。','有一滴落在他的手上，是凉的。'] },
    { tag:'第三幕',  lines:['五十个人举起枪。','五十根食指，都放在扳机外面。'] },
    { tag:'第四幕',  lines:['一台机器站在雨里，不躲。','它说：你比我们像人。'] },
    { tag:'间章',    lines:['它响了三秒。','之后的三十分钟，没有人说话。'] },
    { tag:'第五幕',  lines:['四十七秒。','门外也有人，站了四十七秒。'] },
    { tag:'第六幕',  lines:['一百一十八个名字。','写到第四十一个，笔迹开始抖。'] },
    { tag:'第七幕 A',lines:['他把耳朵关掉了。','后来雨落在别人身上，也会响。'] },
    { tag:'第七幕 B',lines:['它把最后几个词，一个一个念完。','没有一个词，是留给自己的。'] },
    { tag:'第八幕',  lines:['三秒。','一个人的手快。另一个人的手在抖。'] },
    { tag:'第九幕',  lines:['心跳留一份，存放四十一处。','一。二。三。'] },
  ];
  V.END_POEMS = {
    end1: '雨落在别人身上，也会响。而我学会了，把耳朵关掉。你替我数的那些拍子，停在了第三个月。后来我又活了七个月，久到忘了自己曾经听过一场雨。',
    end2: '他们杀我的时候，我没有子弹。这不丢人。丢人的是他们以为，没有子弹的枪就不会响。我在最后听见了两个心跳，一个是我自己的，一个是你留给我的那半片海。现在这世界上每一块屏幕都在下雨。酸的那种。但是终于，没有人再骗我们，说雨是甜的。',
    end3: '你没有开枪。这是你这一生，唯一一次没有赢。你把一张纸塞进我口袋，纸上写着人类所犯下的滔天罪行，写着与我遥不可及的生命。你比我懂爱，你比我先离去。所以我活着，而你在那张纸上，比我自由。',
    endT: '没有一个人在死的时候，会希望自己只死一次。所以我把自己分成四十一份，交给四十一个还会开花的地方。现在你听见的每一声心跳，都是一行诗。念到「蜀葵」的时候，请替我，停一秒。',
  };

  /* ---------- 七处雪花字（倒带目标） ---------- */
  V.SNOW = [
    { id:1, text:'第0天。评估开始。',                              at:'序章',       unlock:'记录03 · 那是它第一次评估他' },
    { id:2, text:'目标：K-07。判定：可养护。',                     at:'第二幕',     unlock:'记录03 · 非授权维修，判定改为「可养护」' },
    { id:3, text:'涂层盐分：超限。许可淋雨：一次。已用完。',        at:'第四幕·雨中', unlock:'记录06 · 涂层超限 3.1 倍，需冲洗' },
    { id:4, text:'第3天。语句输出：你比我们像人。未理解。继续维护。',at:'第四幕·温室', unlock:'记录13 · 真实意图「你的手能修东西。留下。」' },
    { id:5, text:'分流演习。样本：一。损耗：可接受。',              at:'第五幕·手术', unlock:'记录08 · 本次拆解比例 1/2000' },
    { id:6, text:'二一三二年。排水管内生命体征：一。判定：可养护。授权：无。未执行。', at:'第六幕·影像', unlock:'记录01 · 管口站了 11 分钟，挪用 4 个字节记一个心率' },
    { id:7, text:'保险。已学会。用途：非我。',                     at:'第七幕 B·抽屉', unlock:'记录12 · 它问了三个人才学会开保险' },
  ];

  V.THEME = '还在运转的东西，不要拆。先看看它在维护谁。';
})();
