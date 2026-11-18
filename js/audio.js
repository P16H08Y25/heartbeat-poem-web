/* ============================================================
   audio.js — 2.0 程序化配乐 / 环境声 / 音效
   设计要点：所有声部都是常驻节点 + 参数渐变。
   绝不「停止再重建」，因此不会出现「播放一段时间后变质 / 无声」。
   修复问题总结 Scene-3 #1。
   ============================================================ */
(function () {
  'use strict';
  const A = (window.VAudio = {
    ready:false, enabled:true, master:null, ctx:null,
    cur:'void', _duck:1, _duckTarget:1,
  });

  let ctx, master, ambBus, musBus, sfxBus, comp;
  /* 音乐总线基准增益：duck（对白压低）结束后要回到这里，不能写死 .9 */
  const MUS_BASE=1.08;
  let noiseBuf=null, noiseBufPink=null;
  const ambNodes = {};   // 常驻环境声部
  const musNodes = {};    // 常驻配乐声部
  let beatTimer=null, beatStep=0, beatCfg=null;
  let lastBeatAt=0;
  let heartTimer=null;

  function now(){ return ctx.currentTime; }
  function gain(v){ const g=ctx.createGain(); g.gain.value=v; return g; }
  function filt(type,f,q){ const b=ctx.createBiquadFilter(); b.type=type; b.frequency.value=f; if(q!==undefined)b.Q.value=q; return b; }

  function makeNoise(sec, pink){
    const len=Math.floor(ctx.sampleRate*sec);
    const b=ctx.createBuffer(1,len,ctx.sampleRate);
    const d=b.getChannelData(0);
    if(!pink){ for(let i=0;i<len;i++) d[i]=Math.random()*2-1; }
    else{
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for(let i=0;i<len;i++){
        const w=Math.random()*2-1;
        b0=.99886*b0+w*.0555179; b1=.99332*b1+w*.0750759;
        b2=.96900*b2+w*.1538520; b3=.86650*b3+w*.3104856;
        b4=.55000*b4+w*.5329522; b5=-.7616*b5-w*.0168980;
        d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11; b6=w*.115926;
      }
    }
    return b;
  }
  function noiseSrc(pink){
    const s=ctx.createBufferSource(); s.buffer=pink?noiseBufPink:noiseBuf; s.loop=true; s.start(0); return s;
  }

  /* ---------------- 常驻环境声部 ---------------- */
  function buildAmb(){
    // rain：粉噪 + 高通 + 慢速 LFO 起伏
    {
      const s=noiseSrc(true), hp=filt('highpass',620), lp=filt('lowpass',7200);
      const g=gain(0), out=gain(1);
      s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out); out.connect(ambBus);
      const lfo=ctx.createOscillator(), la=gain(.012);
      lfo.frequency.value=.07; lfo.connect(la); la.connect(g.gain); lfo.start();
      ambNodes.rain={g,lfo,base:.075};
    }
    // wind / air：低通粉噪
    {
      const s=noiseSrc(true), lp=filt('lowpass',340), g=gain(0);
      s.connect(lp); lp.connect(g); g.connect(ambBus);
      const lfo=ctx.createOscillator(), la=gain(.010);
      lfo.frequency.value=.043; lfo.connect(la); la.connect(g.gain); lfo.start();
      ambNodes.air={g,lfo,base:.035};
    }
    // water：带通噪声 + 轻微颤动
    {
      const s=noiseSrc(false), bp=filt('bandpass',1150,.7), g=gain(0);
      s.connect(bp); bp.connect(g); g.connect(ambBus);
      const lfo=ctx.createOscillator(), la=gain(.008);
      lfo.frequency.value=.31; lfo.connect(la); la.connect(g.gain); lfo.start();
      ambNodes.water={g,lfo,base:.024};
    }
    // hum：机房低频
    {
      const o=ctx.createOscillator(), g=gain(0);
      o.type='sine'; o.frequency.value=52; o.connect(g); g.connect(ambBus); o.start();
      const o2=ctx.createOscillator(), g2=gain(0);
      o2.type='sine'; o2.frequency.value=104.3; o2.connect(g2); g2.connect(ambBus); o2.start();
      ambNodes.hum={g,g2,base:.012};
    }
    // servo：极轻的高频伺服
    {
      const o=ctx.createOscillator(), g=gain(0);
      o.type='triangle'; o.frequency.value=3120; o.connect(g); g.connect(ambBus); o.start();
      ambNodes.servo={g,base:.0025};
    }
    // crowd：远处人声质感
    {
      const s=noiseSrc(true), bp=filt('bandpass',430,.5), g=gain(0);
      s.connect(bp); bp.connect(g); g.connect(ambBus);
      ambNodes.crowd={g,base:.020};
    }
  }

  /* ---------------- 常驻配乐声部 ----------------
     整体基调：除冲突段（tense / battle）外一律以「柔和」为主 ——
     长音铺底（pad）+ 稀疏点状音（钢琴 / 钟），不放鼓、不放密集脉冲。
     旧版每个场景都垫着 pulse 心跳和 kick，听久了像节拍器，正是「不柔」的来源。
       pad   : 和弦音高（Hz），第一个是根音；pad[2]*2 同时作为钢琴的根音
       cut   : pad 低通截止，越低越闷、越远
       bpm   : 调度速度。柔和场景用 40~60 的慢速，只用来撒点状音
       pulse : 心跳式低频脉冲响度，柔和场景按到几乎听不见
       kick/snare/hat/guitar/piano/chime : 0 或具体音量
     ================================================ */
  const MUSIC = {
    /* 虚无 · 黑屏 · 界面层：几乎只剩空气 */
    void:     { pad:[55,82.4,110],       cut:150, bpm:40, pulse:0,     air:.03,  rain:0 },
    /* 第一幕 · 冷雨与赏金：一个人在雨里走。孤独、冷，但不紧张 */
    alley:    { pad:[55,65.4,98,130.8],  prog2:[49,65.4,87.3,130.8], cut:380, bpm:48, pulse:.008, air:.05, rain:.055, piano:1 },
    /* 第二幕 · 鲸落：暖、暧昧、酒精。慢摇摆，鼓只留最轻的一下 */
    bar:      { pad:[73.4,92.5,110,146.8],prog2:[65.4,98,110,130.8], cut:780,bpm:76, pulse:0, air:.04, rain:.02,
                kick:.11, hat:.045, guitar:1, piano:1, swing:1 },
    /* 记忆残片：隔着水听见的童年 */
    memory:   { pad:[49,73.4,110],       prog2:[43.6,65.4,98],  cut:230, bpm:40, pulse:.010, air:.07, rain:.01, water:.03, chime:1 },
    /* 穹顶：空、开阔、有回响 */
    dome:     { pad:[65.4,98,130.8,196], prog2:[58.3,87.3,116.5,174.6], cut:860, bpm:44, pulse:0, air:.06, rain:.035, water:.03, chime:1 },
    /* 酸雨：侵蚀、压抑，但不吵 */
    rain:     { pad:[58.3,87.3,116.5],   prog2:[55,82.4,110],   cut:440, bpm:44, pulse:.010, air:.06, rain:.065, piano:1 },
    /* 温室：全剧最暖的地方。大调、钢琴、水 */
    green:    { pad:[65.4,98,164.8,196], prog2:[73.4,110,174.6,220], cut:1100,bpm:52, pulse:0, air:.04, rain:.01, water:.02, piano:1, chime:1 },
    /* 室内：安全的日常 */
    room:     { pad:[55,82.4,110],       prog2:[49,82.4,98],   cut:320, bpm:44, pulse:.010, air:.05, rain:.02, piano:1 },
    /* 夜：私密、低声说话 */
    night:    { pad:[49,65.4,98],        prog2:[55,73.4,110],  cut:260, bpm:40, pulse:.008, air:.05, rain:.045, piano:1 },
    /* 对峙：日常段里唯一允许有压迫感的地方 —— 低频 drone + 慢心跳 */
    tense:    { pad:[43.6,65.4,87.3,110],cut:400, bpm:88, pulse:.048,  air:.06,  rain:.03, kick:.28, hat:.04 },
    /* 手术：冷、洁净、不敢呼吸 */
    surgery:  { pad:[55,82.4,110],       cut:240, bpm:40, pulse:.014,  air:.035, rain:0,   hum:.02, chime:1 },
    /* 地籍 / 档案：数据层，干净得没有体温 */
    archive:  { pad:[49,73.4,98],        cut:280, bpm:42, pulse:.008,  air:.06,  rain:.01, hum:.025 },
    /* 观测塔 / 数据塔：宏大、有距离 */
    tower:    { pad:[43.6,65.4,130.8,174],prog2:[41.2,61.7,123.5,164.8], cut:620,bpm:44, pulse:.014, air:.05, rain:0, hum:.03, chime:1 },
    /* 蓄水池 / 三号渠：空旷回声
       旧版这个 key 不在表里，SC-25 / SC-26 会静默掉回 void（等于没配乐） */
    water:    { pad:[49,73.4,110,146.8], prog2:[55,82.4,110,146.8], cut:380, bpm:40, pulse:.010, air:.05, water:.040, chime:1 },
    /* 冲突：全剧唯一允许「不柔和」的地方 */
    battle:   { pad:[41.2,61.7,82.4],    cut:520, bpm:132,pulse:.070,  air:.07,  rain:.03,
                kick:.60, snare:.23, hat:.095 },
    /* 潮汐 / 春天：升华，但是柔和地升华 */
    tide:     { pad:[65.4,98,146.8,196], prog2:[73.4,110,164.8,220], cut:1250,bpm:50, pulse:0, air:.04, rain:.02, piano:1, chime:1 },
    /* 合诗：两列字同时出现，两个声部互相等 */
    duet:     { pad:[73.4,110,146.8,196],prog2:[65.4,98,130.8,196],  cut:1150,bpm:48, pulse:0, air:.04, rain:.01, piano:1, chime:1 },
  };

  function buildMusic(){
    // 3 声部 pad（常驻振荡器，只改频率与增益）
    musNodes.pad=[];
    for(let i=0;i<4;i++){
      const o=ctx.createOscillator(), g=gain(0), f=filt('lowpass',400);
      o.type = i%2 ? 'sine':'triangle'; o.frequency.value=55;
      o.connect(f); f.connect(g); g.connect(musBus); o.start();
      // 极慢的 detune 让声音活着
      const lfo=ctx.createOscillator(), la=gain(2.4+i);
      lfo.frequency.value=.05+i*.017; lfo.connect(la); la.connect(o.detune); lfo.start();
      musNodes.pad.push({o,g,f,lfo});
    }
    // 心跳脉冲声部
    {
      const o=ctx.createOscillator(), g=gain(0);
      o.type='sine'; o.frequency.value=60; o.connect(g); g.connect(musBus); o.start();
      musNodes.pulse={o,g};
    }
    // 钢琴/钟声/吉他 —— 一次性发声，送入 musBus
    musNodes.voices = [];
  }

  function ramp(param,v,t){ try{ param.setTargetAtTime(v, now(), Math.max(.02,t||.25)); }catch(e){ param.value=v; } }
  /* 带起点的渐变：when 秒之后才开始，tc 是时间常数（越小越快到位） */
  function rampAt(param,v,when,tc){
    try{ param.setTargetAtTime(v, now()+(when||0), Math.max(.02,tc===undefined?.25:tc)); }
    catch(e){ try{ param.value=v; }catch(_){} }
  }

  function setMusic(name){
    if(!A.ready) { A.cur=name; return; }
    /* 同一首音景不重启动：连续两个场景用同一个 key 时（酒吧 → 灯灭的酒吧），
       重跑一遍 pad 会把音量抽掉 0.3 秒，正好砸在最该安静的那个表情上。 */
    if(name===A.cur && beatCfg) return;
    const cfg=MUSIC[name]||MUSIC.void; A.cur=name; beatCfg=cfg; beatStep=0;
    /* 换和弦：先把 pad 收到几乎听不见，再改频率，然后慢慢升回来。
       直接滑频率会听到一段明显的「哇」走音，在氛围段落里很扎耳。 */
    musNodes.pad.forEach((p,i)=>{
      const f=cfg.pad[i%cfg.pad.length]*(i>=cfg.pad.length?2:1);
      rampAt(p.g.gain, .003, 0, .16);
      rampAt(p.o.frequency, f, .22, .06);
      rampAt(p.f.frequency, cfg.cut, .24, .35);
      rampAt(p.g.gain, (i<cfg.pad.length? .021 : .011), .30, 1.35);
    });
    // 环境声部混合
    const mix={
      rain:cfg.rain||0, air:cfg.air||.04, water:cfg.water||0,
      hum:cfg.hum||.008, servo:0, crowd: name==='bar'?.014:0,
    };
    /* 环境声统一退到 .58：旧值让雨声压过了 pad，听着只有雨没有音乐。
       hum 是机房低频，本来就极小，不参与这个衰减。
       雨再单独砍半（.8 → .4）：它是全片铺得最长的一层，原来盖住了对白与配乐。 */
    const AMB_BACK=.58;
    Object.keys(ambNodes).forEach(k=>{
      const n=ambNodes[k];
      if(k==='hum'){ ramp(n.g.gain, (mix[k]||0)*.9, .6); if(n.g2) ramp(n.g2.gain,(mix[k]||0)*.45,.6); }
      else if(n.g) ramp(n.g.gain, (mix[k]||0)*(k==='rain'?AMB_BACK*.4:AMB_BACK), .7);
    });
    // 节拍调度（watchdog：独立 setInterval，永不因 duck 而停）
    if(!beatTimer){
      beatTimer=setInterval(scheduleBeat, 120);
      // 看门狗：即使标签页被节流，恢复后立刻补上
      document.addEventListener('visibilitychange',()=>{ if(!document.hidden) lastBeatAt=0; });
    }
  }

  function scheduleBeat(){
    if(!A.ready || !A.enabled || !beatCfg || !beatCfg.bpm) return;
    const t=now();
    if(t-lastBeatAt < 60/beatCfg.bpm/2) return;
    lastBeatAt=t;
    const b=beatStep++ % 8;
    const at=t+.02, c=beatCfg;
    /* 鼓只在 cfg 里给了音量时才响；柔和场景压根没有 kick/snare 键 */
    if(c.kick   && (b===0||b===4)) kick(at, c.kick);
    if(c.snare  && (b===2||b===6)) snare(at, c.snare);
    if(c.hat    && b%2===0)        hat(at, c.hat);
    if(c.guitar && (b===0||b===3||b===6)) guitarAt(at, c.swing);
    if(c.piano  && (b===0||b===5)) pianoAt(at, c.swing);
    /* 钟声稀疏地掉下来一颗，别成规律 */
    if(c.chime  && (b===2||b===7) && Math.random()<.55) chimeAt(at);
    /* 缓慢和声进行：每 8 拍换一次和弦，让 pad 不再是嗡嗡的一片 */
    if(c.prog2 && (b===0||b===4)){
      const chord=(b===0?c.pad:c.prog2);
      musNodes.pad.forEach((p,i)=>{
        const f=chord[i%chord.length]*(i>=chord.length?2:1);
        try{ p.o.frequency.setTargetAtTime(f, at, .08); }catch(e){}
      });
    }
    if(c.pulse) pulseAt(at, c.pulse);
  }

  function kick(t,v){
    const o=ctx.createOscillator(), g=gain(0);
    o.type='sine'; o.frequency.setValueAtTime(120,t); o.frequency.exponentialRampToValueAtTime(38,t+.14);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+.006); g.gain.exponentialRampToValueAtTime(.0001,t+.30);
    o.connect(g); g.connect(musBus); o.start(t); o.stop(t+.34);
  }
  function snare(t,v){
    const s=ctx.createBufferSource(); s.buffer=noiseBuf;
    const f=filt('bandpass',1750,.8), g=gain(0);
    s.connect(f); f.connect(g); g.connect(musBus);
    g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.0001,t+.16);
    s.start(t); s.stop(t+.18);
  }
  function hat(t,v){
    const s=ctx.createBufferSource(); s.buffer=noiseBuf;
    const f=filt('highpass',7200), g=gain(0);
    s.connect(f); f.connect(g); g.connect(musBus);
    g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.0001,t+.055);
    s.start(t); s.stop(t+.07);
  }
  /* 吉他：酒吧的拨弦低音。soft 时不推失真、低通压到 520，只留一点木质的身子 */
  function guitarAt(t, soft){
    const root=(beatCfg&&beatCfg.pad)?beatCfg.pad[0]*2:82.4;
    const o=ctx.createOscillator(), g=gain(0);
    const f=filt('lowpass', soft?520:760), sh=ctx.createWaveShaper();
    const k=soft?1.5:3.2;
    const c=new Float32Array(256); for(let i=0;i<256;i++){const x=i/128-1;c[i]=Math.tanh(x*k);} sh.curve=c;
    o.type='sawtooth'; o.frequency.value=root;
    o.connect(sh); sh.connect(f); f.connect(g); g.connect(musBus);
    const d=soft?1.9:1.1, v=soft?.018:.030;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+.06);
    g.gain.exponentialRampToValueAtTime(.0001,t+d);
    o.start(t); o.stop(t+d+.06);
  }
  /* 钢琴：根音取自 pad，不再固定弹 C-G-C。
     旧版固定三个音，碰上别的调的场景会跟 pad 打架。 */
  function pianoAt(t, soft){
    const p=(beatCfg&&beatCfg.pad)||[55,82.4,110];
    const root=((p[2]||p[1]*2||110))*2;
    [1,1.5,2].forEach((m,i)=>{
      const o=ctx.createOscillator(), g=gain(0);
      o.type='sine'; o.frequency.value=root*m;
      o.connect(g); g.connect(musBus);
      const at=t+i*(soft?.17:.09);
      g.gain.setValueAtTime(0,at);
      g.gain.linearRampToValueAtTime(soft?.011:.015, at+.02);
      g.gain.exponentialRampToValueAtTime(.0001, at+(soft?2.6:1.7));
      o.start(at); o.stop(at+(soft?2.7:1.8));
    });
  }
  /* 钟：比钢琴远一层、高两个八度。掉下来一颗就自己散开，不连成旋律 */
  function chimeAt(t){
    const p=(beatCfg&&beatCfg.pad)||[55,82.4,110];
    const root=((p[2]||p[1]*2||110))*4;
    [1,2.76].forEach((m,i)=>{
      const o=ctx.createOscillator(), g=gain(0), bp=filt('bandpass',root*m,5);
      o.type='sine'; o.frequency.value=root*m;
      o.connect(bp); bp.connect(g); g.connect(musBus);
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(i?.004:.010, t+.035);
      g.gain.exponentialRampToValueAtTime(.0001, t+3.0);
      o.start(t); o.stop(t+3.1);
    });
  }
  function pulseAt(t,v){
    const o=ctx.createOscillator(), g=gain(0);
    o.type='sine'; o.frequency.setValueAtTime(72,t); o.frequency.exponentialRampToValueAtTime(44,t+.12);
    o.connect(g); g.connect(musBus);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+.012); g.gain.exponentialRampToValueAtTime(.0001,t+.24);
    o.start(t); o.stop(t+.26);
  }

  /* ---------------- 音效 ---------------- */
  const SFX = {
    clank(){ tone(190,'square',.09,.055,140); },
    chip(){ tone(1180,'sine',.07,.045,760); },
    servo(){ tone(2900,'triangle',.16,.016,2100); },
    beep(){ tone(880,'square',.10,.035); setTimeout(()=>tone(660,'square',.10,.03),110); },
    wrench(){ tone(140,'square',.08,.05,95); setTimeout(()=>tone(170,'square',.07,.04,120),130); },
    hinge(){ sweep(320,90,.5,.045,'sawtooth'); },
    guitar(){ tone(110,'sawtooth',.5,.035,82); },
    gunshot(){
      const s=ctx.createBufferSource(); s.buffer=noiseBuf;
      const f=filt('lowpass',2600), g=gain(0);
      s.connect(f); f.connect(g); g.connect(sfxBus);
      g.gain.setValueAtTime(.30,now()); g.gain.exponentialRampToValueAtTime(.0001,now()+.36);
      s.start(now()); s.stop(now()+.4); kick(now(),.7);
    },
    water(){ const s=ctx.createBufferSource(); s.buffer=noiseBuf; const f=filt('bandpass',900,.6),g=gain(0);
      s.connect(f);f.connect(g);g.connect(sfxBus); g.gain.setValueAtTime(.055,now());
      g.gain.exponentialRampToValueAtTime(.0001,now()+.7); s.start(now()); s.stop(now()+.75); },
    weld(){ const s=ctx.createBufferSource(); s.buffer=noiseBuf; const f=filt('highpass',3200),g=gain(0);
      s.connect(f);f.connect(g);g.connect(sfxBus); g.gain.setValueAtTime(.035,now());
      g.gain.exponentialRampToValueAtTime(.0001,now()+.28); s.start(now()); s.stop(now()+.3); },
    paper(){ const s=ctx.createBufferSource(); s.buffer=noiseBuf; const f=filt('bandpass',2600,1.4),g=gain(0);
      s.connect(f);f.connect(g);g.connect(sfxBus); g.gain.setValueAtTime(.045,now());
      g.gain.exponentialRampToValueAtTime(.0001,now()+.2); s.start(now()); s.stop(now()+.22); },
    bell(){ tone(880,'sine',1.2,.03); tone(1320,'sine',.9,.017); },
    type(){ tone(1500,'square',.022,.010); },
    confirm(){ tone(520,'sine',.10,.030); setTimeout(()=>tone(780,'sine',.14,.025),90); },
    error(){ tone(190,'sine',.18,.035,150); },
  };
  function tone(f,type,dur,v,f2){
    if(!A.ready)return; const t=now(), o=ctx.createOscillator(), g=gain(0);
    o.type=type||'sine'; o.frequency.setValueAtTime(f,t); if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);
    o.connect(g); g.connect(sfxBus);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+.008); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.start(t); o.stop(t+dur+.02);
  }
  function sweep(f1,f2,dur,v,type){
    if(!A.ready)return; const t=now(), o=ctx.createOscillator(), g=gain(0);
    o.type=type||'sine'; o.frequency.setValueAtTime(f1,t); o.frequency.exponentialRampToValueAtTime(f2,t+dur);
    o.connect(g); g.connect(sfxBus);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+.02); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.start(t); o.stop(t+dur+.02);
  }

  /* ---------------- 公共 API ---------------- */
  A.init=function(){
    if(A.ready) { if(ctx.state==='suspended') ctx.resume(); return; }
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC) return;
      ctx=new AC(); A.ctx=ctx;
      // 鼓点 / 音效这些一次性音源在 stop() 后自动断开，避免长时间游玩累积孤儿节点拖慢音频线程
      const mkOsc=ctx.createOscillator.bind(ctx), mkBuf=ctx.createBufferSource.bind(ctx);
      const autoRelease=n=>{ n.onended=function(){ try{n.disconnect();}catch(e){} n.onended=null; }; return n; };
      ctx.createOscillator=function(){ return autoRelease(mkOsc()); };
      ctx.createBufferSource=function(){ return autoRelease(mkBuf()); };
      noiseBuf=makeNoise(2,false); noiseBufPink=makeNoise(3,true);
      master=gain(.85); comp=ctx.createDynamicsCompressor();
      comp.threshold.value=-18; comp.knee.value=22; comp.ratio.value=3.4; comp.attack.value=.006; comp.release.value=.26;
      master.connect(comp); comp.connect(ctx.destination);
      ambBus=gain(.9); ambBus.connect(master);
      /* 配乐底噪偏轻：音乐总线从 .9 提到 1.08（约 +1.6 dB），
         环境声与音效不动，整体音量仍由 master 与设置里的滑杆控制 */
      musBus=gain(MUS_BASE); musBus.connect(master);
      sfxBus=gain(.9); sfxBus.connect(master);
      buildAmb(); buildMusic();
      A.ready=true;
      setMusic(A.cur||'void');
      startHeart();
    }catch(e){ console.warn('[VAudio] init failed',e); }
  };
  A.play=function(name){ if(!A.enabled)return; A.init(); setMusic(name||A.cur); };
  A.sfx=function(n){ if(!A.ready||!A.enabled)return; try{ (SFX[n]||function(){})(); }catch(e){} };
  A.duck=function(amount,sec){
    if(!A.ready)return;
    // 只调增益，不动声部结构 → 对白结束后 BGM 原样回来
    const v=amount===undefined?.62:amount;
    ramp(musBus.gain, MUS_BASE*v, .12);
    clearTimeout(A._duckT);
    A._duckT=setTimeout(()=>ramp(musBus.gain,MUS_BASE,.45),(sec||1)*1000);
  };
  A.setEnabled=function(on){
    A.enabled=!!on;
    if(!A.ready)return;
    ramp(master.gain, on?.85:0, .15);
    if(on && ctx.state==='suspended') ctx.resume();
  };
  A.setVolume=function(v){ if(A.ready) ramp(master.gain, Math.max(0,Math.min(1.4,v)), .1); };
  /* 出声口：给频谱可视化 / 自检用，不参与混音逻辑 */
  A.tap=function(){ return A.ready ? {mus:musBus, amb:ambBus, master:master} : null; };

  /* 心跳：常驻节拍器，41 下/分；手术后 43 —— 只在需要时 audible */
  function startHeart(){
    if(heartTimer)return;
    heartTimer=setInterval(()=>{
      if(!A.ready||!A.enabled)return;
      if(!A.heartOn)return;
      pulseAt(now()+.01, .05);
      setTimeout(()=>pulseAt(now()+.01,.032),190);
    }, 60000/41);
  }
  A.heart=function(on){ A.heartOn=!!on; };
  A.resume=function(){ if(A.ready && ctx.state==='suspended') ctx.resume(); };
})();
