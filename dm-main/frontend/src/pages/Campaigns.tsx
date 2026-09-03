import React, { useState } from 'react';
import axios from 'axios';
import { Copy, Expand, Archive, RefreshCw, Plus, MapPin, Trash2 } from 'lucide-react';
import { useApp, Campaign } from '../App';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3378/api';

const Campaigns: React.FC = () => {
  const { campaigns, setActiveCampaign, loadCampaigns } = useApp();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandCampaign, setExpandCampaign] = useState<Campaign | null>(null);
  const [expandMaxLeads, setExpandMaxLeads] = useState(12);
  const [expandCity, setExpandCity] = useState('');
  const [expandZones, setExpandZones] = useState('');

  const runAction = async (campaign: Campaign, action: 'expand' | 'duplicate' | 'archive' | 'delete', options?: { city?: string; maxLeads?: number; zones?: string[] }) => {
    setBusyId(campaign.id);
    setMessage(null);
    try {
      if (action === 'expand') {
        await axios.post(`${API_URL}/campaigns/${campaign.id}/runs`, {
          run_type: 'expand',
          max_leads: options?.maxLeads || campaign.max_leads || 12,
          city: options?.city || campaign.city,
          zones: options?.zones || []
        });
      } else if (action === 'duplicate') {
        await axios.post(`${API_URL}/campaigns/${campaign.id}/duplicate`);
      } else if (action === 'archive') {
        await axios.patch(`${API_URL}/campaigns/${campaign.id}/archive`);
      } else if (action === 'delete') {
        if (!window.confirm('¿Estás seguro de que deseas eliminar permanentemente esta campaña y todos sus prospectos? Esta acción no se puede deshacer.')) {
          setBusyId(null);
          return;
        }
        await axios.delete(`${API_URL}/campaigns/${campaign.id}`);
      }
      await loadCampaigns();
      setExpandCampaign(null);
      setMessage(
        action === 'archive' ? 'Campaña archivada.' : 
        action === 'duplicate' ? 'Campaña duplicada y ejecutándose.' : 
        action === 'delete' ? 'Campaña eliminada permanentemente.' :
        'Nueva ejecución iniciada.'
      );
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'No se pudo completar la acción.');
    } finally {
      setBusyId(null);
    }
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ color: 'var(--text-primary)', fontWeight: 800, marginBottom: '6px' }}>Campañas</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Gestiona objetivos, ejecuciones y ampliaciones de prospección.
            </p>
          </div>
          <button className="btn-primary" onClick={() => window.location.assign('/')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> Nueva campaña
          </button>
        </div>
        {message && <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>{message}</p>}
      </div>

      {campaigns.length === 0 ? (
        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No hay campañas registradas.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {campaigns.map((campaign) => (
            <article key={campaign.id} className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
                <div>
                  <button onClick={() => { setActiveCampaign(campaign); window.location.assign('/dashboard/overview'); }} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 800 }}>
                    {campaign.name}
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '8px' }}>
                    <MapPin size={14} /> {campaign.city || 'Ciudad no indicada'} · máximo {campaign.max_leads || 12}
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '10px', maxWidth: '720px' }}>{campaign.prompt}</p>
                </div>
                <span style={{ alignSelf: 'flex-start', padding: '5px 9px', borderRadius: '6px', background: campaign.status === 'completed_with_review' ? '#fff4e6' : 'rgba(118, 232, 167, 0.15)', color: campaign.status === 'completed_with_review' ? '#d9480f' : 'var(--text-primary)', fontSize: '0.72rem', fontWeight: 800 }}>
                  {campaign.status.toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '18px' }}>
                <button className="btn-dark" onClick={() => { setExpandCampaign(campaign); setExpandMaxLeads(campaign.max_leads || 12); setExpandCity(campaign.city || ''); setExpandZones(''); }} disabled={busyId === campaign.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Expand size={14} /> Ampliar
                </button>
                <button className="btn-dark" onClick={() => runAction(campaign, 'duplicate')} disabled={busyId === campaign.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Copy size={14} /> Duplicar y ejecutar
                </button>
                {campaign.status !== 'archived' && <button className="btn-dark" onClick={() => runAction(campaign, 'archive')} disabled={busyId === campaign.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Archive size={14} /> Archivar
                </button>}
                <button className="btn-dark" onClick={() => runAction(campaign, 'delete')} disabled={busyId === campaign.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ff6b6b' }}>
                  <Trash2 size={14} /> Eliminar
                </button>
                <button className="btn-dark" onClick={() => { setActiveCampaign(campaign); window.location.assign('/dashboard/leads'); }}>
                  Ver prospectos
                </button>
              </div>
              {expandCampaign?.id === campaign.id && (
                <div style={{ marginTop: '18px', padding: '16px', borderRadius: '10px', background: 'rgba(112, 72, 232, 0.06)', border: '1px solid rgba(112, 72, 232, 0.2)' }}>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '12px' }}>Configurar nueva ejecución</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      Ciudad
                      <input value={expandCity} onChange={(event) => setExpandCity(event.target.value)} style={{ display: 'block', width: '100%', marginTop: '5px', padding: '9px', border: '1px solid var(--border-light)', borderRadius: '7px' }} />
                    </label>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      Cantidad máxima
                      <input type="number" min={1} max={100} value={expandMaxLeads} onChange={(event) => setExpandMaxLeads(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} style={{ display: 'block', width: '100%', marginTop: '5px', padding: '9px', border: '1px solid var(--border-light)', borderRadius: '7px' }} />
                    </label>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      Zonas separadas por coma
                      <input placeholder="Centro, Providencia" value={expandZones} onChange={(event) => setExpandZones(event.target.value)} style={{ display: 'block', width: '100%', marginTop: '5px', padding: '9px', border: '1px solid var(--border-light)', borderRadius: '7px' }} />
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                    <button className="btn-primary" disabled={busyId === campaign.id || !expandCity.trim()} onClick={() => runAction(campaign, 'expand', { city: expandCity.trim(), maxLeads: expandMaxLeads, zones: expandZones.split(',').map((zone) => zone.trim()).filter(Boolean) })}>
                      {busyId === campaign.id ? <RefreshCw size={14} className="spin" /> : <Expand size={14} />} Iniciar ejecución
                    </button>
                    <button className="btn-dark" onClick={() => setExpandCampaign(null)}>Cancelar</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default Campaigns;
