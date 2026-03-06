import { $, euro, ymd, parseAmount, fillSelect, getMultiSelectValues, message, confirmDelete, fileToMeta, downloadText, todayRange } from './ui.js';
import { buildReportHtml, openPdfPreview } from './report.js';
import { exportExpensesCsv, exportRecurringCsv, importExpensesCsv, importRecurringCsv } from './csv.js';
import { ping, subjectsApi, accountsApi, categoriesApi, expensesApi, attachmentsApi, recurringApi } from './api.js';
import { STORAGE_LIMIT_BYTES, STORAGE_WARN_RATIO, STORAGE_ALERT_RATIO, STORAGE_BLOCK_RATIO } from './config.js';

const state = {
  subjects: [],
  accounts: [],
  categories: [],
  expenses: [],
  recurring: []
};

bootstrap().catch(handleError);

async function bootstrap() {
  bindTabs();
  bindActions();
  initMobileCollapsibles();
  setDefaultDates();
  await reloadAll();
}

function bindTabs() {
  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(x => x.classList.add('hidden'));
    btn.classList.add('active');
    $(`tab-${btn.dataset.tab}`).classList.remove('hidden');
  }));
}

function bindActions() {
  $('btnPing').addEventListener('click', testConnection);
  $('btnAddSubject').addEventListener('click', onAddSubject);
  $('btnAddCategory').addEventListener('click', onAddCategory);
  $('btnAddAccount').addEventListener('click', onAddAccount);
  $('btnAddExpense').addEventListener('click', onAddExpense);
  $('btnClearExpense').addEventListener('click', clearExpenseForm);
  $('btnApplyFilters').addEventListener('click', refreshExpenses);
  $('btnResetFilters').addEventListener('click', resetExpenseFilters);
  $('btnRefreshExpenses').addEventListener('click', refreshExpenses);
  $('e_account').addEventListener('change', syncExpenseSubjectsForAccount);
  $('m_account').addEventListener('change', syncEditSubjectsForAccount);
  $('r_account').addEventListener('change', syncRecurringSubjectsForAccount);
  $('btnSaveExpenseChanges').addEventListener('click', onSaveExpenseChanges);
  $('btnCloseExpenseDialog').addEventListener('click', () => $('editExpenseDialog').close());
  $('btnAddRecurring').addEventListener('click', onAddRecurring);
  $('btnGenerateRecurring').addEventListener('click', onGenerateRecurring);
  $('btnExportExpensesCsv').addEventListener('click', onExportExpensesCsv);
  $('btnExportRecurringCsv').addEventListener('click', onExportRecurringCsv);
  $('btnImportCsv').addEventListener('click', onImportCsv);
  $('btnPreviewReport').addEventListener('click', onPreviewReport);
}

function initMobileCollapsibles() {
  document.querySelectorAll('.collapsibleToggle').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.innerWidth > 900) return;

      const card = btn.closest('.collapsibleCard');
      if (!card) return;

      card.classList.toggle('mobileOpen');
    });
  });
}

function renderMobileExpenses() {
  const box = $('mobileExpensesList');
  if (!box) return;

  box.innerHTML = '';

  if (!state.expenses.length) {
    box.innerHTML = `<div class="mobileExpenseEmpty">Nessuna spesa trovata.</div>`;
    return;
  }

  for (const item of state.expenses) {
    const card = document.createElement('details');
    card.className = 'mobileExpenseCard';

    card.innerHTML = `
      <summary>
        <div class="mobileExpenseSummary">
          <div class="mobileExpenseTitle">${item.description || '-'}</div>
          <div class="mobileExpenseAmount">${euro(item.amount)}</div>
        </div>
      </summary>

      <div class="mobileExpenseBody">
        <div class="mobileExpenseGrid">
          <div><span class="muted">Data</span><strong>${item.expense_date || '-'}</strong></div>
          <div><span class="muted">Soggetto</span><strong>${item.subject_name || '-'}</strong></div>
          <div><span class="muted">Conto</span><strong>${item.account_name || '-'}</strong></div>
          <div><span class="muted">Categoria</span><strong>${item.category_name || '-'}</strong></div>
        </div>

        ${item.notes ? `<div class="mobileExpenseNotes"><span class="muted">Note</span><div>${item.notes}</div></div>` : ''}

        <div class="mobileExpenseAttachments">
          <span class="muted">Ricevute</span>
          <div>${renderAttachmentLinks(item.attachments)}</div>
        </div>

        <div class="actions">
          <button class="small" data-edit-expense="${item.id}">Modifica</button>
          <button class="small danger" data-del-expense="${item.id}">Elimina</button>
        </div>
      </div>
    `;

    box.append(card);
  }

  box.querySelectorAll('[data-edit-expense]').forEach(btn =>
    btn.addEventListener('click', () => openEditExpense(btn.dataset.editExpense))
  );

  box.querySelectorAll('[data-del-expense]').forEach(btn =>
    btn.addEventListener('click', () => onDeleteExpense(btn.dataset.delExpense))
  );

  box.querySelectorAll('[data-open-attachment]').forEach(btn =>
    btn.addEventListener('click', () => window.open(btn.dataset.openAttachment, '_blank'))
  );
}

