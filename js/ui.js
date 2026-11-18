/* ============================================================
   ui.js — 2.0 界面层
   主菜单（渠边循环 + 心电图 + 白光点）/ 全章节 / 67 场景档案
   / 设置 / 暂停 / 结局诗集 / 作者手记 / 存档心电图纸
   ============================================================ */
(function () {
  'use strict';
  const U=(window.VUI={});
  const D=window.V2DATA;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let G, openPanel=null, filterGroup='全部', archiveCode=null, confirmYes=null;
  const CHAPTER_LABEL={
    ch00:'ch00', chP:'chP', ch01:'ch01', ch02:'ch02', ch03:'ch03', ch04:'ch04',
    chInt:'chInt', ch05:'ch05', ch06:'ch06', ch07a:'ch07a', end1:'ch07a',
    ch07b:'ch07b', ch08:'ch08', ch09:'ch09', chFin:'ch09', end2:'ch09',
    end3:'end3route', endT:'endT', wk2:'wk2', duet:'wk2', epi:'epilogue', notes:'notes'
  };

  U.init=function(){
    G=window.VGame;
    buildTitle(); buildChapters(); buildArchive(); buildSettings(); buildPause();
    buildSave(); buildPoems(); buildFinish(); buildConfirm();
    U.refresh();
  };

  /* ---------------- 通用确认框 ----------------
     覆盖进度、重置记录这类不可撤销的动作都走这里，不用浏览器 confirm()，
     因为桌面壳里的原生弹窗会冻住整个渲染循环。 */
  U.confirm=function(title,text,onYes,sub){
    const t=$('confirmTitle'), s=$('confirmSub'), b=$('confirmBody');
    if(t)t.textContent=title||'请确认';
    if(s)s.textContent=sub||'';
    if(b)b.innerHTML=`<div class="confirmText">${text||''}</div>`;
    confirmYes=onYes||null;
    open('confirmScreen');
  };
  function buildConfirm(){
    const yes=$('confirmYes'), no=$('confirmNo'), x=$('confirmClose');
    if(yes)yes.onclick=e=>{e.stopPropagation();const f=confirmYes;confirmYes=null;close();if(f)f();};
    if(no)no.onclick=e=>{e.stopPropagation();confirmYes=null;close();};
    if(x)x.onclick=e=>{e.stopPropagation();confirmYes=null;close();};
  }

  /* ---------------- 通用面板 ---------------- */
  function open(id){
    close();
    const p=$(id); if(!p)return;
    p.classList.add('on'); openPanel=id;
    if(id==='pauseScreen'&&$('stage'))$('stage').classList.add('paused');
    G.auto=false; G.scheduleAuto&&G.scheduleAuto();
    if(window.VAudio)window.VAudio.sfx('paper');
  }
  function closeArchiveDetail(){
    const d=$('archiveDetail');
    if(d)d.classList.remove('on');
    archiveCode=null;
  }
  function close(){
    const had=openPanel;
    if(had){
      const p=$(had); if(p)p.classList.remove('on');
      openPanel=null;
    }
    // 预览层是档案层的子状态，任何关闭路径都必须一并复位，
    // 否则下次进入档案会带着上一张图，Esc 也会误判层级。
    closeArchiveDetail();
    if(!had)return;
    if($('stage'))$('stage').classList.remove('paused');
    G.scheduleAuto&&G.scheduleAuto();
  }
  U.close=close;
  U.blocking=function(){
    if(G.mode==='title'||G.mode==='finish')return true;
    if(!openPanel)return false;
    const p=$(openPanel);
    if(p&&p.classList.contains('on'))return true;
    // 面板已被别处收掉，就不该再永久拦着输入
    openPanel=null;
    return false;
  };
  U.hideAll=function(){ close(); ['titleScreen','finishScreen'].forEach(id=>{const p=$(id);if(p)p.classList.remove('on');}); };
  U.key=function(e){
    if(e.key!=='Escape')return false;
    // Esc 只关最上层：图片预览 → 环境档案 → 主界面/游戏。
    const detail=$('archiveDetail');
    if(detail&&detail.classList.contains('on')){ closeArchiveDetail(); return true; }
    if(openPanel){ close(); return true; }
    return false;
  };
  function btn(parent,label,fn,cls){
    const b=document.createElement('button'); b.className='uiBtn '+(cls||'');
    b.innerHTML=label; b.onclick=e=>{e.stopPropagation();fn(e);}; parent.appendChild(b); return b;
  }

  /* ---------------- 主菜单 ---------------- */
  function chapterTitle(id){
    const c=(D.CHAPTERS||[]).find(x=>x.id===id);
    return c?c.title:'';
  }
  function buildTitle(){
    const p=$('titleScreen'); if(!p)return;
    const menu=$('titleMenu'); if(!menu)return;
    menu.innerHTML='';
    // 有存档进度时「继续」置顶；「开始」退居次席并在覆盖前二次确认
    const has=!!(G.hasProgress&&G.hasProgress());
    const info=G.progressInfo?G.progressInfo():null;
    const where=has?([chapterTitle(info.chapter),info.day].filter(Boolean).join(' · ')||'上次离开的地方'):'';

    const main=[];
    if(has) main.push(['继 续',where,()=>{U.hideAll();G.resume();}]);
    main.push(['开 始',has?'从序章重新开始':'从序章开始 · 双周目完整流程',()=>{
      if(has) U.confirm('重新开始',
        '本轮进度、分支变量与分支标记会重置；<b>已抵达的结局、联句、倒带收藏保留</b>。',
        ()=>{U.hideAll();G.startAt('chP',true);},'不可撤销');
      else {U.hideAll();G.startAt('chP',true);}
    }]);
    main.push(['卷零 · 渠边说','先听她把话说完',()=>{U.hideAll();G.startAt('ch00');}]);
    main.push(['章 节','22 章 · 所有时间线',()=>U.chapters()]);
    main.forEach(([t,sub,fn],i)=>{
      const b=btn(menu,`<b>${t}</b><i>${sub}</i>`,fn,i===0?'primary':'');
      b.dataset.idx=i;
    });
    const links=document.createElement('div'); links.className='titleLinks';
    [['环境档案',()=>U.archive()],['结局诗集',()=>U.poems()],['存 档',()=>U.savePanel()],
     ['作者手记',()=>{U.hideAll();G.startAt('notes');}],['设 置',()=>U.settings()],
    ].forEach(([t,fn])=>{
      const b=document.createElement('button'); b.className='titleLink'; b.textContent=t;
      b.onclick=e=>{e.stopPropagation();fn();};
      links.appendChild(b);
    });
    menu.appendChild(links);
  }
  U.showTitle=function(on){
    const p=$('titleScreen'); if(!p)return;
    // 每次回标题都重建菜单：「继续」按钮要跟着最新进度出现或消失
    if(on)buildTitle();
    p.classList.toggle('on',!!on);
    if(on){ U.refresh(); if($('ecgBottom'))$('ecgBottom').classList.add('on'); }
  };
  U.refresh=function(){
    const p=$('titleProgress'); if(!p)return;
    const got=Object.keys(G.endings||{}).length;
    p.innerHTML=`已抵达结局 <b>${got}</b>/4　·　第二周目 <b>${G.wk2?'已读':'未读'}</b>　·　倒带 <b>${Object.keys(G.foundSnow||{}).length}</b>/7`;
  };

  /* ---------------- 章节选择（全 22 章） ----------------
     两道闸门，互不代替：
     ① 周目闸 —— 第二周目与「跋」要先把第一周目走完
        （G.wk2 在抵达结局、解锁《维护日志》时置位）。
     ② 结局闸 —— 四个结局必须自己走到过一次才给跳（G.endings[id]）。
        没走到的，标题一律显示「？？？」：结局名本身就是剧透，
        菜单不该替玩家先说破《锈》《白噪声》《未寄出的信》《潮汐》。 */
  const WEEK2_GROUPS={ '第二周目':1, '跋':1 };
  const ENDING_GROUP='结局';
  function endingSeen(id){ return !!(G&&G.endings&&G.endings[id]); }
  function buildChapters(){
    const list=$('chapterList'); if(!list)return;
    list.innerHTML='';
    let lastGroup='', wkLocked=0, endLocked=0;
    D.CHAPTERS.forEach((c,idx)=>{
      if(c.group!==lastGroup){
        lastGroup=c.group;
        const h=document.createElement('div'); h.className='chGroup'; h.textContent=c.group; list.appendChild(h);
      }
      const isEnd=c.group===ENDING_GROUP;
      const wkLock=!!WEEK2_GROUPS[c.group]&&!G.wk2;
      const endLock=isEnd&&!endingSeen(c.id);
      const lock=wkLock||endLock;
      if(wkLock)wkLocked++;
      if(endLock)endLocked++;
      const b=document.createElement('button');
      b.className='chItem'+(lock?' locked':'');
      b.innerHTML=`<span class="chLab">${esc(c.label)}</span>`+
        `<span class="chTit">${endLock?'？？？':esc(c.title)}</span>`+
        `<span class="chDay">${wkLock?'未解锁':endLock?'未抵达':esc(c.day)}</span>`;
      if(lock){
        b.disabled=true;
        b.title=wkLock?'通关第一周目之后，才能选择这一周目的章节'
                      :'先自己走到这个结局，才知道它叫什么';
      }else{
        b.onclick=e=>{e.stopPropagation();close();U.hideAll();G.startAt(CHAPTER_LABEL[c.id]||c.id);};
      }
      list.appendChild(b);
    });
    const notes=[];
    if(wkLocked)notes.push(`第二周目 ·《维护日志》与「跋」　·　通关第一周目后解锁（${wkLocked} 项）`);
    if(endLocked)notes.push(`四个结局　·　自己走到过一次，才可在时间线上回看（${endLocked} 项）`);
    notes.forEach(t=>{
      const n=document.createElement('div'); n.className='chLockNote'; n.textContent=t; list.appendChild(n);
    });
    const back=$('chaptersBack'); if(back)back.onclick=e=>{e.stopPropagation();close();};
    const closeB=$('chaptersClose'); if(closeB)closeB.onclick=e=>{e.stopPropagation();close();};
  }
  U.chapters=function(){ buildChapters(); open('chaptersScreen'); };

  /* ---------------- 67 场景档案 ---------------- */
  function buildArchive(){
    const grid=$('archiveGrid'); if(!grid)return;
    renderArchiveGrid();
    const fl=$('archiveFilters'); if(fl){
      fl.innerHTML='';
      const groups=['全部','第一周目','分支 · 离开','分支 · 留下','结局','第二周目','跋','主菜单','卷零','间章','第五幕','第六幕','第七幕 A','第七幕 B','第八幕','第九幕','终章','隐藏结局','作者手记','存档','第一幕','第二幕','第三幕','第四幕','序章'];
      const uniq=[...new Set(['全部',...D.SCENE_LIST.map(c=>D.SCENES[c].act)])];
      uniq.forEach(g=>{
        const b=document.createElement('button'); b.className='filterBtn'+(g===filterGroup?' on':''); b.textContent=g;
        b.onclick=e=>{e.stopPropagation();filterGroup=g;renderArchiveGrid();
          [...fl.children].forEach(x=>x.classList.toggle('on',x===b));};
        fl.appendChild(b);
      });
    }
    const back=$('archiveBack'); if(back)back.onclick=e=>{e.stopPropagation();closeArchiveDetail();};
    const detailClose=$('archiveDetailClose'); if(detailClose)detailClose.onclick=e=>{e.stopPropagation();closeArchiveDetail();};
    const closeB=$('archiveClose'); if(closeB)closeB.onclick=e=>{e.stopPropagation();close();};
  }
  function renderArchiveGrid(){
    const grid=$('archiveGrid'); if(!grid)return;
    grid.innerHTML='';
    D.SCENE_LIST.forEach(code=>{
      const m=D.SCENES[code];
      if(filterGroup!=='全部'&&m.act!==filterGroup)return;
      const d=document.createElement('button'); d.className='arcThumb';
      d.innerHTML=`<img loading="lazy" src="assets/sc/${code}.jpg"><span>${esc(code)}</span><i>${esc(m.name)}</i>`;
      d.onclick=e=>{e.stopPropagation();showArchiveDetail(code);};
      grid.appendChild(d);
    });
  }
  function showArchiveDetail(code){
    const m=D.SCENES[code]; const box=$('archiveDetail'); if(!box)return;
    archiveCode=code;
    $('arcDetailImg').src='assets/sc/'+code+'.jpg';
    $('arcDetailCode').textContent=code;
    $('arcDetailName').textContent=m.name;
    $('arcDetailMeta').textContent=`${m.act}　·　调色 ${m.grade}　·　氛围 ${m.weather}　·　镜头 ${m.cam}　·　配乐 ${m.music}`;
    box.classList.add('on');
    if(window.VAudio)window.VAudio.play(m.music);
    const play=$('arcPlay'); if(play)play.onclick=e=>{e.stopPropagation();close();U.hideAll();G.startAt(chapterForScene(code));};
  }
  function chapterForScene(code){
    const act=D.SCENES[code].act;
    const map={'序章':'chP','第一幕':'ch01','第二幕':'ch02','第三幕':'ch03','第四幕':'ch04','间章':'chInt',
      '第五幕':'ch05','第六幕':'ch06','第七幕 A':'ch07a','结局一':'ch07a','第七幕 B':'ch07b','第八幕':'ch08',
      '第九幕':'ch09','终章':'ch09','结局二':'ch09','结局三':'end3route','隐藏结局':'endT',
      '第二周目':'wk2','跋':'epilogue','卷零':'ch00','主菜单':'ch00','作者手记':'notes','存档':'chP'};
    return map[act]||'chP';
  }
  U.archive=function(){ buildArchive(); open('archiveScreen'); };

  /* ---------------- 设置 ---------------- */
  function buildSettings(){
    const box=$('settingsBody'); if(!box)return;
    const rows=[
      ['画面质量','quality','select',[['cinema','电影'],['balanced','均衡'],['low','流畅']]],
      ['镜头漂移','drift','switch'],
      ['氛围粒子','particles','switch'],
      ['胶片颗粒','grain','switch'],
      ['宽银幕 2.39:1','scope','switch'],
      ['音量','volume','range'],
    ];
    box.innerHTML='';
    rows.forEach(([label,key,type,opts])=>{
      const r=document.createElement('div'); r.className='setRow';
      r.innerHTML=`<span>${label}</span>`;
      const c=document.createElement('div'); c.className='setCtl';
      if(type==='switch'){
        const b=document.createElement('button'); b.className='switch'; b.dataset.key=key;
        b.onclick=e=>{e.stopPropagation();G.setSetting(key,!G.settings[key]);U.syncSettings();};
        c.appendChild(b);
      } else if(type==='select'){
        const s=document.createElement('div'); s.className='seg'; s.dataset.key=key;
        opts.forEach(([v,t])=>{const b=document.createElement('button');b.textContent=t;b.dataset.val=v;
          b.onclick=e=>{e.stopPropagation();G.setSetting(key,v);U.syncSettings();};s.appendChild(b);});
        c.appendChild(s);
      } else {
        const inp=document.createElement('input'); inp.type='range'; inp.min=0; inp.max=1.2; inp.step=.05; inp.dataset.key=key;
        inp.oninput=()=>G.setSetting(key,parseFloat(inp.value));
        inp.onclick=e=>e.stopPropagation();
        c.appendChild(inp);
      }
      r.appendChild(c); box.appendChild(r);
    });
    const closeB=$('settingsClose'); if(closeB)closeB.onclick=e=>{e.stopPropagation();close();};

    /* —— 存档位置 / 通关统计 / 版本 / 重置 ——（只读展示，方便玩家自己备份） */
    if(!window.VSave)return;
    const row=(label,node)=>{
      const r=document.createElement('div'); r.className='setRow';
      const l=document.createElement('span'); l.textContent=label; r.appendChild(l);
      const c=document.createElement('div'); c.className='setCtl'; c.appendChild(node);
      r.appendChild(c); box.appendChild(r); return r;
    };
    const pathCode=document.createElement('code');
    pathCode.className='savePath'; pathCode.textContent=VSave.path(); pathCode.title=VSave.path();
    row('存档位置',pathCode);

    const sum=VSave.summary&&VSave.summary();
    if(sum){
      const code=document.createElement('code'); code.className='savePath';
      code.textContent=`结局 ${sum.endings}/4 · 联句 ${sum.poems}/12 · 倒带 ${sum.snow}/7 · 通关 ${sum.playthroughs} 次 · ${fmtMs(sum.totalPlayMs)}`;
      row('通关统计',code);
    }

    const ver=document.createElement('code'); ver.className='savePath'; ver.textContent='网页版';
    row('版本',ver);
    if(window.NativeApp&&NativeApp.info){
      NativeApp.info().then(i=>{ ver.textContent='桌面版 v'+i.version; }).catch(()=>{});
    }

    const rb=document.createElement('button');
    rb.className='switch'; rb.textContent='重置';
    rb.onclick=e=>{
      e.stopPropagation();
      U.confirm('重置通关记录',
        '结局、联句、倒带、三个存档槽与本轮进度都会被清空，<b>无法恢复</b>。',
        async()=>{ await VSave.reset(); location.reload(); },
        '危险操作');
    };
    row('重置通关记录',rb);
  }

  function fmtMs(ms){
    if(!ms)return '0 分钟';
    const m=Math.round(ms/60000);
    if(m<60)return m+' 分钟';
    const h=Math.floor(m/60), r=m%60;
    return h+' 小时'+(r?(' '+r+' 分'):'');
  }
  U.syncSettings=function(){
    document.querySelectorAll('.setRow .switch').forEach(b=>{
      const v=G.settings[b.dataset.key]; b.classList.toggle('on',!!v); b.textContent=v?'开':'关';
    });
    document.querySelectorAll('.setRow .seg').forEach(s=>{
      [...s.children].forEach(b=>b.classList.toggle('on',b.dataset.val===G.settings[s.dataset.key]));
    });
    document.querySelectorAll('.setRow input[type=range]').forEach(i=>{
      if(document.activeElement!==i)i.value=G.settings[i.dataset.key];
    });
  };
  U.settings=function(){ buildSettings(); U.syncSettings(); open('settingsScreen'); };

  /* ---------------- 暂停 ---------------- */
  /* 暂停菜单：标题居中、选项只留主标题。
     心电图只由 CSS 的 :hover 驱动 —— 判定区域就是按钮自身的矩形，
     选项之间的空隙不命中任何一条，鼠标擦出边界也会立刻停下。 */
  const PAUSE_ECG='M0 47 H120 l10 -3 8 3 h30 l8 -9 10 13 8 -4 h40 q12 -4 24 0 h60 l8 -3 10 3 h184';
  function buildPause(){
    const box=$('pauseBody'); if(!box)return;
    box.innerHTML='';
    const items=[
      ['继 续',()=>close()],
      ['章 节',()=>U.chapters()],
      ['环境档案',()=>U.archive()],
      ['结局诗集',()=>U.poems()],
      ['存 档',()=>U.savePanel()],
      ['设 置',()=>U.settings()],
      ['主菜单',()=>{close();G.hideAll();G.title();}],
    ];
    items.forEach(([t,fn],i)=>{
      const b=document.createElement('button');
      b.type='button';
      b.className='pauseItem'+(i===0?' primary':'');
      b.innerHTML=
        `<svg class="piEcg" viewBox="0 0 520 52" preserveAspectRatio="none" aria-hidden="true">`+
        `<path pathLength="100" d="${PAUSE_ECG}"/></svg>`+
        `<span class="piNo">0${i+1}</span>`+
        `<span class="piTxt">${esc(t)}</span>`;
      b.onclick=e=>{e.stopPropagation();fn();};
      box.appendChild(b);
    });
    const closeB=$('pauseClose'); if(closeB)closeB.onclick=e=>{e.stopPropagation();close();};
  }
  U.pause=function(){
    if(openPanel){close();return;}
    if(G.mode==='title')return;
    buildPause(); open('pauseScreen');
  };

  /* ---------------- 结局诗集 ---------------- */
  function buildPoems(){
    const box=$('poemsBody'); if(!box)return;
    const closeB=$('poemsClose'); if(closeB)closeB.onclick=e=>{e.stopPropagation();close();};
  }
  U.poems=function(){
    const box=$('poemsBody'); if(!box)return;
    let html='<h3 class="poemH">心电诗集 · 十二联</h3><div class="poemGrid">';
    D.POEMS.forEach(p=>{
      const has=G.poems.indexOf(p.tag)>=0;
      html+=`<div class="poemCard ${has?'got':'locked'}"><b>${esc(p.tag)}</b>${has?p.lines.map(l=>`<span>${esc(l)}</span>`).join(''):'<span class="unread">未读到</span>'}</div>`;
    });
    html+='</div><h3 class="poemH">四份账单 · 结局诗</h3><div class="poemEnds">';
    /* 与章节面板同一套规矩：没抵达过的结局，连《锈》《白噪声》这些名字都不给，
       名字本身就是剧透。抵达过才把标题和诗一起放出来。 */
    const ends={ end1:['结局一','《锈》'], end2:['结局二','《白噪声》'],
                 end3:['结局三','《未寄出的信》'], endT:['隐藏结局','《潮汐》'] };
    Object.keys(ends).forEach(k=>{
      const got=!!G.endings[k];
      const name=got?ends[k][0]+' · '+ends[k][1]:ends[k][0]+' · ？？？';
      html+=`<div class="poemEnd ${got?'got':'locked'}"><b>${name}</b><p>${got?esc(D.END_POEMS[k]):'—— 尚未抵达 ——'}</p></div>`;
    });
    html+='</div>';
    box.innerHTML=html;
    open('poemsScreen');
  };

  /* ---------------- 存档：心电图纸 ---------------- */
  function buildSave(){ const closeB=$('saveClose'); if(closeB)closeB.onclick=e=>{e.stopPropagation();close();}; }
  U.savePanel=function(){
    const box=$('saveSlots'); if(!box)return;
    box.innerHTML='';
    G.saves.forEach((s,i)=>{
      const d=document.createElement('div'); d.className='saveSlot '+(s?'filled':'empty');
      const wave=`<svg viewBox="0 0 260 34" preserveAspectRatio="none"><path d="M0 20 H40 l5 -3 5 3 h18 l4 -12 5 24 5 -12 h22 q8 -6 16 0 h30 l4 -3 5 3 h96" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
      d.innerHTML=`<div class="saveWave">${wave}</div><div class="saveMeta">
        <b>存档 ${i+1}</b><span>${s?esc(s.chapter||'—')+' · '+esc(s.day||''):'空'}</span>
        <em>${s?esc(s.date||''):'——'}</em></div>
        <div class="saveBtns"><button data-a="save">写入</button><button data-a="load">读取</button></div>`;
      d.querySelector('[data-a=save]').onclick=e=>{
        e.stopPropagation();
        G.saves[i]={i:G.i,chapter:G.chapter,day:G.day,vars:Object.assign({},G.vars),
          flags:Object.assign({},G.flags),date:new Date().toLocaleString('zh-CN')};
        G.save();G.toast('已写入存档 '+(i+1));U.savePanel();
        if(window.VAudio)window.VAudio.sfx('confirm');
      };
      d.querySelector('[data-a=load]').onclick=e=>{
        e.stopPropagation();
        if(!G.saves[i]){G.toast('这一格是空的');return;}
        const sv=G.saves[i]; Object.assign(G.vars,sv.vars||{}); Object.assign(G.flags,sv.flags||{});
        G.chapter=sv.chapter||''; G.day=sv.day||'';
        close();U.hideAll();G.mode='story';G.hist=[];
        G.run(sv.i);
        if(window.VAudio)window.VAudio.sfx('bell');
      };
      box.appendChild(d);
    });
    open('saveScreen');
  };

  /* ---------------- 收尾屏 ---------------- */
  function buildFinish(){
    const box=$('finishActions'); if(!box)return;
    box.innerHTML='';
    const items=[
     ['回到主菜单','她还在渠边',()=>{U.hideAll();G.title();}],
     ['第二周目 ·《维护日志》','去读那本账',()=>{U.hideAll();G.startAt('wk2');}],
     ['跋 · 渠边说（三）','把核心沉下去',()=>{U.hideAll();G.startAt('epilogue');}],
     ['结局诗集','四份账单',()=>U.poems()],
     ['环境档案','67 场场景',()=>U.archive()],
     ['作者手记','写给读完的人',()=>{U.hideAll();G.startAt('notes');}],
    ];
    // 只有真正达成定稿条件，这一行手写体选项才会在收尾屏出现
    const ok=G.condOk?G.condOk({wk2:true,T:8,M:3,C:3,c04:'B',c05:'A'}):false;
    if(ok) items.splice(1,0,['◆ 回到那一秒','倒带 · 把核心放回去 ·《潮汐》',()=>{U.hideAll();G.jumpToHidden();}]);
    items.forEach(([t,s,fn],i)=>btn(box,`<b>${t}</b><i>${s}</i>`,fn,i===0?'primary':''));
  }
  U.rebuildFinish=buildFinish;
})();
