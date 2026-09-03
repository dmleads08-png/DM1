import React from 'react';
import { Link } from 'react-router-dom';
import { LogIn, Check, Radar, ShieldCheck, Sparkles } from 'lucide-react';

const PublicLanding: React.FC = () => (
  <div className="pub-root">
    <nav className="pub-nav">
      <div className="pub-logo"><img src="/logodm.png" alt="DM Event Lovers" className="brand-logo" /><div><strong>EVENT LOVERS</strong><small>SDR AGENT</small></div></div>
      <Link to="/login" className="pub-login-btn"><LogIn size={15}/> Iniciar sesión</Link>
    </nav>
    <main className="pub-split">
      <div className="pub-text">
        <div className="pub-kicker"><span className="pub-dot"/> PROSPECCIÓN INTELIGENTE</div>
        <h1>Encuentra clientes, <em>no contactos.</em></h1>
        <p>Investigación profunda, validación real de prospectos y secuencias de contacto accionables para tu equipo de ventas. Todo desde un solo lugar.</p>
        <div className="pub-cta-row"><Link to="/login" className="pub-cta">Acceder al workspace <LogIn size={14}/></Link><span className="pub-note">Acceso privado</span></div>
        <div className="pub-features"><span><Check size={14}/> Research con fuentes verificadas</span><span><Check size={14}/> Leads con validación de calidad</span><span><Check size={14}/> Campañas ampliables</span></div>
      </div>
      <div className="pub-preview">
        <div className="preview-bar"><span className="preview-dots"><i/><i/><i/></span><small>DM · WORKSPACE</small><span className="preview-live">● LIVE</span></div>
        <div className="preview-body">
          <div className="preview-eyebrow"><Sparkles size={12}/> CAMPAIGN INTELLIGENCE</div>
          <h2>Restaurantes AAA<br/><span>Guadalajara, Jalisco</span></h2>
          <div className="preview-stats"><div><strong>47</strong><small>CANDIDATOS</small></div><div><strong>18</strong><small>VALIDADOS</small></div><div><strong>82%</strong><small>CONFIDENCE</small></div></div>
          <div className="preview-log"><div><Radar size={15}/><span>Prospect Discovery<small>11 sitios</small></span><b>DONE</b></div><div><ShieldCheck size={15}/><span>Quality Control<small>Fuentes y ubicación</small></span><b>RUNNING</b></div></div>
        </div>
      </div>
    </main>
    <footer className="pub-footer"><span>DM SDR PLATFORM</span><span>Research first. Outreach second.</span></footer>
  </div>
);

export default PublicLanding;
