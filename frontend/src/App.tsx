import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
  LayoutDashboard, ListTodo, Search, Mail, CalendarDays, Terminal,
  ArrowLeft, Sparkles, Pause, Play, Download, Flame, Send, Calendar, Lock, AlertCircle
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3378/api';

export interface Organization {
  id: string; name: string; plan: string; leads_limit: number; leads_used: number;
}
export interface Campaign {
  id: string; name: string; prompt: string; city?: string; status: string;
  progress: number; created_at: string; logs?: any[]; max_leads?: number;
}
export interface Lead {
  id: string; campaign_id: string; company_name: string; website: string;
  score: number; priority: string; contact_name: string | null;
  contact_role: string | null; contact_email: string | null;
  research_notes: string; outreach_messages: { email?: string; whatsapp?: string; linkedin?: string; };
  status: string; source_url?: string | null; source_type?: string | null;
  location_verified?: boolean; business_category_verified?: boolean;
  domain_verified?: boolean; contact_verified?: boolean; email_verified?: boolean;
  validation_status?: string; validation_reason?: string | null; confidence_score?: number;
}

interface AppContextType {
  org: Organization | null; campaigns: Campaign[]; activeCampaign: Campaign | null;
  leads: Lead[]; loading: boolean; error: string | null;
  setActiveCampaign: (c: Campaign | null) => void;
  loadOrganization: () => void; loadCampaigns: () => void; loadLeads: () => void;
  startCampaign: (name: string, prompt: string, city: string, maxLeads?: number) => Promise<Campaign>;
  upgradeTenant: () => Promise<void>; updateLeadStatus: (leadId: string, status: string, validationStatus?: string, researchNotes?: string) => Promise<void>;
  isPaused: boolean; setIsPaused: (p: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp fuera de contexto');
  return ctx;
};

import Landing from './pages/Landing';
import Overview from './pages/Overview';
import LeedsList from './pages/LeedsList';
import DeepResearch from './pages/DeepResearch';
import OutreachCenter from './pages/OutreachCenter';
import FollowUps from './pages/FollowUps';
import AgentLogs from './pages/AgentLogs';
import Campaigns from './pages/Campaigns';
import Login from './pages/Login';
import Recovery from './pages/Recovery';
import ResetPassword from './pages/ResetPassword';
import Admin from './pages/Admin';
import PublicLanding from './pages/PublicLanding';

const useSession = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    
    supabase.auth.getSession().then(({ data }) => { 
      setSession(data.session); 
      if (data.session) {
        axios.defaults.headers.common.Authorization = `Bearer ${data.session.access_token}`;
        axios.get(`${API_URL}/me`)
          .then(r => setRole(r.data.role || 'user'))
          .catch(() => setRole('user'));
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));

    const { data } = supabase.auth.onAuthStateChange((_e, s) => { 
      setSession(s); 
      if (s) {
        axios.defaults.headers.common.Authorization = `Bearer ${s.access_token}`;
        axios.get(`${API_URL}/me`)
          .then(r => setRole(r.data.role || 'user'))
          .catch(() => setRole('user'));
      } else {
        delete axios.defaults.headers.common.Authorization; 
        setRole(null);
        setLoading(false);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && role !== null) {
      setLoading(false);
    } else if (!session) {
      setLoading(false);
    }
  }, [session, role]);

  const signOut = async () => { 
    if (supabase) await supabase.auth.signOut(); 
    delete axios.defaults.headers.common.Authorization; 
    setRole(null);
  };

  return { session, loading, configured: Boolean(supabase), signOut, role };
};

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useSession();
  const [org, setOrg] = useState<Organization | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaignState] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const loadOrganization = async () => {
    try { const res = await axios.get(`${API_URL}/organizations/default-tenant-id`); setOrg(res.data); } catch { }
  };
  const loadCampaigns = async () => {
    try { const res = await axios.get(`${API_URL}/campaigns`); setCampaigns(res.data); const r = res.data.find((c: any) => c.status === 'running'); if (r) setActiveCampaignState(r); } catch { }
  };
  const loadLeads = async () => {
    try { const res = await axios.get(`${API_URL}/leads`); setLeads(res.data); } catch { }
  };
  const setActiveCampaign = (c: Campaign | null) => setActiveCampaignState(c);
  const startCampaign = async (name: string, prompt: string, city: string, maxLeads = 12) => {
    const res = await axios.post(`${API_URL}/campaigns`, { name, prompt, city, max_leads: maxLeads });
    const c = res.data; setCampaigns(p => [c, ...p]); setActiveCampaignState(c); await loadOrganization(); return c;
  };
  const upgradeTenant = async () => { await axios.post(`${API_URL}/billing/upgrade`); await loadOrganization(); };
  const updateLeadStatus = async (leadId: string, status: string, validationStatus?: string, researchNotes?: string) => {
    const payload: any = { status };
    if (validationStatus) payload.validation_status = validationStatus;
    if (researchNotes !== undefined) payload.research_notes = researchNotes;
    await axios.patch(`${API_URL}/leads/${leadId}`, payload);
    setLeads(p => p.map(l => l.id === leadId ? { 
      ...l, 
      status, 
      ...(validationStatus ? { validation_status: validationStatus } : {}),
      ...(researchNotes !== undefined ? { research_notes: researchNotes } : {})
    } : l));
  };

  useEffect(() => {
    if (session?.access_token) {
      axios.defaults.headers.common.Authorization = `Bearer ${session.access_token}`;
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    const init = async () => { setLoading(true); await loadOrganization(); await loadCampaigns(); await loadLeads(); setLoading(false); };
    init();
  }, [session]);

  useEffect(() => {
    if (!activeCampaign || activeCampaign.status !== 'running') return;
    const iv = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/campaigns/${activeCampaign.id}`);
        const u = res.data; setActiveCampaignState(u);
        setCampaigns(p => p.map(c => c.id === u.id ? u : c));
        if (u.status !== 'running') { clearInterval(iv); loadLeads(); loadOrganization(); }
      } catch { }
    }, 2000);
    return () => clearInterval(iv);
  }, [activeCampaign?.id, activeCampaign?.status]);

  return <AppContext.Provider value={{ org, campaigns, activeCampaign, leads, loading, error, setActiveCampaign, loadOrganization, loadCampaigns, loadLeads, startCampaign, upgradeTenant, updateLeadStatus, isPaused, setIsPaused }}>{children}</AppContext.Provider>;
};

const NavigationSidebar = () => {
  const { org, activeCampaign } = useApp();
  const { signOut, role } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const active = (p: string) => location.pathname === p;
  
  const navLinks = role === 'admin' ? [
    {to:'/dashboard/admin', icon:<Sparkles size={18}/>, label:'Admin'}
  ] : [
    {to:'/dashboard/overview', icon:<LayoutDashboard size={18}/>, label:'Overview'},
    {to:'/dashboard/campaigns', icon:<CalendarDays size={18}/>, label:'Campañas'},
    {to:'/dashboard/leads', icon:<ListTodo size={18}/>, label:'Leeds'},
    {to:'/dashboard/research', icon:<Search size={18}/>, label:'Research'},
    {to:'/dashboard/outreach', icon:<Mail size={18}/>, label:'Outreach'},
    {to:'/dashboard/followups', icon:<CalendarDays size={18}/>, label:'Follow Ups'},
    {to:'/dashboard/logs', icon:<Terminal size={18}/>, label:'Logs'},
  ];

  return <aside className="sidebar">
    <div style={{ display: 'flex', alignItems:'center', gap:'10px', marginBottom:'32px' }}>
      <img src="/logodm.png" alt="DM Event Lovers" style={{ height: '38px', width: 'auto', objectFit: 'contain' }} />
      <div><span style={{ fontWeight:800, fontSize:'1rem', display:'block', color:'var(--text-light)', letterSpacing:'0.5px' }}>EVENT LOVERS</span><span style={{ fontSize:'0.65rem', color:'var(--accent-mint)', fontWeight:600, letterSpacing:'1px' }}>SDR AGENT</span></div>
    </div>
    {role !== 'admin' && <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'12px', padding:'14px', marginBottom:'24px', border:'1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize:'0.65rem', color:'var(--text-muted)', textTransform:'uppercase', fontWeight:600, display:'block', marginBottom:'4px' }}>Campaña Activa</span>
      <span style={{ fontSize:'0.85rem', fontWeight:700, color:'#f5f6f7' }}>{activeCampaign?.name || 'Ninguna activa'}</span>
      {activeCampaign && <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'6px' }}>
        <span style={{ width:'8px', height:'8px', borderRadius:'50%', display:'inline-block', backgroundColor: activeCampaign.status==='running'?'var(--accent-mint)':activeCampaign.status==='completed'?'#7048e8':activeCampaign.status==='completed_with_review'?'#f59f00':'#8d949e' }} />
        <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase' }}>{activeCampaign.status==='running'?'PROCESANDO':activeCampaign.status==='completed'?'COMPLETADO':activeCampaign.status==='completed_with_review'?'REVISIÓN':activeCampaign.status==='completed_empty'?'SIN RESULTADOS':'FALLIDO'}</span>
      </div>}
    </div>}
    <nav style={{ display:'flex', flexDirection:'column', gap:'6px', flexGrow:1 }}>
      {navLinks.map(l => (
        <Link key={l.to} to={l.to} style={{
          display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', borderRadius:'10px',
          textDecoration:'none', color:active(l.to)?'var(--bg-dark)':'var(--text-muted)',
          backgroundColor:active(l.to)?'var(--accent-mint)':'transparent',
          fontWeight:active(l.to)?700:500, fontSize:'0.9rem'
        }}>{l.icon}{l.label}</Link>
      ))}
    </nav>
    <div style={{ marginTop:'auto', paddingTop:'20px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
      {org && <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', marginBottom:'6px' }}>
        <span style={{ color:'var(--text-muted)' }}>Leads:</span>
        <span style={{ fontWeight:700, color:'var(--text-light)' }}>{org.leads_used}/{org.leads_limit>10000?'∞':org.leads_limit}</span>
      </div>}
      <button onClick={() => signOut()} style={{ marginTop:'10px', width:'100%', padding:'10px', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', background:'transparent', color:'#e03131', cursor:'pointer', fontSize:'0.82rem', fontWeight:600 }}>Cerrar sesión</button>
    </div>
  </aside>;
};

const HeaderBar = () => {
  const { activeCampaign, isPaused, setIsPaused } = useApp();
  const loc = useLocation();
  if (loc.pathname === '/') return null;
  return <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 0 24px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', marginBottom:'32px' }}>
    <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
      <Link to="/" style={{ color:'var(--text-muted)', display:'flex', alignItems:'center' }}><ArrowLeft size={20}/></Link>
      <span style={{ fontSize:'1.1rem', fontWeight:700 }}>{activeCampaign?`Campaña: ${activeCampaign.name}`:'Workspace'}</span>
    </div>
    <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
      <button onClick={() => setIsPaused(!isPaused)} className="btn-dark" style={{ padding:'8px 16px', fontSize:'0.85rem' }}>{isPaused?<Play size={16}/>:<Pause size={16}/>}{isPaused?'Reanudar':'Pausar'}</button>
      <button className="btn-dark" style={{ padding:'8px 16px', fontSize:'0.85rem' }} onClick={() => alert("Exportando CSV...")}><Download size={16}/>Exportar</button>
    </div>
  </header>;
};

const AppIndex: React.FC = () => {
  const { session, loading: authLoading, configured, role } = useSession();
  const location = useLocation();

  if (authLoading) return <div className="splash"><img src="/favicon1.png" alt="Cargando..." /></div>;
  if (!configured) return <AppShell><Landing /></AppShell>;

  if (!session) {
    return <Routes>
      <Route path="/" element={<PublicLanding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<Recovery />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>;
  }
  return <AppShell>
    <Routes>
      <Route path="/" element={<Navigate to={role === 'admin' ? '/dashboard/admin' : '/dashboard/overview'} replace />} />
      <Route path="/dashboard/overview" element={role !== 'admin' ? <Overview /> : <Navigate to="/dashboard/admin" replace />} />
      <Route path="/dashboard/campaigns" element={role !== 'admin' ? <Campaigns /> : <Navigate to="/dashboard/admin" replace />} />
      <Route path="/dashboard/leads" element={role !== 'admin' ? <LeedsList /> : <Navigate to="/dashboard/admin" replace />} />
      <Route path="/dashboard/research" element={role !== 'admin' ? <DeepResearch /> : <Navigate to="/dashboard/admin" replace />} />
      <Route path="/dashboard/outreach" element={role !== 'admin' ? <OutreachCenter /> : <Navigate to="/dashboard/admin" replace />} />
      <Route path="/dashboard/followups" element={role !== 'admin' ? <FollowUps /> : <Navigate to="/dashboard/admin" replace />} />
      <Route path="/dashboard/logs" element={role !== 'admin' ? <AgentLogs /> : <Navigate to="/dashboard/admin" replace />} />
      <Route path="/dashboard/admin" element={role === 'admin' ? <Admin /> : <Navigate to="/dashboard/overview" replace />} />
      <Route path="*" element={<Navigate to={role === 'admin' ? '/dashboard/admin' : '/dashboard/overview'} replace />} />
    </Routes>
  </AppShell>;
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading } = useApp();
  if (loading) return <div className="splash"><img src="/favicon1.png" alt="Cargando..." /></div>;
  return <div className="app-container"><NavigationSidebar /><main className="main-content"><HeaderBar />{children}</main></div>;
};

const App: React.FC = () => (
  <Router>
    <AppProvider>
      <AppIndex />
    </AppProvider>
  </Router>
);

export default App;
