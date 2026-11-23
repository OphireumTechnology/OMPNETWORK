import React, { useEffect, useState } from 'react';
import { X, UserRound, LayoutDashboard, ShoppingBag, LogOut, ShieldCheck, CreditCard, CircleAlert, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabaseService';

type CustomerOrder = {
  id: string;
  order_number: string;
  item_name: string;
  amount: number;
  currency: string;
  preferred_method: string;
  status: string;
  created_at: string;
};

interface CustomerCommercePortalProps {
  isOpen: boolean;
  onClose: () => void;
}

const paymentMethods = [
  { id: 'xendit', name: 'Xendit', detail: 'GCash, Maya, QR Ph and supported bank channels' },
  { id: 'paypal', name: 'PayPal', detail: 'International checkout' },
  { id: 'maya', name: 'Maya Checkout', detail: 'Maya merchant checkout' },
  { id: 'gotyme', name: 'GoTyme Bank', detail: 'Direct integration subject to approval' },
  { id: 'paymongo', name: 'PayMongo', detail: 'Available after merchant onboarding' },
];

export const CustomerCommercePortal: React.FC<CustomerCommercePortalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState({ full_name: '', phone: '', company_name: '' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [itemName, setItemName] = useState('AI Multimedia Service Package');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('PHP');
  const [method, setMethod] = useState('xendit');
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [tab, setTab] = useState<'dashboard' | 'checkout' | 'profile'>('dashboard');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [isOpen]);

  useEffect(() => {
    if (!session?.user || !supabase) return;
    void loadCustomerData();
  }, [session?.user?.id]);

  const loadCustomerData = async () => {
    if (!supabase || !session?.user) return;
    setBusy(true);
    setError('');
    const [profileResult, orderResult] = await Promise.all([
      supabase.from('client_profiles').select('full_name,phone,company_name').eq('auth_user_id', session.user.id).maybeSingle(),
      supabase.from('customer_orders').select('id,order_number,item_name,amount,currency,preferred_method,status,created_at').order('created_at', { ascending: false }).limit(25),
    ]);
    if (profileResult.data) setProfile({
      full_name: profileResult.data.full_name || '',
      phone: profileResult.data.phone || '',
      company_name: profileResult.data.company_name || '',
    });
    if (orderResult.error) setError('Customer order history is not available yet. Apply the customer commerce database migration.');
    else setOrders((orderResult.data || []) as CustomerOrder[]);
    setBusy(false);
  };

  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: profile.full_name, phone: profile.phone, company_name: profile.company_name } },
        });
        if (authError) throw authError;
        if (data.session) setSession(data.session);
        setNotice(data.session ? 'Account created. Complete your customer profile.' : 'Registration submitted. Check your email to verify the account, then sign in.');
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        setSession(data.session);
        setNotice('Welcome back to your customer account.');
      }
    } catch (e: any) { setError(e.message || 'Unable to authenticate.'); }
    finally { setBusy(false); }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !session?.user) return;
    setBusy(true); setError(''); setNotice('');
    const { error: saveError } = await supabase.from('client_profiles').upsert({
      auth_user_id: session.user.id,
      email: session.user.email,
      full_name: profile.full_name.trim(),
      phone: profile.phone.trim(),
      company_name: profile.company_name.trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'auth_user_id' });
    if (saveError) setError(saveError.message);
    else setNotice('Customer profile saved.');
    setBusy(false);
  };

  const createDraftOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !session?.user) return;
    const parsedAmount = Number(amount);
    if (!itemName.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an item description and a valid estimated amount.');
      return;
    }
    setBusy(true); setError(''); setNotice('');
    const { data, error: orderError } = await supabase.from('customer_orders').insert({
      user_id: session.user.id,
      item_name: itemName.trim(),
      amount: parsedAmount,
      currency,
      preferred_method: method,
      status: 'draft',
    }).select('id,order_number,item_name,amount,currency,preferred_method,status,created_at').single();
    if (orderError) setError(orderError.message);
    else {
      setOrders((current) => [data as CustomerOrder, ...current]);
      setNotice('Checkout draft created. No payment has been collected and no product or credits have been activated.');
      setTab('dashboard');
      setAmount('');
    }
    setBusy(false);
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null); setOrders([]); setNotice('You have signed out.');
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5">
      <section className="w-full max-w-6xl max-h-[94vh] overflow-hidden rounded-2xl border border-slate-700 bg-[#0B1220] shadow-2xl flex flex-col">
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-[#101a2b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center"><ShoppingBag className="w-5 h-5 text-cyan-300" /></div>
            <div><h2 className="font-bold text-white">OPHIREUM CUSTOMER CENTER</h2><p className="text-xs text-slate-400">Account · Checkout · Orders</p></div>
          </div>
          <button onClick={onClose} aria-label="Close customer center" className="p-2 rounded-lg hover:bg-slate-800 text-slate-300"><X className="w-5 h-5" /></button>
        </header>
        {!isSupabaseConfigured || !supabase ? (
          <div className="p-8 text-center space-y-3">
            <CircleAlert className="w-10 h-10 text-amber-300 mx-auto" />
            <h3 className="text-xl font-bold text-white">Customer accounts are not configured yet</h3>
            <p className="text-sm text-slate-300 max-w-xl mx-auto">The customer interface is ready, but account creation requires the Supabase project URL and public anon key in the frontend environment, plus the customer commerce database migration. No demo account or fake order will be created.</p>
          </div>
        ) : !session ? (
          <div className="overflow-y-auto p-5 sm:p-10 grid lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[.2em] text-cyan-300">Secure customer access</p>
              <h3 className="text-3xl font-bold text-white">Your Ophireum workspace starts here.</h3>
              <p className="text-slate-300 leading-relaxed">Create an account to prepare checkout requests, manage your profile, and track order status from one dashboard.</p>
              <div className="space-y-3 pt-3 text-sm text-slate-300">
                {['Customer profile and account access','Checkout drafts and order history','Payment method preference saved for later gateway connection','Payment status and fulfillment visibility'].map((x) => <div key={x} className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-cyan-300" />{x}</div>)}
              </div>
            </div>
            <form onSubmit={authenticate} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 space-y-3">
              <div className="flex gap-2 p-1 bg-slate-950 rounded-lg">
                <button type="button" onClick={() => setMode('signup')} className={`flex-1 py-2 rounded-md text-sm ${mode === 'signup' ? 'bg-cyan-400 text-slate-950 font-bold' : 'text-slate-300'}`}>Create account</button>
                <button type="button" onClick={() => setMode('login')} className={`flex-1 py-2 rounded-md text-sm ${mode === 'login' ? 'bg-cyan-400 text-slate-950 font-bold' : 'text-slate-300'}`}>Sign in</button>
              </div>
              {mode === 'signup' && <input required value={profile.full_name} onChange={e => setProfile(p => ({...p,full_name:e.target.value}))} placeholder="Full name" className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-3 text-white" />}
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-3 text-white" />
              {mode === 'signup' && <input value={profile.phone} onChange={e => setProfile(p => ({...p,phone:e.target.value}))} placeholder="Mobile number (optional)" className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-3 text-white" />}
              <input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (minimum 8 characters)" className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-3 text-white" />
              {error && <p className="text-sm text-rose-300">{error}</p>}{notice && <p className="text-sm text-emerald-300">{notice}</p>}
              <button disabled={busy} className="w-full rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold py-3 disabled:opacity-50">{busy ? 'Please wait…' : mode === 'signup' ? 'Create customer account' : 'Sign in securely'}</button>
              <p className="text-[11px] text-slate-500">Your password is handled by Supabase Authentication and is never stored in the Ophireum application database.</p>
            </form>
          </div>
        ) : (
          <div className="min-h-0 flex-1 grid md:grid-cols-[220px_1fr]">
            <aside className="border-r border-slate-800 p-4 flex md:flex-col gap-2 overflow-x-auto">
              {[['dashboard','Dashboard',LayoutDashboard],['checkout','Checkout',CreditCard],['profile','My Profile',UserRound]].map(([id,label,Icon]: any) => <button key={id} onClick={() => {setTab(id);setError('');setNotice('');}} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm whitespace-nowrap ${tab === id ? 'bg-cyan-400 text-slate-950 font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}><Icon className="w-4 h-4" />{label}</button>)}
              <button onClick={signOut} className="md:mt-auto flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800"><LogOut className="w-4 h-4" />Sign out</button>
            </aside>
            <main className="overflow-y-auto p-5 sm:p-7 space-y-5">
              <div><p className="text-xs uppercase tracking-widest text-cyan-300">Customer workspace</p><h3 className="text-2xl font-bold text-white">{tab === 'checkout' ? 'Prepare checkout' : tab === 'profile' ? 'Customer profile' : 'Welcome back'}</h3><p className="text-sm text-slate-400">{session.user.email}</p></div>
              {error && <p className="text-sm text-rose-300 bg-rose-950/30 p-3 rounded-lg">{error}</p>}{notice && <p className="text-sm text-emerald-300 bg-emerald-950/30 p-3 rounded-lg">{notice}</p>}
              {tab === 'dashboard' && <><div className="grid sm:grid-cols-3 gap-3">{[['Orders',orders.length],['Draft checkouts',orders.filter(o=>o.status==='draft').length],['Paid orders',orders.filter(o=>o.status==='paid').length]].map(([label,value]: any)=><div key={label} className="p-4 rounded-xl border border-slate-700 bg-slate-900"><p className="text-xs text-slate-400">{label}</p><p className="text-2xl font-bold text-white">{value}</p></div>)}</div><div className="flex justify-between items-center"><h4 className="font-semibold text-white">Recent orders</h4><button onClick={()=>setTab('checkout')} className="text-sm text-cyan-300">Start checkout →</button></div><div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full text-sm"><thead className="bg-slate-900 text-slate-400"><tr><th className="p-3 text-left">Order</th><th className="p-3 text-left">Item</th><th className="p-3 text-left">Amount</th><th className="p-3 text-left">Status</th></tr></thead><tbody>{orders.map(o=><tr key={o.id} className="border-t border-slate-800"><td className="p-3 font-mono text-cyan-300">{o.order_number}</td><td className="p-3 text-white">{o.item_name}</td><td className="p-3 text-white">{o.currency} {Number(o.amount).toLocaleString()}</td><td className="p-3 text-amber-300 capitalize">{o.status.replace('_',' ')}</td></tr>)}{!orders.length && <tr><td colSpan={4} className="p-6 text-center text-slate-500">No orders yet. Start your first checkout.</td></tr>}</tbody></table></div></>}
              {tab === 'profile' && <form onSubmit={saveProfile} className="max-w-xl space-y-3"><label className="block text-sm text-slate-300">Full name<input required value={profile.full_name} onChange={e=>setProfile(p=>({...p,full_name:e.target.value}))} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-3 text-white" /></label><label className="block text-sm text-slate-300">Mobile number<input value={profile.phone} onChange={e=>setProfile(p=>({...p,phone:e.target.value}))} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-3 text-white" /></label><label className="block text-sm text-slate-300">Company / organization<input value={profile.company_name} onChange={e=>setProfile(p=>({...p,company_name:e.target.value}))} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-3 text-white" /></label><button disabled={busy} className="rounded-lg bg-cyan-400 text-slate-950 font-bold px-5 py-3">Save profile</button></form>}
              {tab === 'checkout' && <form onSubmit={createDraftOrder} className="max-w-2xl space-y-4"><div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-sm text-amber-200">Gateway integrations are not connected yet. This creates an order draft only; no payment is collected and no credits or products are activated.</div><label className="block text-sm text-slate-300">Product / service description<input required value={itemName} onChange={e=>setItemName(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-3 text-white" /></label><div className="grid sm:grid-cols-2 gap-3"><label className="block text-sm text-slate-300">Estimated amount<input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Enter quoted amount" className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-3 text-white" /></label><label className="block text-sm text-slate-300">Currency<select value={currency} onChange={e=>setCurrency(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-3 text-white"><option value="PHP">PHP — Philippine Peso</option><option value="USD">USD — US Dollar</option></select></label></div><div><p className="text-sm text-slate-300 mb-2">Preferred payment method (gateway integration pending)</p><div className="grid sm:grid-cols-2 gap-2">{paymentMethods.map(p=><button type="button" key={p.id} onClick={()=>setMethod(p.id)} className={`text-left p-3 rounded-lg border ${method===p.id?'border-cyan-400 bg-cyan-400/10':'border-slate-700 bg-slate-900'}`}><span className="block text-sm font-semibold text-white">{p.name}</span><span className="block text-xs text-slate-400 mt-1">{p.detail}</span></button>)}</div></div><button disabled={busy} className="rounded-lg bg-cyan-400 text-slate-950 font-bold px-6 py-3">{busy ? 'Creating draft…' : 'Create checkout draft'}</button></form>}
              {busy && <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" />Loading account data…</div>}
            </main>
          </div>
        )}
      </section>
    </div>
  );
};
