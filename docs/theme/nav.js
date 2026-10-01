/* Collapsible left navigation for the Asciidoctor single-page manual.
 * No dependencies. Progressively enhances the built-in #toc list:
 * without JS, all levels render open and every link still works.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'tech-manual-nav-v1';
  var COLLAPSED = 'nav-collapsed';
  var ACTIVE = 'toc-active';

  // Read persisted collapsed hrefs; tolerate private-mode failures.
  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function saveState(hrefs) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hrefs));
    } catch (e) {
      /* storage unavailable: navigation still works for this visit */
    }
  }

  function sectionHref(li) {
    var link = li.querySelector(':scope > a, :scope > .nav-row > a');
    return link ? link.getAttribute('href') : null;
  }

  function setCollapsed(li, collapsed, btn) {
    li.classList.toggle(COLLAPSED, collapsed);
    if (btn) {
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      var arrow = btn.querySelector('.nav-arrow');
      if (arrow) arrow.textContent = collapsed ? '\u25B8' : '\u25BE';
    }
  }

  function collectCollapsed(root) {
    var out = [];
    var items = root.querySelectorAll('li.' + COLLAPSED);
    for (var i = 0; i < items.length; i++) {
      var href = sectionHref(items[i]);
      if (href) out.push(href);
    }
    return out;
  }

  // Wrap each parent item's link in a row with a disclosure button.
  // The title link keeps navigating normally; only the arrow toggles.
  function enhance(root, collapsedHrefs) {
    var items = root.querySelectorAll('li');
    for (var i = 0; i < items.length; i++) {
      (function (li) {
        var childList = li.querySelector(':scope > ul');
        var link = li.querySelector(':scope > a');
        if (!childList || !link) return; // leaf: nothing to collapse

        var row = document.createElement('span');
        row.className = 'nav-row';
        li.insertBefore(row, link);
        row.appendChild(link);

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nav-toggle';
        btn.setAttribute('aria-expanded', 'true');
        btn.setAttribute('aria-label', 'Toggle subsection: ' + link.textContent.trim());
        var arrow = document.createElement('span');
        arrow.className = 'nav-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '\u25BE';
        btn.appendChild(arrow);
        row.insertBefore(btn, link);

        var href = link.getAttribute('href');
        var shouldCollapse = collapsedHrefs && href && collapsedHrefs.indexOf(href) !== -1;
        setCollapsed(li, !!shouldCollapse, btn);

        btn.addEventListener('click', function () {
          var nowCollapsed = !li.classList.contains(COLLAPSED);
          setCollapsed(li, nowCollapsed, btn);
          saveState(collectCollapsed(root));
        });
      })(items[i]);
    }
  }

  function addControls(toc, root) {
    var bar = document.createElement('div');
    bar.id = 'toc-controls';

    var collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.textContent = 'Collapse all';
    collapse.addEventListener('click', function () {
      var parents = root.querySelectorAll('li');
      for (var i = 0; i < parents.length; i++) {
        if (parents[i].querySelector(':scope > ul')) {
          setCollapsed(parents[i], true, parents[i].querySelector(':scope > .nav-row > .nav-toggle'));
        }
      }
      saveState(collectCollapsed(root));
    });

    var expand = document.createElement('button');
    expand.type = 'button';
    expand.textContent = 'Expand all';
    expand.addEventListener('click', function () {
      var open = root.querySelectorAll('li.' + COLLAPSED);
      for (var j = 0; j < open.length; j++) {
        setCollapsed(open[j], false, open[j].querySelector(':scope > .nav-row > .nav-toggle'));
      }
      saveState([]);
    });

    bar.appendChild(collapse);
    bar.appendChild(expand);
    toc.insertBefore(bar, toc.firstChild);
  }

  function expandAncestors(link) {
    var li = link ? link.closest('li') : null;
    while (li) {
      if (li.classList.contains(COLLAPSED)) {
        setCollapsed(li, false, li.querySelector(':scope > .nav-row > .nav-toggle'));
      }
      li = li.parentElement ? li.parentElement.closest('li') : null;
    }
  }

  function markActive(root) {
    var hash = window.location.hash;
    var links = root.querySelectorAll('a[href^="#"]');
    for (var i = 0; i < links.length; i++) links[i].classList.remove(ACTIVE);
    if (!hash) return;
    var current = root.querySelector('a[href="' + hash + '"]');
    if (current) {
      current.classList.add(ACTIVE);
      expandAncestors(current);
    }
  }

  // Lightweight scroll-spy: highlight the heading nearest the top.
  function watchSections(root) {
    if (typeof window.IntersectionObserver !== 'function') return;
    var headings = document.querySelectorAll('#content h2[id], #content h3[id], #content h4[id]');
    if (!headings.length) return;
    var map = {};
    var links = root.querySelectorAll('a[href^="#"]');
    for (var i = 0; i < links.length; i++) map[links[i].getAttribute('href')] = links[i];
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var href = '#' + entry.target.id;
        for (var k in map) map[k].classList.remove(ACTIVE);
        if (map[href]) map[href].classList.add(ACTIVE);
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    headings.forEach(function (h) { observer.observe(h); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var toc = document.getElementById('toc');
    if (!toc) return;
    var root = toc.querySelector('ul.sectlevel1, ul');
    if (!root) return;
    enhance(root, loadState());
    addControls(toc, root);
    markActive(root);
    watchSections(root);
    window.addEventListener('hashchange', function () { markActive(root); });
  });
})();
