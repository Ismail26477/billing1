import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BookOpen, CalendarDays, Check, ChevronDown, CircleDollarSign, FileText, HardHat, Lock, Menu, Plus, Printer, ReceiptIndianRupee, Search, Settings, Trash2, Users, X } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

type View = 'Customers' | 'Quotations' | 'Invoices' | 'Labour' | 'Settings';
type Customer = { id: string; name: string; project_name: string | null; address: string | null; city: string | null; state: string | null; pincode: string | null; phone: string | null; email: string | null; gst_number: string | null; notes: string | null; created_at: string };
type Document = { id: string; invoice_number?: string; quotation_number?: string; customer_id: string | null; status: string; grand_total: number; amount_paid?: number; balance_due?: number; discount?: number; invoice_date?: string; quotation_date?: string; due_date?: string; valid_until?: string; notes?: string | null; created_at: string; customers?: { name: string; project_name: string | null; address: string | null; phone: string | null; gst_number: string | null } | null };
type SettingsData = { id: string; company_name: string; proprietor_name: string; address: string; phone: string; email: string; invoice_prefix: string; quotation_prefix: string; default_tax: number; default_footer: string; trust_text: string; currency: string };
type Line = { description: string; unit: string; quantity: number; rate: number };
type PreviewData = { type: 'invoice' | 'quotation'; document: Document; lines: Line[]; customer: Customer | null };
type Labourer = { id: string; name: string; role: string | null; phone: string | null; daily_wage: number; weekly_incentive: number; is_deleted: boolean; created_at: string };
type LabourPayment = { id: string; labourer_id: string; week_ending: string; amount: number; paid: boolean; notes: string | null; created_at: string };
type AttendanceRecord = { id: string; labourer_id: string; week_ending: string; day_mon: boolean; day_tue: boolean; day_wed: boolean; day_thu: boolean; day_fri: boolean; day_sat: boolean; day_sun: boolean; incentive: number; amount: number; settled: boolean; notes: string | null };
type LabourerWithPayments = Labourer & { payments: LabourPayment[]; attendance: AttendanceRecord[] };

const nav = [
  ['Quotations', FileText], ['Invoices', ReceiptIndianRupee], ['Customers', Users], ['Labour', HardHat], ['Settings', Settings],
] as const;
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const dateLabel = (value?: string) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const today = new Date().toISOString().slice(0, 10);
function selectZeroOnFocus(event: React.FocusEvent<HTMLInputElement>) { if (event.currentTarget.value === '0') event.currentTarget.select(); }

const LOCK_EMAIL = 'irsusheikh14@gmail.com';

