import { euro, escapeHtml } from './ui.js';

export function buildReportHtml({ filters, expenses }) {
  const total = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const groups = new Map();
  for (const item of expenses) {
    const key = item.category_name || 'Altro';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const groupedHtml = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, items]) => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const rows = items.map(item => `
      <tr>
        <td>${escapeHtml(item.expense_date)}</td>
        <td>${escapeHtml(item.subject_name)}</td>
        <td>${escapeHtml(item.account_name)}</td>
        <td>${escapeHtml(item.description)}</td>
        <td class="r">${euro(item.amount)}</td>
      </tr>
    `).join('');

    return `
      <h3>${escapeHtml(name)} <span class="pill">Subtotale: <b>${euro(subtotal)}</b></span></h3>
      <table>
        <thead>
          <tr><th>Data</th><th>Soggetto</th><th>Conto</th><th>Descrizione</th><th class="r">Importo</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }).join('');

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Report Spese</title>
      <style>
        body{font-family:system-ui,Arial,sans-serif;margin:24px;color:#111}
        table{width:100%;border-collapse:collapse;margin:10px 0 24px}
        th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}
        .r{text-align:right}
        .pill{display:inline-block;padding:4px 10px;border-radius:999px;background:#f2f2f7;font-size:12px}
        .muted{color:#666;font-size:12px}
        button{margin-bottom:16px}
      </style>
    </head>
    <body>
      <button onclick="window.print()">Stampa / Salva PDF</button>
      <h1>Report Spese</h1>
      <div class="muted">Range: ${escapeHtml(filters.from || '-') } → ${escapeHtml(filters.to || '-')} · Soggetto: ${escapeHtml(filters.subjectName || 'tutti')} · Conto: ${escapeHtml(filters.accountName || 'tutti')} · Categoria: ${escapeHtml(filters.categoryName || 'tutte')}</div>
      <p><span class="pill">Totale: <b>${euro(total)}</b></span></p>
      ${groupedHtml || '<p class="muted">Nessuna spesa trovata.</p>'}
    </body>
  </html>`;
}

export function openPdfPreview(html) {
  const w = window.open('', '_blank');
  if (!w) throw new Error('Popup bloccato.');
  w.document.open();
  w.document.write(html);
  w.document.close();
}
