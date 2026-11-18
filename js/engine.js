/* ============================================================
   engine.js — 2.0 运行时
   步骤机 / 打字机 / 立绘 / 回溯 / 变量与分支 / 存档 / 全屏演出 / 输入
   ============================================================ */
(function () {
  'use strict';
  const D=window.V2DATA, ST=window.V2STORY, FX=window.VFX, AU=window.VAudio, MN=window.VMini;
  const steps=ST.steps, labels=ST.labels;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const G=(window.VGame={
    mode:'title', i:0, vars:{T:0,R:0,M:0,C:0}, flags:{},
    scene:'SC-65', day:'第 0 天', act:'',
    chapter:'', chapterId:'', cast:[], hist:[],
    typing:null, textOpen:false, textPause:0,
    foundSnow:{}, poems:[], endings:{}, wk2:false,
    auto:false, fast:false, skipOnce:false,
    settings:{ quality:'cinema', drift:true, particles:true, grain:true, scope:false, volume:.85 },
    saves:[null,null,null], slot:0,
    unlockedChapters:true,
    lastText:null, lastTextI:-1,
  });

  let el={}, autoTimer=null, snowTimer=null, poemTimer=null, chapterTimer=null;
  let curCG=null, curNote=null, curEnding=null;

  /* ---------- 单线剧情调度 ----------
     旧实现用裸 setTimeout 续跑 run()（对话框淡出后 90ms 再推进），玩家连点或
     回溯时旧回调依然会触发，两条「剧情线程」同时改 G.i：轻则跳步，重则把
     mode 卡在 choice / cg / mini 上，此后 advance() 全部早退——就是卡死。
     现在所有延迟续跑统一登记，clearTimers() 作废一代，旧回调自动失效。 */
  let gen=0, laterTimers=[];
  let pendingRun=null;          // 正在等待自动续跑的步骤下标
  function clearTimers(){
    gen++;
    laterTimers.forEach(t=>clearTimeout(t));
    laterTimers=[];
    pendingRun=null;
  }
  function later(ms,fn){
    const g=gen;
    const t=setTimeout(()=>{ if(g!==gen)return; fn(); },ms);
    laterTimers.push(t);
    return t;
  }
  function scheduleRun(i,ms){
    clearTimers();
    pendingRun=i;
    later(ms||0,()=>{ if(pendingRun!==i)return; pendingRun=null; run(i); });
  }

  /* ---------------- 初始化 ---------------- */
  G.init=async function(){
    cacheEls();
    FX.init(); MN.init();
    await load();                 // 存档是异步的（Electron 走 IPC），必须先等
    window.VUI.init();            // 主菜单依赖存档里的进度，必须放在 load 之后
    applySettings();
    bindInput();
    G.title();
  };

  function cacheEls(){
    ['stage','stageShake','camWrap','bgA','bgB','gradeLayer','tintLayer','vignette','pCanvas',
     'grainCanvas','castLayer','flashLayer','ecgCanvas','ecgBottom',
     'hud','dayLabel','sceneTag','soundBtn','menuBtn','autoBtn','skipBtn',
     'textbox','speaker','speakerName','speakerHint','line','nextMark',
     'tbPortrait','tbPortraitImg','tbPortraitName',
     'chapterScreen','chNum','chTitle','chDay','chSub',
     'cgScreen','cgImg','cgCap','cgNote','cgPortrait','cgClose',
     'poemFloat','poemTag','poemLines','snowLine',
     'choiceBox','choicePrompt','choiceSub','choiceList',
     'logScreen','logBody','logTitle','logNo','logClose','logRewind',
     'noteScreen','noteBody','noteClose',
     'miniLayer','titleScreen','chaptersScreen','archiveScreen','settingsScreen','pauseScreen',
     'endingScreen','endTitle','endPoem','endClose','finishScreen','finishBody',
     'toast','scope','quickHint','sheHands'
    ].forEach(k=>el[k]=$(k));
  }

  /* ---------------- 设置 / 存档 ----------------
     存档内核在 save.js（VSave）：schema 2、旧版迁移、300ms 去抖、双后端
     （Electron 写 userData 下的 JSON，浏览器写 localStorage）。
     engine 只负责在「运行时对象 G」和「存档 state」之间搬运字段。 */
  async function load(){
    const s=await VSave.load();
    if(s.progress){
      Object.assign(G.vars,s.progress.vars||{});
      Object.assign(G.flags,s.progress.flags||{});
    }
    if(s.profile){
      G.endings=s.profile.endings||{};
      G.foundSnow=s.profile.foundSnow||{};
      G.poems=s.profile.poems||[];
      G.wk2=!!s.profile.wk2;
    }
    Object.assign(G.settings,s.settings||{});
    /* 磁盘上是新结构（step/chapterId/savedAt），内存里保持旧字段名，
       这样 ui.js 的存档面板一行都不用改。 */
    G.saves=(s.slots||[]).map(x=>x?{
      i:typeof x.step==='number'?x.step:0,
      chapter:x.chapterId||'', day:x.day||'',
      vars:x.vars||{}, flags:x.flags||{}, date:x.savedAt||'', playMs:x.playMs||0
    }:null);
    while(G.saves.length<3)G.saves.push(null);
  }
  function save(){
    const s=window.VSave&&VSave.state; if(!s)return;
    s.progress={ step:G.i, chapterId:G.chapterId||'', day:G.day||'',
                 scene:G.scene||'SC-65', vars:G.vars, flags:G.flags };
    s.profile.endings=G.endings; s.profile.foundSnow=G.foundSnow;
    s.profile.poems=G.poems;     s.profile.wk2=!!G.wk2;
    s.settings=G.settings;
    s.slots=(G.saves||[]).map((x,i)=>x?{
      slot:i+1, savedAt:x.date||new Date().toISOString(), playMs:x.playMs||0,
      step:typeof x.i==='number'?x.i:0, chapterId:x.chapter||'', day:x.day||'',
      vars:x.vars||{}, flags:x.flags||{}
    }:null);
    VSave.markDirty();
  }
  G.save=save;

  /* 「继续游戏」：直接落盘一次再跳回上次的步骤号。
     变量/标记已经从 G 里恢复过，跳转不会把 T·R·M·C 清掉。 */
  G.hasProgress=function(){
    const p=VSave.state&&VSave.state.progress;
    return !!(p&&typeof p.step==='number'&&p.step>0);
  };
  G.progressInfo=function(){
    const p=VSave.state&&VSave.state.progress;
    return p?{step:p.step,chapter:p.chapterId||'',day:p.day||''}:null;
  };
  G.resume=function(){
    const p=VSave.state&&VSave.state.progress;
    if(!p||!p.step){ toast('没有可继续的进度'); return; }
    clearTimers(); G.textPause=0;
    hideAll(); window.VUI.hideAll(); G.hist=[];
    G.mode='story';
    Object.assign(G.vars,p.vars||{}); Object.assign(G.flags,p.flags||{});
    G.chapterId=p.chapterId||G.chapterId; G.day=p.day||G.day; G.scene=p.scene||G.scene;
    if(AU){AU.init();AU.setEnabled(G.settings.volume>0);}
    run(p.step);
  };

  function applySettings(){
    const s=G.settings;
    FX.setQuality(s.quality); FX.setDrift(s.drift); FX.setParticles(s.particles);
    FX.setGrain(s.grain); FX.setScope(s.scope);
    if(AU)AU.setVolume(s.volume);
    if(el.soundBtn){
      const on=s.volume>0;
      el.soundBtn.classList.toggle('isMuted',!on);
      el.soundBtn.setAttribute('aria-label',on?'声音：开':'声音：关');
      el.soundBtn.title=on?'声音：开（点击静音）':'声音：关（点击开启）';
    }
    if(el.autoBtn)el.autoBtn.classList.toggle('on',G.auto);
    if(window.VUI)window.VUI.syncSettings();
  }
  G.applySettings=applySettings;
  G.setSetting=function(k,v){ G.settings[k]=v; save(); applySettings(); };

  /* ---------------- 输入 ----------------
     严格「一次按键 = 一步」：单击只翻一句，长按不会连发（浏览器自身的
     keydown repeat 一律忽略）。想快进就连续点，节奏完全由玩家控制。
     文字正在逐字显示时，第一下先把整句显示完，第二下才翻到下一句。 */
  const ADV_KEYS={' ':'adv',Enter:'adv',ArrowRight:'adv',ArrowLeft:'back',Backspace:'back'};
  function stepOnce(dir){
    if(dir>0){ advance(); return; }
    G.back();
  }

  function bindInput(){
    document.addEventListener('keydown',onKey);
    document.addEventListener('keyup',onKeyUp);

    // 指针：按下即走一步（只走一步，按住不会连发）
    if(el.stage){
      el.stage.addEventListener('pointerdown',e=>{
        if(e.pointerType==='mouse'&&e.button!==0)return;
        if(e.target.closest&&e.target.closest('button,.noAdvance,[role=button],.panel,#miniLayer,input,textarea,select,a'))return;
        AU&&AU.init();
        stepOnce(1);
      });
    }

    // 点过的按钮立刻失焦：否则之后的空格/回车会再次「激活」这个按钮。
    // 例如开始游戏后按空格，又把主菜单的『开始』点了一遍，剧情被直接重置。
    document.addEventListener('click',e=>{
      const b=e.target&&e.target.closest?e.target.closest('button'):null;
      if(b&&b.blur)b.blur();
    },true);

    ['soundBtn','menuBtn','autoBtn','skipBtn'].forEach(k=>{
      if(!el[k])return;
      el[k].addEventListener('click',e=>{ e.stopPropagation(); handleBtn(k); });
    });
    if(el.cgClose)el.cgClose.onclick=e=>{e.stopPropagation();closeCG();};
    if(el.logClose)el.logClose.onclick=e=>{e.stopPropagation();closeLog();};
    if(el.noteClose)el.noteClose.onclick=e=>{e.stopPropagation();closeNote();};
    if(el.endClose)el.endClose.onclick=e=>{e.stopPropagation();closeEnding();};
  }
  function handleBtn(k){
    switch(k){
      case 'soundBtn':
        G.settings.volume=G.settings.volume>0?0:.85; G.setSetting('volume',G.settings.volume);
        if(AU){AU.init();AU.setEnabled(G.settings.volume>0);} break;
      case 'menuBtn': window.VUI.pause(); break;
      case 'autoBtn': G.auto=!G.auto; applySettings(); if(G.auto)scheduleAuto(); else clearAuto(); break;
      case 'skipBtn':
        // 跳过当前演出：正在小游戏就直接收掉，其余等价于推进一句
        if(MN&&MN.active){ if(MN.finish)MN.finish(true); break; }
        advance(); break;
    }
  }
  function onKeyUp(e){
    if(MN&&MN._keyUp)MN._keyUp(e.key);
  }
  function onKey(e){
    if(MN&&MN.active&&MN.key(e)) { e.preventDefault(); return; }
    if(window.VUI&&window.VUI.key(e)) { e.preventDefault(); return; }
    const k=e.key;
    if(k==='Escape'){ window.VUI.pause(); e.preventDefault(); return; }
    const act=ADV_KEYS[k];
    if(act){
      const ae=document.activeElement;
      // 焦点在控件上时，空格 / 回车交回浏览器，保留用键盘选菜单的能力
      if((k===' '||k==='Enter')&&ae&&(ae.tagName==='BUTTON'||ae.tagName==='INPUT'||ae.tagName==='TEXTAREA'||ae.isContentEditable))return;
      e.preventDefault();
      if(e.repeat)return;                 // 长按不连发
      AU&&AU.init();
      stepOnce(act==='adv'?1:-1);
      return;
    }
  }
  function clearAuto(){ if(autoTimer){clearTimeout(autoTimer);autoTimer=null;} }
  function scheduleAuto(){
    clearAuto();
    if(!G.auto||G.mode!=='story')return;
    autoTimer=setTimeout(()=>{ if(G.auto&&G.mode==='story'){ advance(); scheduleAuto(); } }, G.fast?260:1900);
  }
  G.scheduleAuto=scheduleAuto;

  /* ---------------- 推进 / 回溯 ---------------- */
  function snapshot(){
    return { i:G.i, lastI:G.lastTextI, vars:Object.assign({},G.vars), flags:Object.assign({},G.flags),
      scene:G.scene, day:G.day, act:G.act, chapter:G.chapter, chapterId:G.chapterId,
      cast:G.cast.map(c=>Object.assign({},c)), foundSnow:Object.assign({},G.foundSnow),
      poems:G.poems.slice(), lastText:G.lastText?Object.assign({},G.lastText):null };
  }
  function pushHist(){ G.hist.push(snapshot()); if(G.hist.length>160)G.hist.shift(); }
  G.back=function(){
    if(G.mode==='title'||!G.hist.length){ toast('已经是最前面了'); return; }
    clearTimers(); G.textPause=0;
    const s=G.hist.pop();
    Object.assign(G.vars,s.vars); Object.assign(G.flags,s.flags);
    G.scene=s.scene; G.day=s.day; G.act=s.act; G.chapter=s.chapter; G.chapterId=s.chapterId;
    G.cast=s.cast; G.foundSnow=s.foundSnow; G.poems=s.poems; G.lastText=s.lastText;
    // 回溯后必须把模式拨回 story。旧实现留着 choice / cg 等模式不放，
    // 而 advance() 在这些模式下只做「关闭遮罩」，遮罩其实早已被 hideAll 收掉，
    // 于是按什么都不动——这正是「回溯之后整页无响应」的来源。
    G.mode='story';
    G.textOpen=false; G.typing=null; G.textPause=0;
    hideAll(); renderCast(G.cast); updateHUD();
    if(s.lastText){
      // 指针也一起退回到这句话所在的步骤：否则「退回一句再前进」会跳过中间那一句
      G.i=(s.lastI===undefined||s.lastI<0)?Math.max(0,s.i-1):s.lastI;
      G.lastTextI=G.i;
      showText(s.lastText.who,s.lastText.text,s.lastText.cls,true);
    }
    else run(s.i,true);
    if(AU)AU.sfx('paper');
  };

  /* 状态自愈：DOM 上根本没有对应遮罩留在屏幕上时，绝不允许 mode 继续压着输入 */
  const OVERLAY_OF={chapter:'chapterScreen',cg:'cgScreen',log:'logScreen',note:'noteScreen',
    ending:'endingScreen',poem:'poemFloat',choice:'choiceBox'};
  function recoverMode(){
    if(G.mode==='mini'){
      if(!MN||!MN.active){ G.mode='story'; return; }
      if(el.miniLayer&&!el.miniLayer.classList.contains('on')){ MN.abort(); G.mode='story'; }
      return;
    }
    const id=OVERLAY_OF[G.mode];
    if(id){
      const n=el[id];
      if(!n||!n.classList.contains('on'))G.mode='story';
    }
  }
  G.recoverMode=recoverMode;

  function advance(){
    recoverMode();
    if(MN&&MN.active)return;
    if(window.VUI&&window.VUI.blocking())return;
    if(G.mode==='chapter'){ closeChapter(); return; }
    if(G.mode==='cg'){ closeCG(); return; }
    if(G.mode==='log'){ closeLog(); return; }
    if(G.mode==='note'){ closeNote(); return; }
    if(G.mode==='ending'){ closeEnding(); return; }
    if(G.mode==='poem'){ closePoem(); return; }
    if(G.mode==='choice')return;
    if(G.mode!=='story')return;
    // 玩家按下了：所有「等一会儿再继续」的旧续跑全部作废（雪花字 / wait / 停顿 / 转场）
    const pend=pendingRun, i=G.i, pause=G.textPause||0;
    clearTimers(); stopSnow();
    if(pend!==null){ G.textPause=0; run(pend); return; }
    if(G.typing&&!G.typing.done){ completeTyping(); return; }
    G.textPause=0;
    hideText();
    if(pause){ scheduleRun(i+1,pause); return; }
    run(i+1);
  }
  G.advance=advance;

  /* ---------------- 步骤机 ---------------- */
  function run(i,fromBack){
    G.i=i;
    save();                     // 每步落一次进度：关掉游戏也能从「继续」回到这一句
    const s=steps[i];
    if(!s){ G.finishScreen(); return; }
    if(!fromBack && ['narr','say','think','sys','chapter','choice','mini','hold','poem','cg','log','note','ending'].indexOf(s.k)>=0) pushHist();
    if(AU&&AU.duck && s.k==='say')AU.duck(.72,.7);
    switch(s.k){
      case 'label': run(i+1,fromBack); break;
      case 'goto': run(labels[s.label]===undefined?i+1:labels[s.label],fromBack); break;
      case 'scene': doScene(s,i,fromBack); break;
      case 'chapter': doChapter(s); break;
      case 'narr': case 'say': case 'think': case 'sys': G.lastTextI=i; doText(s); break;
      case 'cast': G.cast=s.list||[]; renderCast(G.cast); run(i+1,fromBack); break;
      case 'fx': FX.fx(s.n); if(s.n==='defocus'||s.n==='slowmo')scheduleRun(i+1,700); else run(i+1,fromBack); break;
      case 'sfx': if(AU)AU.sfx(s.n); run(i+1,fromBack); break;
      case 'wait': scheduleRun(i+1,s.ms||600); break;
      case 'mini': doMini(s,i); break;
      case 'hold': doMini(Object.assign({},s,{type:'hold'}),i); break;
      case 'choice': doChoice(s); break;
      case 'snow': doSnow(s,i); break;
      case 'poem': doPoem(s); break;
      case 'cg': doCG(s); break;
      case 'set': Object.assign(G.vars,s); delete G.vars.k; if(s.wk2)G.wk2=true; if(s.unlockedWk2){G.wk2=true;G.flags.wk2Done=true;} save(); run(i+1,fromBack); break;
      case 'log': doLog(s); break;
      case 'note': doNote(s); break;
      case 'ending': doEnding(s); break;
      case 'finish': G.finishScreen(); break;
      default: run(i+1,fromBack);
    }
    if(G.auto)scheduleAuto();
  }
  G.run=run;
  /* fresh=true 仅在「从序章重新开始」时使用：只清本轮的分支变量与标记。
     章节跳转 / 进入第二周目必须保留 T·R·M·C 与 c04·c05，
     否则隐藏结局《潮汐》的条件（T≥8 / M=3 / C≥3）永远不可能成立。
     收藏品（结局 endings / 联句 poems / 倒带 foundSnow / 二周目 wk2）跨周目保留，
     这是正式单机游戏「新游戏不清收藏」的惯例，2026-11-18 用户确认。 */
  G.startAt=function(label,fresh){
    clearTimers(); G.textPause=0;
    hideAll(); G.hist=[];
    if(fresh){
      G.vars={T:0,R:0,M:0,C:0};
      delete G.flags.c04; delete G.flags.c05;
    }
    window.VUI.hideAll();
    G.mode='story';
    if(AU){AU.init();AU.setEnabled(G.settings.volume>0);}
    run(labels[label]===undefined?0:labels[label]);
    save();
  };

  /* 倒带回到那一秒：读完《维护日志》后，重新面对第九幕那行手写体选项。
     这是隐藏结局《潮汐》在正常流程里的唯一正统入口。 */
  G.jumpToHidden=function(){
    const idx=ST.steps.findIndex(s=>s.k==='choice'&&s.id==='cHidden');
    if(idx<0){G.toast('没有找到那一秒');return;}
    clearTimers(); G.textPause=0;
    hideAll(); window.VUI.hideAll(); G.hist=[];
    G.mode='story';
    run(idx);
  };

  /* ---------------- 场景 ---------------- */
  function doScene(s,i,fromBack){
    G.scene=s.sc||'SC-01';
    const meta=D.SCENES[G.scene]||{};
    G.act=meta.act||G.act;
    FX.scene(G.scene,s);
    if(AU)AU.play(s.music||meta.music||'void');
    updateHUD(meta);
    renderCast(G.cast);
    run(i+1,fromBack);
  }
  function updateHUD(meta){
    if(el.dayLabel)el.dayLabel.textContent=G.day;
    if(el.sceneTag)el.sceneTag.textContent=(meta&&meta.name)||'';
  }

  /* ---------------- 立绘 ---------------- */
  function renderCast(list){
    if(!el.castLayer)return;
    el.castLayer.innerHTML='';
    (list||[]).forEach(c=>{
      if(c.who==='she'){
        const d=document.createElement('div'); d.className='castShe';
        d.innerHTML='<div class="sheHand">🔧</div>';
        d.style.left=(c.side==='r'?'62%':'12%');
        d.style.opacity=c.op||.45;
        el.castLayer.appendChild(d); return;
      }
      const info=D.CAST[c.who]; if(!info)return;
      const img=document.createElement('img');
      img.className='castImg '+(c.side||'l'); img.dataset.who=c.who;
      img.src='assets/ch/'+info.file+'.webp';
      img.style.height=(c.scale?c.scale*100:82)+'%';
      img.style.opacity=c.op===undefined?.97:c.op;
      if(c.pose==='sit')img.classList.add('sit');
      el.castLayer.appendChild(img);
    });
  }
  function highlight(who,emo){
    if(!el.castLayer)return;
    [...el.castLayer.querySelectorAll('.castImg')].forEach(im=>{
      im.classList.toggle('speaking',im.dataset.who===who);
      im.classList.remove('emo-smile','emo-laugh','emo-chuckle','emo-sharp','emo-bliss','emo-falter','emo-quiet');
      if(emo&&im.dataset.who===who)im.classList.add('emo-'+emo);
    });
  }

  /* ---------------- 文本 ---------------- */
  /* ---------- 对话框人物立绘 ----------
     优先用剧本里的 ch 键（区分酒吧/温室版塞勒斯），否则按中文说话人名映射。
     「她」是叙述者，全作不露脸，故不显示立绘。头像用裁好的轻量 webp，
     避免把 1200×1615 的全身 PNG 拉进对话框再缩小。 */
  const PORTRAIT_NAME={
    '卡尔':'carl','塞勒斯':'sylusB','岚':'lan','上司':'boss','铁砧':'anvil',
    '灰雀':'sparrow','阿竹':'azhu','芦苇':'reed','蜡':'wax','拾荒者':'resident',
    '接头人':'guard','孩子':'reed','企业肃卫':'guard','她':null
  };
  let portraitFile=null;
  function resolvePortrait(s){
    if(s.k==='narr'||s.k==='sys')return null;
    if(s.ch&&D.CAST[s.ch])return s.ch;
    const raw=String(s.who||'').split(' · ')[0].trim();
    return Object.prototype.hasOwnProperty.call(PORTRAIT_NAME,raw)?PORTRAIT_NAME[raw]:null;
  }
  function setPortrait(key){
    if(!el.tbPortrait)return;
    const info=key?D.CAST[key]:null;
    // 同一角色不重复赋值 src，浏览器可复用已解码的纹理
    if(info&&info.file!==portraitFile){
      portraitFile=info.file;
      if(el.tbPortraitImg)el.tbPortraitImg.src='assets/face/'+info.file+'.webp';
    }
    if(info){
      if(el.tbPortraitName)el.tbPortraitName.textContent=info.name;
      el.tbPortrait.classList.add('on');
      if(el.textbox)el.textbox.classList.add('withPortrait');
    }else{
      el.tbPortrait.classList.remove('on');
      if(el.textbox)el.textbox.classList.remove('withPortrait');
    }
  }
  function doText(s){
    G.mode='story';
    const who=s.k==='say'?(s.who||''):s.k==='think'?((s.who?s.who+' · ':'')+'心声'):'';
    const cls=s.cls||(s.k==='think'?'think':s.k==='sys'?'system':s.k==='say'?'':'narr');
    G.lastText={who,text:s.text,cls};
    if(s.ch)highlight(s.ch,s.emo); else highlight(null);
    if(s.sfx&&AU)AU.play(s.sfx);
    G.textPause=s.pause||0;
    showText(who,s.text,cls,false);
    setPortrait(resolvePortrait(s)); // 必须在 showText 之后：它会重设 className
  }
  function showText(who,text,cls,instant){
    if(!el.textbox)return;
    el.textbox.className='on'; el.textbox.classList.add('textbox');
    if(el.speakerName)el.speakerName.textContent=who||'';
    if(el.speaker)el.speaker.style.display=who?'':'none';
    if(el.speakerHint)el.speakerHint.textContent=cls==='think'?'INNER':cls==='system'?'SYSTEM':(who?'DIALOGUE':'NARRATION');
    if(el.speaker)el.speaker.className=cls==='think'?'think':'';
    if(el.line){el.line.className=cls||'';el.line.textContent='';}
    G.textOpen=true;
    G.typing={full:text,i:0,acc:0,done:false,lastI:-1};
    if(instant)completeTyping();
  }
  function charCost(c){
    if('。！？…—'.indexOf(c)>=0)return .115;
    if('，、；：'.indexOf(c)>=0)return .055;
    return .029;
  }
  G.tick=function(dt){
    const t=G.typing;
    if(!t||t.done||!G.textOpen||(window.VUI&&window.VUI.blocking()))return;
    t.acc+=dt*(G.fast?4:1);
    while(t.acc>0&&t.i<t.full.length){ t.acc-=charCost(t.full[t.i]); t.i++; }
    // 只在字数变化时写 DOM：原来每帧都写 textContent，会持续触发对话框重排
    if(t.i!==t.lastI){
      t.lastI=t.i;
      if(el.line)el.line.textContent=t.full.slice(0,t.i);
      if(t.i%3===0&&AU&&Math.random()<.25)AU.sfx('type');
    }
    if(t.i>=t.full.length)completeTyping();
  };
  function completeTyping(){
    const t=G.typing; if(!t)return;
    t.i=t.full.length; t.done=true; t.lastI=t.i;
    if(el.line&&el.line.textContent!==t.full)el.line.textContent=t.full;
    if(el.textbox)el.textbox.classList.add('done');
    if(el.nextMark)el.nextMark.classList.add('on');
  }
  function hideText(){ if(el.textbox)el.textbox.className='textbox'; G.textOpen=false; G.typing=null;
    if(el.nextMark)el.nextMark.classList.remove('on');
    if(el.tbPortrait)el.tbPortrait.classList.remove('on'); }
  G.hideText=hideText;

  /* ---------------- 章节卡 ---------------- */
  function doChapter(s){
    const c=D.CHAPTERS.find(x=>x.id===s.id)||{};
    G.chapter=c.title||s.title||''; G.chapterId=s.id;
    G.day=c.day||s.day||G.day;
    if(el.chNum)el.chNum.textContent=s.num||c.label||'';
    if(el.chTitle)el.chTitle.textContent=s.title||c.title||'';
    if(el.chDay)el.chDay.textContent=G.day;
    if(el.chSub)el.chSub.textContent=s.sub||'';
    G.mode='chapter'; G.cast=[]; renderCast([]);
    hideText();
    if(el.chapterScreen)el.chapterScreen.classList.add('on');
    if(AU)AU.sfx('bell');
    if(chapterTimer)clearTimeout(chapterTimer);
    chapterTimer=setTimeout(closeChapter, G.fast?500:2600);
  }
  function closeChapter(){
    if(G.mode!=='chapter')return;
    if(chapterTimer)clearTimeout(chapterTimer);
    if(el.chapterScreen)el.chapterScreen.classList.remove('on');
    G.mode='story'; run(G.i+1);
  }

  /* ---------------- CG 特写 ---------------- */
  function doCG(s){
    G.mode='cg'; curCG=s;
    /* 先解码再上屏。原来直接改 src，浏览器在新图解码完成前仍会沿用上一张
       位图，配合 #cgScreen 的 600ms 淡入，开场会闪出上一张 CG（第一幕那张）。 */
    if(el.cgImg){
      const src='assets/sc/'+(s.sc||G.scene)+'.jpg';
      if(el.cgImg.dataset.want!==src){
        el.cgImg.dataset.want=src;
        el.cgImg.classList.remove('ready');
        const im=new Image();
        im.onload=()=>{
          if(!el.cgImg||el.cgImg.dataset.want!==src)return;
          el.cgImg.src=src;
          el.cgImg.classList.add('ready');
        };
        im.src=src;
      }else{
        el.cgImg.classList.add('ready');
      }
    }
    if(el.cgCap)el.cgCap.textContent=s.cap||'';
    if(el.cgNote)el.cgNote.textContent=s.note||'';
    if(el.cgPortrait){
      if(s.portrait&&D.CAST[s.portrait]){ el.cgPortrait.src='assets/ch/'+D.CAST[s.portrait].file+'.webp'; el.cgPortrait.style.display=''; }
      else el.cgPortrait.style.display='none';
    }
    const box=el.cgScreen&&el.cgScreen.querySelector('.cgFrame');
    if(box){ box.classList.remove('focus-eyes','focus-face','focus-crack','focus-flowers','focus-hands','focus-drawer','focus-pen','focus-screen','focus-blood','focus-door','focus-anvil','focus-paper','focus-guns'); box.classList.add('focus-'+(s.focus||'flowers')); }
    if(el.cgScreen)el.cgScreen.classList.add('on');
    hideText(); if(AU)AU.sfx('paper');
  }
  function closeCG(){ if(G.mode!=='cg')return; if(el.cgScreen)el.cgScreen.classList.remove('on'); G.mode='story'; run(G.i+1); }
  G.closeCG=closeCG;

  /* ---------------- 雪花字 ---------------- */
  function stopSnow(){
    if(snowTimer){clearTimeout(snowTimer);snowTimer=null;}
    if(el.snowLine)el.snowLine.classList.remove('on');
  }
  function doSnow(s,i){
    const item=D.SNOW.find(x=>x.id===s.id)||{text:''};
    G.foundSnow[s.id]=true; save();
    if(el.snowLine){ el.snowLine.textContent=item.text; el.snowLine.classList.add('on'); }
    if(AU)AU.sfx('type');
    if(snowTimer)clearTimeout(snowTimer);
    snowTimer=later(G.fast?120:520,()=>{ snowTimer=null; if(el.snowLine)el.snowLine.classList.remove('on'); run(i+1); });
  }

  /* ---------------- 心电诗集 ---------------- */
  function doPoem(s){
    const p=D.POEMS.find(x=>x.tag===s.tag);
    if(!p){run(G.i+1);return;}
    if(G.poems.indexOf(s.tag)<0){G.poems.push(s.tag);save();}
    G.mode='poem';
    if(el.poemTag)el.poemTag.textContent='心电诗集 · '+p.tag;
    if(el.poemLines)el.poemLines.innerHTML=p.lines.map(l=>'<div>'+esc(l)+'</div>').join('');
    if(el.poemFloat)el.poemFloat.classList.add('on');
    if(AU)AU.sfx('bell');
    if(poemTimer)clearTimeout(poemTimer);
    poemTimer=setTimeout(closePoem,G.fast?500:2600);
  }
  function closePoem(){ if(G.mode!=='poem')return; if(poemTimer)clearTimeout(poemTimer);
    if(el.poemFloat)el.poemFloat.classList.remove('on'); G.mode='story'; run(G.i+1); }

  /* ---------------- 选择 / 分支 ---------------- */
  function doChoice(s){
    G.mode='choice';
    let opts=(s.options||[]).slice();
    if(s.hidden){
      const ok=condOk(s.cond);
      if(!ok){
        // 为 DEMO 保留可达性：标注「体验」，仍可进入隐藏结局
        opts=opts.map(o=>Object.assign({},o,{sub:'体验模式 · 正常流程需：完成第二周目 / T≥8 / M=3 / C≥3',demo:true}));
      }
    }
    if(!opts.length){run(G.i+1);return;}
    if(el.choicePrompt)el.choicePrompt.textContent=s.prompt||'';
    if(el.choiceSub){
      el.choiceSub.textContent=s.sub||'';
      el.choiceSub.style.display=s.sub?'':'none';
    }
    if(el.choiceList){el.choiceList.innerHTML='';}
    opts.forEach((o,idx)=>{
      const b=document.createElement('button');
      b.className='choiceBtn'+(o.hand?' hand':'')+(s.critical?' critical':'');
      b.innerHTML=`<span class="chNum">${o.hand?'？':String.fromCharCode(65+idx)}</span><span class="chBody"><b>${esc(o.t)}</b><i>${esc(o.sub||'')}</i></span><span class="chArrow">↗</span>`;
      b.onclick=e=>{
        e.stopPropagation();
        // 选择 04 / 05 用 'A'·'B' 记录（隐藏结局条件按此比对）；其余保留跳转标签，供维护日志动态分支使用
        if(s.id)G.flags[s.id]=(o.set&&(o.set.choice04||o.set.choice05))||o.to||idx;
        if(o.set){
          Object.keys(o.set).forEach(k=>{
            const v=o.set[k];
            if(k==='T'||k==='R'||k==='M'||k==='C'){
              // 四个对外/隐藏变量是「累计量」，必须累加而非覆盖
              G.vars[k]=(Number(G.vars[k])||0)+(Number(v)||0);
            } else G.vars[k]=v;
          });
        }
        save();
        if(el.choiceBox)el.choiceBox.classList.remove('on');
        G.mode='story';
        if(AU)AU.sfx(o.hand?'bell':'confirm');
        run(o.to&&labels[o.to]!==undefined?labels[o.to]:G.i+1);
      };
      if(el.choiceList)el.choiceList.appendChild(b);
    });
    // classList.add 不接受空字符串 token：旧写法在普通选择分支会抛
    // DOMException，导致选择框永远不显示、随后被 recoverMode 拨回 story，
    // 玩家看到的就是「这一页点不动 / 直接跳过选择」。
    if(el.choiceBox){
      el.choiceBox.classList.toggle('isHidden',!!s.hidden);
      el.choiceBox.classList.add('on');
    }
    hideText();
    if(AU)AU.duck(.42,2.2);
  }
  function condOk(c){
    if(!c)return true;
    const v=G.vars;
    if(c.wk2&&!(G.wk2||G.flags.wk2Done))return false;
    if(c.T&&v.T<c.T)return false;
    if(c.M&&v.M<c.M)return false;
    if(c.C&&v.C<c.C)return false;
    if(c.c04&&G.flags.c04!==c.c04)return false;
    if(c.c05&&G.flags.c05!==c.c05)return false;
    return true;
  }
  G.condOk=condOk;

  /* ---------------- 小游戏 ---------------- */
  function doMini(s,i){
    G.mode='mini'; hideText();
    MN.run(s,()=>{ G.mode='story'; run(i+1); });
  }

  /* ---------------- 第二周目日志层 ---------------- */
  function doLog(s){
    G.mode='log'; curLog=s;
    const rows=(s.rows||[]).slice();
    const notes=(s.notes||[]).slice();
    if(s.dynamic==='maint01'){
      const m=G.flags.m01||G.vars.maint01;
      if(m==='A'||m==='m01A'){ rows.push('第15天，三号渠修复。执行：K-07。工时：一夜。','灌溉面积 +1 平方米。花期 +1。词表 −1。','词表余额：1,204 条。','备注：划算。'); notes.push('备注：一个词换一平方米能开花的土。这个汇率是我自己定的。','备注：那天少的是「流域」。我本来也不常用。'); }
      else if(m==='C'||m==='m01C'){ rows.push('第15天，三号渠修复。执行：铁砧。','灌溉面积 +1 平方米。词表 −0。（铁砧不记账。它只修。）'); notes.push('备注：这是唯一一种不花我东西的修法。也是唯一一种我学不会的修法。'); }
      else { rows.push('第15天，三号渠未修。缺口扩大。菜畦损失 100%。','灌溉面积 −1 平方米。花期 0。词表 −0。','词表余额：1,205 条。','备注：那天没有失去任何词。'); notes.push('备注：账户很干净。干净得像没活过。'); }
    }
    if(s.dynamic==='maint04'&&(G.vars.maint04==='C')){
      notes.push('备注：那本旧笔记本，他后来放在我的工作台上。抄到第四十一页停了。第四十一页是空的。','备注：空的那一页，是他留给我自己填的。我没有填。','备注：我把它抄进了核心最内层——和那句话刻在一起。');
    }
    let html=`<div class="logMeta"><span>维护日志 / RECORD ${esc(s.no)}</span><b>${esc(s.title)}</b></div><div class="logRows">`;
    rows.forEach(r=>html+=`<div class="logRow">${esc(r)}</div>`);
    html+='</div><div class="logNotes">';
    notes.forEach(n=>html+=`<div class="logNote">${esc(n)}</div>`);
    html+='</div>';
    if(el.logBody)el.logBody.innerHTML=html;
    if(el.logTitle)el.logTitle.textContent='《维护日志》 · 记录 '+s.no;
    if(el.logNo)el.logNo.textContent=s.no;
    if(el.logScreen)el.logScreen.classList.add('on');
    if(el.logRewind){
      if(s.rewind){ el.logRewind.style.display=''; el.logRewind.onclick=e=>{e.stopPropagation(); showRewind(s.rewind);}; }
      else el.logRewind.style.display='none';
    }
    hideText(); if(AU)AU.sfx('paper');
  }
  let curLog=null;
  function closeLog(){ if(G.mode!=='log')return; if(el.logScreen)el.logScreen.classList.remove('on'); G.mode='story'; run(G.i+1); }
  G.closeLog=closeLog;
  function showRewind(id){
    const item=D.SNOW.find(x=>x.id===id);
    if(!item||!el.logScreen)return;
    const d=document.createElement('div'); d.className='rewindView';
    d.innerHTML=`<div class="rwSnow">${esc(item.text)}</div><div class="rwUnlock">＋ 解锁注释：${esc(item.unlock)}</div><div class="rwAt">${esc(item.at)} · 倒带定格 ×2.2</div><button class="ghostBtn" id="rwClose">收起</button>`;
    el.logScreen.appendChild(d);
    G.foundSnow[id]=true; save();
    d.querySelector('#rwClose').onclick=e=>{e.stopPropagation();d.remove();};
    if(AU)AU.sfx('confirm');
  }

  /* ---------------- 作者手记 ---------------- */
  function doNote(s){
    G.mode='note'; curNote=s;
    const pages=s.pages||[];
    if(el.noteBody)el.noteBody.innerHTML=pages.map((p,i)=>
      `<div class="notePage" data-i="${i}"><h3>${esc(p.t)}</h3><div>${p.b}</div></div>`).join('')+
      `<div class="noteNav">${pages.map((_,i)=>`<button data-p="${i}" class="${i===0?'on':''}">${i+1}</button>`).join('')}</div>`;
    if(el.noteBody){
      [...el.noteBody.querySelectorAll('.noteNav button')].forEach(b=>b.onclick=e=>{
        e.stopPropagation(); const n=+b.dataset.p;
        [...el.noteBody.querySelectorAll('.notePage')].forEach(p=>p.classList.toggle('on',+p.dataset.i===n));
        [...el.noteBody.querySelectorAll('.noteNav button')].forEach(x=>x.classList.toggle('on',x===b));
        if(AU)AU.sfx('paper');
      });
      const first=el.noteBody.querySelector('.notePage'); if(first)first.classList.add('on');
    }
    if(el.noteScreen)el.noteScreen.classList.add('on');
    hideText(); if(AU)AU.sfx('paper');
  }
  function closeNote(){ if(G.mode!=='note')return; if(el.noteScreen)el.noteScreen.classList.remove('on'); G.mode='story'; run(G.i+1); }
  G.closeNote=closeNote;

  /* ---------------- 结局 ---------------- */
  function doEnding(s){
    G.mode='ending'; curEnding=s;
    G.endings[s.id]=true; save();
    const names={end1:'结局一 ·《锈》',end2:'结局二 ·《白噪声》',end3:'结局三 ·《未寄出的信》',endT:'隐藏结局 ·《潮汐》'};
    if(el.endTitle)el.endTitle.textContent=names[s.id]||'结局';
    if(el.endPoem)el.endPoem.textContent=D.END_POEMS[s.id]||'';
    if(el.endingScreen)el.endingScreen.classList.add('on');
    hideText(); if(AU)AU.sfx('bell');
    if(AU)AU.heart(false);
  }
  function closeEnding(){ if(G.mode!=='ending')return; if(el.endingScreen)el.endingScreen.classList.remove('on'); G.mode='story'; run(G.i+1); }
  G.closeEnding=closeEnding;

  /* ---------------- 收尾 ---------------- */
  G.finishScreen=function(){
    clearTimers(); G.textPause=0;
    hideAll(); G.mode='finish';
    if(window.VUI.rebuildFinish)window.VUI.rebuildFinish();
    const got=Object.keys(G.endings).length;
    if(el.finishBody)el.finishBody.innerHTML=
      `<div class="finTheme">${esc(D.THEME)}</div>
       <div class="finStat">本次维护：<b>${G.vars.C}</b> 样东西　·　签下 <b>${G.vars.C}</b> 条欠条　·　信任 <b>${G.vars.T}</b>　·　记忆碎片 <b>${G.vars.M}</b></div>
       <div class="finStat">已抵达结局 <b>${got}</b> / 4　·　收集联句 <b>${G.poems.length}</b> / 12　·　倒带 <b>${Object.keys(G.foundSnow).length}</b> / 7</div>
       <div class="finHint">你维护了什么。你放弃了什么。</div>`;
    if(el.finishScreen)el.finishScreen.classList.add('on');
    if(AU)AU.play('tide');
    window.VUI.refresh();
    save();
    if(window.VSave)VSave.markFinish();   // 通关统计：首次通关时间 + 通关次数
  };

  /* ---------------- 标题 ---------------- */
  G.title=function(){
    clearTimers(); G.textPause=0;
    hideAll(); G.mode='title'; clearAuto();
    window.VUI.showTitle(true);
    FX.scene('SC-65',{fade:1.6});
    if(AU){AU.play('dome');AU.heart(false);}
    FX.ecgMode('live');
  };

  function hideAll(){
    hideText();
    if(chapterTimer){clearTimeout(chapterTimer);chapterTimer=null;}
    if(poemTimer){clearTimeout(poemTimer);poemTimer=null;}
    stopSnow();
    [el.chapterScreen,el.cgScreen,el.poemFloat,el.choiceBox,el.logScreen,el.noteScreen,el.endingScreen,el.finishScreen].forEach(x=>{if(x)x.classList.remove('on');});
    if(el.snowLine)el.snowLine.classList.remove('on');
    MN&&MN.abort();
  }
  G.hideAll=hideAll;

  function toast(msg){
    if(!el.toast)return;
    el.toast.textContent=msg; el.toast.classList.add('on');
    clearTimeout(el.toast._t); el.toast._t=setTimeout(()=>el.toast.classList.remove('on'),1900);
  }
  G.toast=toast;

  /* ---------------- 崩溃兜底 ----------------
     任何未捕获异常：记一条日志、把存档刷盘、给玩家一句人话。
     正式发行不能出现「点一下没反应、什么提示都没有」的状态。 */
  const errLog=[];
  function reportError(where,e){
    const msg=(e&&(e.stack||e.message))||String(e);
    errLog.push({ t:new Date().toISOString(), where, msg });
    console.error('[game]',where,msg);
    try{ if(window.VSave)VSave.flush(); }catch(_){}
    if(el.toast)toast('程序出错，已记录；若反复出现请重启游戏');
  }
  window.addEventListener('error',ev=>reportError('window',ev.error||ev.message));
  window.addEventListener('unhandledrejection',ev=>reportError('promise',ev.reason));

  /* ---------------- 主循环驱动打字机 ---------------- */
  let lastT=performance.now(), guardTick=0, playAcc=0;
  function loop(now){
    requestAnimationFrame(loop);
    const dt=Math.min(.06,(now-lastT)/1000); lastT=now;
    // 游戏时长：只在真正在玩（非标题、非切后台）时累计，每 10 秒落一次盘
    if(G.mode!=='title'&&document.visibilityState==='visible'&&window.VSave){
      playAcc+=dt*1000;
      if(playAcc>=10000){ VSave.addPlayMs(playAcc); playAcc=0; }
    }
    // 舞台模式跟随运行时状态：HUD 只在 story / mini 出现，封面心电图只在标题态全亮
    if(el.stage&&el.stage.dataset.mode!==G.mode)el.stage.dataset.mode=G.mode;
    // 看门狗：即使有未知路径把 mode 写歪，也不允许输入被永久锁死
    if((guardTick=(guardTick+1)%24)===0)recoverMode();
    G.tick(dt);
  }
  requestAnimationFrame(loop);

  /* 关窗 / 切后台 / 崩溃：把去抖中的存档立即刷盘（最多丢 300ms 的改动） */
  window.addEventListener('pagehide',()=>{ if(window.VSave)VSave.flush(); });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&window.VSave)VSave.flush();
  });
})();
