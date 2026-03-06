const EXPENSE_COLUMNS = [
  'id', 'account_id', 'subject_id', 'category_id', 'description', 'amount', 'expense_date', 'notes'
];

const RECURRING_COLUMNS = [
  'id', 'account_id', 'subject_id', 'category_id', 'description', 'amount', 'notes',
  'frequency', 'interval_value', 'start_date', 'end_date', 'last_generated_date'
];

function escapeCsv(value) {
  const s = String(value ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n')) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQ) {
      if (ch === '"' && next === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQ = false; continue; }
      cur += ch; continue;
    }
    if (ch === '"') { inQ = true; continue; }
    if (ch === ';') { row.push(cur); cur = ''; continue; }
    if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; continue; }
    if (ch === '\r') continue;
    cur += ch;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

export function exportExpensesCsv(rows) {
  const lines = [EXPENSE_COLUMNS.join(';')];
  for (const row of rows) lines.push(EXPENSE_COLUMNS.map(col => escapeCsv(row[col])).join(';'));
  return lines.join('\n');
}

export function exportRecurringCsv(rows) {
  const lines = [RECURRING_COLUMNS.join(';')];
  for (const row of rows) lines.push(RECURRING_COLUMNS.map(col => escapeCsv(row[col])).join(';'));
  return lines.join('\n');
}

export function importExpensesCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0];
  const dataRows = rows.slice(1);
  return dataRows.map(raw => Object.fromEntries(header.map((col, idx) => [col, raw[idx] || '']))).map(r => ({
    account_id: r.account_id,
    subject_id: r.subject_id,
    category_id: r.category_id,
    description: r.description,
    amount: Number(r.amount),
    expense_date: r.expense_date,
    notes: r.notes || null
  }));
}

export function importRecurringCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0];
  const dataRows = rows.slice(1);
  return dataRows.map(raw => Object.fromEntries(header.map((col, idx) => [col, raw[idx] || '']))).map(r => ({
    account_id: r.account_id,
    subject_id: r.subject_id,
    category_id: r.category_id,
    description: r.description,
    amount: Number(r.amount),
    notes: r.notes || null,
    frequency: r.frequency,
    interval_value: Number(r.interval_value || 1),
    start_date: r.start_date,
    end_date: r.end_date || null,
    last_generated_date: r.last_generated_date || null
  }));
}