function App() {
  const [view, setView] = useState<View>('Invoices');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Document[]>([]);
  const [quotations, setQuotations] = useState<Document[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<'customer' | 'customerProfile' | 'document' | 'preview' | 'labourer' | null>(null);
  const [documentType, setDocumentType] = useState<'invoice' | 'quotation'>('invoice');
  const [editingDocument, setEditingDocument] = useState<{ document: Document; lines: Line[]; customer: Customer | null } | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [labourers, setLabourers] = useState<LabourerWithPayments[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [notice, setNotice] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showLock, setShowLock] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const isUnlocked = !!session;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthChecked(true); });
    supabase.auth.onAuthStateChange((event, newSession) => {
      (async () => {
        if (event === 'PASSWORD_RECOVERY') { setRecoveryMode(true); setShowLock(true); setSession(newSession); return; }
        setSession(newSession);
        if (newSession) setShowLock(false);
      })();
    });
  }, []);


  async function loadData() {
    const [customerRes, invoiceRes, quotationRes, settingRes, labourerRes, paymentRes, attendanceRes] = await Promise.all([
      supabase.from('customers').select('*').eq('is_deleted', false).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*, customers(name, project_name, address, phone, gst_number)').order('created_at', { ascending: false }),
      supabase.from('quotations').select('*, customers(name, project_name, address, phone, gst_number)').order('created_at', { ascending: false }),
      supabase.from('company_settings').select('*').limit(1).maybeSingle(),
      supabase.from('labourers').select('*').eq('is_deleted', false).order('created_at', { ascending: false }),
      supabase.from('labour_payments').select('*').order('week_ending', { ascending: false }),
      supabase.from('labour_attendance').select('*').order('week_ending', { ascending: false }),
    ]);
    if (!customerRes.error) setCustomers(customerRes.data || []);
    if (!invoiceRes.error) setInvoices(invoiceRes.data || []);
    if (!quotationRes.error) setQuotations(quotationRes.data || []);
    if (!settingRes.error) setSettings(settingRes.data);
    if (!labourerRes.error && !paymentRes.error && !attendanceRes.error) {
      const labourerData = (labourerRes.data || []).map((labourer: Labourer) => ({
        ...labourer,
        payments: (paymentRes.data || []).filter((p: LabourPayment) => p.labourer_id === labourer.id),
        attendance: (attendanceRes.data || []).filter((r: AttendanceRecord) => r.labourer_id === labourer.id),
      }));
      setLabourers(labourerData);
    }
  }
  useEffect(() => { if (authChecked) void loadData(); }, [authChecked]);
  useEffect(() => { if (notice) { const timer = window.setTimeout(() => setNotice(''), 2800); return () => window.clearTimeout(timer); } }, [notice]);

  const totals = useMemo(() => ({
    invoiceAmount: invoices.reduce((sum, row) => sum + Number(row.grand_total || 0), 0),
    quotationAmount: quotations.reduce((sum, row) => sum + Number(row.grand_total || 0), 0),
    paid: invoices.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0),
    pending: invoices.reduce((sum, row) => sum + Number(row.balance_due || 0), 0),
  }), [invoices, quotations]);
  const filteredCustomers = customers.filter((row) => `${row.name} ${row.phone || ''} ${row.project_name || ''}`.toLowerCase().includes(query.toLowerCase()));

  function requireUnlock(): boolean { if (isUnlocked) return true; setShowLock(true); return false; }
  function openCreate(type: 'invoice' | 'quotation') { if (!requireUnlock()) return; setEditingDocument(null); setDocumentType(type); setModal('document'); }
  async function openEdit(type: 'invoice' | 'quotation', document: Document) {
    if (!requireUnlock()) return;
    const table = type === 'invoice' ? 'invoice_items' : 'quotation_items';
    const key = type === 'invoice' ? 'invoice_id' : 'quotation_id';
    const { data, error } = await supabase.from(table).select('description, unit, quantity, rate').eq(key, document.id);
    if (error) { setNotice('Unable to load this document for editing'); return; }
    setEditingDocument({ document, lines: data || [], customer: customers.find((row) => row.id === document.customer_id) || null });
    setDocumentType(type);
    setModal('document');
  }
  async function openPreview(type: 'invoice' | 'quotation', document: Document) {
    if (!requireUnlock()) return;
    const table = type === 'invoice' ? 'invoice_items' : 'quotation_items';
    const key = type === 'invoice' ? 'invoice_id' : 'quotation_id';
    const { data, error } = await supabase.from(table).select('description, unit, quantity, rate').eq(key, document.id);
    if (error) { setNotice('Unable to load this document'); return; }
    const customer = customers.find((row) => row.id === document.customer_id) || null;
    setPreview({ type, document, lines: data || [], customer });
    setModal('preview');
  }
  async function deleteCustomer(customer: Customer) { if (!window.confirm(`Delete ${customer.name}?`)) return; setCustomers((current) => current.filter((c) => c.id !== customer.id)); const { error } = await supabase.from('customers').update({ is_deleted: true }).eq('id', customer.id); if (error) { void loadData(); setNotice('Unable to delete customer'); } else setNotice('Customer removed'); }
  async function saveCustomer(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); const { error } = await supabase.from('customers').insert(data); if (error) setNotice(error.message); else { setModal(null); setNotice('Customer added'); void loadData(); } }
  async function saveLabourer(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); const payload = { name: data.name, role: data.role || null, phone: data.phone || null, daily_wage: Number(data.daily_wage), weekly_incentive: Number(data.weekly_incentive || 0) }; const { error } = await supabase.from('labourers').insert(payload); if (error) setNotice(error.message); else { setModal(null); setNotice('Labourer added'); void loadData(); } }
  async function deleteLabourer(labourer: Labourer) { if (!window.confirm(`Remove ${labourer.name}?`)) return; setLabourers((current) => current.filter((l) => l.id !== labourer.id)); const { error } = await supabase.from('labourers').update({ is_deleted: true }).eq('id', labourer.id); if (error) { void loadData(); setNotice('Unable to remove labourer'); } else setNotice('Labourer removed'); }
  async function togglePayment(payment: LabourPayment) { const newPaid = !payment.paid; setLabourers((current) => current.map((l) => ({ ...l, payments: l.payments.map((p) => p.id === payment.id ? { ...p, paid: newPaid } : p) }))); const { error } = await supabase.from('labour_payments').update({ paid: newPaid }).eq('id', payment.id); if (error) { void loadData(); setNotice('Unable to update payment'); } else setNotice(newPaid ? 'Marked paid' : 'Marked unpaid'); }
  async function deletePayment(payment: LabourPayment) { if (!window.confirm('Delete this payment entry?')) return; setLabourers((current) => current.map((l) => ({ ...l, payments: l.payments.filter((p) => p.id !== payment.id) }))); const { error } = await supabase.from('labour_payments').delete().eq('id', payment.id); if (error) { void loadData(); setNotice('Unable to delete payment'); } else setNotice('Payment entry deleted'); }
  async function unlockWeek(record: AttendanceRecord) {
    const linked = labourers.flatMap((l) => l.payments).find((p) => p.labourer_id === record.labourer_id && p.week_ending === record.week_ending);
    if (linked && linked.paid) { setNotice('This week is already paid, so it cannot be changed'); return; }
    if (!window.confirm('Make changes to this week? The payment entry for this week will be removed so you can update the attendance.')) return;
    setLabourers((current) => current.map((l) => ({ ...l, attendance: l.attendance.map((r) => r.id === record.id ? { ...r, settled: false } : r), payments: linked ? l.payments.filter((p) => p.id !== linked.id) : l.payments })));
    if (linked) { await supabase.from('labour_payments').delete().eq('id', linked.id); }
    const { error } = await supabase.from('labour_attendance').update({ settled: false }).eq('id', record.id);
    if (error) { void loadData(); setNotice('Could not open this week for changes'); return; }
    setNotice('Week opened for changes');
    void loadData();
  }
  async function markInvoicePaid(doc: Document, paid: boolean) {
    const grand = Number(doc.grand_total || 0);
    const payload = paid
      ? { status: 'Paid', amount_paid: grand, balance_due: 0 }
      : { status: 'Unpaid', amount_paid: 0, balance_due: grand };
    setInvoices((current) => current.map((row) => row.id === doc.id ? { ...row, ...payload } : row));
    if (preview) setPreview({ ...preview, document: { ...doc, ...payload } });
    const { error } = await supabase.from('invoices').update(payload).eq('id', doc.id);
    if (error) { void loadData(); setNotice('Unable to update invoice'); return; }
    setNotice(paid ? 'Invoice marked as paid' : 'Invoice marked as unpaid');
    void loadData();
  }
  async function recordPayment(doc: Document, amount: number) {
    const grand = Number(doc.grand_total || 0);
    const currentPaid = Number(doc.amount_paid || 0);
    const newPaid = currentPaid + amount;
    const newBalance = Math.max(0, grand - newPaid);
    const status = newBalance <= 0 ? 'Paid' : 'Partial';
    const payload = { amount_paid: newPaid, balance_due: newBalance, status };
    setInvoices((current) => current.map((row) => row.id === doc.id ? { ...row, ...payload } : row));
    if (preview) setPreview({ ...preview, document: { ...doc, ...payload } });
    const { error } = await supabase.from('invoices').update(payload).eq('id', doc.id);
    if (error) { void loadData(); setNotice('Unable to record payment'); return; }
    setNotice(`Payment of ${money(amount)} recorded`);
    void loadData();
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><img src="/image copy 2.png" alt="Shri Tirupati logo" /></div><div><strong>TIRUPATI</strong><span>PLUMBING CONTRACTOR</span></div><button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={20} /></button></div>
      <div className="workspace"><span>WORKSPACE</span><button>Washim office <ChevronDown size={14} /></button></div>
      <nav>{nav.map(([label, Icon]) => <button key={label} className={view === label ? 'active' : ''} onClick={() => { setView(label); setMobileOpen(false); }}><Icon size={18} /><span>{label}</span>{label === 'Invoices' && invoices.filter((invoice) => invoice.status === 'Unpaid').length > 0 ? <em>{invoices.filter((invoice) => invoice.status === 'Unpaid').length}</em> : null}</button>)}</nav>
      <div className="sidebar-footer"><div className="avatar">BP</div><div><strong>Bandu S. Pathe</strong><small>Proprietor</small></div>{isUnlocked && <button onClick={() => { void supabase.auth.signOut(); }} title="Lock invoices & quotations"><Lock size={17} /></button>}<button onClick={() => setView('Settings')}><Settings size={17} /></button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><button className="menu-button" onClick={() => setMobileOpen(true)}><Menu size={22} /></button><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{view}</strong></div><div className="top-actions"><div className="search-global"><Search size={17} /><input placeholder="Search anything..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><button className="round-button"><CalendarDays size={18} /></button><div className="profile-chip"><div className="avatar small">BP</div><span>Bandu Pathe</span><ChevronDown size={14} /></div></div></header>
      {notice && <div className="toast">{notice}</div>}
      <div className="page-content">

        {view === 'Customers' && <section><PageHeading title="Customers" description="Keep your client and project information organized." action="Add customer" onAction={() => setModal('customer')} /><div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder="Search name, phone or project" value={query} onChange={(event) => setQuery(event.target.value)} /></div></div><div className="table-card"><table><thead><tr><th>Customer</th><th>Project</th><th>Contact</th><th>Location</th><th>Added</th><th></th></tr></thead><tbody>{filteredCustomers.map((customer) => <tr className="clickable-row" key={customer.id} onClick={() => { setSelectedCustomer(customer); setModal('customerProfile'); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedCustomer(customer); setModal('customerProfile'); } }} tabIndex={0}><td><div className="person-cell"><div className="person-avatar">{customer.name.slice(0, 2).toUpperCase()}</div><div><strong>{customer.name}</strong><small>{customer.email || 'No email added'}</small></div></div></td><td>{customer.project_name || '—'}</td><td>{customer.phone || '—'}</td><td>{[customer.city, customer.state].filter(Boolean).join(', ') || '—'}</td><td>{dateLabel(customer.created_at)}</td><td><button className="icon-button danger" onClick={(event) => { event.stopPropagation(); void deleteCustomer(customer); }}><Trash2 size={16} /></button></td></tr>)}</tbody></table>{filteredCustomers.length === 0 && <EmptyState title="No customers found" text="Add your first customer to start billing." />}</div></section>}
        {view === 'Quotations' && <DocumentList type="quotation" documents={quotations} query={query} setQuery={setQuery} onCreate={() => openCreate('quotation')} onView={openPreview} onEdit={openEdit} />}
        {view === 'Invoices' && <DocumentList type="invoice" documents={invoices} query={query} setQuery={setQuery} onCreate={() => openCreate('invoice')} onView={openPreview} onEdit={openEdit} />}
        {view === 'Labour' && <LabourView labourers={labourers} query={query} setQuery={setQuery} onAddLabourer={() => setModal('labourer')} onDeleteLabourer={deleteLabourer} onReload={loadData} onNotify={setNotice} unlockWeek={unlockWeek} onTogglePayment={togglePayment} onDeletePayment={deletePayment} />}
        {view === 'Settings' && settings && <SettingsPage settings={settings} onSaved={() => { setNotice('Settings saved'); void loadData(); }} />}
      </div>
    </main>
    {modal === 'customer' && <Modal title="Add customer" onClose={() => setModal(null)}><CustomerForm onSubmit={saveCustomer} /></Modal>}
    {modal === 'customerProfile' && selectedCustomer && <Modal title="Customer profile" onClose={() => { setModal(null); setSelectedCustomer(null); }}><CustomerProfile customer={selectedCustomer} /></Modal>}
    {modal === 'labourer' && <Modal title="Add labourer" onClose={() => setModal(null)}><LabourerForm onSubmit={saveLabourer} /></Modal>}
    {modal === 'document' && <Modal wide title={editingDocument ? `Edit ${documentType === 'invoice' ? 'invoice' : 'quotation'}` : documentType === 'invoice' ? 'Create invoice' : 'Create quotation'} onClose={() => { setModal(null); setEditingDocument(null); }}><DocumentForm type={documentType} settings={settings} invoiceCount={invoices.length} quotationCount={quotations.length} editing={editingDocument} onSaved={() => { setModal(null); setEditingDocument(null); setNotice(`${documentType === 'invoice' ? 'Invoice' : 'Quotation'} ${editingDocument ? 'updated' : 'saved'}`); void loadData(); }} /></Modal>}
    {modal === 'preview' && preview && <Modal wide title={`${preview.type === 'invoice' ? 'Invoice' : 'Quotation'} preview`} onClose={() => setModal(null)}><DocumentPreview data={preview} settings={settings} onMarkPaid={preview.type === 'invoice' ? markInvoicePaid : undefined} onRecordPayment={preview.type === 'invoice' ? recordPayment : undefined} /></Modal>}
    {showLock && <LockScreen email={LOCK_EMAIL} isUnlocked={isUnlocked} recoveryMode={recoveryMode} onUnlock={() => setShowLock(false)} onRecoveryDone={() => { setRecoveryMode(false); setShowLock(false); setNotice('Password updated — you are unlocked'); }} onCancel={() => { setShowLock(false); setRecoveryMode(false); }} />}
  </div>;
}

