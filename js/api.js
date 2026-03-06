import { supabase } from './supabaseClient.js';
import { STORAGE_BUCKET } from './config.js';

function unwrap(result) {
  if (result.error) throw result.error;
  return result.data;
}

export async function ping() {
  const { error } = await supabase.from('categories').select('id', { head: true, count: 'exact' }).limit(1);
  if (error) throw error;
  return true;
}

export const subjectsApi = {
  list: async () => unwrap(await supabase.from('subjects').select('*').order('name')),
  create: async (payload) => unwrap(await supabase.from('subjects').insert(payload).select().single()),
  update: async (id, payload) => unwrap(await supabase.from('subjects').update(payload).eq('id', id).select().single()),
  remove: async (id) => unwrap(await supabase.from('subjects').delete().eq('id', id))
};

export const categoriesApi = {
  list: async () => unwrap(await supabase.from('categories').select('*').order('name')),
  create: async (payload) => unwrap(await supabase.from('categories').insert(payload).select().single()),
  update: async (id, payload) => unwrap(await supabase.from('categories').update(payload).eq('id', id).select().single()),
  remove: async (id) => unwrap(await supabase.from('categories').delete().eq('id', id))
};

export const accountsApi = {
  list: async () => {
    const rows = unwrap(await supabase.from('accounts').select('id,name,description,account_subjects(subject_id,subjects(id,name))').order('name'));
    return rows.map(row => ({
      ...row,
      subject_ids: (row.account_subjects || []).map(x => x.subject_id),
      subject_names: (row.account_subjects || []).map(x => x.subjects?.name).filter(Boolean)
    }));
  },
  create: async ({ name, description, subjectIds }) => {
    const account = unwrap(await supabase.from('accounts').insert({ name, description }).select().single());
    if (subjectIds?.length) {
      unwrap(await supabase.from('account_subjects').insert(subjectIds.map(subject_id => ({ account_id: account.id, subject_id }))));
    }
    return account;
  },
  update: async (id, { name, description, subjectIds }) => {
    unwrap(await supabase.from('accounts').update({ name, description }).eq('id', id));
    unwrap(await supabase.from('account_subjects').delete().eq('account_id', id));
    if (subjectIds?.length) unwrap(await supabase.from('account_subjects').insert(subjectIds.map(subject_id => ({ account_id: id, subject_id }))));
    return true;
  },
  remove: async (id) => unwrap(await supabase.from('accounts').delete().eq('id', id)),
  subjectsForAccount: async (accountId) => {
    const rows = unwrap(await supabase.from('account_subjects').select('subject_id,subjects(id,name,email)').eq('account_id', accountId));
    return rows.map(r => r.subjects).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  }
};

export const expensesApi = {
  list: async (filters = {}) => {
    let query = supabase.from('expenses').select(`
      id, account_id, subject_id, category_id, description, amount, expense_date, notes, created_at,
      accounts(name), subjects(name,email), categories(name,color), expense_attachments(id,file_name,mime_type,file_size,storage_path)
    `).order('expense_date', { ascending: false }).order('created_at', { ascending: false });

    if (filters.from) query = query.gte('expense_date', filters.from);
    if (filters.to) query = query.lte('expense_date', filters.to);
    if (filters.account_id) query = query.eq('account_id', filters.account_id);
    if (filters.subject_id) query = query.eq('subject_id', filters.subject_id);
    if (filters.category_id) query = query.eq('category_id', filters.category_id);
    if (filters.text) query = query.ilike('description', `%${filters.text}%`);

    const rows = unwrap(await query);
    return rows.map(row => ({
      ...row,
      account_name: row.accounts?.name || '',
      subject_name: row.subjects?.name || '',
      category_name: row.categories?.name || '',
      attachments: row.expense_attachments || []
    }));
  },
  create: async (payload) => unwrap(await supabase.from('expenses').insert(payload).select().single()),
  update: async (id, payload) => unwrap(await supabase.from('expenses').update(payload).eq('id', id).select().single()),
  remove: async (id) => unwrap(await supabase.from('expenses').delete().eq('id', id)),
  bulkInsert: async (rows) => unwrap(await supabase.from('expenses').insert(rows))
};

export const attachmentsApi = {
  upload: async ({ expenseId, file, file_name, mime_type, file_size }) => {
    const ext = file_name.includes('.') ? file_name.split('.').pop() : 'bin';
    const path = `${expenseId}/${Date.now()}.${ext}`;
    unwrap(await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false, contentType: mime_type }));
    return unwrap(await supabase.from('expense_attachments').insert({
      expense_id: expenseId,
      storage_path: path,
      file_name,
      mime_type,
      file_size
    }).select().single());
  },
  remove: async (attachment) => {
    unwrap(await supabase.storage.from(STORAGE_BUCKET).remove([attachment.storage_path]));
    unwrap(await supabase.from('expense_attachments').delete().eq('id', attachment.id));
    return true;
  },
  getPublicUrl: (storagePath) => supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl,
  storageUsage: async () => {
    const rows = unwrap(await supabase.from('expense_attachments').select('file_size'));
    return rows.reduce((sum, row) => sum + Number(row.file_size || 0), 0);
  }
};

export const recurringApi = {
  list: async () => {
    const rows = unwrap(await supabase.from('recurring_expenses').select(`
      *, accounts(name), subjects(name), categories(name)
    `).order('description'));
    return rows.map(row => ({
      ...row,
      account_name: row.accounts?.name || '',
      subject_name: row.subjects?.name || '',
      category_name: row.categories?.name || ''
    }));
  },
  create: async (payload) => unwrap(await supabase.from('recurring_expenses').insert(payload).select().single()),
  update: async (id, payload) => unwrap(await supabase.from('recurring_expenses').update(payload).eq('id', id).select().single()),
  remove: async (id) => unwrap(await supabase.from('recurring_expenses').delete().eq('id', id)),
  bulkInsert: async (rows) => unwrap(await supabase.from('recurring_expenses').insert(rows))
};