function setDefaultDates() {
  const { from, to } = todayRange();
  $('f_from').value = from;
  $('f_to').value = to;
  $('rp_from').value = from;
  $('rp_to').value = to;
  $('e_date').value = to;
  $('r_start').value = to;
}

async function testConnection() {
  try {
    await ping();
    $('connectionBadge').textContent = 'Connesso';
    $('connectionBadge').className = 'pill ok';
    message('Connessione Supabase riuscita.', 'ok');
  } catch (err) {
    $('connectionBadge').textContent = 'Errore';
    $('connectionBadge').className = 'pill danger';
    handleError(err);
  }
}

async function reloadAll() {
  await Promise.all([reloadSubjects(), reloadCategories(), reloadAccounts(), reloadRecurring()]);
  await refreshExpenses();
  await refreshStorageBadge();
}

async function reloadSubjects() {
  state.subjects = await subjectsApi.list();
  fillSelect($('e_subject'), state.subjects);
  fillSelect($('f_subject'), state.subjects, { includeEmpty: true, emptyText: 'Tutti' });
  fillSelect($('rp_subject'), state.subjects, { includeEmpty: true, emptyText: 'Tutti' });
  fillSelect($('r_subject'), state.subjects);
  fillSelect($('m_subject'), state.subjects);
  fillSelect($('a_subjects'), state.subjects);
  renderSubjects();
}

async function reloadCategories() {
  state.categories = await categoriesApi.list();
  fillSelect($('e_category'), state.categories);
  fillSelect($('f_category'), state.categories, { includeEmpty: true, emptyText: 'Tutte' });
  fillSelect($('rp_category'), state.categories, { includeEmpty: true, emptyText: 'Tutte' });
  fillSelect($('r_category'), state.categories);
  fillSelect($('m_category'), state.categories);
  renderCategories();
}

async function reloadAccounts() {
  state.accounts = await accountsApi.list();
  fillSelect($('e_account'), state.accounts);
  fillSelect($('f_account'), state.accounts, { includeEmpty: true, emptyText: 'Tutti' });
  fillSelect($('rp_account'), state.accounts, { includeEmpty: true, emptyText: 'Tutti' });
  fillSelect($('r_account'), state.accounts);
  fillSelect($('m_account'), state.accounts);
  renderAccounts();
  await syncExpenseSubjectsForAccount();
  await syncEditSubjectsForAccount();
  await syncRecurringSubjectsForAccount();
}

async function reloadRecurring() {
  state.recurring = await recurringApi.list();
  renderRecurring();
}

async function refreshExpenses() {
  const filters = {
    from: $('f_from').value || null,
    to: $('f_to').value || null,
    subject_id: $('f_subject').value || null,
    account_id: $('f_account').value || null,
    category_id: $('f_category').value || null,
    text: $('f_text').value.trim() || null
  };
  state.expenses = await expensesApi.list(filters);
  renderExpenses();
}