function LockScreen({ email, isUnlocked, recoveryMode, onUnlock, onRecoveryDone, onCancel }: { email: string; isUnlocked: boolean; recoveryMode: boolean; onUnlock: () => void; onRecoveryDone: () => void; onCancel: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => { if (recoveryMode) { setMode('signin'); setError(''); setInfo('A password reset was requested. Sign in with your new password below.'); } }, [recoveryMode]);
  useEffect(() => { if (isUnlocked) { setMode('signin'); setPassword(''); setError(''); setInfo(''); } }, [isUnlocked]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setInfo('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) { setError(err.message.includes('Invalid login') ? 'Wrong password. Try again or use "Forgot password" to reset.' : err.message); return; }
    setPassword(''); onUnlock();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setInfo('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); setBusy(false); return; }
    const { error: err } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setInfo('Account created! You can now sign in with your password.');
    setPassword(''); setMode('signin');
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setInfo('');
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reset-link`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'X-Client-Info': 'billing-app',
        },
        body: JSON.stringify({ email, redirectUrl: `${window.location.origin}${window.location.pathname}` }),
      });
      const result = await response.json();
      setBusy(false);
      if (!response.ok) { setError(result.error || 'Something went wrong. Please try again.'); return; }
      setInfo(`A reset link has been sent to ${email}. Open it soon, while this app is available, and check your spam folder if needed.`);
    } catch {
      setBusy(false);
      setError('Network error. Please check your connection and try again.');
    }
  }

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); setBusy(false); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); setBusy(false); return; }
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (err) { setError(err.message.includes('expired') || err.message.includes('invalid') ? 'This reset link has expired. Request a new link and open the newest email.' : err.message); return; }
    window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}`);
    setNewPassword(''); setConfirmPassword(''); onRecoveryDone();
  }

  if (recoveryMode) {
    return <div className="modal-backdrop"><div className="lock-card"><div className="lock-icon"><Lock size={28} /></div><h2>Set a new password</h2><p className="lock-subtitle">Choose your new password for {email}</p><form className="lock-form" onSubmit={handleRecovery}><input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoFocus /><input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /><button className="button primary lock-submit" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Update password & unlock'}</button>{error && <p className="lock-error">{error}</p>}</form></div></div>;
  }

  return <div className="modal-backdrop"><div className="lock-card"><div className="lock-icon"><Lock size={28} /></div><h2>{mode === 'signup' ? 'Create password' : mode === 'forgot' ? 'Reset password' : 'Enter password'}</h2><p className="lock-subtitle">{mode === 'signup' ? 'Set a password to protect your invoices and quotations.' : mode === 'forgot' ? `We'll send a reset link to ${email}` : 'Enter your password to view or edit'}</p>
    {mode === 'signin' && <form className="lock-form" onSubmit={handleSignIn}><input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus /><button className="button primary lock-submit" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Unlock'}</button>{error && <p className="lock-error">{error}</p>}<div className="lock-links"><button type="button" className="text-button" onClick={() => { setMode('signup'); setError(''); setInfo(''); }}>Create password</button><button type="button" className="text-button" onClick={() => { setMode('forgot'); setError(''); setInfo(''); }}>Forgot password?</button></div></form>}
    {mode === 'signup' && <form className="lock-form" onSubmit={handleSignUp}><input type="password" placeholder="Choose a password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus /><button className="button primary lock-submit" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create password'}</button>{error && <p className="lock-error">{error}</p>}{info && <p className="lock-info">{info}</p>}<div className="lock-links"><button type="button" className="text-button" onClick={() => { setMode('signin'); setError(''); setInfo(''); }}>Back to sign in</button></div></form>}
    {mode === 'forgot' && <form className="lock-form" onSubmit={handleForgot}><p className="lock-info">{info}</p><button className="button primary lock-submit" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>{error && <p className="lock-error">{error}</p>}<div className="lock-links"><button type="button" className="text-button" onClick={() => { setMode('signin'); setError(''); setInfo(''); }}>Back to sign in</button></div></form>}
    <button className="text-button lock-cancel" onClick={onCancel}>Cancel</button>
  </div></div>;
}

function Dashboard({ invoices, quotations, totals, onCreate, onNavigate }: { invoices: Document[]; quotations: Document[]; totals: { invoiceAmount: number; quotationAmount: number; paid: number; pending: number }; onCreate: (type: 'invoice' | 'quotation') => void; onNavigate: (view: View) => void }) { return <section><div className="welcome"><div><p className="eyebrow">TODAY</p><h1>Welcome back, Bandu.</h1><p className="muted">Here's what's happening with your business.</p></div><div className="welcome-actions"><button className="button secondary" onClick={() => onCreate('quotation')}><Plus size={17} /> New quotation</button><button className="button primary" onClick={() => onCreate('invoice')}><Plus size={17} /> New invoice</button></div></div><div className="metric-grid"><Metric label="Total billing" value={money(totals.invoiceAmount)} change={`${invoices.length} invoices`} icon={ReceiptIndianRupee} tone="blue" /><Metric label="Outstanding" value={money(totals.pending)} change="Needs attention" icon={CircleDollarSign} tone="amber" /><Metric label="Collected" value={money(totals.paid)} change="Paid to date" icon={FileText} tone="green" /><Metric label="Quotation value" value={money(totals.quotationAmount)} change={`${quotations.length} quotations`} icon={FileText} tone="slate" /></div><div className="dashboard-grid"><div className="chart-card"><div className="card-heading"><div><h3>Billing overview</h3><p>Invoice and quotation value over the last 6 months</p></div><button className="filter-button">Last 6 months <ChevronDown size={14} /></button></div><div className="chart"><div className="y-axis"><span>₹2L</span><span>₹1.5L</span><span>₹1L</span><span>₹50K</span><span>₹0</span></div><div className="bars">{['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'].map((month, index) => <div className="bar-group" key={month}><div className="bar invoice" style={{ height: `${[38, 52, 45, 68, 58, 78][index]}%` }} /><div className="bar quote" style={{ height: `${[25, 38, 30, 46, 40, 55][index]}%` }} /><span>{month}</span></div>)}</div></div><div className="legend"><span><i className="dot blue" /> Invoices</span><span><i className="dot teal" /> Quotations</span></div></div><div className="side-card"><div className="card-heading"><div><h3>Recent activity</h3><p>Your latest documents</p></div><button className="text-button" onClick={() => onNavigate('Invoices')}>View all</button></div><div className="activity-list">{[...invoices.slice(0, 3), ...quotations.slice(0, 2)].slice(0, 4).map((doc) => <div className="activity-row" key={doc.id}><div className="activity-icon"><FileText size={16} /></div><div><strong>{doc.invoice_number || doc.quotation_number}</strong><small>{doc.customers?.name || 'Walk-in customer'} · {dateLabel(doc.invoice_date || doc.quotation_date)}</small></div><b>{money(doc.grand_total)}</b></div>)}{invoices.length + quotations.length === 0 && <EmptyState title="No activity yet" text="Your saved documents will appear here." />}</div></div></div><div className="quick-section"><div className="card-heading"><div><h3>Quick actions</h3><p>Common tasks for your workday</p></div></div><div className="quick-grid"><button onClick={() => onCreate('invoice')}><ReceiptIndianRupee size={20} /><span><strong>Create invoice</strong><small>Bill a completed job</small></span><Plus size={16} /></button><button onClick={() => onCreate('quotation')}><FileText size={20} /><span><strong>Create quotation</strong><small>Send a new estimate</small></span><Plus size={16} /></button><button onClick={() => onNavigate('Customers')}><Users size={20} /><span><strong>Add customer</strong><small>Save client details</small></span><Plus size={16} /></button></div></div></section> }
function Metric({ label, value, change, icon: Icon, tone }: { label: string; value: string; change: string; icon: typeof FileText; tone: string }) { return <div className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={19} /></div><span>{label}</span><strong>{value}</strong><small>{change}</small></div> }
function PageHeading({ title, description, action, onAction }: { title: string; description: string; action: string; onAction: () => void }) { return <div className="page-heading"><div><p className="eyebrow">MANAGE</p><h1>{title}</h1><p className="muted">{description}</p></div><button className="button primary" onClick={onAction}><Plus size={17} /> {action}</button></div> }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="empty-state"><BookOpen size={25} /><strong>{title}</strong><span>{text}</span></div> }
function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) { return <div className="modal-backdrop"><div className={`modal ${wide ? 'wide' : ''}`}><div className="modal-header"><h2>{title}</h2><button onClick={onClose}><X size={19} /></button></div>{children}</div></div> }
function CustomerProfile({ customer }: { customer: Customer }) { return <div className="customer-profile"><div className="profile-hero"><div className="person-avatar large">{customer.name.slice(0, 2).toUpperCase()}</div><div><h3>{customer.name}</h3><p>{customer.project_name || 'Customer'}</p></div></div><div className="profile-details customer-details"><div><span>Phone</span><strong>{customer.phone || 'Not added'}</strong></div><div><span>Email</span><strong>{customer.email || 'Not added'}</strong></div><div><span>Location</span><strong>{[customer.city, customer.state].filter(Boolean).join(', ') || 'Not added'}</strong></div><div><span>PIN code</span><strong>{customer.pincode || 'Not added'}</strong></div></div><div className="customer-profile-section"><span>Address</span><p>{customer.address || 'No address added.'}</p></div>{customer.gst_number && <div className="customer-profile-section"><span>GST number</span><p>{customer.gst_number}</p></div>}{customer.notes && <div className="customer-profile-section"><span>Notes</span><p>{customer.notes}</p></div>}</div>; }

function CustomerForm({ onSubmit }: { onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) { return <form className="form-grid" onSubmit={onSubmit}><label>Customer name *<input name="name" required placeholder="e.g. Anil Kad" /></label><label>Project / property<input name="project_name" placeholder="e.g. Kad residence" /></label><label className="full">Address<input name="address" placeholder="Street and building details" /></label><label>City<input name="city" placeholder="Washim" /></label><label>State<input name="state" placeholder="Maharashtra" /></label><label>PIN code<input name="pincode" inputMode="numeric" /></label><label>Mobile number<input name="phone" inputMode="tel" /></label><label>Email<input name="email" type="email" /></label><label>GST number<input name="gst_number" /></label><label className="full">Notes<textarea name="notes" rows={3} /></label><div className="form-actions full"><button type="submit" className="button primary">Save customer</button></div></form> }
function DocumentList({ type, documents, query, setQuery, onCreate, onView, onEdit }: { type: 'invoice' | 'quotation'; documents: Document[]; query: string; setQuery: (value: string) => void; onCreate: () => void; onView: (type: 'invoice' | 'quotation', document: Document) => void; onEdit: (type: 'invoice' | 'quotation', document: Document) => void }) { const filtered = documents.filter((row) => `${row.invoice_number || row.quotation_number} ${row.customers?.name || ''} ${row.status}`.toLowerCase().includes(query.toLowerCase())); return <section><PageHeading title={type === 'invoice' ? 'Invoices' : 'Quotations'} description={type === 'invoice' ? 'Create, track and collect payment for every job.' : 'Prepare clear estimates and win more work.'} action={type === 'invoice' ? 'Create invoice' : 'Create quotation'} onAction={onCreate} /><div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder={`Search ${type}s`} value={query} onChange={(event) => setQuery(event.target.value)} /></div></div><div className="table-card"><table><thead><tr><th>Document</th><th>Customer</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>{filtered.map((row) => <tr className="clickable-row" key={row.id} onClick={() => void onView(type, row)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void onView(type, row); } }} tabIndex={0}><td><button className="document-link" onClick={(event) => { event.stopPropagation(); void onView(type, row); }}>{row.invoice_number || row.quotation_number}</button><small className="table-subtext">{row.customers?.project_name || 'No project'}</small></td><td>{row.customers?.name || 'No customer'}</td><td>{dateLabel(row.invoice_date || row.quotation_date)}</td><td><span className={`status ${row.status.toLowerCase().replace(' ', '-')}`}>{row.status}</span></td><td><div className="row-actions"><button className="text-button" onClick={(event) => { event.stopPropagation(); void onEdit(type, row); }}>Edit</button><button className="text-button" onClick={(event) => { event.stopPropagation(); void onView(type, row); }}>View</button></div></td></tr>)}</tbody></table>{filtered.length === 0 && <EmptyState title={`No ${type}s yet`} text={`Create your first ${type} to see it here.`} />}</div></section> }
function SettingsPage({ settings, onSaved }: { settings: SettingsData; onSaved: () => void }) { const [form, setForm] = useState(settings); useEffect(() => setForm(settings), [settings]); async function save(event: React.FormEvent) { event.preventDefault(); const { error } = await supabase.from('company_settings').update(form).eq('id', form.id); if (!error) onSaved(); } return <section><div className="page-heading"><div><p className="eyebrow">WORKSPACE</p><h1>Settings</h1><p className="muted">Keep your company identity and billing preferences current.</p></div></div><form className="settings-form" onSubmit={save}><div className="settings-card"><div className="card-heading"><div><h3>Company details</h3><p>Shown on your invoices and quotations.</p></div></div><div className="form-grid"><label>Company name<input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></label><label>Proprietor name<input value={form.proprietor_name} onChange={(e) => setForm({ ...form, proprietor_name: e.target.value })} /></label><label className="full">Business address<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label><label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label>Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label></div></div><div className="settings-card"><div className="card-heading"><div><h3>Document preferences</h3><p>Choose how new documents are numbered.</p></div></div><div className="form-grid"><label>Invoice prefix<input value={form.invoice_prefix} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })} /></label><label>Quotation prefix<input value={form.quotation_prefix} onChange={(e) => setForm({ ...form, quotation_prefix: e.target.value })} /></label><label>Default tax (%)<input type="number" onFocus={selectZeroOnFocus} value={form.default_tax} onChange={(e) => setForm({ ...form, default_tax: Number(e.target.value) })} /></label><label>Currency<input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></label><label className="full">Invoice footer<textarea rows={3} value={form.default_footer} onChange={(e) => setForm({ ...form, default_footer: e.target.value })} /></label><label className="full">Trust text<input value={form.trust_text} onChange={(e) => setForm({ ...form, trust_text: e.target.value })} /></label></div></div><button className="button primary" type="submit">Save settings</button></form></section> }
function DocumentPreview({ data, settings, onMarkPaid, onRecordPayment }: { data: PreviewData; settings: SettingsData | null; onMarkPaid?: (doc: Document, paid: boolean) => void; onRecordPayment?: (doc: Document, amount: number) => void }) {
  const { type, document: doc, lines, customer } = data;
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const number = doc.invoice_number || doc.quotation_number || '';
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.rate, 0);
  const grand = Number(doc.grand_total || 0);
  const tax = Math.max(0, grand - subtotal + Number(doc.discount || 0));
  const balance = type === 'invoice' ? Number(doc.balance_due || 0) : 0;
  const isPaid = type === 'invoice' && doc.status === 'Paid';
  const isPartial = type === 'invoice' && doc.status === 'Partial';
  const name = customer?.name || doc.customers?.name || 'Walk-in customer';
  const project = customer?.project_name || doc.customers?.project_name || null;
  const address = customer?.address || doc.customers?.address || null;
  const phone = customer?.phone || doc.customers?.phone || null;
  const gst = customer?.gst_number || doc.customers?.gst_number || null;
  function submitPayment(e: React.FormEvent) { e.preventDefault(); if (paymentAmount > 0 && onRecordPayment) { onRecordPayment(doc, paymentAmount); setShowPayment(false); setPaymentAmount(0); } }
  return <div className="preview-shell"><div className="preview-actions">{onMarkPaid && (isPaid ? <button className="button secondary" onClick={() => onMarkPaid(doc, false)}><X size={16} /> Mark unpaid</button> : <button className="button success" onClick={() => onMarkPaid(doc, true)}><Check size={16} /> Mark as paid</button>)}{onRecordPayment && !isPaid && <button className="button secondary" onClick={() => setShowPayment(!showPayment)}><CircleDollarSign size={16} /> Record payment</button>}<button className="button secondary" onClick={() => window.print()}><Printer size={16} /> Print</button></div>{showPayment && <form className="payment-inline-form" onSubmit={submitPayment}><label>Payment amount<input type="number" onFocus={selectZeroOnFocus} min="1" max={balance} value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} required autoFocus /></label><button type="submit" className="button primary">Add payment</button><button type="button" className="button secondary" onClick={() => { setShowPayment(false); setPaymentAmount(0); }}>Cancel</button><small>Balance due: {money(balance)}</small></form>}
    <div className="a4-sheet" id="document-print">
      {isPaid && <div className="paid-stamp">PAID</div>}
      <header className="doc-header"><div className="doc-company"><img src="/image copy 2.png" alt="Shri Tirupati logo" /><div><h1>{settings?.company_name || 'SHRI TIRUPATI PLUMBING CONTRACTOR'}</h1><p>PRO. {settings?.proprietor_name || 'BANDUBHAU PATHE'}</p><p>{settings?.address || 'SHRI DR ANIL KAD SIR WASHIM'}</p><p>MOB. {settings?.phone || '9766677051'}</p></div></div><div className="doc-type-badge"><strong>{type === 'invoice' ? 'INVOICE' : 'QUOTATION'}</strong><span>{number}</span>{isPaid && <em className="paid-tag">PAID</em>}{isPartial && <em className="partial-tag">PARTIAL</em>}</div></header>
      <section className="doc-meta"><div><span className="doc-label">{type === 'invoice' ? 'Invoice date' : 'Quotation date'}</span><strong>{dateLabel(doc.invoice_date || doc.quotation_date)}</strong></div>{type === 'invoice' && <div><span className="doc-label">Due date</span><strong>{dateLabel(doc.due_date)}</strong></div>}{type === 'quotation' && <div><span className="doc-label">Valid until</span><strong>{dateLabel(doc.valid_until)}</strong></div>}<div><span className="doc-label">Status</span><span className={`status ${doc.status.toLowerCase().replace(' ', '-')}`}>{doc.status}</span></div></section>
      <section className="doc-party"><div><span className="doc-label">Billed to</span><strong>{name}</strong>{project && <p>{project}</p>}{address && <p>{address}</p>}{phone && <p>Ph: {phone}</p>}{gst && <p>GST: {gst}</p>}</div></section>
      <table className="doc-table"><thead><tr><th className="sr">SR.</th><th className="desc">DESCRIPTION</th><th className="unit">UNIT</th><th className="qty">QTY</th><th className="rate">RATE</th><th className="amt">AMOUNT</th></tr></thead><tbody>{lines.map((line, index) => <tr key={index}><td className="sr">{index + 1}</td><td className="desc">{line.description}</td><td className="unit">{line.unit}</td><td className="qty">{line.quantity}</td><td className="rate">{money(line.rate)}</td><td className="amt">{money(line.quantity * line.rate)}</td></tr>)}</tbody></table>
      <section className="doc-totals"><div className="totals-rows"><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Discount</span><b>{money(Number(doc.discount || 0))}</b></div><div><span>Tax ({settings?.default_tax || 0}%)</span><b>{money(tax)}</b></div><div className="grand-row"><span>Grand total</span><strong>{money(grand)}</strong></div>{type === 'invoice' && <><div><span>Amount paid</span><b>{money(Number(doc.amount_paid || 0))}</b></div><div className="balance-row"><span>Balance due</span><strong>{money(balance)}</strong></div></>}</div></section>
      {doc.notes && <section className="doc-notes"><span className="doc-label">Notes & terms</span><p>{doc.notes}</p></section>}
      <footer className="doc-footer"><p>{settings?.default_footer || 'Thank you for choosing us.'}</p><small>{settings?.trust_text || '30 years of plumbing trust'}</small></footer>
    </div></div>;
}
const attendanceDays = [
  ['day_mon', 'Mon'], ['day_tue', 'Tue'], ['day_wed', 'Wed'], ['day_thu', 'Thu'], ['day_fri', 'Fri'], ['day_sat', 'Sat'], ['day_sun', 'Sun'],
] as const;
type AttendanceDayKey = typeof attendanceDays[number][0];

