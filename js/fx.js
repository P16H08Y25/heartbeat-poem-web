/* ============================================================
   fx.js — 2.0 视觉引擎
   场景双层交叉淡入 · 电影调色 · 镜头运动 · 真实粒子贴图
   心跳波形 / 光点 · 胶片颗粒 · 暗角 · 全部屏幕特效
   ============================================================ */
(function () {
  'use strict';
  const F = (window.VFX = { ready:false });
  const D = window.V2DATA;
  let stage, bgA, bgB, gradeLayer, camWrap, pCanvas, pctx, grain, flash, shakeEl;
  let curImg=null, curCode=null, raf=0, last=0, t=0;
  let camState={ z:1.04, drift:.008, push:.004, sway:.006, pan:0, x:0, y:0 };
  let camTarget={ z:1.04, drift:.008, push:.004, sway:.006, pan:0, x:0, y:0 };
  let cutToken=0;
  let quality='cinema', particlesOn=true, grainOn=true, driftOn=true, scopeOn=false;
  let cfg={ layers:[], wind:0, fog:0, wet:0 };
  const sprites={};   // PT 贴图
  const plist=[];      // 活跃粒子
  let W=1280,H=720, DPR=1, PDPR=1, EDPR=1;
  let ecgCanvas=null, ecgCtx=null, ecgPhase=0, ecgMode='live';
  // 帧预算：粒子 / 心电图 / 镜头统一 30fps，颗粒完全交给 GPU
  let pAcc=0, ecgAcc=0, camAcc=0, perfScale=1, slowFrames=0, lastMode=null;

  const $ = id => document.getElementById(id);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rnd=(a,b)=>a+Math.random()*(b-a);

  /* ---------------- 初始化 ---------------- */
  F.init=function(){
    if(F.ready)return;
    stage=$('stage'); bgA=$('bgA'); bgB=$('bgB');
    // 镜头只变换背景层：粒子 / 立绘 / 颗粒不再被巨型父层拖着每帧重合成
    gradeLayer=$('gradeLayer'); camWrap=$('bgLayer');
    pCanvas=$('pCanvas'); pctx=pCanvas.getContext('2d');
    grain=$('grainCanvas');
    flash=$('flashLayer'); shakeEl=$('stageShake');
    ecgCanvas=$('ecgCanvas'); ecgCtx=ecgCanvas?ecgCanvas.getContext('2d'):null;
    // 预载粒子贴图
    Object.keys(D.PARTICLES).forEach(k=>{
      const im=new Image(); im.src='assets/pt/'+D.PARTICLES[k]+'.png'; sprites[k]=im;
    });
    window.addEventListener('resize',resize,{passive:true});
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){ if(raf){cancelAnimationFrame(raf);raf=0;} }
      else if(!raf){ last=performance.now(); raf=requestAnimationFrame(loop); }
    });
    resize();
    buildGrainTile();
    F.ready=true;
    last=performance.now();
    raf=requestAnimationFrame(loop);
  };

  function resize(){
    if(!stage)return;
    const r=stage.getBoundingClientRect();
    W=Math.max(640,r.width); H=Math.max(360,r.height);
    DPR=Math.min(window.devicePixelRatio||1, quality==='cinema'?1.25:1);
    // 粒子是柔光斑：0.75x 画布由 CSS 拉伸，像素填充与纹理上传再降 44%
    PDPR=quality==='low'?.6:.75; EDPR=Math.min(DPR,1.25);
    pCanvas.width=Math.floor(W*PDPR); pCanvas.height=Math.floor(H*PDPR);
    pCanvas.style.width=W+'px'; pCanvas.style.height=H+'px';
    if(ecgCanvas){ const er=ecgCanvas.getBoundingClientRect();
      ecgCanvas.width=Math.max(300,Math.floor(er.width*EDPR));
      ecgCanvas.height=Math.max(60,Math.floor(er.height*EDPR)); }
  }

  /* 胶片颗粒：只生成一次 192² 的小 tile，之后由 CSS transform 动画抖动。
     旧实现每 55ms 重建整屏 ImageData（约 2600 万次随机数/秒），是卡顿主因。 */
  function buildGrainTile(){
    if(!grain)return;
    const S=192;
    const c=document.createElement('canvas'); c.width=c.height=S;
    const x=c.getContext('2d'), id=x.createImageData(S,S), d=id.data;
    for(let i=0;i<d.length;i+=4){
      const v=Math.random()*255; d[i]=d[i+1]=d[i+2]=v; d[i+3]=16+Math.random()*24;
    }
    x.putImageData(id,0,0);
    grain.style.backgroundImage=`url(${c.toDataURL('image/png')})`;
    grain.style.backgroundRepeat='repeat';
    grain.style.backgroundSize=S+'px '+S+'px';
    grain.classList.add('grainReady');
  }

  /* ---------------- 场景切换 ---------------- */
  F.scene=function(code, opts){
    opts=opts||{};
    const meta=D.SCENES[code]||D.SCENES['SC-01'];
    const sc=meta.code;
    curCode=sc;
    const src='assets/sc/'+sc+'.jpg';
    const img=new Image();
    img.onload=()=>{
      const next = (curImg===bgA)? bgB : bgA;
      next.src=src;
      next.style.opacity='0';
      next.classList.add('on');
      requestAnimationFrame(()=>{
        const dur=(opts.fade||1.0)*1000;
        next.style.transition='opacity '+dur+'ms cubic-bezier(.32,.06,.24,1)';
        next.style.opacity='1';
        if(curImg){ curImg.style.transition='opacity '+(dur*1.08)+'ms ease'; curImg.style.opacity='0'; }
        curImg=next;
      });
    };
    img.src=src;
    // 若已在缓存，onload 仍会触发
    applyGrade(meta.grade, opts.gradeExt);
    setWeather(meta.weather, opts);
    setCam(meta.cam);
    F.setScope && F.setScope(false);
  };

  function applyGrade(name, ext){
    const g=Object.assign({}, D.GRADE[name]||D.GRADE.noir);
    if(ext==='bright'){ g.exposure=1.22; g.contrast=1.02; g.sat=1.06; g.temp=.14; g.tint='#cfe6c4'; g.vignette=.30; }
    if(ext==='wide'){ g.exposure=1.10; g.sat=1.10; }
    if(ext==='blood'){ g.tint='#8f1f16'; g.temp=.24; g.sat=1.10; }
    if(ext==='exterior'){ g.exposure=.80; g.sat=.70; g.temp=-.10; }
    const f=`brightness(${g.exposure}) contrast(${g.contrast}) saturate(${g.sat})`;
    if(bgA)bgA.style.filter=f; if(bgB)bgB.style.filter=f;
    // 暗角 / 色温 / 湿光 / 雾合并为单个普通渐变层：零 mix-blend-mode、零额外合成层
    if(gradeLayer){
      // 原 vignette 层自带 opacity:.6，合并后必须还原这个系数，否则画面会被压得过黑
      const v=clamp(g.vignette||0,0,1)*.6;
      const t1=hex(g.tint,.13), t2=hex(g.tint,Math.abs(g.temp||0)*.16);
      gradeLayer.style.background=
        `radial-gradient(115% 88% at 50% 46%,transparent 34%,rgba(0,0,0,${(v*.55).toFixed(3)}) 78%,rgba(0,0,0,${(v*.92).toFixed(3)}) 100%),`+
        `radial-gradient(120% 90% at 50% 40%,transparent 42%,${t1} 100%),`+
        `linear-gradient(${(g.temp||0)>0?'15deg':'195deg'},${t2},transparent 60%),`+
        `linear-gradient(180deg,transparent 62%,rgba(190,215,225,.05) 100%),`+
        `radial-gradient(80% 50% at 50% 90%,rgba(200,215,220,.05),transparent 70%)`;
    }
  }

  function hex(h,a){
    const m=/^#([0-9a-f]{6})$/i.exec(h||'#000000');
    if(!m)return `rgba(0,0,0,${a})`;
    const n=parseInt(m[1],16), r=n>>16, g=(n>>8)&255, b=n&255;
    return `rgba(${r},${g},${b},${a})`;
  }

  function setCam(name){
    const c=D.CAM[name]||D.CAM.static;
    camTarget=Object.assign({pan:0,x:0,y:0},c);
    camState.z=camTarget.z;
    camState.x=0; camState.y=0;
  }
  F.cam=function(name){ setCam(name); };
  F.nudgeCam=function(dx,dy){ camTarget.x=(camTarget.x||0)+dx; camTarget.y=(camTarget.y||0)+dy; };

  /* ---------------- 天气 / 粒子 ---------------- */
  function setWeather(name,opts){
    const base=D.WEATHER[name]||D.WEATHER.none;
    cfg={ layers:base.layers.map(l=>l.slice()), wind:base.wind, fog:base.fog, wet:base.wet };
    if(opts && opts.smoke){ cfg.layers.push(['dust',1.0,.55]); }
    if(opts && opts.rainBoost){ cfg.layers.push(['rain',.7,1]); }
    seedParticles();
  }
  F.weather=function(name){ setWeather(name); };

  function seedParticles(){
    plist.length=0;
    if(!particlesOn)return;
    const idle=stage && stage.dataset.mode==='title';
    const base = quality==='cinema'? 88 : quality==='balanced'? 56 : 28;
    // 主菜单只留稀疏的雨，画面更干净；perfScale 由帧率自适应下调
    const maxN = Math.max(12, Math.round(base*perfScale*(idle?.45:1)));
    cfg.layers.forEach(layer=>{
      const [type,density,alphaScale]=layer;
      const n=Math.floor(maxN*clamp(density,0,1.6)/Math.max(1,cfg.layers.length*.55));
      for(let i=0;i<n;i++) plist.push(makeP(type,alphaScale,true));
    });
  }
  F.reseed=seedParticles;

  function makeP(type,alphaScale,initial){
    const s=sprites[type];
    const isRain=type==='rain', isNeon=type==='neon';
    const p={
      type, s, grid: spriteGrid(type),
      alpha: rnd(.20,.85)*alphaScale,
      x: rnd(-.1,1.1)*W, y: initial? rnd(-.1,1.1)*H : (isRain? -rnd(10,90) : rnd(-.1,1.1)*H),
      vx:0, vy:0, w:0, h:0, rot:rnd(0,6.28), vr:rnd(-.7,.7), life:rnd(0,1),
    };
    configP(p,alphaScale);
    p.alphaScale=alphaScale;
    return p;
  }
  function spriteGrid(type){
    // 每张粒子图是 4×4 左右的 sprite sheet
    return ({petal:4,pollen:5,leaf:4,fall:4,rain:5,dust:5,rust:4,ember:5,snow:4,neon:4})[type]||4;
  }
  function configP(p,alphaScale){
    const t=p.type;
    if(t==='rain'){
      p.vy=rnd(680,1150); p.vx=cfg.wind*260+rnd(-40,40);
      p.w=rnd(7,15); p.h=rnd(26,58); p.rot=rnd(-.12,.12); p.vr=0;
    } else if(t==='neon'){
      p.vy=0; p.vx=rnd(560,900); p.w=rnd(90,190); p.h=rnd(26,46);
      p.rot=rnd(-.05,.05); p.vr=0; p.y=rnd(.05,.62)*H; p.x=-p.w;
    } else if(t==='ember'){
      p.vy=-rnd(30,105); p.vx=rnd(-28,32); p.w=p.h=rnd(5,14); p.vr=rnd(-1,1);
    } else if(t==='pollen'||t==='dust'){
      p.vy=rnd(-16,22); p.vx=cfg.wind*30+rnd(-14,14); p.w=p.h=rnd(4,13); p.vr=rnd(-.6,.6);
    } else if(t==='snow'){
      p.vy=rnd(38,95); p.vx=rnd(-24,18); p.w=p.h=rnd(6,18); p.vr=rnd(-.5,.5);
    } else if(t==='rust'){
      p.vy=rnd(60,170); p.vx=rnd(-30,30); p.w=p.h=rnd(5,14); p.vr=rnd(-2,2);
    } else { // petal / leaf / fall
      p.vy=rnd(24,72); p.vx=cfg.wind*40+rnd(-26,26); p.w=p.h=rnd(12,32); p.vr=rnd(-1.1,1.1);
    }
  }

  function drawParticles(step){
    if(!pctx)return;
    pctx.setTransform(1,0,0,1,0,0);
    pctx.clearRect(0,0,pCanvas.width,pCanvas.height);
    if(!particlesOn||!plist.length)return;
    // 用普通 alpha 混合：canvas 内 screen 每次绘制都要读回目标像素，代价高得多
    const r=PDPR;
    for(let i=0;i<plist.length;i++){
      const p=plist[i];
      p.x+=p.vx*step; p.y+=p.vy*step; p.rot+=p.vr*step; p.life+=step;
      let dead=false;
      if(p.type==='rain'){ if(p.y>H+80)dead=true; }
      else if(p.type==='neon'){ if(p.x>W+p.w)dead=true; }
      else if(p.type==='ember'){ if(p.y<-40)dead=true; }
      else { if(p.y>H+60||p.y<-80||p.x>W+90||p.x<-90)dead=true; }
      if(dead){ plist[i]=makeP(p.type,p.alphaScale,false); continue; }
      const im=p.s;
      if(!im || !im.complete || !im.naturalWidth) continue;
      const gw=im.naturalWidth/p.grid, gh=im.naturalHeight/p.grid;
      const gx=(i*7+Math.floor(p.life*3))%p.grid, gy=(i*11)%p.grid;
      let a=p.alpha;
      if(p.type==='neon') a*=clamp(Math.sin(p.life*.7),0,1)*.9;
      if(p.type==='ember') a*=clamp(p.life*1.5,0,1)*clamp((H+40-p.y)/H,0,1);
      if(p.type==='pollen') a*=.55+.45*Math.sin(p.life*1.7+i);
      pctx.globalAlpha=clamp(a*1.22,0,1);
      // 直接写变换矩阵，省掉每粒子一次 save/translate/rotate/restore
      if(p.vr===0){ pctx.setTransform(r,0,0,r,p.x*r,p.y*r); }
      else { const c=Math.cos(p.rot),s=Math.sin(p.rot);
             pctx.setTransform(c*r,s*r,-s*r,c*r,p.x*r,p.y*r); }
      try{ pctx.drawImage(im,gx*gw,gy*gh,gw,gh,-p.w/2,-p.h/2,p.w,p.h); }catch(e){}
    }
    pctx.globalAlpha=1;
    pctx.globalCompositeOperation='source-over';
    pctx.setTransform(1,0,0,1,0,0);
  }

  /* ---------------- 主循环 ----------------
     所有重活按 30fps 分频；颗粒与光点交给 CSS/GPU，JS 每帧只做少量状态计算。 */
  /* 分频：镜头 15fps（大层 transform 最贵）、粒子 24fps、心电图 20fps。
     三者都不需要 60Hz，低频更新能大幅减少全屏重合成次数。 */
  const CAM_F=1/15, P_F=1/24, ECG_F=1/20;
  function loop(now){
    raf=requestAnimationFrame(loop);
    const dt=clamp((now-last)/1000,0,.05); last=now; t+=dt;

    // 自适应降档：持续掉帧时自动减少粒子，不覆盖用户在设置里的选择
    if(dt>.042) slowFrames++; else slowFrames=Math.max(0,slowFrames-2);
    if(slowFrames>90&&perfScale>.55){ perfScale=.55; slowFrames=0; seedParticles(); }
    // 主菜单 / 游戏内切换时重新播种（两者密度不同）
    const mode=stage?stage.dataset.mode:'';
    if(mode!==lastMode){ lastMode=mode; seedParticles(); }

    camAcc+=dt;
    if(camWrap&&driftOn&&camAcc>=CAM_F){
      const cdt=camAcc; camAcc=0;
      camState.z += (camTarget.z-camState.z)*Math.min(1,cdt*1.4) + (camTarget.push||0)*cdt*.10;
      camState.x += ((camTarget.x||0)-camState.x)*Math.min(1,cdt*2);
      camState.y += ((camTarget.y||0)-camState.y)*Math.min(1,cdt*2);
      const sway=camTarget.sway||0, drift=camTarget.drift||0;
      const ox=Math.sin(t*.31)*sway*100 + Math.sin(t*.11)*drift*34 + (camTarget.pan||0)*Math.sin(t*.07)*40;
      const oy=Math.cos(t*.27)*sway*62 + Math.cos(t*.17)*drift*20;
      const z=camState.z + Math.sin(t*.23)*drift*.012;
      camWrap.style.transform=`translate(${camState.x+ox}px, ${camState.y+oy}px) scale(${z})`;
    }
    pAcc+=dt;   if(pAcc>=P_F){ const s=Math.min(pAcc,.09); pAcc=0; drawParticles(s); }
    ecgAcc+=dt; if(ecgAcc>=ECG_F){ const s=Math.min(ecgAcc,.09); ecgAcc=0; drawECG(s); }
  }

  F.perf=function(){ return {particles:plist.length, scale:perfScale, dpr:DPR}; };

  /* ---------------- 心电图 ---------------- */
  function drawECG(step){
    if(!ecgCtx||!ecgCanvas)return;
    const w=ecgCanvas.width,h=ecgCanvas.height;
    ecgCtx.clearRect(0,0,w,h);
    ecgPhase=(ecgPhase+step*(ecgMode==='flat'?0:.30))%1;
    const mid=h*.60;
    // 采样点稀疏 6 倍，波形特征（QRS 宽约 0.014）依然完整
    const N=Math.max(240,Math.floor(w/8));
    ecgCtx.beginPath();
    for(let i=0;i<=N;i++){
      const u=i/N, ph=(u+ecgPhase)%1;
      let y=mid;
      if(ecgMode!=='flat'){
        if(ph>.06&&ph<.12) y-=Math.sin((ph-.06)/.06*Math.PI)*h*.10;
        else if(ph>.19&&ph<.205) y+=h*.045;
        else if(ph>=.205&&ph<.218) y-=h*.06;
        else if(ph>=.218&&ph<.232) y+=h*.44;
        else if(ph>=.232&&ph<.252) y-=h*.16;
        else if(ph>.30&&ph<.40) y-=Math.sin((ph-.30)/.10*Math.PI)*h*.15;
        y+=Math.sin(u*70+ecgPhase*12)*h*.006;
      }
      const x=u*w;
      if(i===0)ecgCtx.moveTo(x,y); else ecgCtx.lineTo(x,y);
    }
    // 双层描边代替 shadowBlur（后者是 canvas 最昂贵的操作之一）
    ecgCtx.lineJoin='round'; ecgCtx.lineCap='round';
    ecgCtx.lineWidth=Math.max(3,5*EDPR);
    ecgCtx.strokeStyle=ecgMode==='flat'?'rgba(120,210,160,.10)':'rgba(110,235,160,.17)';
    ecgCtx.stroke();
    ecgCtx.lineWidth=Math.max(1.2,1.6*EDPR);
    ecgCtx.strokeStyle=ecgMode==='flat'?'rgba(140,220,170,.55)':'rgba(140,240,175,.92)';
    ecgCtx.stroke();
    if(ecgMode!=='flat'){
      const hx=((1-ecgPhase)%1)*w;
      ecgCtx.fillStyle='rgba(190,255,210,.85)'; ecgCtx.beginPath(); ecgCtx.arc(hx,mid,3*EDPR,0,6.28); ecgCtx.fill();
    }
  }
  F.ecgMode=function(m){ ecgMode=m; };
  F.heart=function(on){ window.VAudio && VAudio.heart(on); };

  /* ---------------- 屏幕特效 ---------------- */
  function fxEl(cls,ms){
    if(!flash)return;
    const d=document.createElement('div'); d.className='fxOnce '+cls;
    flash.appendChild(d);
    setTimeout(()=>d.remove(),ms||700);
  }
  F.fx=function(n){
    switch(n){
      case 'white': fxEl('fxWhite',900); break;
      case 'blackout': fxEl('fxBlack',1500); break;
      case 'blackoutAll': fxEl('fxBlackLong',2200); break;
      case 'flash': fxEl('fxWhiteFast',320); break;
      case 'flashback': fxEl('fxFlashback',650); break;
      case 'freeze': if(stage)stage.classList.add('isFrozen'); setTimeout(()=>stage&&stage.classList.remove('isFrozen'),950); break;
      case 'cut': fxEl('fxCut',420); break;
      case 'noise': if(stage)stage.classList.add('isNoise'); setTimeout(()=>stage&&stage.classList.remove('isNoise'),1300); break;
      case 'defocus': if(camWrap)camWrap.classList.add('defocus'); break;
      case 'focus': if(camWrap)camWrap.classList.remove('defocus'); break;
      case 'shake': shake(700); break;
      case 'slowmo': if(stage)stage.classList.add('isSlow'); setTimeout(()=>stage&&stage.classList.remove('isSlow'),1800); break;
      case 'burn': fxEl('fxBurn',1400); break;
      case 'emblem': showEmblem(); break;
      case 'flatline': F.ecgMode('flat'); fxEl('fxBlack',900); break;
      case 'ecg2': F.ecgMode('live'); break;
      case 'theme': fxEl('fxTheme',2400); break;
    }
  };
  function shake(ms){
    if(!shakeEl)return;
    shakeEl.classList.add('isShake');
    setTimeout(()=>shakeEl.classList.remove('isShake'),ms);
  }
  function showEmblem(){
    if(!flash)return;
    const d=document.createElement('div'); d.className='emblem';
    d.innerHTML='<div class="emblemRing"><div class="emblemBird">⌁</div></div><div class="emblemTxt">锈蚀猎人<span>RUST HUNTER · 合法 / 高薪 / 无限授权</span></div>';
    flash.appendChild(d);
    setTimeout(()=>d.classList.add('on'),30);
    setTimeout(()=>{ d.classList.add('out'); setTimeout(()=>d.remove(),1000); },2600);
  }

  /* ---------------- 设置 ---------------- */
  F.setQuality=function(q){
    quality=q; particlesOn=(q!=='low'); resize(); seedParticles();
  };
  F.setParticles=function(on){ particlesOn=!!on; seedParticles(); };
  F.setGrain=function(on){ grainOn=!!on; if(grain){ grain.style.opacity=on?'':'0'; grain.classList.toggle('grainReady',!!on); } };
  F.setDrift=function(on){ driftOn=!!on; };
  F.setScope=function(on){
    scopeOn=!!on; if(stage)stage.classList.toggle('scopeOn',!!on);
  };
  F.currentCode=()=>curCode;
})();
