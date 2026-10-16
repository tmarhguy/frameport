/* Notebook: progressive enhancement over a complete static AsciiDoc manual. */
(() => {
  'use strict';
  const config = window.NOTEBOOK || {name:'Project',label:'Documentation',groups:{}};
  const content = document.getElementById('content');
  const chapters = [...content.querySelectorAll(':scope > .sect1')];
  if (!chapters.length) return;
  const title = el => el.textContent.trim().replace(/^\d+(?:\.\d+)*\.\s*/, '');
  const pages = chapters.map(el => ({el,heading:el.querySelector('h2')})).filter(p => p.heading);
  const make = (tag, cls, text) => { const el = document.createElement(tag); if(cls) el.className=cls; if(text) el.textContent=text; return el; };
  const link = (text, href, cls) => {const a=make('a',cls,text);a.href=href;return a;};
  const button = (text, cls, label) => {const b=make('button',cls,text);b.type='button';if(label)b.setAttribute('aria-label',label);return b;};
  // Small inline SVGs: no icon font, package, or external request.
  const iconPaths = {
    person: '<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    moon: '<path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
    github: '<path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.58 9.58 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/>'
  };
  function withIcon(node, name, label) {
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    svg.setAttribute('focusable','false');svg.setAttribute('class','ui-icon');
    svg.innerHTML=iconPaths[name];node.replaceChildren(svg,make('span','',label));
    return node;
  }
  const skip=link('Skip to content','#content','skip-link');document.body.prepend(skip);
  content.tabIndex=-1;content.setAttribute('role','main');
  const bar=make('header','topbar');
  const menu=withIcon(button('Menu','icon-button mobile-menu','Open navigation'),'menu','Menu');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-controls','notebook-sidebar');
  const brand=link('', '#'+pages[0].heading.id,'brand');brand.append(make('span','',config.name));
  const topLinks=make('div','toplinks');
  const mobileSearch=withIcon(button('Search','icon-button mobile-search','Search documentation'),'search','Search');mobileSearch.setAttribute('data-search-trigger','');topLinks.append(mobileSearch);
  if(config.about)topLinks.append(withIcon(link('',config.about,'about-link'),'person','About'));
  if(config.repository)topLinks.append(withIcon(link('',config.repository,'header-button'),'github','GitHub'));
  if(config.website)topLinks.append(withIcon(link('',config.website,'header-button'),'globe','Website'));
  const theme=button('Dark','icon-button','Switch color theme');topLinks.append(theme);
  bar.append(menu,brand,make('span','top-label',config.label),topLinks);document.body.prepend(bar);
  let saved;try{saved=localStorage.getItem('notebook-theme');}catch{}
  const media=matchMedia('(prefers-color-scheme: dark)');
  function setTheme(value){document.documentElement.dataset.theme=value;withIcon(theme,value==='dark'?'moon':'sun',value==='dark'?'Dark':'Light');theme.setAttribute('aria-label',value==='dark'?'Switch to light theme':'Switch to dark theme');theme.setAttribute('title',value==='dark'?'Switch to light theme':'Switch to dark theme');}
  setTheme(saved || (media.matches?'dark':'light'));
  theme.onclick=()=>{saved=document.documentElement.dataset.theme==='dark'?'light':'dark';setTheme(saved);try{localStorage.setItem('notebook-theme',saved);}catch{}};
  media.addEventListener('change',e=>{if(!saved)setTheme(e.matches?'dark':'light');});
  const sidebar=make('aside','sidebar');sidebar.id='notebook-sidebar';sidebar.setAttribute('aria-label','Documentation navigation');
  const search=button('Search documentation','search-trigger');search.append(make('kbd','','⌘ K'));search.id='search-trigger';search.setAttribute('data-search-trigger','');
  const nav=make('nav','sidebar-nav');nav.setAttribute('aria-label','Chapters');
  const chapterLinks=[];
  const nestedIds=new Set(config.nested||[]);
  pages.forEach((p,i)=>{
    const group=config.groups?.[i]??config.groups?.[String(i)];
    if(group)nav.append(make('div','sidebar-label',typeof group==='string'?group:group.label));
    const label=i===0?'Overview':title(p.heading);
    const a=link('','#'+p.heading.id,'chapter-link');
    a.append(make('span','',label));
    const subs=[...p.el.querySelectorAll('h3[id]')];
    const nest=nestedIds.has(p.heading.id)||title(p.heading).toLowerCase()==='engineering log';
    if(nest&&subs.length){
      const folder=make('div','chapter-folder');
      const row=make('div','chapter-row');
      const toggle=button('','folder-toggle','Show log entries');
      toggle.innerHTML='<svg viewBox="0 0 24 24" class="ui-icon" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      const kids=make('div','chapter-children');
      kids.hidden=true;
      toggle.setAttribute('aria-expanded','false');
      toggle.setAttribute('aria-controls',p.heading.id+'-entries');
      kids.id=p.heading.id+'-entries';
      toggle.onclick=()=>{const open=kids.hidden;kids.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Hide log entries':'Show log entries');folder.classList.toggle('open',open);};
      subs.forEach(h=>{const child=link('','#'+h.id,'chapter-child');child.append(make('span','',title(h)));kids.append(child);});
      row.append(toggle,a);folder.append(row,kids);nav.append(folder);
      p.folder={kids,toggle,folder};
    }else nav.append(a);
    chapterLinks.push(a);
  });
  const foot=make('div','sidebar-foot');foot.append(make('strong','',config.label));
  const version=document.querySelector('#revnumber')?.textContent || 'Local edition';foot.append(make('span','',version));
  if(config.repository)foot.append(link('GitHub repository',config.repository,'sidebar-external'));
  sidebar.append(search,nav,foot);document.body.append(sidebar);
  const backdrop=button('','nav-backdrop','Close navigation');document.body.append(backdrop);
  const setMenu=open=>{document.body.classList.toggle('nav-open',open);content.inert=open;menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');if(open)search.focus();};
  menu.onclick=()=>setMenu(!document.body.classList.contains('nav-open'));backdrop.onclick=()=>{setMenu(false);menu.focus();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('nav-open')){setMenu(false);menu.focus();}});
  const rail=make('aside','right-rail');rail.setAttribute('aria-label','On this page');document.body.append(rail);
  const crumb=make('div','breadcrumb');const crumbName=make('span');
  crumb.append(make('span','','Docs'),make('span','crumb-divider','/'),crumbName);
  const pageTools=make('div','page-tools');const print=button('Print manual','', 'Print the complete manual');print.onclick=()=>window.print();pageTools.append(print);crumb.append(pageTools);content.prepend(crumb);
  const mobileToc=make('details','mobile-toc');const mobileTocSummary=make('summary','','In this chapter');const mobileTocLinks=make('nav');mobileTocLinks.setAttribute('aria-label','Sections in this chapter');mobileToc.append(mobileTocSummary,mobileTocLinks);crumb.after(mobileToc);
  const pagination=make('nav','pagination');pagination.setAttribute('aria-label','Adjacent chapters');content.append(pagination);

  let current=-1, railLinks=[], activeHeadings=[];
  function showPage(index){
    current=index;const page=pages[index];pages.forEach((p,i)=>{p.el.hidden=i!==index;chapterLinks[i].classList.toggle('active',i===index);if(i===index)chapterLinks[i].setAttribute('aria-current','page');else chapterLinks[i].removeAttribute('aria-current');});
    const preamble=content.querySelector('#preamble');if(preamble)preamble.hidden=index!==0;
    crumbName.textContent=title(page.heading);document.title=title(page.heading)+' · '+config.name;
    rail.replaceChildren(make('p','rail-title','On this page'));
    const local=make('nav');activeHeadings=[...page.el.querySelectorAll('h3[id]')];railLinks=activeHeadings.map(h=>link(title(h),'#'+h.id));local.append(...railLinks);rail.append(local);
    mobileTocLinks.replaceChildren(...activeHeadings.map(h=>link(title(h),'#'+h.id)));mobileToc.hidden=!activeHeadings.length;mobileToc.open=false;
    const extras=make('div','rail-links');if(config.source)extras.append(link('View source',config.chapterSources?.[page.heading.id] || config.source));extras.append(link('Back to top','#'+page.heading.id));rail.append(extras);
    const progress=make('div','reading-progress');progress.append(make('span'));rail.append(progress,make('div','rail-note','Your place in this chapter'));
    pagination.replaceChildren();
    for(const [i,label] of [[index-1,'Previous'],[index+1,'Next']]){if(!pages[i])continue;const a=link('','#'+pages[i].heading.id,i<index?'previous':'next');a.append(make('small','',label),make('span','',title(pages[i].heading)));pagination.append(a);}
    if(page.folder){page.folder.kids.hidden=false;page.folder.toggle.setAttribute('aria-expanded','true');page.folder.toggle.setAttribute('aria-label','Hide log entries');page.folder.folder.classList.add('open');}
    let hashId='';try{hashId=decodeURIComponent(location.hash.slice(1));}catch{hashId='';}
    document.querySelectorAll('.chapter-child').forEach(child=>{const on=child.getAttribute('href')==='#'+hashId;child.classList.toggle('active',on);if(on)child.setAttribute('aria-current','location');else child.removeAttribute('aria-current');});
    setMenu(false);updateProgress();
  }
  function route(scroll=true){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{id='';}const target=document.getElementById(id);const index=pages.findIndex(p=>p.el.contains(target));showPage(index<0?0:index);if(scroll){requestAnimationFrame(()=>{if(target&&target!==pages[current].heading)target.scrollIntoView();else window.scrollTo(0,0);const focusTarget=target&&target.offsetParent!==null?target:content;focusTarget.tabIndex=-1;focusTarget.focus({preventScroll:true});});}}
  let ticking=false;
  function updateProgress(){const y=window.scrollY+125;let active=0;activeHeadings.forEach((h,i)=>{if(h.getBoundingClientRect().top+window.scrollY<=y)active=i;});if(window.scrollY+innerHeight>=document.documentElement.scrollHeight-2)active=activeHeadings.length-1;railLinks.forEach((a,i)=>{a.classList.toggle('active',i===active);if(i===active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});const total=document.documentElement.scrollHeight-innerHeight;const fill=rail.querySelector('.reading-progress span');if(fill)fill.style.width=(total>0?Math.min(100,window.scrollY/total*100):100)+'%';ticking=false;}
  addEventListener('scroll',()=>{if(!ticking){requestAnimationFrame(updateProgress);ticking=true;}},{passive:true});
  addEventListener('hashchange',()=>route());
  document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(!a)return;if(a.getAttribute('href')==='#content'){setMenu(false);return;}if(a.hash===location.hash)route();});
  document.querySelectorAll('.listingblock pre,.literalblock pre').forEach(pre=>{const parent=pre.closest('.listingblock,.literalblock');const copy=button('Copy','copy-code','Copy code to clipboard');const code=pre.querySelector('code');const toolbar=make('div','code-toolbar');const wrap=button('Wrap','wrap-code','Wrap code lines');wrap.setAttribute('aria-pressed','false');wrap.onclick=()=>{const on=pre.classList.toggle('code-wrap');wrap.setAttribute('aria-pressed',String(on));};toolbar.append(make('span','code-language',code?.dataset.lang || 'text'),wrap,copy);pre.before(toolbar);copy.onclick=async()=>{try{await navigator.clipboard.writeText(pre.textContent);copy.textContent='Copied';}catch{copy.textContent='Select & copy';const range=document.createRange();range.selectNodeContents(pre);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}setTimeout(()=>{copy.textContent='Copy';},2000);};});
  document.querySelectorAll('table.tableblock').forEach(table=>{const wrap=make('div','table-scroll');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Reference table');table.before(wrap);wrap.append(table);const labels=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());table.querySelectorAll('tbody tr').forEach(row=>[...row.querySelectorAll('td')].forEach((cell,i)=>{cell.dataset.label=labels[i]||'';const value=make('div','cell-value');while(cell.firstChild)value.append(cell.firstChild);cell.append(value);}));});
  mobileTocLinks.addEventListener('click',e=>{if(e.target.closest('a'))mobileToc.open=false;});
  document.querySelectorAll('.imageblock img').forEach(img=>{if(img.closest('a'))return;const a=link('',img.getAttribute('src'),'figure-link');a.target='_blank';a.rel='noopener';a.setAttribute('aria-label','Open full-size image: '+(img.alt||'figure'));img.before(a);a.append(img);});
  // Hero raster media opens full-size in a dialog; without JS the link opens the file.
  const heroLink=document.querySelector('.docs-hero-media a[href]');
  if(heroLink){
    let lightbox=null;
    heroLink.addEventListener('click',e=>{
      e.preventDefault();
      if(!lightbox){
        lightbox=document.createElement('dialog');lightbox.className='hero-lightbox';
        const full=document.createElement('img');full.src=heroLink.href;
        full.alt=(heroLink.querySelector('img')||{}).alt||'Expanded hero image';
        const close=button('Close','icon-button hero-close','Close expanded image');
        close.onclick=()=>lightbox.close();lightbox.append(full,close);
        lightbox.addEventListener('click',ev=>{if(ev.target===lightbox)lightbox.close();});
        document.body.append(lightbox);
      }
      if(typeof lightbox.showModal==='function')lightbox.showModal();
      else window.open(heroLink.href,'_blank');
    });
  }
  document.body.classList.add('enhanced');route(Boolean(location.hash));
})();
