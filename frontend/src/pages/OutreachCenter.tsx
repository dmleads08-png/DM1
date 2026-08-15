import React, { useState } from 'react';
import { useApp, Lead } from '../App';
import { Mail, MessageSquare, Send, CheckCircle2, User, Globe, Edit3, ArrowRight } from 'lucide-react';

const Linkedin = (props: any) => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const OutreachCenter: React.FC = () => {
  const { activeCampaign, leads, updateLeadStatus } = useApp();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp' | 'linkedin'>('email');
  const [editingText, setEditingText] = useState('');
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const campaignLeads = activeCampaign 
    ? leads.filter(l => l.campaign_id === activeCampaign.id) 
    : leads;

  const currentLead = campaignLeads.find(l => l.id === selectedLeadId) || campaignLeads[0];

  // Sync editing text when active tab or selected lead changes
  React.useEffect(() => {
    if (currentLead) {
      const msg = currentLead.outreach_messages[activeTab] || '';
      setEditingText(msg);
      setSentSuccess(false);
    }
  }, [currentLead?.id, activeTab]);

  const handleSend = async () => {
    if (!currentLead) return;
    if (currentLead.validation_status !== 'QUALIFIED') return;
    setSending(true);
    // Simulate API calling out to cold messaging APIs
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Update lead status to CONTACTED
    await updateLeadStatus(currentLead.id, "CONTACTED");
    
    setSending(false);
    setSentSuccess(true);
    setTimeout(() => {
      setSentSuccess(false);
    }, 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div className="glass-panel" style={{ border: '1px solid rgba(0, 0, 0, 0.05)', padding: '20px' }}>
        <h2 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.2rem', marginBottom: '6px' }}>
          Outreach Center
        </h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Gestiona, edita y envía los copys estructurados en español por el redactor de secuencias.
        </span>
      </div>

      {campaignLeads.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No hay secuencias de outreach disponibles.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px' }}>
          
          {/* Sidebar leads selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {campaignLeads.map((lead) => (
              <button
                key={lead.id}
                onClick={() => {
                  setSelectedLeadId(lead.id);
                  setSentSuccess(false);
                }}
                style={{
                  textAlign: 'left',
                  padding: '16px',
                  borderRadius: '12px',
                  border: lead.id === (currentLead?.id) ? '1.5px solid var(--accent-mint)' : '1px solid var(--border-light)',
                  backgroundColor: lead.id === (currentLead?.id) ? 'rgba(118, 232, 167, 0.05)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {lead.company_name}
                  </span>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: lead.status === 'NEW' ? '#e8f7ff' : '#f3f0ff',
                    color: lead.status === 'NEW' ? '#1c7ed6' : '#7048e8'
                  }}>
                    {lead.status}
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                  {lead.contact_name}
                </span>
              </button>
            ))}
          </div>

          {/* Outreach Panel */}
          {currentLead && (
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {currentLead.validation_status !== 'QUALIFIED' && (
                <div style={{ backgroundColor: '#fff4e6', border: '1px solid #ffd8a8', color: '#d9480f', padding: '14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                  <div>
                    Este prospecto requiere revisión antes de iniciar outreach. {currentLead.validation_reason || 'Faltan validaciones de calidad.'}
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await updateLeadStatus(currentLead.id, currentLead.status, 'QUALIFIED');
                      } catch (err) {
                        alert('Error al aprobar el prospecto');
                      }
                    }}
                    style={{
                      backgroundColor: '#d9480f',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Aprobar manualmente
                  </button>
                </div>
              )}
              
              {/* Top Details */}
              <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#f1f3f5', display: 'flex', alignItems: 'center', justifyItems: 'center', paddingLeft: '12px' }}>
                    <User size={16} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
                      {currentLead.contact_name}
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {currentLead.contact_role} en {currentLead.company_name}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Email: <b>{currentLead.contact_email}</b>
                </span>
              </div>

              {/* Tabs selector */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
                <button
                  onClick={() => setActiveTab('email')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: activeTab === 'email' ? '#ffeef0' : 'transparent',
                    color: activeTab === 'email' ? '#ff4d6d' : 'var(--text-secondary)',
                    fontWeight: activeTab === 'email' ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  <Mail size={16} />
                  Email Sequence
                </button>
                <button
                  onClick={() => setActiveTab('whatsapp')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: activeTab === 'whatsapp' ? '#e6fcf5' : 'transparent',
                    color: activeTab === 'whatsapp' ? '#0ca678' : 'var(--text-secondary)',
                    fontWeight: activeTab === 'whatsapp' ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  <MessageSquare size={16} />
                  WhatsApp
                </button>
                <button
                  onClick={() => setActiveTab('linkedin')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: activeTab === 'linkedin' ? '#f3f0ff' : 'transparent',
                    color: activeTab === 'linkedin' ? '#7048e8' : 'var(--text-secondary)',
                    fontWeight: activeTab === 'linkedin' ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  <Linkedin size={16} />
                  LinkedIn
                </button>
              </div>

              {/* Text editor box */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Editar Mensaje Personalizado
                  </span>
                  <Edit3 size={14} style={{ color: 'var(--text-secondary)' }} />
                </div>
                <textarea
                  rows={8}
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-light)',
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    lineHeight: '1.5',
                    resize: 'none',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                {sentSuccess ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0ca678', fontSize: '0.9rem', fontWeight: 600 }}>
                    <CheckCircle2 size={18} />
                    ¡Mensaje enviado con éxito! Estatus cambiado a CONTACTADO.
                  </div>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Al enviar, se simula el despacho del mensaje por el canal seleccionado.
                  </span>
                )}
                
                <button
                  onClick={handleSend}
                  disabled={sending || !editingText || currentLead.validation_status !== 'QUALIFIED'}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 28px' }}
                >
                  <Send size={16} />
                  {sending ? 'Despachando...' : 'Send Outreach'}
                </button>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
};

export default OutreachCenter;