async function refreshStorageBadge() {
  const used = await attachmentsApi.storageUsage();
  const ratio = used / STORAGE_LIMIT_BYTES;
  const pct = Math.round(ratio * 100);
  $('storageBadge').textContent = `Storage: ${pct}%`;
  $('storageBadge').className = 'pill';
  if (ratio >= STORAGE_BLOCK_RATIO) $('storageBadge').classList.add('danger');
  else if (ratio >= STORAGE_ALERT_RATIO) $('storageBadge').classList.add('warn');
  else if (ratio >= STORAGE_WARN_RATIO) $('storageBadge').classList.add('ok');
}

function selectedAccount() {
  return state.accounts.find(x => x.id === $('e_account').value) || null;
}

async function syncExpenseSubjectsForAccount() {
  const account = selectedAccount();
  if (!account) return fillSelect($('e_subject'), state.subjects);
  const rows = account.subject_ids?.length
    ? state.subjects.filter(s => account.subject_ids.includes(s.id))
    : await accountsApi.subjectsForAccount(account.id);
  fillSelect($('e_subject'), rows);
}

async function syncEditSubjectsForAccount() {
  const accountId = $('m_account').value;
  if (!accountId) return fillSelect($('m_subject'), state.subjects);
  const account = state.accounts.find(x => x.id === accountId);
  const rows = account?.subject_ids?.length ? state.subjects.filter(s => account.subject_ids.includes(s.id)) : await accountsApi.subjectsForAccount(accountId);
  fillSelect($('m_subject'), rows);
}

async function syncRecurringSubjectsForAccount() {
  const accountId = $('r_account').value;
  if (!accountId) return fillSelect($('r_subject'), state.subjects);
  const account = state.accounts.find(x => x.id === accountId);
  const rows = account?.subject_ids?.length ? state.subjects.filter(s => account.subject_ids.includes(s.id)) : await accountsApi.subjectsForAccount(accountId);
  fillSelect($('r_subject'), rows);
}

async function onAddSubject() {
  const name = $('s_name').value.trim();
  if (!name) throw new Error('Nome soggetto obbligatorio.');
  await subjectsApi.create({ name, email: $('s_email').value.trim() || null, notes: $('s_notes').value.trim() || null });
  $('s_name').value = '';
  $('s_email').value = '';
  $('s_notes').value = '';
  await reloadSubjects();
  message('Soggetto salvato.');
}

async function onAddCategory() {
  const name = $('c_name').value.trim();
  if (!name) throw new Error('Nome categoria obbligatorio.');
  await categoriesApi.create({
    name,
    description: $('c_desc').value.trim() || null,
    color: $('c_color').value.trim() || null,
    icon: $('c_icon').value.trim() || null
  });
  $('c_name').value = '';
  $('c_desc').value = '';
  $('c_color').value = '';
  $('c_icon').value = '';
  await reloadCategories();
  message('Categoria salvata.');
}

async function onAddAccount() {
  const name = $('a_name').value.trim();
  if (!name) throw new Error('Nome conto obbligatorio.');
  const subjectIds = getMultiSelectValues($('a_subjects'));
  if (!subjectIds.length) throw new Error('Seleziona almeno un soggetto per il conto.');
  await accountsApi.create({ name, description: $('a_desc').value.trim() || null, subjectIds });
  $('a_name').value = '';
  $('a_desc').value = '';
  [...$('a_subjects').options].forEach(o => { o.selected = false; });
  await reloadAccounts();
  message('Conto salvato.');
}

