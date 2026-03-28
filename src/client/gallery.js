let selectedStyleId = null;
let stylesData = null;
let styleFamilies = null;
let selectedFamily = null;
let familyExpanded = false;

const FAMILY_COLLAPSED_LIMIT = 6;

const { sessionId, appDescription } = window.__CC_DESIGN__;

async function init() {
  try {
    const [stylesRes, familiesRes] = await Promise.all([
      fetch('/styles-data'),
      fetch('/style-families.json'),
    ]);
    stylesData = await stylesRes.json();
    styleFamilies = await familiesRes.json();
    renderGallery(stylesData);
    renderFamilyList(styleFamilies);
  } catch (err) {
    showToast('加载失败，请刷新页面重试');
  }
}

function renderGallery(data) {
  const container = document.getElementById('rounds-container');
  container.innerHTML = '';

  const rounds = [...(data.rounds || [])].sort((a, b) => b.number - a.number);

  let totalStyles = 0;
  rounds.forEach((round) => {
    totalStyles += (round.styles || []).length;
  });

  document.getElementById('styleCount').textContent = `${totalStyles} 个风格`;
  document.getElementById('mainSubtitle').textContent =
    `共 ${totalStyles} 个风格方案，点击卡片选择后开始生成代码`;

  rounds.forEach((round) => {
    const section = document.createElement('div');
    section.className = 'round-section';

    const label = document.createElement('div');
    label.className = 'round-label';
    label.textContent = round.label || `第 ${round.number} 轮`;
    section.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'gallery';

    (round.styles || []).forEach((style) => {
      grid.appendChild(createStyleCard(style, round.number));
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}

function createStyleCard(style, roundNumber) {
  const card = document.createElement('div');
  card.className = 'style-card';
  card.dataset.styleId = style.id;
  card.onclick = () => selectStyle(card, style.id, style.name);

  const indicator = document.createElement('div');
  indicator.className = 'select-indicator';
  indicator.innerHTML =
    '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5 6.5-7" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  card.appendChild(indicator);

  const previewWrapper = document.createElement('div');
  previewWrapper.className = 'preview-wrapper';

  const iframe = document.createElement('iframe');
  iframe.className = 'preview-frame';
  iframe.src = `/preview/${sessionId}/${roundNumber}/${style.id}`;
  iframe.loading = 'lazy';
  previewWrapper.appendChild(iframe);

  const previewBtn = document.createElement('button');
  previewBtn.className = 'preview-btn';
  previewBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1h5v2H3v3H1V1zm12 0H8v2h3v3h2V1zM1 13h5v-2H3V8H1v5zm12 0H8v-2h3V8h2v5z" fill="currentColor"/></svg>全屏预览';
  previewBtn.onclick = (e) => {
    e.stopPropagation();
    openFullscreen(style.id, roundNumber, style.name);
  };
  previewWrapper.appendChild(previewBtn);

  card.appendChild(previewWrapper);

  const info = document.createElement('div');
  info.className = 'style-info';

  const name = document.createElement('div');
  name.className = 'style-name';
  name.textContent = style.name;
  info.appendChild(name);

  if (style.description) {
    const desc = document.createElement('div');
    desc.className = 'style-description';
    desc.textContent = style.description;
    info.appendChild(desc);
  }

  const keywords = style.design_system?.keywords || [];
  if (keywords.length > 0) {
    const tags = document.createElement('div');
    tags.className = 'style-tags';
    keywords.slice(0, 6).forEach((kw) => {
      const tag = document.createElement('span');
      tag.className = 'style-tag';
      tag.textContent = kw;
      tags.appendChild(tag);
    });
    info.appendChild(tags);
  }

  const colors = style.design_system?.colors;
  if (colors) {
    const dots = document.createElement('div');
    dots.className = 'color-dots';
    const colorValues = [
      colors.primary,
      colors.secondary,
      colors.accent,
      colors.background,
      colors.surface,
    ].filter(Boolean);
    colorValues.forEach((c) => {
      const dot = document.createElement('div');
      dot.className = 'color-dot';
      dot.style.background = c;
      dots.appendChild(dot);
    });
    info.appendChild(dots);
  }

  card.appendChild(info);
  return card;
}

function selectStyle(card, styleId, styleName) {
  document.querySelectorAll('.style-card.selected').forEach((el) => {
    el.classList.remove('selected');
  });
  card.classList.add('selected');
  selectedStyleId = styleId;

  const bottomBar = document.getElementById('bottomBar');
  document.getElementById('bottomBarLabel').textContent = `✓ 已选择 ${styleName}`;
  bottomBar.classList.add('visible');
}

function openFullscreen(styleId, roundNumber, styleName) {
  const overlay = document.getElementById('fullscreenOverlay');
  const iframe = document.getElementById('fullscreenIframe');
  document.getElementById('fullscreenTitle').textContent = styleName;
  iframe.src = `/preview/${sessionId}/${roundNumber}/${styleId}`;
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeFullscreen() {
  const overlay = document.getElementById('fullscreenOverlay');
  overlay.classList.remove('visible');
  document.getElementById('fullscreenIframe').src = '';
  document.body.style.overflow = '';
}

async function confirmSelection() {
  if (!selectedStyleId) return;
  try {
    await fetch('/api/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ styleId: selectedStyleId }),
    });
    showToast('已提交选择，AI 正在为你生成代码...');
    document.getElementById('bottomBar').classList.remove('visible');
  } catch {
    showToast('提交失败，请重试');
  }
}

function showRegenerateModal() {
  document.getElementById('feedbackModal').classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeRegenerateModal() {
  document.getElementById('feedbackModal').classList.remove('visible');
  document.body.style.overflow = '';
}

function selectFamily(familyId) {
  selectedFamily = familyId === selectedFamily ? null : familyId;

  document.querySelectorAll('.style-family-item').forEach((el) => {
    el.classList.toggle('selected', el.dataset.familyId === selectedFamily);
  });
}

async function submitRegenerate() {
  const feedback = document.getElementById('feedbackText').value.trim();
  try {
    await fetch('/api/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_style: selectedFamily || undefined,
        feedback: feedback || undefined,
      }),
    });
    closeRegenerateModal();
    document.getElementById('feedbackText').value = '';
    selectedFamily = null;
    showToast('已提交反馈，AI 正在生成新的风格方案...');
  } catch {
    showToast('提交失败，请重试');
  }
}

function renderFamilyList(families) {
  const list = document.getElementById('styleFamilyList');
  list.innerHTML = '';

  if (!Array.isArray(families) || families.length === 0) return;

  const grouped = {};
  families.forEach((f) => {
    const cat = f.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f);
  });

  let totalRendered = 0;
  const allItems = [];

  Object.entries(grouped).forEach(([category, items]) => {
    const catLabel = document.createElement('div');
    catLabel.className = 'family-category-label';
    catLabel.textContent = category;
    list.appendChild(catLabel);

    items.forEach((family) => {
      const item = createFamilyItem(family);
      list.appendChild(item);
      allItems.push(item);
      totalRendered++;

      if (!familyExpanded && totalRendered > FAMILY_COLLAPSED_LIMIT) {
        item.style.display = 'none';
      }
    });
  });

  if (totalRendered > FAMILY_COLLAPSED_LIMIT && !familyExpanded) {
    const showMore = document.createElement('div');
    showMore.className = 'family-show-more';
    showMore.textContent = `查看全部（${totalRendered} 个风格方向）`;
    showMore.onclick = () => {
      familyExpanded = true;
      allItems.forEach((item) => {
        item.style.display = '';
      });
      showMore.remove();
    };
    list.appendChild(showMore);
  }
}

function createFamilyItem(family) {
  const item = document.createElement('div');
  item.className = 'style-family-item';
  item.dataset.familyId = family.id;
  item.onclick = () => selectFamily(family.id);

  const radio = document.createElement('div');
  radio.className = 'family-radio';
  const dot = document.createElement('div');
  dot.className = 'family-radio-dot';
  radio.appendChild(dot);
  item.appendChild(radio);

  const info = document.createElement('div');
  info.className = 'family-info';

  const nameRow = document.createElement('div');
  const nameSpan = document.createElement('span');
  nameSpan.className = 'family-name';
  nameSpan.textContent = family.name;
  nameRow.appendChild(nameSpan);

  if (family.name_zh) {
    const zhSpan = document.createElement('span');
    zhSpan.className = 'family-name-zh';
    zhSpan.textContent = family.name_zh;
    nameRow.appendChild(zhSpan);
  }
  info.appendChild(nameRow);

  if (family.description) {
    const desc = document.createElement('div');
    desc.className = 'family-desc';
    desc.textContent = family.description;
    info.appendChild(desc);
  }

  item.appendChild(info);
  return item;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.getElementById('fullscreenOverlay').classList.contains('visible')) {
      closeFullscreen();
    } else if (document.getElementById('feedbackModal').classList.contains('visible')) {
      closeRegenerateModal();
    }
  }
});

document.addEventListener('DOMContentLoaded', init);
