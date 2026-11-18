/* ============================================================
   minigames.js — 2.0 交互小游戏全集
   全部对应《问题总结》提出的优化：
   · 封面心电图 + 白色光点
   · 飞行器横向水滴型霓虹光轨 · 人群穿梭抖动
   · 水龙头手部拧紧 + 水花/雨滴粒子（不用白线）
   · 交易芯片窗口 + 抛出分镜 · 终端分镜
   · 酒吧推门（风铃/音乐骤大/陌生人转头）、精美照片
   · 点酒 4 瓶 · 找小刀 · 拔枪抵喉 · 放枪举手 · 砖墙暗门
   · 穹顶多镜头巡览 · 方向键淋雨 · 点亮植物（写实+名称）
   · 收音机三秒 · 花开 · 凌晨的门 · 三次按住回环
   · 倒带 · 合诗双列 · 调频 · 沉核心
   ============================================================ */
(function () {
  'use strict';
  const M = (window.VMini = { active:null });
  const D = window.V2DATA;
  const $ = id => document.getElementById(id);
  let layer, cb=null, cur=null, timers=[], raf=0;
  const rnd=(a,b)=>a+Math.random()*(b-a);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  function later(ms,fn){ const t=setTimeout(fn,ms); timers.push(t); return t; }
  // 所有周期任务统一登记，跳过 / 中止小游戏时一并清掉，避免 interval 残留拖慢后续章节
  function every(fn,ms){ const t=setInterval(fn,ms); timers.push(t); return t; }
  function clearTimers(){ timers.forEach(t=>{clearTimeout(t);clearInterval(t);}); timers=[]; if(raf){cancelAnimationFrame(raf);raf=0;} }
  function frame(){ if(!cur)return; }

  function open(cls, html, opts){
    opts=opts||{};
    layer.className='miniLayer on '+(cls||'');
    layer.innerHTML=`<div class="miniScrim"></div><div class="miniBox ${cls||''}">${html}</div>`+
      `<button class="miniSkip" id="miniSkip" title="跳过（Esc）">跳过 <span>ESC</span></button>`;
    $('miniSkip').onclick=()=>finish(true);
    if(opts.onMount) opts.onMount(layer.querySelector('.miniBox'));
    M._tap=cardTapHint;
    VAudio && VAudio.sfx('paper');
  }
  /* 点到空白：把可点的按钮闪一下，并说清楚「画面不会自己走」 */
  function cardTapHint(){
    const box=layer.querySelector('.miniBox'); if(!box)return false;
    const bs=[].slice.call(box.querySelectorAll('button')).filter(b=>{
      if(b.classList.contains('hidden')||b.id==='miniSkip')return false;
      const r=b.getBoundingClientRect(); return r.width>8&&r.height>8;
    });
    if(!bs.length)return false;
    bs.forEach(b=>{ b.classList.remove('miniBtnPulse'); void b.offsetWidth; b.classList.add('miniBtnPulse'); });
    let h=layer.querySelector('.miniTapHint');
    if(!h){ h=document.createElement('div'); h.className='miniTapHint'; layer.appendChild(h); }
    h.textContent='这一步要按下面的按钮 · 画面不会自己走';
    // 贴着卡片下沿放，别飘到屏幕最底下
    const rb=box.getBoundingClientRect();
    h.style.top=Math.min(window.innerHeight-28, rb.bottom+14)+'px';
    h.style.bottom='auto';
    h.classList.add('on');
    clearTimeout(h._t); h._t=setTimeout(()=>h.classList.remove('on'),2600);
    if(VAudio)VAudio.sfx('type');
    return true;
  }
  /* ---------- 场景内演出 ----------
     Question 批次的核心反馈：不要「一张暗底卡片 + 一个按钮」的独立小界面，
     演出必须发生在场景里。openScene 直接把画面铺满舞台，没有遮罩、
     没有卡片边框；交互只用画面本身 + 一条底部细进度线。 */
  function openScene(cls, html, onMount){
    layer.className='miniLayer on mScene '+(cls||'');
    layer.innerHTML=`<div class="scStage" id="scStage">${html}</div>`+
      `<button class="miniSkip scSkip" id="miniSkip" title="跳过（Esc）">跳过 <span>ESC</span></button>`;
    $('miniSkip').onclick=()=>finish(true);
    M._tap=null;
    if(onMount)onMount(layer.querySelector('#scStage'));
    VAudio && VAudio.sfx('paper');
  }

  /* 画面内的「按住」：没有圆形按钮、没有光圈，只有底部一条进度线。 */
  function sceneHold(stage, o){
    o=o||{};
    const dur=o.dur||6;
    const bar=stage.querySelector('#scBar'), txt=stage.querySelector('#scHoldTxt');
    let down=false, acc=0, last=0, rafId=0;
    function step(ts){
      if(!down||!cb)return;
      const dt=Math.min(.05,(ts-last)/1000); last=ts; acc+=dt;
      const r=Math.min(1,acc/dur);
      if(bar)bar.style.width=(r*100)+'%';
      if(o.onProgress)o.onProgress(r,stage);
      if(r>=1){ down=false; rafId=0;
        if(o.onDone)o.onDone(stage);
        finish(false,{held:true});
        return; }
      rafId=requestAnimationFrame(step);
    }
    function dn(e){
      if(e&&e.preventDefault)e.preventDefault();
      if(down||!cb)return;
      down=true; last=performance.now();
      if(txt)txt.classList.add('on');
      if(o.onDown)o.onDown(stage);
      cancelAnimationFrame(rafId); rafId=requestAnimationFrame(step);
    }
    function up(){
      if(!down)return; down=false; cancelAnimationFrame(rafId); rafId=0;
      if(o.onUp)o.onUp(Math.min(1,acc/dur),stage);
    }
    stage.addEventListener('pointerdown',dn);
    window.addEventListener('pointerup',up);
    window.addEventListener('pointercancel',up);
    cur._key=(k)=>{ if(k===' '||k==='Enter'){dn(null);return true;} return false; };
    M._keyUp=(k)=>{ if(k===' '||k==='Enter')up(); };
    M._cleanupHold=()=>{
      window.removeEventListener('pointerup',up);
      window.removeEventListener('pointercancel',up);
      cancelAnimationFrame(rafId);
    };
    return {progress:()=>acc/dur};
  }

  /* 四段「插入镜头」共用：画面铺满暗场，特效图从中浮出，按住推进 */
  function fxScene(o){
    openScene('mFxSc',`
      <div class="scDark"></div>
      <div class="scInsWrap"><img class="scIns" id="scIns" src="${o.img}" alt=""></div>
      <div class="scFxLayer" id="scFxLayer">${o.extra||''}</div>
      <div class="scVig"></div>
      <div class="scCap on"><em>${esc(o.kicker||'')}</em>${esc(o.hint||'')}</div>
      <div class="scHoldTxt" id="scHoldTxt">${esc(o.hold||'按住 · 不松手')}</div>
      <div class="scHold"><i id="scBar"></i></div>`,(stage)=>{
        const ins=$('scIns');
        requestAnimationFrame(()=>ins.classList.add('on'));
        sceneHold(stage,{
          dur:o.dur||7,
          onProgress:(r)=>{
            ins.style.opacity=String(.18+r*.82);
            ins.style.transform=`translate(-50%,-50%) scale(${.94+r*.08})`;
            if(o.onProgress)o.onProgress(r,stage);
          },
          onDone:()=>{ if(o.onDone)o.onDone(stage); }
        });
      });
  }

  function finish(skipped,result){
    if(!cb){
      // 没有待回调时也要把残留层收干净，避免一个隐形的 .on 盖住整个舞台
      if(M.active){ M.active=null; cur=null; if(layer){ layer.className='miniLayer'; layer.innerHTML=''; } }
      return;
    }
    const f=cb; cb=null; clearTimers();
    // 释放按住控件注册的全局监听与动画帧
    try{ if(M._cleanupHold) M._cleanupHold(); }catch(e){}
    M._cleanupHold=null; M._keyUp=null;
    if(layer){ layer.className='miniLayer'; layer.innerHTML=''; }
    M.active=null; cur=null;
    try{ if(VAudio)VAudio.duck(1,.1); }catch(e){}
    // 同步交接：旧实现延后 90ms 再回调，这 90ms 里玩家再按一下就会叠出
    // 第二条剧情线程，a 步骤与 b 步骤互相抢 G.i。
    try{ f(Object.assign({skipped:!!skipped},result||{})); }
    catch(err){ console.error('[mini:cb]',err); }
  }
  M.finish=finish;

  M.run=function(step, done){
    // 换一个演出时静默收掉旧的：不能走 finish()，否则会把旧回调也触发，
    // 让上一段剧情在 90ms 后突然又前进一次。
    if(M.active&&M.abort)M.abort();
    cb=done; cur=step; M.active=step.type;
    const fn=GAMES[step.type]||GAMES._generic;
    try{ fn(step,layer); }catch(e){ console.error('[mini]',step.type,e); finish(true); }
  };
  M.key=function(e){
    if(!cb)return false;
    const k=e.key;
    if(k==='Escape'){ finish(true); return true; }
    if(cur && cur._key && cur._key(k,e)) return true;
    return false;
  };
  M.click=function(){ return false; };

  /* ---------- 通用：按住控件 ---------- */
  function holdWidget(box, o){
    const label=o.hint||'按住', sub=o.sub||'';
    box.insertAdjacentHTML('beforeend',
      `<div class="holdWidget"><div class="holdHint">${esc(label)}</div><div class="holdSub">${esc(sub)}</div>
       <button class="holdBtn" id="holdBtn"><span class="holdRing"></span><span class="holdCore"></span><span class="holdTxt">按住</span></button>
       <div class="holdNote" id="holdNote"></div></div>`);
    const btn=$('holdBtn'), ring=box.querySelector('.holdRing'), note=$('holdNote');
    let down=false, acc=0, started=0, rafId=0;
    const dur=o.dur||6;
    function tick(ts){
      if(!down||!cb)return;
      const dt=Math.min(.05,(ts-started)/1000); started=ts;
      acc+=dt;
      const ratio=Math.min(1,acc/dur);
      ring.style.setProperty('--p',String(ratio*360));
      box.querySelector('.holdCore').style.transform=`scale(${1+ratio*.10})`;
      if(o.onProgress)o.onProgress(ratio,box);
      if(acc>=dur){ finish(false,{held:true,acc}); return; }
      rafId=requestAnimationFrame(tick);
    }
    function downFn(e){ e.preventDefault(); if(down||!cb)return; down=true; started=performance.now();
      btn.classList.add('isDown'); if(VAudio)VAudio.sfx('water'); if(o.onDown)o.onDown(box);
      // 旧实现只置 down，没有启动 tick，按住永远不会累计进度；
      // 所有「按住」类交互因此都像没反应。这里必须真正启动 rAF。
      cancelAnimationFrame(rafId);
      rafId=requestAnimationFrame(tick);
    }
    function upFn(e){ if(!down)return; down=false; cancelAnimationFrame(rafId);
      btn.classList.remove('isDown'); ring.style.setProperty('--p','0');
      if(note)note.textContent=o.earlyText||'松手只是松手。'; if(o.onUp)o.onUp(box,acc);
    }
    btn.addEventListener('pointerdown',downFn);
    window.addEventListener('pointerup',upFn);
    window.addEventListener('pointercancel',upFn);
    M._cleanupHold=()=>{ window.removeEventListener('pointerup',upFn); window.removeEventListener('pointercancel',upFn); cancelAnimationFrame(rafId); };
    // 键盘空格 / 回车
    cur._key=(k)=>{
      if(k===' '||k==='Enter'){ downFn({preventDefault(){}}); return true; }
      return false;
    };
    M._keyUp=(k)=>{ if(k===' '||k==='Enter') upFn(); };
    return { btn, ring, note };
  }

  /* ============================================================
     各类小游戏
     ============================================================ */
  const GAMES={};

  /* 序章：按住中心光点，字逐行浮出；松手字散掉 */
  GAMES.prologue=function(s){
    open('mPrologue',`
      <div class="proWrap">
        <div class="proDot" id="proDot"></div>
        <div class="proLines" id="proLines"></div>
        <div class="proFoot">按住光点 · 字才浮出来　／　松开，字会散掉</div>
      </div>`);
    const lines=s.lines||[], L=$('proLines'), dot=$('proDot');
    let idx=0, down=false, acc=0, last=0, rafId=0, done=false;
    function emit(){
      if(idx>=lines.length){ complete(); return; }
      const d=document.createElement('div'); d.className='proLine'; d.textContent=lines[idx++];
      L.appendChild(d); requestAnimationFrame(()=>d.classList.add('on'));
      if(VAudio)VAudio.sfx('type');
      while(L.children.length>7) L.removeChild(L.firstChild);
    }
    function scatter(){
      [...L.children].forEach(c=>{ c.classList.add('scatter'); setTimeout(()=>c.remove(),700); });
      idx=Math.max(0,idx-1);
    }
    function complete(){
      if(done)return; done=true;
      const f=document.createElement('div'); f.className='proFlat'; f.textContent=s.flat||'';
      L.appendChild(f); requestAnimationFrame(()=>f.classList.add('on'));
      later(1500,()=>finish(false,{held:true}));
    }
    function tick(ts){
      if(!down||done||!cb)return;
      const dt=Math.min(.06,(ts-last)/1000); last=ts; acc+=dt;
      if(acc>1.35){ acc=0; emit(); }
      dot.classList.add('lit');
      rafId=requestAnimationFrame(tick);
    }
    function dn(e){ if(down||done||!cb)return; down=true; last=performance.now(); dot.classList.add('lit'); rafId=requestAnimationFrame(tick); }
    function up(){ if(!down||done)return; down=false; cancelAnimationFrame(rafId); dot.classList.remove('lit'); scatter(); }
    const dotEl=$('proDot');
    dotEl.addEventListener('pointerdown',dn);
    window.addEventListener('pointerup',up); window.addEventListener('pointercancel',up);
    cur._key=(k)=>{ if(k===' '||k==='Enter'){dn();return true;} return false; };
    M._keyUp=(k)=>{ if(k===' '||k==='Enter')up(); };
    M._cleanupHold=()=>{window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);cancelAnimationFrame(rafId);};
  };

  /* 抬头看天幕：整屏夜空，光轨自己划过；摄影机缓慢上摇 */
  GAMES.ship=function(s){
    openScene('mShipSc',`
      <img class="scShot" id="skyShot" src="assets/q2/Q2-02.jpg" alt="">
      <div class="scVig"></div>
      <div class="skyFlare" id="skyFlare"></div>
      <div class="scCap" id="shipCap"><em>第 0 天 · 锈街</em>${esc(s.hint||'抬头 · 看一道光划过天幕')}</div>
      <div class="scHoldTxt" id="scHoldTxt">点击画面 · 抬头</div>`,(stage)=>{
        const shot=$('skyShot'), cap=$('shipCap'), fl=$('skyFlare');
        let played=false;
        requestAnimationFrame(()=>{ shot.classList.add('on'); later(420,()=>cap.classList.add('on')); });
        function go(){
          if(played||!cb)return; played=true;
          if($('scHoldTxt'))$('scHoldTxt').classList.remove('on');
          shot.classList.add('tiltUp');
          fl.classList.add('fly');
          if(VAudio)VAudio.sfx('servo');
          later(1400,()=>{ cap.innerHTML='<em>一道光</em>头大，尾小。它没有声音。城市里没有人抬头。'; });
          later(3000,()=>finish(false,{seen:true}));
        }
        stage.addEventListener('pointerdown',e=>{ if(!e.target.closest('button'))go(); });
        cur._key=(k)=>{ if(k===' '||k==='Enter'||k==='ArrowUp'){go();return true;} return false; };
        if($('scHoldTxt'))$('scHoldTxt').classList.add('on');
      });
  };

  /* 穿过人群：第一视角贴地推进，前景人影掠过 */
  GAMES.crowd=function(s){
    openScene('mCrowdSc',`
      <img class="scShot on crowdPic" id="crowdShot" src="assets/q2/Q2-03.jpg" alt="">
      <div class="crowdFg" id="crowdFg"></div>
      <div class="scVig"></div>
      <div class="scCap on"><em>第一视角 · 贴地推进</em>${esc(s.hint||'穿过人群')}</div>
      <div class="scHoldTxt" id="scHoldTxt">点击或按住 · 往前走</div>
      <div class="scHold"><i id="scBar"></i></div>`,(stage)=>{
        const shot=$('crowdShot'), fg=$('crowdFg'), bar=$('scBar');
        let step=0, down=false, last=0, rafId=0, walk=0;
        const MAX=5;
        function advance(){
          if(!cb)return;
          step++; walk=step/MAX;
          shot.style.transform=`scale(${1.02+walk*.16}) translateY(${-walk*2.4}%)`;
          stage.classList.remove('isStep'); void stage.offsetWidth; stage.classList.add('isStep');
          for(let i=0;i<2;i++){
            const d=document.createElement('i');
            d.style.left=rnd(-6,106)+'%';
            d.style.height=rnd(52,84)+'%';
            d.style.setProperty('--sp',rnd(.55,1.15)+'s');
            fg.appendChild(d); setTimeout(()=>d.remove(),1300);
          }
          if(VAudio)VAudio.sfx(step%2?'clank':'water');
          bar.style.width=(walk*100)+'%';
          if(step>=MAX){ bar.style.width='100%'; later(420,()=>finish(false,{walked:true})); }
        }
        function tick(ts){
          if(!down||!cb)return;
          const dt=(ts-last)/1000; last=ts;
          if(dt>=.42){ advance(); last=ts; }
          rafId=requestAnimationFrame(tick);
        }
        function dn(e){
          if(e&&e.preventDefault)e.preventDefault();
          if(!cb)return;
          advance();
          if(down)return;
          down=true; last=performance.now(); rafId=requestAnimationFrame(tick);
        }
        function up(){ down=false; cancelAnimationFrame(rafId); }
        stage.addEventListener('pointerdown',dn);
        window.addEventListener('pointerup',up); window.addEventListener('pointercancel',up);
        cur._key=(k)=>{ if(k===' '||k==='Enter'||k==='ArrowRight'){dn(null);return true;} return false; };
        M._keyUp=()=>up();
        M._cleanupHold=()=>{ window.removeEventListener('pointerup',up); window.removeEventListener('pointercancel',up); cancelAnimationFrame(rafId); };
      });
  };

  /* 水龙头：整屏近景，手拧阀门；水滴用粒子贴图，不用白线 */
  /* 拧水龙头 —— 按 SC3-FAUCET 四格分镜做交互状态机
     分镜给的是四个可直接对照的状态：龙头开着 / 手握住把手 / 拧动、水变细 /
     水停且龙头后方露出一整道冷白反光。按住时画面就停在这四个状态上，
     玩家不必读提示，看画面就知道「还要继续拧」。 */
  GAMES.faucet=function(s){
    const FR=[
      { f:'F-A', t:'阀芯松了，水一直往下淌。按住，拧紧它。' },
      { f:'F-B', t:'握住把手。铁的凉意从掌心透进来。' },
      { f:'F-C', t:'一圈。两圈。水声一点一点收细。' },
      { f:'F-D', t:'水停了。龙头后面的缝隙里，露出一整道冷白的光。' }
    ];
    openScene('mFaucetSc',`
      <div class="fcFrames" id="fcFrames">
        ${FR.map((x,i)=>`<img class="fcF fc${i}${i===0?' on':''}" src="assets/q3/${x.f}.jpg" alt="">`).join('')}
      </div>
      <div class="fcGlint" id="fcGlint"></div>
      <div class="fcDrops" id="fcDrops"></div>
      <div class="scVig"></div>
      <div class="scCap on"><em>巷口 · 公共水龙头</em><span id="fcCap">${esc(FR[0].t)}</span></div>
      <div class="scHoldTxt" id="scHoldTxt">按住画面 · 拧</div>
      <div class="scHold"><i id="scBar"></i></div>`,(stage)=>{
      const frames=[].slice.call(stage.querySelectorAll('.fcF'));
      const glint=$('fcGlint'), drops=$('fcDrops'), cap=$('fcCap');
      let cur=0;
      // 水还在流的时候，出水口持续落水滴
      const drip=every(()=>{
        if(!cb){clearInterval(drip);return;}
        if(cur>=3)return;
        const d=document.createElement('img'); d.src='assets/pt/PT-05.png'; d.className='fDrop';
        d.style.left=(cur<1?30:32)+rnd(-1.4,1.4)+'%';
        d.style.top=(cur<1?55:57)+rnd(-1,1)+'%';
        d.style.width=rnd(5,9)+'px';
        drops.appendChild(d); setTimeout(()=>d.remove(),1000);
      },cur<1?380:620);
      function show(i){
        if(i===cur)return;
        frames[cur].classList.remove('on');
        cur=i; frames[i].classList.add('on');
        if(cap)cap.textContent=FR[i].t;
        if(i===3&&glint){ glint.classList.add('on'); }
      }
      sceneHold(stage,{
        dur:s.dur||6.2,
        onDown:()=>{ if(VAudio)VAudio.sfx('wrench'); },
        onProgress:(r)=>{
          show(r<.14?0: r<.48?1: r<.80?2: 3);
          // 逐格轻微推近：像镜头跟着手
          const k=1.02+r*.07;
          frames.forEach((f,i)=>{ if(i===cur)f.style.transform=`scale(${k})`; });
          if(r>.8&&VAudio&&Math.random()<.10)VAudio.sfx('water');
        },
        onUp:()=>{
          // 松手不会退回 —— 但水会重新渗出来一点，提示「还没拧到底」
          if(cur<3){
            glint&&glint.classList.remove('on');
            if(cap)cap.textContent='松手了。水又渗出来，一滴一滴砸在铁桶上。';
            if(VAudio)VAudio.sfx('water');
          }
        },
        onDone:()=>{
          clearInterval(drip);
          glint&&glint.classList.add('on');
          if(s.done&&cap)cap.textContent=s.done;
          if(VAudio){VAudio.sfx('confirm');VAudio.sfx('water');}
        }
      });
      const prev=M._cleanupHold;
      M._cleanupHold=()=>{ clearInterval(drip); if(prev)prev(); };
    });
  };

  /* 找反光：把镜头拉近，左右环顾，反光藏在龙头后面 —— 不再在画面上直接标一个点 */
  GAMES.look=function(s){
    openScene('mLookSc',`
      <div class="lookView" id="lookView">
        <div class="lookPan" id="lookPan">
          <img class="lookImg" src="assets/q2/Q2-01.jpg" alt="">
          <div class="lookGlint" id="glint"></div>
        </div>
      </div>
      <div class="scVig"></div>
      <div class="lookRuler"><i id="lookBar"></i></div>
      <div class="scCap" id="lookCap"><em>拉近 · 左右环顾</em>${esc(s.hint||'寻找水龙头后面的反光')}</div>
      <div class="scHoldTxt on" id="scHoldTxt">拖动 / 方向键 · 左右看</div>`,(stage)=>{
        const pan=$('lookPan'), glint=$('glint'), cap=$('lookCap'), bar=$('lookBar');
        let p=.5, found=false;
        function apply(){
          pan.style.transform=`translateX(${-p*47.4}%)`;
          if(bar)bar.style.width=(p*100)+'%';
          // 反光只在镜头拉到右侧、龙头挡住它的那一段才露出来
          const vis=clamp((p-.34)/.16,0,1)*clamp((.86-p)/.10,0,1);
          glint.style.opacity=String(vis*(.55+.45*Math.sin(performance.now()/420)));
          if(vis>.5&&cap)cap.innerHTML='<em>拉近 · 左右环顾</em>龙头后面的墙角，有一点反光。';
        }
        apply();
        const rid=setInterval(()=>{ if(!cb){clearInterval(rid);return;} apply(); },90);
        M._cleanupHold=()=>clearInterval(rid);
        stage.addEventListener('pointermove',e=>{
          const r=stage.getBoundingClientRect();
          p=clamp((e.clientX-r.left)/r.width,0,1); apply();
        });
        stage.addEventListener('pointerdown',e=>{
          const gr=glint.getBoundingClientRect();
          const cx=gr.left+gr.width/2, cy=gr.top+gr.height/2;
          const dist=Math.hypot(e.clientX-cx,e.clientY-cy);
          if(dist<70&&parseFloat(glint.style.opacity||'0')>.25&&!found){
            found=true; glint.classList.add('found');
            if(VAudio){VAudio.sfx('confirm');}
            if(cap)cap.innerHTML='<em>找到了</em>不是水。是别人的镜片。有人在看他。';
            later(1600,()=>finish(false,{found:true}));
          }
        });
        cur._key=(k)=>{
          if(k==='ArrowRight'){p=clamp(p+.05,0,1);apply();return true;}
          if(k==='ArrowLeft'){p=clamp(p-.05,0,1);apply();return true;}
          if(k===' '||k==='Enter'){return true;}
          return false;
        };
        later(9000,()=>{ if(cb&&cap)cap.innerHTML='<em>提示</em>把镜头往右拉，看看龙头后面。'; });
      });
  };

  /* 芯片交易窗口：把芯片拖进铁盘，命中后吸附并扫描 */
  GAMES.chip=function(s){
    open('mChip',`<div class="chipWindow" id="chipWindow">
        <div class="chipGlass"></div><div class="chipTray" id="chipTray"></div>
        <div class="chipPiece" id="chipPiece" role="button" tabindex="0" aria-label="按住芯片，拖到铁盘上"><span>◈</span></div>
        <div class="chipScan" id="chipScan"></div>
      </div><div class="miniTitle">${esc(s.hint)}</div><div class="miniSub" id="chipSub">${esc(s.sub||'')}</div>`);
    const win=$('chipWindow'), chip=$('chipPiece'), tray=$('chipTray'), scan=$('chipScan'), sub=$('chipSub');
    let dragging=false, placed=false, downX=0, downY=0, startL=0, startT=0;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const overTray=()=>{
      const cr=chip.getBoundingClientRect(), tr=tray.getBoundingClientRect();
      const cx=cr.left+cr.width/2, cy=cr.top+cr.height/2;
      const padX=Math.max(36,tr.width*.35), padY=46;
      return cx>=tr.left-padX&&cx<=tr.right+padX&&cy>=tr.top-padY&&cy<=tr.bottom+padY;
    };
    function detach(){
      window.removeEventListener('pointermove',onMove);
      window.removeEventListener('pointerup',onUp);
      window.removeEventListener('pointercancel',onUp);
    }
    function home(){
      const wr=win.getBoundingClientRect(), cr=chip.getBoundingClientRect();
      startL=cr.left-wr.left; startT=cr.top-wr.top;
      chip.style.left=startL+'px'; chip.style.top=startT+'px';
    }
    function onMove(e){
      if(!dragging)return;
      e.preventDefault();
      const wr=win.getBoundingClientRect();
      let nx=startL+(e.clientX-downX), ny=startT+(e.clientY-downY);
      nx=clamp(nx,2,wr.width-chip.offsetWidth-2);
      ny=clamp(ny,2,wr.height-chip.offsetHeight-2);
      chip.style.left=nx+'px'; chip.style.top=ny+'px';
      tray.classList.toggle('hot',overTray());
    }
    function onUp(e){
      if(!dragging)return;
      dragging=false; detach();
      chip.classList.remove('dragging');
      tray.classList.remove('hot');
      if(placed)return;
      if(!overTray()){
        chip.classList.add('returning');
        chip.style.left=startL+'px'; chip.style.top=startT+'px';
        later(260,()=>chip.classList.remove('returning'));
        return;
      }
      placed=true;
      const wr=win.getBoundingClientRect(), tr=tray.getBoundingClientRect();
      chip.style.left=(tr.left-wr.left+tr.width/2-chip.offsetWidth/2)+'px';
      chip.style.top=(tr.top-wr.top+tr.height/2-chip.offsetHeight/2)+'px';
      chip.classList.add('placed'); tray.classList.add('on');
      sub.textContent='芯片已落入铁盘 · 扫描中';
      scan.classList.add('on');
      if(VAudio){VAudio.sfx('chip');VAudio.sfx('confirm');}
      later(1200,()=>finish(false,{dropped:true}));
    }
    function onDown(e){
      if(placed)return;
      e.preventDefault();
      dragging=true; downX=e.clientX; downY=e.clientY;
      const wr=win.getBoundingClientRect(), cr=chip.getBoundingClientRect();
      startL=cr.left-wr.left; startT=cr.top-wr.top;
      chip.classList.add('dragging'); chip.classList.remove('returning','placed');
      tray.classList.remove('hot');
      try{chip.setPointerCapture(e.pointerId);}catch(err){}
      window.addEventListener('pointermove',onMove,{passive:false});
      window.addEventListener('pointerup',onUp);
      window.addEventListener('pointercancel',onUp);
    }
    home();
    chip.addEventListener('pointerdown',onDown);
    M._cleanupHold=detach;
  };

  /* 终端分镜 */
  GAMES.terminal=function(s){
    const rows=(s.rows||[]).map(r=>`<div class="tRow"><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join('');
    const port=s.portrait?`<img class="tPortrait" src="assets/ch/${D.CAST[s.portrait].file}.webp" alt="">`:'';
    // 立绘单独占一列，不再绝对定位压在档案行上；窄屏由 CSS 自动改成上下排布。
    open('mTerminal',`<div class="termFrame">${port}<div class="termBody">
      <div class="termHead">${esc(s.head||'// TERMINAL')}</div>
      <div class="termRows">${rows}</div><div class="termFoot">${esc(s.foot||'')}</div>
    </div></div>
      <button class="ghostBtn" id="termClose">收起终端</button>`);
    $('termClose').onclick=()=>finish(false);
  };

  /* 推门进入：第一视角，手握门把；推开时暖光涌出、画面被吸进门缝 */
  /* 推门 —— Q2-04 第一视角。门在画面中偏右，门缝里已经透出酒吧的暖光。
     旧版只有一团圆光在放大，门开完就直接跳到酒吧场景图，中间是硬切。
     现在：按住时门缝从一条线撑开成一片光，光柱里漂着灰尘，门板随进度让开；
     推到底让这束暖光吃掉整个画面，再由它淡出、露出酒吧 —— 转场从「切」变成「走进光里」。 */
  GAMES.door=function(s){
    openScene('mDoorSc',`
      <img class="scShot on doorShot" id="doorShot" src="assets/q2/Q2-04.jpg" alt="">
      <div class="doorSlit" id="doorSlit"></div>
      <div class="doorBloom" id="doorBloom"></div>
      <div class="doorBeams" id="doorBeams"></div>
      <div class="doorDust" id="doorDust"></div>
      <div class="scVig"></div>
      <div class="scCap on"><em>深巷 · 音乐酒吧「鲸落」</em><span id="doorCap">${esc(s.hint||'按住画面 · 推开')}</span></div>
      <div class="scHoldTxt" id="scHoldTxt">按住画面 · 推开</div>
      <div class="scHold"><i id="scBar"></i></div>`,(stage)=>{
      const shot=$('doorShot'), slit=$('doorSlit'), bloom=$('doorBloom'),
            beams=$('doorBeams'), dust=$('doorDust'), cap=$('doorCap');
      if(VAudio)VAudio.play('bar');
      // 光柱里的浮尘：越到后面越密
      let dustRate=.35;
      const dustTimer=every(()=>{
        if(!cb){clearInterval(dustTimer);return;}
        const d=document.createElement('img'); d.src='assets/pt/PT-06.png';
        d.className='doorDustP';
        d.style.left=(53+rnd(0,10))+'%';
        d.style.top=rnd(24,72)+'%';
        d.style.width=rnd(3,7)+'px';
        d.style.setProperty('--dx',rnd(-16,22)+'px');
        d.style.opacity=String(rnd(.25,.7));
        dust.appendChild(d); setTimeout(()=>d.remove(),2400);
      },(120));
      sceneHold(stage,{
        dur:s.dur||4.2,
        onDown:()=>{ if(VAudio)VAudio.sfx('hinge'); },
        onProgress:(r)=>{
          // 门缝：一条竖线 → 一片光。中心 57%，向两侧撑开
          const w=5+r*44;
          slit.style.width=w+'%';
          slit.style.left=(57-w/2)+'%';
          slit.style.opacity=String(.30+r*.70);
          bloom.style.opacity=String(r*.92);
          bloom.style.transform=`scale(${.55+r*2.1})`;
          beams.style.opacity=String(r*.62);
          beams.style.transform=`scaleX(${.8+r*.5})`;
          // 镜头向门里推进，同时门板让开（画面整体右移一点，像被门顶着走）
          shot.style.transform=`scale(${1.02+r*.30}) translate(${-r*2.2}%,${-r*1.2}%)`;
          shot.style.filter=`brightness(${1+r*.16}) saturate(${1+r*.12})`;
          if(r>.55){
            if(VAudio&&Math.random()<.35)VAudio.play('bar');
            if(cap)cap.textContent='音乐从门缝里漏出来，一点一点变响。';
          }
          if(r>.86&&cap)cap.textContent='风铃响了一下。几个陌生人转过头，又扭回去。';
        },
        onUp:()=>{
          // 松手只是松手：光弹回收细，不判负
          slit.style.width=''; slit.style.left=''; slit.style.opacity='';
          bloom.style.opacity=''; bloom.style.transform='';
          beams.style.opacity=''; beams.style.transform='';
          if(cap)cap.textContent='门又合回去一点。光缩成一条线。';
        },
        onDone:()=>{
          clearInterval(dustTimer);
          // 让这束光吃掉画面，然后由它淡出、露出酒吧
          slit.style.width='150%'; slit.style.left='-24%'; slit.style.opacity='1';
          bloom.style.opacity='1'; bloom.style.transform='scale(4.2)';
          beams.style.opacity='1';
          if(VAudio){VAudio.sfx('bell');VAudio.play('bar');}
          warmBridge(1500,.55);
          later(430,()=>finish(false,{bridge:true}));
        }
      });
      const prev=M._cleanupHold;
      M._cleanupHold=()=>{ clearInterval(dustTimer); if(prev)prev(); };
    });
  };

  /* 暖光桥：把「门」和「酒吧」两条画面接起来。
     它挂在 body 上、层级压过小游戏层，因此小游戏层退场时它还在，
     等新场景的交叉淡入起来后再自己淡掉 —— 不会出现一帧黑。 */
  function warmBridge(hold,peak){
    const d=document.createElement('div');
    d.className='warmBridge';
    d.style.setProperty('--pk',String(peak||.9));
    document.body.appendChild(d);
    requestAnimationFrame(()=>d.classList.add('on'));
    /* 这里必须用原生 setTimeout：finish() 会 clearTimers()，
       用 later() 注册的话，暖光层就永远等不到淡出，整局都蒙着一层橙色。 */
    setTimeout(()=>{
      d.classList.add('out');
      setTimeout(()=>{ try{d.remove();}catch(e){} },1500);
    }, hold||1200);
    /* 兜底：万一上面那步被打断，也不能让它一直盖着 */
    setTimeout(()=>{ try{ if(d.parentNode)d.remove(); }catch(e){} }, (hold||1200)+4200);
  }

  /* 塞勒斯照片（精美立绘，非像素） */
  GAMES.photo=function(s){
    const c=D.CAST[s.portrait]||D.CAST.sylusB;
    open('mPhoto',`<div class="photoCard"><div class="photoImg"><img src="assets/ch/${c.file}.webp"></div>
      <div class="photoMeta"><b>${esc(c.name)}</b><span>${esc(c.sub)}</span><em>TARGET / S · 核心须完整回收</em></div></div>
      <div class="miniSub">${esc(s.hint||'')} · ${esc(s.sub||'')}</div>
      <button class="ghostBtn" id="photoClose">收起照片</button>`);
    $('photoClose').onclick=()=>finish(false);
  };

  /* 点酒：4 瓶 + 调酒师反馈；答对点亮标记 + 专属台词 + 举杯 */
  GAMES.drink=function(s){
    const bs=s.bottles||[];
    open('mDrink',`<div class="shelf"><div class="shelfBottles" id="shelfBottles"></div></div>
      <div class="miniTitle">${esc(s.hint)}</div><div class="miniSub">${esc(s.sub||'')}</div>
      <div class="drinkMsg" id="drinkMsg">点击一瓶酒。</div>
      <button class="ghostBtn hidden" id="drinkExit">直接退出</button>`);
    const box=$('shelfBottles'), msg=$('drinkMsg'), exit=$('drinkExit');
    const colors=['#d5a24a','#8a5a2c','#c8d06a','#4e8f6a'];
    bs.forEach((b,i)=>{
      const d=document.createElement('button'); d.className='bottle';
      d.innerHTML=`<i style="--bc:${colors[i%4]}"></i><span>${esc(b.name)}</span><em>${b.deg}°</em><u>✓</u>`;
      d.onclick=()=>{
        if(!cb)return;
        msg.classList.remove('good'); msg.textContent='调酒师：'+b.line;
        if(VAudio)VAudio.sfx(b.correct?'confirm':'type');
        if(b.correct){
          d.classList.add('picked');
          if(b.extra)later(700,()=>{msg.textContent='调酒师：'+b.extra;});
          exit.classList.remove('hidden');
          layer.querySelector('.miniBox').classList.add('toastUp');
          later(1900,()=>finish(false,{picked:b.name}));
        }else{
          msg.classList.add('soft');
          later(500,()=>msg.classList.remove('soft'));
        }
      };
      box.appendChild(d);
    });
    exit.onclick=()=>finish(false,{picked:null});
  };

  /* 找小刀 */
  GAMES.knife=function(s){
    open('mKnife',`<div class="knifeScene"><div class="knifeGlass"></div>
        <div class="knifeObj" id="knifeObj"><i></i></div><div class="knifeHint">${esc(s.hint)}</div>
        <div class="knifeSub">${esc(s.sub||'')}</div><div class="knifeReveal" id="knifeReveal">塞勒斯抽出了那把折刀。</div></div>`);
    $('knifeObj').onclick=()=>{
      $('knifeObj').classList.add('pull'); $('knifeReveal').classList.add('on');
      if(VAudio)VAudio.sfx('clank');
      later(1400,()=>finish(false,{found:true}));
    };
  };

  /* 拔枪 / 抵喉 交叉动画 */
  GAMES.duel=function(s){
    open('mDuel',`<div class="duelWrap"><div class="duelL">${esc(s.left||'拔枪')}</div><div class="duelR">${esc(s.right||'抵喉')}</div>
      <div class="duelCross"><i></i><i></i></div><div class="duelSub">${esc(s.sub||'')}</div></div>
      <button class="ghostBtn" id="duelGo">一瞬间</button>`);
    $('duelGo').onclick=()=>{
      layer.querySelector('.miniBox').classList.add('fired'); if(VAudio)VAudio.sfx('clank');
      later(1500,()=>finish(false));
    };
    cur._key=(k)=>{ if(k===' '||k==='Enter'){$('duelGo')&&$('duelGo').click();return true;} return false; };
  };

  /* 放枪 / 举手 */
  GAMES.handsUp=function(s){
    open('mHands',`<div class="handsWrap"><div class="handsGun" id="handsGun"></div><div class="handsFig" id="handsFig"><i></i><i></i></div>
      <div class="handsTxt">${esc(s.hint)}<span>${esc(s.sub||'')}</span></div></div>
      <button class="ghostBtn" id="handsGo">放下枪</button>`);
    $('handsGo').onclick=()=>{
      $('handsGun').classList.add('down'); $('handsFig').classList.add('up');
      if(VAudio)VAudio.sfx('clank');
      later(1500,()=>finish(false));
    };
  };

  /* 砖墙暗门：点击其中一块砖 */
  GAMES.brick=function(s){
    open('mBrick',`<div class="brickWall" id="brickWall"></div>
      <div class="miniTitle">${esc(s.hint)}</div><div class="miniSub">${esc(s.sub||'')}</div>
      <div class="brickDoor" id="brickDoor"></div>`);
    const w=$('brickWall'); const target=Math.floor(rnd(18,42));
    for(let i=0;i<60;i++){
      const b=document.createElement('i'); b.style.opacity=rnd(.72,1);
      if(i===target){ b.className='loose'; b.dataset.t='1'; }
      w.appendChild(b);
    }
    w.addEventListener('click',e=>{
      if(e.target.dataset&&e.target.dataset.t){ e.target.classList.add('pressed');
        $('brickDoor').classList.add('open'); if(VAudio)VAudio.sfx('hinge');
        later(1900,()=>finish(false,{opened:true}));
      } else { if(VAudio)VAudio.sfx('clank'); }
    });
  };

  /* 穹顶多镜头巡览 */
  GAMES.domeTour=function(s){
    const shots=s.shots||[];
    open('mTour',`<div class="tourStage"><img id="tourImg" src=""><div class="tourCap" id="tourCap"></div><div class="tourBar" id="tourBar"></div></div>
      <div class="miniSub">${esc(s.hint)}</div><button class="ghostBtn" id="tourGo">跳过这段</button>`);
    let i=0; const img=$('tourImg'),cap=$('tourCap'),bar=$('tourBar');
    if(shots[0]){ img.src='assets/sc/'+shots[0].sc+'.jpg'; requestAnimationFrame(()=>img.classList.add('on')); }
    shots.forEach(()=>{const b=document.createElement('i');bar.appendChild(b);});
    function next(){
      if(i>=shots.length){ later(700,()=>finish(false)); return; }
      const sh=shots[i];
      img.classList.remove('on'); img.src='assets/sc/'+sh.sc+'.jpg';
      requestAnimationFrame(()=>{img.classList.add('on');});
      cap.textContent=sh.cap||''; cap.classList.add('on');
      [...bar.children].forEach((b,j)=>b.classList.toggle('on',j<=i));
      if(VAudio)VAudio.sfx('paper');
      i++; later(2300,next);
    }
    // 进来就自己走：旧版停在空画面上等一个按钮，玩家会以为卡住了
    $('tourGo').onclick=()=>finish(false);
    later(420,next);
  };

  /* 淋雨：方向键前进 / 后退 */
  GAMES.rainWay=function(s){
    open('mRainWay',`<div class="rwStage"><div class="rwRain" id="rwRain"></div>
      <div class="rwFigure"><img src="assets/ch/CH-03.webp"></div>
      <div class="rwFace" id="rwFace"><img src="assets/ch/CH-03.webp"></div></div>
      <div class="rwPrompt">${esc(s.hint)}</div><div class="miniSub">${esc(s.sub||'')}</div>
      <div class="rwBtns"><button class="ghostBtn" id="rwBack">← 后退</button><button class="ghostBtn primary" id="rwFwd">走进雨里 →</button></div>
      <div class="rwMsg" id="rwMsg"></div>`);
    const rm=$('rwRain');
    for(let i=0;i<34;i++){const d=document.createElement('img');d.src='assets/pt/PT-05.png';d.className='rwDrop';
      d.style.left=rnd(0,100)+'%';d.style.animationDelay=(-rnd(0,2))+'s';d.style.animationDuration=rnd(.6,1.3)+'s';rm.appendChild(d);}
    function fwd(){
      $('rwFace').classList.add('on'); $('rwMsg').textContent=s.forward||'';
      if(VAudio)VAudio.sfx('water'); later(1600,()=>finish(false,{forward:true}));
    }
    function back(){
      $('rwMsg').textContent=s.back||'故事无法继续。';
      layer.querySelector('.miniBox').classList.add('retreat');
      later(900,()=>layer.querySelector('.miniBox').classList.remove('retreat'));
    }
    $('rwFwd').onclick=fwd; $('rwBack').onclick=back;
    cur._key=(k)=>{ if(k==='ArrowRight'||k==='d'||k==='D'){fwd();return true;} if(k==='ArrowLeft'||k==='a'||k==='A'){back();return true;} return false; };
  };

  /* 点亮植物 + 名称 + 蝴蝶 */
  GAMES.plants=function(s){
    const ps=s.plants||[];
    open('mPlants',`<div class="plantScene" id="plantScene">
      <div class="plantButterfly" id="pbf1">✧</div><div class="plantButterfly" id="pbf2">✧</div>
      <div class="plantLabels" id="plantLabels"></div></div>
      <div class="miniTitle">${esc(s.hint)}</div><div class="miniSub">${esc(s.sub||'')}</div>
      <button class="ghostBtn hidden" id="plantDone">走进去</button>`);
    const sc=$('plantScene'), labs=$('plantLabels'), btn=$('plantDone');
    const hues=[ '#e08a6e','#8d7fd0','#c9526a','#e3b5c9','#e2b64a' ];
    let lit=0;
    ps.forEach((pl,i)=>{
      const b=document.createElement('button'); b.className='plantObj';
      b.style.left=pl.x+'%'; b.style.top=pl.y+'%'; b.style.setProperty('--ph',hues[i%5]);
      b.innerHTML='<i></i><i></i><i></i><u>✿</u>';
      b.onclick=()=>{
        if(b.classList.contains('lit')||!cb)return;
        b.classList.add('lit'); lit++; if(VAudio)VAudio.sfx('bell');
        const lab=document.createElement('div'); lab.className='plantLabel';
        lab.style.left=pl.x+'%'; lab.style.top=(pl.y-13)+'%';
        lab.innerHTML=`<b>${esc(pl.name)}</b><span>${esc(pl.desc||'')}</span>`;
        labs.appendChild(lab); requestAnimationFrame(()=>lab.classList.add('on'));
        // 蝴蝶飞过去
        const bf=(i%2)?$('pbf2'):$('pbf1'); bf.style.left=(pl.x+3)+'%'; bf.style.top=(pl.y-6)+'%';
        if(lit>=ps.length){ btn.classList.remove('hidden'); }
      };
      sc.appendChild(b);
    });
    btn.onclick=()=>finish(false,{lit});
  };

  /* 收音机：响了三秒 */
  GAMES.radio=function(s){
    open('mRadio',`<div class="radioObj"><div class="radioGrill"></div><div class="radioKnob" id="radioKnob"></div><div class="radioWave" id="radioWave"></div></div>
      <div class="miniTitle">${esc(s.hint)}</div><div class="miniSub">${esc(s.sub||'')}</div>
      <button class="ghostBtn" id="radioGo">拧旋钮</button>`);
    $('radioGo').onclick=()=>{
      $('radioKnob').classList.add('turn'); $('radioWave').classList.add('on');
      if(VAudio){VAudio.sfx('type'); VAudio.sfx('bell');}
      later(3000,()=>{ $('radioWave').classList.remove('on'); if(VAudio)VAudio.sfx('beep');
        later(700,()=>finish(false)); });
    };
  };

  /* 花开：可以蹲着，也可以走开 */
  GAMES.bloom=function(s){
    open('mBloom',`<div class="bloomStage"><div class="bloomPot"><div class="bloomBud" id="bloomBud"></div></div>
      <div class="bloomLight"></div></div><div class="miniTitle">${esc(s.hint)}</div><div class="miniSub">${esc(s.sub||'')}</div>
      <div class="bloomBtns"><button class="ghostBtn primary" id="bloomStay">蹲下来等</button><button class="ghostBtn" id="bloomLeave">站起来走开</button></div>
      <div class="bloomClock" id="bloomClock"></div>`);
    const clock=$('bloomClock'); let elapsed=0;
    const it=every(()=>{ if(!cb){clearInterval(it);return;} elapsed++; clock.textContent=String(elapsed).padStart(2,'0')+' s'; },1000);
    $('bloomLeave').onclick=()=>{ clearInterval(it); finish(false,{stayed:false}); };
    $('bloomStay').onclick=()=>{
      clearInterval(it); $('bloomStay').classList.add('hidden'); $('bloomLeave').classList.add('hidden');
      $('bloomBud').classList.add('open'); if(VAudio)VAudio.sfx('bell');
      later(3200,()=>finish(false,{stayed:true}));
    };
  };

  /* 凌晨的门：时间跳格 + 按住门把 */
  GAMES.nightDoor=function(s){
    open('mNightDoor',`<div class="ndClock" id="ndClock">03:00</div><div class="ndDoor"><div class="ndHandle" id="ndHandle"></div></div>
      <div class="ndSparks" id="ndSparks"></div>
      <div class="miniTitle">${esc(s.hint)}</div><div class="miniSub">${esc(s.sub||'')}</div>`);
    const box=layer.querySelector('.miniBox'), clock=$('ndClock'), sp=$('ndSparks');
    const it=every(()=>{
      if(!cb){clearInterval(it);return;}
      for(let i=0;i<3;i++){const d=document.createElement('img');d.src='assets/pt/PT-08.png';d.className='ndSpark';
        d.style.left=rnd(60,86)+'%';d.style.top=rnd(38,62)+'%';sp.appendChild(d);setTimeout(()=>d.remove(),700);}
      if(Math.random()<.25&&VAudio)VAudio.sfx('weld');
    },420);
    holdWidget(box,{hint:'按住门把',sub:'或者就站着 · 时间会一格一格跳',dur:s.dur||9,
      onProgress:(r)=>{ const mins=Math.floor(r*23); clock.textContent='03:'+String(mins).padStart(2,'0'); },
      onUp:()=>{},
    });
    const _cleanup=M._cleanupHold;
    M._cleanupHold=()=>{clearInterval(it); if(_cleanup)_cleanup();};
  };

  /* 焊渠：画面里焊接，弧光/火花/涟漪都跟着按住的进度走 */
  GAMES.weld=function(s){
    fxScene({
      img:'assets/q2/Q2-F1.jpg',
      kicker:'第 17 夜 · 三号渠',
      hint:s.hint||'按住 · 焊完这一夜',
      hold:'按住画面 · 焊',
      dur:s.dur||9,
      onProgress:(r,stage)=>{
        const fl=stage.querySelector('#scFxLayer');
        if(Math.random()<.55){
          const d=document.createElement('img'); d.src='assets/pt/PT-08.png'; d.className='weldSpark';
          d.style.left=(34+rnd(-8,8))+'%'; d.style.top=(58+rnd(-6,6))+'%';
          d.style.width=rnd(4,11)+'px'; fl.appendChild(d); setTimeout(()=>d.remove(),800);
        }
        if(Math.random()<.3&&VAudio)VAudio.sfx('weld');
        const arc=fl.querySelector('.weldArc');
        if(arc)arc.style.opacity=String(.35+.65*Math.abs(Math.sin(r*26)));
      },
      extra:'<div class="weldArc"></div><div class="weldRipple"></div>'
    });
  };
  GAMES.trigger=function(s){
    fxScene({
      img:'assets/q2/Q2-F3.jpg',
      kicker:'第七幕 · 那四十分钟',
      hint:s.hint||'按住扳机 · 直到不再响',
      hold:'按住画面 · 开枪',
      dur:s.dur||7,
      onProgress:(r,stage)=>{
        if(r>.5&&Math.random()<.5){
          const d=stage.querySelector('#scFxLayer');
          const f=document.createElement('div'); f.className='muzzleFlash';
          f.style.left=(56+rnd(-4,4))+'%'; f.style.top=(38+rnd(-4,4))+'%';
          d.appendChild(f); setTimeout(()=>f.remove(),160);
          if(VAudio&&Math.random()<.6)VAudio.sfx('gunshot');
        }
        if(r>.6)stage.classList.add('isShaking');
        else stage.classList.remove('isShaking');
      }
    });
  };
  /* ---------- 工作台三景 ----------
     P11 / P13 / P14 的共同症状：舞台是空的，只有一颗圆形「按住」按钮，
     按住也看不出发生了什么。这里把三处都改成「在画面上干活」：
     按住的进度直接改写画面本身（磨痕、螺丝、核心），并配有火花与灰尘。 */

  /* 修一根轴：磨痕一层层退掉（剧本要求「不给进度条」，所以不画进度线） */
  GAMES.repair=function(s){
    openScene('mRepairSc',`
      <img class="scShot on wbShot" id="rpShot" src="assets/sc/SC-30.jpg" alt="">
      <div class="scDark"></div>
      <div class="wbBench" id="rpBench">
        <i class="rpShaft"><i class="rpWear" id="rpWear"></i><i class="rpShine" id="rpShine"></i></i>
        <i class="rpFile" id="rpFile"></i>
      </div>
      <div class="scFxLayer" id="rpFx"></div>
      <div class="scVig"></div>
      <div class="scCap on"><em>间章 · 工具间</em><span id="rpCap">手腕里那根轴磨成了椭圆。锉圆它。</span></div>
      <div class="scHoldTxt" id="scHoldTxt">按住画面 · 锉下去</div>`,(stage)=>{
        const bench=$('rpBench'), wear=$('rpWear'), shine=$('rpShine'),
              file=$('rpFile'), fx=$('rpFx'), cap=$('rpCap'), shot=$('rpShot');
        let strokes=0, lastN=0;
        const lines=[
          [0,'手腕里那根轴磨成了椭圆。锉圆它。'],
          [.28,'一下，两下。铁屑落在工作台上，像很轻的雪。'],
          [.55,'它的手一直在旁边等着，一动不动。'],
          [.78,'轴慢慢变圆。他的手开始跟着锉刀的节奏轻轻发颤。']
        ];
        sceneHold(stage,{
          dur:s.dur||7,
          onDown:()=>{ file.classList.add('on'); if(VAudio)VAudio.sfx('clank'); },
          onProgress:(r)=>{
            wear.style.opacity=String(Math.max(0,1-r*1.06));
            shine.style.opacity=String(r*.9);
            if(shot)shot.style.transform=`scale(${1.04+r*.06}) translate(${r*-.8}%,${r*-.6}%)`;
            // 每一「锉」都看得见：锉刀下去、火花溅开
            const n=Math.floor(r*18);
            if(n!==lastN){
              lastN=n; strokes=n;
              file.style.transform=`translateY(${n%2?9:-3}px) rotate(${n%2?2.4:-1.6}deg)`;
              for(let k=0;k<3;k++){
                const sp=document.createElement('i'); sp.className='wbSpark';
                sp.style.left=(50+rnd(-3,3))+'%'; sp.style.top=(56+rnd(-4,2))+'%';
                sp.style.setProperty('--dx',rnd(-18,18)+'px');
                sp.style.setProperty('--dy',rnd(-34,-14)+'px');
                fx.appendChild(sp); setTimeout(()=>sp.remove(),620);
              }
              if(VAudio&&n%2===0)VAudio.sfx('clank');
            }
            for(let k=lines.length-1;k>=0;k--){
              if(r>=lines[k][0]){ if(cap.textContent!==lines[k][1])cap.textContent=lines[k][1]; break; }
            }
          },
          // 松手锉刀就收回去，只有按住的当下它在动
          onUp:()=>{ file.classList.remove('on'); file.style.transform=''; },
          onDone:()=>{
            bench.classList.add('done'); file.classList.remove('on');
            if(cap)cap.textContent='轴磨圆了。他把右手举到眼前，翻过来，翻过去。';
            if(VAudio)VAudio.sfx('confirm');
          }
        });
      });
  };

  /* 拧八颗螺丝：一颗一颗松开，灰尘扬起来，最后风扇转起来 */
  GAMES.server=function(s){
    openScene('mServerSc',`
      <img class="scShot on wbShot" id="svShot" src="assets/sc/SC-38.jpg" alt="">
      <div class="scDark"></div>
      <div class="svScrews" id="svScrews"></div>
      <div class="svFan" id="svFan"></div>
      <div class="scFxLayer" id="svFx"></div>
      <div class="scVig"></div>
      <div class="scCap on"><em>第六幕 · 观测塔 · 地籍机柜</em><span id="svCap">八颗螺丝。清灰，换轴承，做镜像。</span></div>
      <div class="scHoldTxt" id="scHoldTxt">按住画面 · 拧下去</div>
      <div class="scHold on"><i id="scBar"></i></div>`,(stage)=>{
        const box=$('svScrews'), fx=$('svFx'), cap=$('svCap'), fan=$('svFan');
        const N=8, done=[];
        for(let k=0;k<N;k++){ const d=document.createElement('i'); box.appendChild(d); }
        const caps=['八颗螺丝。清灰，换轴承，做镜像。','第一排松了。灰是温的。',
                    '它在旁边递工具，不用抬头也知道他要哪一把。','最后一颗。风扇卡了一下，转了。'];
        sceneHold(stage,{
          dur:s.dur||8,
          onDown:()=>{ if(VAudio)VAudio.sfx('type'); },
          onProgress:(r)=>{
            const want=Math.min(N,Math.floor(r*N+.35));
            while(done.length<want){
              const el=box.children[done.length]; if(el)el.classList.add('on');
              done.push(1);
              for(let k=0;k<2;k++){
                const d=document.createElement('i'); d.className='wbDust';
                d.style.left=(rnd(52,78))+'%'; d.style.top=(rnd(34,64))+'%';
                fx.appendChild(d); setTimeout(()=>d.remove(),1200);
              }
              if(VAudio)VAudio.sfx('clank');
            }
            fan.classList.toggle('on', r>.86);
            const ci=Math.min(caps.length-1,Math.floor(r*caps.length));
            if(cap&&cap.textContent!==caps[ci])cap.textContent=caps[ci];
          }
        });
      });
  };

  /* 取核心：按住把它拔出来；松手它还会亮着 */
  GAMES.core=function(s){
    openScene('mCoreSc',`
      <img class="scShot on wbShot" id="coShot" src="assets/sc/SC-42.jpg" alt="">
      <div class="scDark"></div>
      <div class="coreOrbWrap">
        <i class="coreGhost" id="coGhost"></i>
        <i class="coreOrb" id="coOrb"></i>
      </div>
      <div class="scFxLayer" id="coFx"></div>
      <div class="scVig"></div>
      <div class="scCap on"><em>第七幕 · 穹顶外沿</em><span id="coCap">核心在胸腔里亮着。按住，把它取出来。</span></div>
      <div class="scHoldTxt" id="scHoldTxt">按住画面 · 取出来</div>`,(stage)=>{
        const orb=$('coOrb'), ghost=$('coGhost'), cap=$('coCap'), fx=$('coFx');
        const caps=['核心在胸腔里亮着。按住，把它取出来。',
                    '它开始往外走。光在指缝里漏出来。',
                    '很轻。比想象中轻太多了。'];
        let pulled=0;
        sceneHold(stage,{
          dur:s.dur||6,
          onDown:()=>{ if(VAudio)VAudio.sfx('servo'); },
          onProgress:(r)=>{
            pulled=r;
            orb.style.opacity=String(.16+r*.84);
            orb.style.transform=`translateY(${-r*26}%) scale(${1-r*.18})`;
            ghost.style.opacity=String(r*.7);
            if(r>.2&&Math.random()<.35){
              const d=document.createElement('i'); d.className='wbSpark';
              d.style.left=(50+rnd(-8,8))+'%'; d.style.top=(56+rnd(-6,6))+'%';
              d.style.setProperty('--dy',rnd(-30,-12)+'px'); d.style.setProperty('--dx',rnd(-14,14)+'px');
              d.style.background='radial-gradient(circle,#e8ffff,rgba(90,220,240,.85) 45%,transparent 72%)';
              fx.appendChild(d); setTimeout(()=>d.remove(),620);
            }
            const ci=Math.min(caps.length-1,Math.floor(r*caps.length));
            if(cap&&cap.textContent!==caps[ci])cap.textContent=caps[ci];
          },
          onUp:(r)=>{
            if(r<1){
              orb.style.transform=''; orb.style.opacity='.16';
              // 松手只是松手：核心还在里面，还亮着
              ghost.style.opacity='.34';
              if(cap)cap.textContent='松手了。它还亮着。';
            }
          }
        });
      });
  };

  /* 心电波形（两条） */
  GAMES.ecg=function(s){ ecgGame(s,2); };
  GAMES.ecg2=function(s){ ecgGame(s,2); };
  function ecgGame(s){
    open('mEcg',`<div class="ecgMonitor"><canvas id="ecgMini" width="900" height="240"></canvas>
      <div class="ecgLabel">HEART RATE / K-07<span id="ecgBpm">72 BPM</span></div></div>
      <div class="miniTitle">${esc(s.hint||'')}</div><div class="miniSub">${esc(s.sub||'')}</div>
      <button class="ghostBtn" id="ecgGo">继续</button>`);
    const c=$('ecgMini'), x=c.getContext('2d'); let ph=0, rid=0;
    function draw(){
      if(!cb)return;
      x.clearRect(0,0,c.width,c.height);
      [0,1].forEach(k=>{
        x.beginPath(); x.lineWidth=k?2:2.4; x.strokeStyle=k?'rgba(120,190,235,.75)':'rgba(120,235,165,.95)';
        x.shadowBlur=10; x.shadowColor=x.strokeStyle;
        const mid=k?150:110, spd=k?.008:.013;
        for(let i=0;i<=c.width;i+=2){
          const u=i/c.width, q=(u+ph*(k?.6:1))%1;
          let y=mid;
          if(q>.20&&q<.215)y+=18; else if(q>=.215&&q<.23)y-=14; else if(q>=.23&&q<.246)y+=72; else if(q>=.246&&q<.262)y-=28;
          else if(q>.32&&q<.42)y-=Math.sin((q-.32)/.1*Math.PI)*22;
          if(i===0)x.moveTo(i,y);else x.lineTo(i,y);
        }
        x.stroke(); x.shadowBlur=0;
      });
      ph+=.006; rid=requestAnimationFrame(draw);
    }
    draw();
    M._cleanupHold=()=>cancelAnimationFrame(rid);
    $('ecgGo').onclick=()=>finish(false);
  }

  /* 地籍检索 */
  GAMES.archive=function(s){
    const target=((s.hint||'').split('·').pop()||'').trim()||'新港三区';
    open('mArchive',`<div class="arcScreen"><div class="arcHead">ARCHIVE / 2132-NG-03</div>
      <div class="arcTask"><span>这一步要做的事</span>
        <b>在检索框里输入地名「${esc(target)}」，然后按回车</b>
        <button class="arcFill" id="arcFill">直接填入</button></div>
      <div class="arcSearch" id="arcSearch"><span>检索：</span><input id="arcInput" placeholder="输入地名，例如：新港三区" autocomplete="off" aria-label="输入地名，例如新港三区"><button id="arcGo">检索 ↵</button></div>
      <div class="arcHint" id="arcHint">光标已经在输入框里 · 打字后按 Enter</div>
      <div class="arcResult" id="arcResult"></div></div>
      <div class="miniTitle">${esc(s.hint)}</div><div class="miniSub">${esc(s.sub||'')}</div>`);
    const inp=$('arcInput'), res=$('arcResult'), search=$('arcSearch'), hint=$('arcHint'), goBtn=$('arcGo');
    function syncReady(){
      const ready=!!inp.value.trim();
      search.classList.toggle('ready',ready);
      goBtn.classList.toggle('ready',ready);
      if(ready) hint.textContent='已输入：'+inp.value.trim()+'　·　按 Enter 或点「检索」执行';
      else hint.textContent='光标已经在输入框里 · 打字后按 Enter';
    }
    function go(){
      if(!inp.value.trim()){
        hint.textContent='请先在检索框里输入地名，例如「新港三区」';
        inp.focus(); if(VAudio)VAudio.sfx('clank'); return;
      }
      hint.textContent='检索中…';
      res.innerHTML='<div class="arcTyping"></div>'; if(VAudio)VAudio.sfx('type');
      const txt=s.result||''; let i=0;
      const it=every(()=>{ if(!cb){clearInterval(it);return;}
        res.textContent=txt.slice(0,++i); if(VAudio&&i%4===0)VAudio.sfx('type');
        if(i>=txt.length){ clearInterval(it); res.classList.add('found'); if(VAudio)VAudio.sfx('confirm');
          later(1900,()=>finish(false,{found:true})); }
      },42);
    }
    const fillBtn=$('arcFill');
    if(fillBtn)fillBtn.onclick=()=>{ inp.value=target; syncReady(); inp.focus(); if(VAudio)VAudio.sfx('type'); };
    goBtn.onclick=go;
    search.addEventListener('click',e=>{ if(e.target===search||e.target.tagName==='SPAN')inp.focus(); });
    inp.addEventListener('keydown',e=>{if(e.key==='Enter')go();});
    inp.addEventListener('input',()=>{ syncReady(); if(inp.value.length>0&&Math.random()<.2&&VAudio)VAudio.sfx('type'); });
    setTimeout(()=>{inp.focus(); syncReady();},80);
  };

  /* 代码浮起：掌心那台旧机器，按住让光带一行一行浮上来 */
  GAMES.code=function(s){
    openScene('mCodeSc',`
      <div class="scDark"></div>
      <div class="scInsWrap"><img class="scIns" id="codeIns" src="assets/q2/Q2-F4.jpg" alt=""></div>
      <pre class="codeFloat" id="codeFloat"></pre>
      <div class="scVig"></div>
      <div class="scCap on"><em>第八幕 · 掌心</em>${esc(s.hint||'看它写下的那行代码')}</div>
      <div class="scHoldTxt" id="scHoldTxt">按住画面</div>
      <div class="scHold"><i id="scBar"></i></div>`,(stage)=>{
        const ins=$('codeIns'), code=$('codeFloat');
        const lines=['// 2132-NG-03 · 118','while (someone_is_watching) {','  push_again();','}'];
        let shown=0;
        requestAnimationFrame(()=>ins.classList.add('on'));
        sceneHold(stage,{
          dur:s.dur||5,
          onProgress:(r)=>{
            ins.style.opacity=String(.2+r*.8);
            ins.style.transform=`translate(-50%,-50%) scale(${.95+r*.06})`;
            const want=Math.min(lines.length,Math.floor(r*lines.length)+1);
            if(want>shown){
              shown=want;
              code.innerHTML=lines.slice(0,want).map(l=>`<b>${esc(l)}</b>`).join('\n');
              if(VAudio)VAudio.sfx('type');
            }
          },
          onUp:(r)=>{ if(r<1){ shown=0; code.innerHTML=''; } }
        });
      });
  };

  /* 全城推送 */
  GAMES.broadcast=function(s){
    open('mBroadcast',`<div class="bcScreen"><div class="bcNoise"></div><div class="bcLines" id="bcLines"></div></div>
      <button class="ghostBtn" id="bcGo">跳过</button>`);
    const L=$('bcLines'), lines=s.lines||[]; let i=0;
    function next(){
      if(i>=lines.length){ later(1000,()=>finish(false)); return; }
      const d=document.createElement('div'); d.className='bcLine'; d.textContent=lines[i++];
      L.appendChild(d); requestAnimationFrame(()=>d.classList.add('on'));
      if(VAudio)VAudio.sfx(i%3?'type':'confirm');
      later(1250,next);
    }
    $('bcGo').onclick=()=>finish(false);
    later(500,next);
  };

  /* 空弹匣 */
  GAMES.emptyMag=function(s){
    open('mEmpty',`<div class="emptyMag"><div class="magBody" id="magBody"><i></i><i></i><i></i><i></i></div></div>
      <div class="miniTitle">${esc(s.hint||'')}</div><div class="miniSub">${esc(s.sub||'')}</div>
      <button class="ghostBtn" id="emptyGo">继续</button>`);
    $('emptyGo').onclick=()=>{ $('magBody').classList.add('out'); if(VAudio)VAudio.sfx('clank');
      later(1200,()=>finish(false)); };
  };

  /* 四十一盏灯 */
  GAMES.tide=function(s){
    open('mTide',`<div class="tideGrid" id="tideGrid"></div><div class="tideWord" id="tideWord"></div>
      <div class="miniTitle">${esc(s.hint||'')}</div><button class="ghostBtn" id="tideGo">跳过</button>`);
    const g=$('tideGrid'), w=$('tideWord'), words=s.words||[];
    for(let i=0;i<41;i++){const d=document.createElement('i');g.appendChild(d);}
    let i=0;
    function next(){
      if(i>=41){ later(900,()=>finish(false)); return; }
      g.children[i].classList.add('on');
      if(i<words.length){ w.textContent=words[i]; w.classList.remove('on'); void w.offsetWidth; w.classList.add('on'); }
      if(VAudio&&i%3===0)VAudio.sfx('bell');
      i++; later(240,next);
    }
    $('tideGo').onclick=()=>finish(false);
    // 41 盏灯自己亮起来，玩家只负责看
    later(420,next);
  };

  /* 卷首调频 */
  GAMES.tuning=function(s){
    open('mTuning',`<div class="tuneWrap"><div class="tuneDial" id="tuneDial"></div>
      <div class="tuneBars" id="tuneBars"></div><div class="tuneFreq" id="tuneFreq">— — — kHz</div></div>
      <div class="miniTitle">${esc(s.hint)}</div><div class="miniSub">${esc(s.sub||'')}</div>
      <button class="ghostBtn" id="tuneGo">找到那个台</button><button class="ghostBtn" id="tuneSkip">跳过（她会把话说完）</button>`);
    const bars=$('tuneBars'), dial=$('tuneDial'), f=$('tuneFreq');
    for(let i=0;i<28;i++){const b=document.createElement('i');bars.appendChild(b);}
    let v=.2, rid=0;
    function draw(){
      if(!cb)return;
      [...bars.children].forEach((b,i)=>{ b.style.height=(8+Math.abs(Math.sin(i*.7+v*18))*rnd(10,44))+'px'; });
      f.textContent=(88+v*20).toFixed(1)+' kHz';
      dial.style.transform=`rotate(${(v-.5)*260}deg)`;
      rid=requestAnimationFrame(draw);
    }
    draw(); M._cleanupHold=()=>cancelAnimationFrame(rid);
    const box=layer.querySelector('.tuneWrap');
    box.addEventListener('pointermove',e=>{const r=box.getBoundingClientRect();v=(e.clientX-r.left)/r.width;});
    cur._key=(k)=>{ if(k==='ArrowRight'){v=Math.min(1,v+.04);return true;} if(k==='ArrowLeft'){v=Math.max(0,v-.04);return true;} return false; };
    $('tuneGo').onclick=()=>{ if(VAudio)VAudio.sfx('bell'); later(600,()=>finish(false,{tuned:true})); };
    $('tuneSkip').onclick=()=>finish(false,{tuned:false,skipped:true});
  };

  /* 合诗：双列同屏 */
  GAMES.duet=function(s){
    const pairs=s.pairs||[];
    const html=pairs.map(p=>`<div class="duetRow"><div class="duetL">${esc(p[0])}</div><div class="duetR">${esc(p[1])}</div></div>`).join('');
    open('mDuet',`<div class="duetScreen"><div class="duetHead"><span>心跳层</span><span>维护日志</span></div>
      <div class="duetBody" id="duetBody">${html}</div></div>
      <div class="miniSub">${esc(s.hint||'')}</div><button class="ghostBtn" id="duetGo">往下读</button>`);
    const b=$('duetBody'), rows=[...b.children];
    rows.forEach((r,i)=>{r.style.animationDelay=(i*.42)+'s';});
    $('duetGo').onclick=()=>{ b.classList.add('scrolling');
      if(VAudio)VAudio.sfx('paper');
      later(Math.min(9000,1800+pairs.length*430),()=>finish(false)); };
  };

  /* 沉核心：整屏水与核心，按住让它沉下去；渠道历史逐行浮起 */
  GAMES.sink=function(s){
    openScene('mSinkSc',`
      <div class="scDark"></div>
      <div class="scInsWrap"><img class="scIns sinkCore" id="sinkCore" src="assets/q2/Q2-F2.jpg" alt=""></div>
      <div class="sinkRipple" id="sinkRipple"></div>
      <div class="sinkLines" id="sinkLines"></div>
      <div class="scVig"></div>
      <div class="scCap on"><em>跋 · 渠边说（三）</em>${esc(s.hint||'按住核心 · 让它沉下去')}</div>
      <div class="scHoldTxt" id="scHoldTxt">按住画面 · 让它沉下去</div>
      <div class="scHold"><i id="scBar"></i></div>`,(stage)=>{
        const core=$('sinkCore'), L=$('sinkLines'), lines=s.lines||[]; let shown=0;
        requestAnimationFrame(()=>core.classList.add('on'));
        sceneHold(stage,{
          dur:s.dur||9,
          onProgress:(r)=>{
            core.style.opacity=String(.22+r*.78);
            core.style.transform=`translate(-50%,-50%) translateY(${r*9}%) scale(${1-r*.14})`;
            if(Math.random()<.25&&VAudio)VAudio.sfx('water');
            const want=Math.floor(r*lines.length);
            while(shown<want&&shown<lines.length){
              const d=document.createElement('div'); d.textContent=lines[shown++]; L.appendChild(d);
              requestAnimationFrame(()=>d.classList.add('on')); if(VAudio)VAudio.sfx('type');
            }
          },
          onUp:(r)=>{ if(r<1){ L.innerHTML=''; shown=0; core.style.transform=''; } }
        });
      });
  };

  /* 纯按住（留下来看一会儿 / 站着不动） */
  GAMES.hold=function(s){
    // 舞台铺当前场景图，别用一块纯黑的空框；提示只由 holdWidget 说一遍
    const sc=window.VGame&&VGame.scene;
    const bg=sc?` style="background-image:url(assets/sc/${sc}.jpg)"`:'';
    open('mHold',`<div class="holdStage"${bg}><div class="holdParticles" id="holdParticles"></div><div class="holdGlow"></div></div>`);
    const box=layer.querySelector('.miniBox'), hp=$('holdParticles');
    holdWidget(box,{hint:s.hint||'按住',sub:s.sub||'',dur:s.dur||6,
      onProgress:(r)=>{
        if(Math.random()<.22){const d=document.createElement('img');d.src='assets/pt/PT-06.png';d.className='holdP';
          d.style.left=rnd(20,80)+'%';d.style.top=rnd(30,72)+'%';hp.appendChild(d);setTimeout(()=>d.remove(),900);}
      },
      onUp:()=>{},
    });
  };

  /* 通用兜底 */
  GAMES._generic=function(s){
    open('mGeneric',`<div class="genericArt"></div><div class="miniTitle">${esc(s.hint||'继续')}</div>
      <div class="miniSub">${esc(s.sub||'')}</div><button class="ghostBtn" id="gGo">继续</button>`);
    $('gGo').onclick=()=>finish(false);
    cur._key=(k)=>{ if(k===' '||k==='Enter'){finish(false);return true;} return false; };
  };

  /* ---------- 清理钩子 ---------- */
  /* 静默中止：不触发回调，用于面板切换 / 返回主菜单 */
  M.abort=function(){
    if(!cb){ if(layer){layer.className='miniLayer';layer.innerHTML='';} M.active=null; return; }
    cb=null; clearTimers();
    try{ if(M._cleanupHold)M._cleanupHold(); }catch(e){}
    M._cleanupHold=null; M._keyUp=null;
    if(layer){ layer.className='miniLayer'; layer.innerHTML=''; }
    M.active=null; cur=null;
    try{ if(VAudio)VAudio.duck(1,.1); }catch(e){}
  };
  M.cancel=function(){ if(cb)finish(true); };
  M.init=function(){
    layer=$('miniLayer');
    /* 玩家会点画面本身 —— 旧版点到空白处什么都不发生，就被读成「卡住」。
       这里把点击翻译成「该点的按钮闪一下 + 一句提示」，不替玩家做决定。 */
    layer.addEventListener('pointerdown',e=>{
      if(!cb)return;
      if(layer.classList.contains('mScene'))return;         // 场景演出由画面自己接
      if(e.target.closest&&e.target.closest('button,input,textarea,select,a,[role=button],.noTap'))return;
      if(M._tap)M._tap();
    });
  };
})();