async function onAddExpense() {
  const amount = parseAmount($('e_amount').value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Importo non valido.');
  const payload = {
    account_id: $('e_account').value,
    subject_id: $('e_subject').value,
    category_id: $('e_category').value,
    description: $('e_desc').value.trim(),
    amount,
    expense_date: $('e_date').value,
    notes: $('e_notes').value.trim() || null
  };
  validateExpensePayload(payload);
  const expense = await expensesApi.create(payload);
  const file = $('e_attach').files[0];
  if (file) {
    const meta = await fileToMeta(file);
    await attachmentsApi.upload({ expenseId: expense.id, ...meta });
  }
  clearExpenseForm();
  await refreshExpenses();
  await refreshStorageBadge();
  message('Spesa salvata.');
}

function clearExpenseForm() {
  $('e_desc').value = '';
  $('e_amount').value = '';
  $('e_notes').value = '';
  $('e_attach').value = '';
  $('e_date').value = ymd(new Date());
}

function validateExpensePayload(payload) {
  if (!payload.account_id) throw new Error('Conto obbligatorio.');
  if (!payload.subject_id) throw new Error('Soggetto obbligatorio.');
  if (!payload.category_id) throw new Error('Categoria obbligatoria.');
  if (!payload.description) throw new Error('Descrizione obbligatoria.');
  if (!payload.expense_date) throw new Error('Data obbligatoria.');
  const account = state.accounts.find(a => a.id === payload.account_id);
  if (!account || !(account.subject_ids || []).includes(payload.subject_id)) {
    throw new Error('Il soggetto selezionato non è associato al conto.');
  }
}

function renderExpenses() {
  const tbody = $('tbodyExpenses');
  tbody.innerHTML = '';
  let total = 0;

  for (const item of state.expenses) {
    total += Number(item.amount || 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.expense_date}</td>
      <td>${item.subject_name}</td>
      <td>${item.account_name}</td>
      <td>${item.category_name}</td>
      <td>${item.description}</td>
      <td class="r">${euro(item.amount)}</td>
      <td>${renderAttachmentLinks(item.attachments)}</td>
      <td class="actionsCell">
        <button class="small" data-edit-expense="${item.id}">Modifica</button>
        <button class="small danger" data-del-expense="${item.id}">Elimina</button>
      </td>`;
    tbody.append(tr);
  }

  $('kpiFiltered').textContent = `Righe: ${state.expenses.length}`;
  $('kpiTotal').textContent = `Totale: ${euro(total)}`;

  tbody.querySelectorAll('[data-edit-expense]').forEach(btn =>
    btn.addEventListener('click', () => openEditExpense(btn.dataset.editExpense))
  );
  tbody.querySelectorAll('[data-del-expense]').forEach(btn =>
    btn.addEventListener('click', () => onDeleteExpense(btn.dataset.delExpense))
  );
  tbody.querySelectorAll('[data-open-attachment]').forEach(btn =>
    btn.addEventListener('click', () => window.open(btn.dataset.openAttachment, '_blank'))
  );

  renderMobileExpenses();
}

function renderAttachmentLinks(attachments) {
  if (!attachments?.length) return '-';
  return attachments.map(a => `<button class="linkBtn" data-open-attachment="${attachmentsApi.getPublicUrl(a.storage_path)}">${a.file_name}</button>`).join(' ');
}

function renderSubjects() {
  const tbody = $('tbodySubjects');
  tbody.innerHTML = '';
  for (const item of state.subjects) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${item.name}</td><td>${item.email || ''}</td><td class="actionsCell"><button class="small danger" data-del-subject="${item.id}">Elimina</button></td>`;
    tbody.append(tr);
  }
  tbody.querySelectorAll('[data-del-subject]').forEach(btn => btn.addEventListener('click', () => onDeleteSubject(btn.dataset.delSubject)));
}

function renderAccounts() {
  const tbody = $('tbodyAccounts');
  tbody.innerHTML = '';
  for (const item of state.accounts) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${item.name}</td><td>${item.description || ''}</td><td>${(item.subject_names || []).join(', ')}</td><td class="actionsCell"><button class="small danger" data-del-account="${item.id}">Elimina</button></td>`;
    tbody.append(tr);
  }
  tbody.querySelectorAll('[data-del-account]').forEach(btn => btn.addEventListener('click', () => onDeleteAccount(btn.dataset.delAccount)));
}

function renderCategories() {
  const tbody = $('tbodyCategories');
  tbody.innerHTML = '';
  for (const item of state.categories) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${item.name}</td><td>${item.description || ''}</td><td class="actionsCell"><button class="small danger" data-del-category="${item.id}">Elimina</button></td>`;
    tbody.append(tr);
  }
  tbody.querySelectorAll('[data-del-category]').forEach(btn => btn.addEventListener('click', () => onDeleteCategory(btn.dataset.delCategory)));
}

