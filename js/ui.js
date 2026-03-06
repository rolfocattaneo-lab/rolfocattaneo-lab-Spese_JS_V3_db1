export const $ = (id) => document.getElementById(id);

export function euro(value) {
  return Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

export function ymd(date = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}`;
}

export function parseAmount(input) {
  const s = String(input ?? '').trim().replace(/\s/g, '').replace(/€/g, '');
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (s.includes(',')) return Number(s.replace(',', '.'));
  return Number(s);
}

export function fillSelect(select, rows, { valueField = 'id', labelField = 'name', includeEmpty = false, emptyText = 'Tutti' } = {}) {
  select.innerHTML = '';
  if (includeEmpty) select.append(new Option(emptyText, ''));
  for (const row of rows) {
    const opt = new Option(row[labelField] ?? '', row[valueField] ?? '');
    select.append(opt);
  }
}

export function getMultiSelectValues(select) {
  return [...select.selectedOptions].map(o => o.value).filter(Boolean);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function message(text, type = 'ok') {
  const box = $('appMessage');
  if (!box) return;
  box.textContent = text;
  box.className = `message ${type}`;
  box.classList.remove('hidden');
  clearTimeout(message._timer);
  message._timer = setTimeout(() => box.classList.add('hidden'), 5000);
}

export function confirmDelete(label) {
  return window.confirm(`Confermi eliminazione di: ${label}?`);
}

export async function fileToMeta(file) {
  return {
    file,
    file_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    file_size: file.size || 0
  };
}

export function downloadText(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function todayRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: ymd(first), to: ymd(now) };
}