function upcomingSunday(value: string) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + ((7 - date.getDay()) % 7));
  return date.toISOString().slice(0, 10);
}
function weekRangeLabel(weekEnding: string) {
  const end = new Date(`${weekEnding}T12:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function LabourView({ labourers, query, setQuery, onAddLabourer, onDeleteLabourer, onReload, onNotify, unlockWeek, onTogglePayment, onDeletePayment }: { labourers: LabourerWithPayments[]; query: string; setQuery: (value: string) => void; onAddLabourer: () => void; onDeleteLabourer: (labourer: Labourer) => void; onReload: () => void; onNotify: (msg: string) => void; unlockWeek: (record: AttendanceRecord) => void; onTogglePayment: (payment: LabourPayment) => void; onDeletePayment: (payment: LabourPayment) => void }) {
  const [weekEnding, setWeekEnding] = useState(upcomingSunday(today));
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [attendanceOverrides, setAttendanceOverrides] = useState<Record<string, AttendanceRecord>>({});
  const filtered = labourers.filter((row) => `${row.name} ${row.role || ''} ${row.phone || ''}`.toLowerCase().includes(query.toLowerCase()));
  const attendanceKey = (labourerId: string, ending: string) => `${labourerId}:${ending}`;
  const currentAttendance = (labourer: LabourerWithPayments) => attendanceOverrides[attendanceKey(labourer.id, weekEnding)] || labourer.attendance.find((r) => r.week_ending === weekEnding);
  const totalPaid = labourers.flatMap((l) => l.payments).filter((p) => p.paid).reduce((sum, p) => sum + Number(p.amount), 0);
  const totalUnpaid = labourers.flatMap((l) => l.payments).filter((p) => !p.paid).reduce((sum, p) => sum + Number(p.amount), 0);

  async function toggleDay(labourer: LabourerWithPayments, day: AttendanceDayKey) {
    const record = currentAttendance(labourer);
    if (record?.settled) { onNotify('This week is already saved. Open it from past weeks to make changes.'); return; }
    const days: Record<AttendanceDayKey, boolean> = { day_mon: false, day_tue: false, day_wed: false, day_thu: false, day_fri: false, day_sat: false, day_sun: false };
    attendanceDays.forEach(([key]) => { (days as Record<string, boolean>)[key] = record?.[key] ?? true; });
    days[day] = !days[day];
    const present = Object.values(days).filter(Boolean).length;
    const incentive = Number(record?.incentive ?? labourer.weekly_incentive ?? 0);
    const amount = present * Number(labourer.daily_wage || 0) + (present === attendanceDays.length ? incentive : 0);
    const optimisticRecord: AttendanceRecord = { id: record?.id || `optimistic-${labourer.id}-${weekEnding}`, labourer_id: labourer.id, week_ending: weekEnding, ...days, incentive, amount, settled: record?.settled || false, notes: record?.notes || null };
    const key = attendanceKey(labourer.id, weekEnding);
    setAttendanceOverrides((current) => ({ ...current, [key]: optimisticRecord }));
    const { error } = await supabase.from('labour_attendance').upsert({ labourer_id: labourer.id, week_ending: weekEnding, ...days, incentive, amount, settled: record?.settled || false }, { onConflict: 'labourer_id,week_ending' });
    if (error) { setAttendanceOverrides((current) => { const next = { ...current }; delete next[key]; return next; }); onNotify('Unable to update attendance'); return; }
    void onReload();
  }

  async function updateIncentive(labourer: LabourerWithPayments, incentive: number) {
    const record = currentAttendance(labourer);
    if (record?.settled) { onNotify('This week is already saved'); return; }
    const present = record ? attendanceDays.filter(([key]) => record[key]).length : attendanceDays.length;
    const amount = present * Number(labourer.daily_wage || 0) + (present === attendanceDays.length ? incentive : 0);
    const key = attendanceKey(labourer.id, weekEnding);
    const optimisticRecord: AttendanceRecord = { id: record?.id || `optimistic-${labourer.id}-${weekEnding}`, labourer_id: labourer.id, week_ending: weekEnding, day_mon: record?.day_mon ?? true, day_tue: record?.day_tue ?? true, day_wed: record?.day_wed ?? true, day_thu: record?.day_thu ?? true, day_fri: record?.day_fri ?? true, day_sat: record?.day_sat ?? true, day_sun: record?.day_sun ?? true, incentive, amount, settled: false, notes: record?.notes || null };
    setAttendanceOverrides((current) => ({ ...current, [key]: optimisticRecord }));
    const { error } = await supabase.from('labour_attendance').upsert({ labourer_id: labourer.id, week_ending: weekEnding, day_mon: record?.day_mon ?? true, day_tue: record?.day_tue ?? true, day_wed: record?.day_wed ?? true, day_thu: record?.day_thu ?? true, day_fri: record?.day_fri ?? true, day_sat: record?.day_sat ?? true, day_sun: record?.day_sun ?? true, incentive, amount, settled: false }, { onConflict: 'labourer_id,week_ending' });
    if (error) { setAttendanceOverrides((current) => { const next = { ...current }; delete next[key]; return next; }); onNotify('Unable to update bonus'); return; }
    void onReload();
  }

  async function settleWeek(labourer: LabourerWithPayments, markPaid: boolean) {
    const record = currentAttendance(labourer);
    if (!record || record.settled) return;
    const presentCount = attendanceDays.filter(([key]) => record[key]).length;
    if (presentCount === 0) { onNotify('Mark at least one day as came first'); return; }
    const present = attendanceDays.filter(([key]) => record[key]).map(([, label]) => label).join(', ');
    const key = attendanceKey(labourer.id, weekEnding);
    setAttendanceOverrides((current) => ({ ...current, [key]: { ...record, settled: true } }));
    const { error: payError } = await supabase.from('labour_payments').insert({ labourer_id: labourer.id, week_ending: weekEnding, amount: record.amount, paid: markPaid, notes: `Attendance: ${present}${record.incentive ? ` + incentive ${money(record.incentive)}` : ''}` });
    if (payError) { setAttendanceOverrides((current) => ({ ...current, [key]: { ...record, settled: false } })); onNotify('Unable to save payment'); return; }
    const { error } = await supabase.from('labour_attendance').update({ settled: true }).eq('id', record.id);
    if (error) { setAttendanceOverrides((current) => ({ ...current, [key]: { ...record, settled: false } })); onNotify('Payment created but week could not be locked'); return; }
    onNotify(markPaid ? `Paid ${money(record.amount)} to ${labourer.name}` : 'Week saved — pay later from past weeks');
    void onReload();
  }

  const detailLabourer = detailFor ? labourers.find((l) => l.id === detailFor) || null : null;

  return <section><PageHeading title="Labour" description="Track workers and their weekly Sunday payments." action="Add labourer" onAction={onAddLabourer} /><div className="labour-summary"><div className="report-card"><span>Paid out</span><strong className="positive">{money(totalPaid)}</strong><small>Total wages paid</small></div><div className="report-card"><span>Pending wages</span><strong className="warning-text">{money(totalUnpaid)}</strong><small>Not yet paid</small></div><div className="report-card"><span>Workers</span><strong>{labourers.length}</strong><small>Active labourers</small></div></div><div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder="Search worker name or role" value={query} onChange={(event) => setQuery(event.target.value)} /></div></div>{filtered.map((labourer) => { const unpaid = labourer.payments.filter((p) => !p.paid).reduce((sum, p) => sum + Number(p.amount), 0); return <button className="labourer-row" key={labourer.id} onClick={() => setDetailFor(labourer.id)}><div className="person-cell"><div className="person-avatar"><HardHat size={18} /></div><div><strong>{labourer.name}</strong><small>{labourer.role || 'Worker'} · {money(labourer.daily_wage)}/day</small></div></div>{unpaid > 0 ? <span className="chip due">{money(unpaid)} due</span> : <span className="chip settled"><Check size={14} /> All settled</span>}</button>; })}{filtered.length === 0 && <div className="table-card"><EmptyState title="No workers found" text="Add a labourer to begin weekly attendance." /></div>}{detailLabourer && <Modal wide title="Worker details" onClose={() => setDetailFor(null)}><LabourerDetail labourer={detailLabourer} weekEnding={weekEnding} setWeekEnding={setWeekEnding} currentAttendance={currentAttendance} toggleDay={toggleDay} updateIncentive={updateIncentive} settleWeek={settleWeek} onTogglePayment={onTogglePayment} onDeletePayment={onDeletePayment} onUnlockWeek={unlockWeek} onDeleteLabourer={onDeleteLabourer} /></Modal>}</section>;
}

function LabourerDetail({ labourer, weekEnding, setWeekEnding, currentAttendance, toggleDay, updateIncentive, settleWeek, onTogglePayment, onDeletePayment, onUnlockWeek, onDeleteLabourer }: { labourer: LabourerWithPayments; weekEnding: string; setWeekEnding: (v: string) => void; currentAttendance: (l: LabourerWithPayments) => AttendanceRecord | undefined; toggleDay: (l: LabourerWithPayments, d: AttendanceDayKey) => void; updateIncentive: (l: LabourerWithPayments, incentive: number) => void; settleWeek: (l: LabourerWithPayments, markPaid: boolean) => void; onTogglePayment: (payment: LabourPayment) => void; onDeletePayment: (payment: LabourPayment) => void; onUnlockWeek: (record: AttendanceRecord) => void; onDeleteLabourer: (labourer: Labourer) => void }) {
  const record = currentAttendance(labourer);
  const present = record ? attendanceDays.filter(([key]) => record[key]).length : attendanceDays.length;
  const wage = present * Number(labourer.daily_wage || 0);
  const incentive = Number(record?.incentive ?? labourer.weekly_incentive ?? 0);
  const finalAmount = wage + (present === attendanceDays.length ? incentive : 0);
  const settled = record?.settled || false;
  const linkedPayment = labourer.payments.find((p) => p.week_ending === weekEnding);
  const isPaid = linkedPayment?.paid || false;
  const paidTotal = labourer.payments.filter((p) => p.paid).reduce((sum, p) => sum + Number(p.amount), 0);
  const owedTotal = labourer.payments.filter((p) => !p.paid).reduce((sum, p) => sum + Number(p.amount), 0);
  const pastPayments = [...labourer.payments].sort((a, b) => b.week_ending.localeCompare(a.week_ending));
  return <div className="labourer-detail">
    <div className="ld-header"><div className="person-cell"><div className="person-avatar large"><HardHat size={22} /></div><div><h3>{labourer.name}</h3><small>{labourer.role || 'Worker'} · {money(labourer.daily_wage)}/day · {labourer.phone || 'No phone'}</small></div></div><button className="icon-button danger" onClick={() => void onDeleteLabourer(labourer)}><Trash2 size={16} /></button></div>
    <div className="ld-strip"><div className="ld-strip-item"><span>Already paid</span><strong className="positive">{money(paidTotal)}</strong></div><div className="ld-strip-item"><span>Still owed</span><strong className="warning-text">{money(owedTotal)}</strong></div></div>
    <div className="ld-week-bar"><div><span className="eyebrow">THIS WEEK</span><strong>{weekRangeLabel(weekEnding)}</strong></div><label>Week ending (Sunday)<input type="date" value={weekEnding} onChange={(e) => setWeekEnding(upcomingSunday(e.target.value))} /></label></div>
    <div className="ld-days">{attendanceDays.map(([key, label]) => { const isPresent = record?.[key] ?? true; return <button className={`ld-day ${isPresent ? 'came' : 'absent'}`} key={key} onClick={() => void toggleDay(labourer, key)} disabled={settled}><span className="ld-day-label">{label}</span><span className="ld-day-state">{isPresent ? <><Check size={18} /> Came</> : <><X size={18} /> Absent</>}</span></button>; })}</div>
    <div className="ld-bonus"><label>Bonus this week (only if all 7 days present)<input type="number" onFocus={selectZeroOnFocus} min="0" value={incentive} onChange={(e) => void updateIncentive(labourer, Number(e.target.value))} disabled={settled} /></label></div>
    <div className="ld-salary-box"><span>Salary to pay this week</span><strong>{money(finalAmount)}</strong></div>
    {settled && isPaid ? <div className="ld-paid-badge"><Check size={18} /> Paid {money(linkedPayment!.amount)} for this week</div> : settled && !isPaid ? <div className="ld-mark-paid"><div className="ld-saved-notice">Week saved — not paid yet</div><button className="button primary ld-pay-now" onClick={() => void onTogglePayment(linkedPayment!)}>Pay {money(linkedPayment!.amount)} now</button></div> : <div className="ld-actions"><button className="button primary ld-pay-now" onClick={() => void settleWeek(labourer, true)} disabled={present === 0}>Pay {money(finalAmount)} now</button><button className="text-button ld-save-only" onClick={() => void settleWeek(labourer, false)}>Save without paying yet</button></div>}
    <div className="ld-history"><div className="profile-section-heading"><h4>Past weeks</h4><span>{pastPayments.length} entries</span></div>{pastPayments.length > 0 ? pastPayments.map((payment) => { const attRecord = labourer.attendance.find((r) => r.week_ending === payment.week_ending); const daysPresent = attRecord ? attendanceDays.filter(([key]) => attRecord[key]).length : null; return <div className="profile-payment-row" key={payment.id}><div><strong>{weekRangeLabel(payment.week_ending)}</strong><small>{daysPresent !== null ? `${daysPresent}/7 days present` : (payment.notes || 'Weekly payment')}</small>{attRecord?.settled && !payment.paid && <button className="text-button tiny" onClick={() => void onUnlockWeek(attRecord)}>Make changes</button>}</div><div className="profile-payment-actions"><strong>{money(payment.amount)}</strong><button className={`pay-toggle ${payment.paid ? 'paid' : 'unpaid'}`} onClick={() => void onTogglePayment(payment)}>{payment.paid ? <><Check size={15} /> Paid</> : <><X size={15} /> Unpaid</>}</button><button className="icon-button danger" onClick={() => void onDeletePayment(payment)}><Trash2 size={15} /></button></div></div>; }) : <div className="labour-empty">No past weeks yet.</div>}</div>
  </div>;
}

function LabourerForm({ onSubmit }: { onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) { return <form className="form-grid" onSubmit={onSubmit}><label className="full">Worker name *<input name="name" required placeholder="e.g. Ramesh" /></label><label>Role / trade<input name="role" placeholder="e.g. Plumber helper" /></label><label>Phone<input name="phone" inputMode="tel" /></label><label>Daily wage<input name="daily_wage" type="number" onFocus={selectZeroOnFocus} min="0" required defaultValue="0" /></label><label>Weekly incentive<input name="weekly_incentive" type="number" onFocus={selectZeroOnFocus} min="0" defaultValue="0" /><small className="field-help">Added when all six working days are present.</small></label><div className="form-actions full"><button type="submit" className="button primary">Save labourer</button></div></form>; }
function DocumentForm({ type, settings, invoiceCount, quotationCount, editing, onSaved }: { type: 'invoice' | 'quotation'; settings: SettingsData | null; invoiceCount: number; quotationCount: number; editing: { document: Document; lines: Line[]; customer: Customer | null } | null; onSaved: () => void }) {
  const [custName, setCustName] = useState(editing?.customer?.name || editing?.document.customers?.name || '');
  const [custProject, setCustProject] = useState(editing?.customer?.project_name || editing?.document.customers?.project_name || '');
  const [custAddress, setCustAddress] = useState(editing?.customer?.address || editing?.document.customers?.address || '');
  const [custPhone, setCustPhone] = useState(editing?.customer?.phone || editing?.document.customers?.phone || '');
  const [date, setDate] = useState(editing?.document.invoice_date || editing?.document.quotation_date || today);
  const [dueDate, setDueDate] = useState(editing?.document.due_date || editing?.document.valid_until || '');
  const [discount, setDiscount] = useState(Number(editing?.document.discount || 0));
  const [taxEnabled, setTaxEnabled] = useState(Number(editing?.document.tax || 0) > 0);
  const [lines, setLines] = useState<Line[]>(editing?.lines.length ? editing.lines : [{ description: '', unit: 'NOS.', quantity: 1, rate: 0 }]);
  const [notes, setNotes] = useState(editing?.document.notes || '');
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.rate, 0);
  const tax = taxEnabled ? subtotal * Number(settings?.default_tax || 0) / 100 : 0;
  const grand = subtotal - discount + tax;
  function updateLine(index: number, key: keyof Line, value: string | number) { setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line)); }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!custName.trim()) return;
    const isEditing = !!editing;
    let customerId = editing?.document.customer_id || null;
    if (isEditing && editing?.customer) {
      const { error: custErr } = await supabase.from('customers').update({ name: custName.trim(), project_name: custProject || null, address: custAddress || null, phone: custPhone || null }).eq('id', editing.customer.id);
      if (custErr) { setNotice('Unable to update customer'); return; }
    } else {
      const { data: customer, error: customerError } = await supabase.from('customers').insert({ name: custName.trim(), project_name: custProject || null, address: custAddress || null, phone: custPhone || null }).select('id').maybeSingle();
      if (customerError || !customer) return;
      customerId = customer.id;
    }
    const table = type === 'invoice' ? 'invoices' : 'quotations';
    const itemsTable = type === 'invoice' ? 'invoice_items' : 'quotation_items';
    const itemKey = type === 'invoice' ? 'invoice_id' : 'quotation_id';
    if (isEditing) {
      const docId = editing!.document.id;
      const updatePayload = type === 'invoice'
        ? { customer_id: customerId, invoice_date: date, due_date: dueDate || null, subtotal, discount, tax, round_off: 0, grand_total: grand, balance_due: Math.max(0, grand - Number(editing!.document.amount_paid || 0)), notes }
        : { customer_id: customerId, quotation_date: date, valid_until: dueDate || null, subtotal, discount, tax, grand_total: grand, notes, terms: [] };
      const { error: docError } = await supabase.from(table).update(updatePayload).eq('id', docId);
      if (docError) { setNotice('Unable to update document'); return; }
      await supabase.from(itemsTable).delete().eq(itemKey, docId);
      const rows = lines.filter((line) => line.description.trim()).map((line) => ({ [itemKey]: docId, description: line.description.trim(), unit: line.unit.trim() || 'NOS.', quantity: line.quantity, rate: line.rate, amount: line.quantity * line.rate }));
      if (rows.length) { const { error: lineError } = await supabase.from(itemsTable).insert(rows); if (lineError) { setNotice('Unable to update work items'); return; } }
      onSaved();
      return;
    }
    const existing = type === 'invoice' ? invoiceCount : quotationCount;
    const prefix = type === 'invoice' ? settings?.invoice_prefix || 'INV-' : settings?.quotation_prefix || 'QT-';
    const number = `${prefix}${String(existing + 1).padStart(4, '0')}`;
    const payload = type === 'invoice'
      ? { invoice_number: number, customer_id: customerId, invoice_date: date, due_date: dueDate || null, status: 'Unpaid', subtotal, discount, tax, round_off: 0, grand_total: grand, amount_paid: 0, balance_due: grand, notes }
      : { quotation_number: number, customer_id: customerId, quotation_date: date, valid_until: dueDate || null, status: 'Draft', subtotal, discount, tax, grand_total: grand, notes, terms: [] };
    const { data, error } = await supabase.from(table).insert(payload).select('id').maybeSingle();
    if (error || !data) return;
    const rows = lines.filter((line) => line.description.trim()).map((line) => ({ [itemKey]: data.id, description: line.description.trim(), unit: line.unit.trim() || 'NOS.', quantity: line.quantity, rate: line.rate, amount: line.quantity * line.rate }));
    const { error: lineError } = rows.length ? await supabase.from(itemsTable).insert(rows) : { error: null };
    if (lineError) return;
    onSaved();
  }
  return <form onSubmit={save} className="document-form"><div className="form-section-title">Customer details</div><div className="form-grid"><label>Customer name *<input value={custName} onChange={(e) => setCustName(e.target.value)} required placeholder="e.g. Anil Kad" /></label><label>Project / property<input value={custProject} onChange={(e) => setCustProject(e.target.value)} placeholder="e.g. Kad residence" /></label><label className="full">Address<input value={custAddress} onChange={(e) => setCustAddress(e.target.value)} placeholder="Site address" /></label><label>Phone<input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} inputMode="tel" placeholder="Mobile number" /></label><label>{type === 'invoice' ? 'Invoice date *' : 'Quotation date *'}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label><label>{type === 'invoice' ? 'Due date' : 'Valid until'}<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label></div><div className="line-items"><div className="line-header"><h3>Work items</h3><button type="button" className="text-button" onClick={() => setLines([...lines, { description: '', unit: 'NOS.', quantity: 1, rate: 0 }])}><Plus size={15} /> Add row</button></div>{lines.map((line, index) => <div className="line-row" key={index}><textarea className="desc-input" rows={1} placeholder="Description of work" value={line.description} onChange={(e) => updateLine(index, 'description', e.target.value)} required /><div className="mobile-field"><small>Unit</small><input className="unit-input" placeholder="Unit" value={line.unit} onChange={(e) => updateLine(index, 'unit', e.target.value)} /></div><div className="mobile-field"><small>Qty</small><input className="number-input" type="number" onFocus={selectZeroOnFocus} min="0" step="0.01" value={line.quantity} onChange={(e) => updateLine(index, 'quantity', Number(e.target.value))} /></div><div className="mobile-field"><small>Rate</small><input className="number-input" type="number" onFocus={selectZeroOnFocus} min="0" step="0.01" value={line.rate} onChange={(e) => updateLine(index, 'rate', Number(e.target.value))} /></div><div className="amount-row"><span>Amount</span><strong>{money(line.quantity * line.rate)}</strong></div>{lines.length > 1 && <button type="button" className="icon-button danger remove-row" onClick={() => setLines(lines.filter((_, lineIndex) => lineIndex !== index))}><Trash2 size={15} /></button>}</div>)}</div><div className="document-summary"><label>Notes / terms<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add work notes or terms" /></label><div className="totals-box"><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Discount</span><input type="number" onFocus={selectZeroOnFocus} min="0" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></div><label className="tax-toggle"><input type="checkbox" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} /> Add tax ({settings?.default_tax || 0}%)</label><div className="grand-total"><span>Grand total</span><strong>{money(grand)}</strong></div></div></div><div className="form-actions"><button className="button primary" type="submit">{editing ? 'Save changes' : `Save ${type}`}</button></div></form>;
}

export default App;