function renderRecurring() {
  const tbody = $('tbodyRecurring');
  tbody.innerHTML = '';
  for (const item of state.recurring) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${item.description}</td><td>${item.frequency} / ${item.interval_value}</td><td>${item.last_generated_date || '-'}</td><td class="actionsCell"><button class="small danger" data-del-recurring="${item.id}">Elimina</button></td>`;
    tbody.append(tr);
  }
  tbody.querySelectorAll('[data-del-recurring]').forEach(btn => btn.addEventListener('click', () => onDeleteRecurring(btn.dataset.delRecurring)));
}

async function openEditExpense(expenseId) {
  const item = state.expenses.find(x => x.id === expenseId);
  if (!item) return;
  $('m_expense_id').value = item.id;
  $('m_account').value = item.account_id;
  await syncEditSubjectsForAccount();
  $('m_subject').value = item.subject_id;
  $('m_category').value = item.category_id;
  $('m_date').value = item.expense_date;
  $('m_desc').value = item.description;
  $('m_amount').value = String(item.amount).replace('.', ',');
  $('m_notes').value = item.notes || '';
  $('editExpenseDialog').showModal();
}

async function onSaveExpenseChanges() {
  const payload = {
    account_id: $('m_account').value,
    subject_id: $('m_subject').value,
    category_id: $('m_category').value,
    description: $('m_desc').value.trim(),
    amount: parseAmount($('m_amount').value),
    expense_date: $('m_date').value,
    notes: $('m_notes').value.trim() || null
  };
  validateExpensePayload(payload);
  await expensesApi.update($('m_expense_id').value, payload);
  $('editExpenseDialog').close();
  await refreshExpenses();
  message('Spesa aggiornata.');
}

async function onDeleteExpense(id) {
  const item = state.expenses.find(x => x.id === id);
  if (!item || !confirmDelete(item.description)) return;
  for (const att of item.attachments || []) await attachmentsApi.remove(att);
  await expensesApi.remove(id);
  await refreshExpenses();
  await refreshStorageBadge();
  message('Spesa eliminata.');
}

async function onDeleteSubject(id) {
  const item = state.subjects.find(x => x.id === id);
  if (!item || !confirmDelete(item.name)) return;
  await subjectsApi.remove(id);
  await reloadAll();
  message('Soggetto eliminato.');
}

async function onDeleteAccount(id) {
  const item = state.accounts.find(x => x.id === id);
  if (!item || !confirmDelete(item.name)) return;
  await accountsApi.remove(id);
  await reloadAll();
  message('Conto eliminato.');
}

async function onDeleteCategory(id) {
  const item = state.categories.find(x => x.id === id);
  if (!item || !confirmDelete(item.name)) return;
  await categoriesApi.remove(id);
  await reloadAll();
  message('Categoria eliminata.');
}

async function onAddRecurring() {
  const payload = {
    account_id: $('r_account').value,
    subject_id: $('r_subject').value,
    category_id: $('r_category').value,
    description: $('r_desc').value.trim(),
    amount: parseAmount($('r_amount').value),
    notes: $('r_notes').value.trim() || null,
    frequency: $('r_frequency').value,
    interval_value: Number($('r_interval').value || 1),
    start_date: $('r_start').value,
    end_date: $('r_end').value || null,
    last_generated_date: null
  };
  validateExpensePayload({ ...payload, expense_date: payload.start_date });
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) throw new Error('Importo ricorrenza non valido.');
  await recurringApi.create(payload);
  $('r_desc').value = '';
  $('r_amount').value = '';
  $('r_notes').value = '';
  $('r_end').value = '';
  $('r_interval').value = '1';
  await reloadRecurring();
  message('Ricorrenza salvata.');
}

async function onGenerateRecurring() {
  const today = new Date();
  const generated = [];
  for (const rec of state.recurring) {
    const dueDates = getDueDates(rec, today);
    for (const due of dueDates) {
      await expensesApi.create({
        account_id: rec.account_id,
        subject_id: rec.subject_id,
        category_id: rec.category_id,
        description: rec.description,
        amount: rec.amount,
        expense_date: due,
        notes: rec.notes || null
      });
      generated.push(`${rec.description} (${due})`);
    }
    if (dueDates.length) {
      await recurringApi.update(rec.id, { last_generated_date: dueDates[dueDates.length - 1] });
    }
  }
  await reloadRecurring();
  await refreshExpenses();
  message(generated.length ? `Generate ${generated.length} spese ricorrenti.` : 'Nessuna ricorrenza dovuta.');
}

function getDueDates(rec, untilDate) {
  const out = [];
  const start = new Date(rec.start_date);
  const end = rec.end_date ? new Date(rec.end_date) : null;
  let current = rec.last_generated_date ? nextDate(new Date(rec.last_generated_date), rec.frequency, rec.interval_value) : start;
  while (current <= untilDate) {
    if (!end || current <= end) out.push(ymd(current));
    current = nextDate(current, rec.frequency, rec.interval_value);
    if (out.length > 100) break;
  }
  return out;
}

function nextDate(date, frequency, interval) {
  const d = new Date(date);
  if (frequency === 'daily') d.setDate(d.getDate() + interval);
  if (frequency === 'weekly') d.setDate(d.getDate() + (7 * interval));
  if (frequency === 'monthly') d.setMonth(d.getMonth() + interval);
  if (frequency === 'yearly') d.setFullYear(d.getFullYear() + interval);
  return d;
}

async function onDeleteRecurring(id) {
  const item = state.recurring.find(x => x.id === id);
  if (!item || !confirmDelete(item.description)) return;
  await recurringApi.remove(id);
  await reloadRecurring();
  message('Ricorrenza eliminata.');
}

function resetExpenseFilters() {
  const { from, to } = todayRange();
  $('f_from').value = from;
  $('f_to').value = to;
  $('f_subject').value = '';
  $('f_account').value = '';
  $('f_category').value = '';
  $('f_text').value = '';
  refreshExpenses().catch(handleError);
}

async function onExportExpensesCsv() {
  const rows = await expensesApi.list({});
  const normalized = rows.map(x => ({
    id: x.id,
    account_id: x.account_id,
    subject_id: x.subject_id,
    category_id: x.category_id,
    description: x.description,
    amount: x.amount,
    expense_date: x.expense_date,
    notes: x.notes || ''
  }));
  downloadText(`spese_${ymd(new Date())}.csv`, exportExpensesCsv(normalized), 'text/csv;charset=utf-8');
}

async function onExportRecurringCsv() {
  const rows = await recurringApi.list();
  const normalized = rows.map(x => ({
    id: x.id,
    account_id: x.account_id,
    subject_id: x.subject_id,
    category_id: x.category_id,
    description: x.description,
    amount: x.amount,
    notes: x.notes || '',
    frequency: x.frequency,
    interval_value: x.interval_value,
    start_date: x.start_date,
    end_date: x.end_date || '',
    last_generated_date: x.last_generated_date || ''
  }));
  downloadText(`ricorrenze_${ymd(new Date())}.csv`, exportRecurringCsv(normalized), 'text/csv;charset=utf-8');
}

async function onImportCsv() {
  const file = $('importFile').files[0];
  if (!file) throw new Error('Seleziona un file CSV.');
  const text = await file.text();
  const kind = $('importKind').value;
  let count = 0;
  if (kind === 'expenses') {
    const rows = importExpensesCsv(text);
    for (const row of rows) validateExpensePayload(row);
    if (rows.length) await expensesApi.bulkInsert(rows);
    count = rows.length;
    await refreshExpenses();
  } else {
    const rows = importRecurringCsv(text);
    for (const row of rows) validateExpensePayload({ ...row, expense_date: row.start_date });
    if (rows.length) await recurringApi.bulkInsert(rows);
    count = rows.length;
    await reloadRecurring();
  }
  $('importResult').textContent = `Righe importate: ${count}`;
  message('Import completato.');
}

async function onPreviewReport() {
  const rows = await expensesApi.list({
    from: $('rp_from').value || null,
    to: $('rp_to').value || null,
    subject_id: $('rp_subject').value || null,
    account_id: $('rp_account').value || null,
    category_id: $('rp_category').value || null
  });
  openPdfPreview(buildReportHtml({
    filters: {
      from: $('rp_from').value,
      to: $('rp_to').value,
      subjectName: state.subjects.find(x => x.id === $('rp_subject').value)?.name || '',
      accountName: state.accounts.find(x => x.id === $('rp_account').value)?.name || '',
      categoryName: state.categories.find(x => x.id === $('rp_category').value)?.name || ''
    },
    expenses: rows
  }));
}

function handleError(err) {
  console.error(err);
  message(err?.message || String(err), 'danger');
}
