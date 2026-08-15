import React from 'react';
import { useApp, Lead } from '../App';
import { MapPin, User, ArrowRight, Calendar } from 'lucide-react';

const FollowUps: React.FC = () => {
  const { campaigns, activeCampaign, setActiveCampaign, leads, updateLeadStatus } = useApp();
  
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
  const [localNotes, setLocalNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (selectedLead) {
      setLocalNotes(selectedLead.research_notes || '');
    }
  }, [selectedLead?.id]);

  const campaignLeads = activeCampaign 
    ? leads.filter(l => l.campaign_id === activeCampaign.id) 
    : [];

  // Group leads by pipeline columns
  const newLeads = campaignLeads.filter(l => l.status === 'NEW');
  const contactedLeads = campaignLeads.filter(l => l.status === 'CONTACTED' || l.status === 'RESPONDED');
  const meetingLeads = campaignLeads.filter(l => l.status === 'MEETING');
  const lostLeads = campaignLeads.filter(l => l.status === 'CLOSED_LOST');

  const moveNext = async (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    if (lead.status === 'CONTACTED' || lead.status === 'RESPONDED') {
      await updateLeadStatus(lead.id, 'MEETING');
    }
  };

  const markLost = async (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    await updateLeadStatus(lead.id, 'CLOSED_LOST');
  };

  const markNew = async (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    await updateLeadStatus(lead.id, 'RESPONDED');
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("text/plain", leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    if (!leadId) return;

    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    if (['CONTACTED', 'RESPONDED', 'MEETING'].includes(targetStatus) && lead.validation_status !== 'QUALIFIED') {
      alert("No puedes mover este prospecto sin haberlo aprobado primero.");
      return;
    }

    try {
      await updateLeadStatus(leadId, targetStatus);
    } catch (err) {
      alert("Error al actualizar el estado del prospecto.");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div className="glass-panel" style={{ border: '1px solid rgba(0, 0, 0, 0.05)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.2rem', marginBottom: '6px' }}>
            Follow Ups & Pipeline
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Arrastra las tarjetas o usa los botones para gestionar las distintas etapas. Haz clic en una tarjeta para agregar notas.
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Campaña activa:</label>
          <select 
            value={activeCampaign?.id || ''} 
            onChange={(e) => {
              const selectedId = e.target.value;
              const camp = campaigns.find(c => c.id === selectedId) || null;
              setActiveCampaign(camp);
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-light)',
              backgroundColor: '#2b2f33',
              color: '#ffffff',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            <option value="" style={{ backgroundColor: '#2b2f33', color: '#ffffff' }}>-- Seleccionar Campaña --</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id} style={{ backgroundColor: '#2b2f33', color: '#ffffff' }}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!activeCampaign ? (
        <div className="glass-panel" style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', border: '1px solid rgba(0, 0, 0, 0.05)' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>No hay ninguna campaña activa</span>
          <span style={{ fontSize: '0.85rem', maxWidth: '400px', lineHeight: '1.5' }}>
            Selecciona una campaña en el selector superior o en la barra lateral izquierda para ver y gestionar su pipeline de seguimiento de prospectos.
          </span>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          alignItems: 'start'
        }}>
          
          {/* Column 0: Por Contactar (Nuevos) */}
          <div 
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'NEW')}
          >
            <div className="kanban-column-header">
              <span className="kanban-column-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#868e96' }}></span>
                Por Contactar (Nuevos)
              </span>
              <span className="kanban-column-count">{newLeads.length}</span>
            </div>

            <div className="kanban-cards" style={{ minHeight: '300px' }}>
              {newLeads.map((lead) => (
                <div 
                  key={lead.id} 
                  className="kanban-card"
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  onClick={() => setSelectedLead(lead)}
                  style={{ cursor: 'grab' }}
                >
                  <div className="kanban-card-header">
                    <span className="kanban-card-title">{lead.company_name}</span>
                    <span className="kanban-card-score">{lead.score}</span>
                  </div>
                  <div className="kanban-card-location">
                    <MapPin size={12} />
                    Guadalajara, MX
                  </div>
                  <div className="kanban-card-contact">
                    <User size={12} />
                    {lead.contact_name || 'Sin contacto'}
                  </div>
                  
                  {lead.validation_status !== 'QUALIFIED' && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      style={{ backgroundColor: '#fff4e6', border: '1px solid #ffd8a8', color: '#d9480f', padding: '8px', borderRadius: '6px', fontSize: '0.7rem', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}
                    >
                      <span>Requiere revisión: {lead.validation_reason || 'Ubicación o datos sin verificar.'}</span>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await updateLeadStatus(lead.id, lead.status, 'QUALIFIED');
                          } catch (err) {
                            alert('Error al aprobar el prospecto');
                          }
                        }}
                        style={{
                          backgroundColor: '#d9480f',
                          color: 'white',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          alignSelf: 'flex-start',
                          fontSize: '0.7rem'
                        }}
                      >
                        Aprobar
                      </button>
                    </div>
                  )}
                  
                  {/* Actions row */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
                    <button 
                      onClick={(e) => markLost(lead, e)}
                      style={{ background: 'none', border: 'none', color: '#ff4d6d', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                    >
                      Descartar
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLeadStatus(lead.id, 'CONTACTED');
                      }}
                      disabled={lead.validation_status !== 'QUALIFIED'}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: lead.validation_status === 'QUALIFIED' ? '#0ca678' : '#adb5bd', 
                        cursor: lead.validation_status === 'QUALIFIED' ? 'pointer' : 'not-allowed', 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '2px' 
                      }}
                    >
                      Contactar <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {newLeads.length === 0 && (
                <div style={{ border: '2px dashed var(--border-light)', borderRadius: '12px', padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Columna vacía
                </div>
              )}
            </div>
          </div>

          {/* Column 1: Contacted / Responded */}
          <div 
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'CONTACTED')}
          >
            <div className="kanban-column-header">
              <span className="kanban-column-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#7048e8' }}></span>
                Contactados / Respondieron
              </span>
              <span className="kanban-column-count">{contactedLeads.length}</span>
            </div>

            <div className="kanban-cards" style={{ minHeight: '300px' }}>
              {contactedLeads.map((lead) => (
                <div 
                  key={lead.id} 
                  className="kanban-card"
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  onClick={() => setSelectedLead(lead)}
                  style={{ cursor: 'grab' }}
                >
                  <div className="kanban-card-header">
                    <span className="kanban-card-title">{lead.company_name}</span>
                    <span className="kanban-card-score">{lead.score}</span>
                  </div>
                  <div className="kanban-card-location">
                    <MapPin size={12} />
                    Guadalajara, MX
                  </div>
                  <div className="kanban-card-contact">
                    <User size={12} />
                    {lead.contact_name || 'Sin contacto'}
                  </div>
                  
                  {/* Actions row */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
                    <button 
                      onClick={(e) => markLost(lead, e)}
                      style={{ background: 'none', border: 'none', color: '#ff4d6d', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                    >
                      Perder
                    </button>
                    <button 
                      onClick={(e) => moveNext(lead, e)}
                      style={{ background: 'none', border: 'none', color: '#0ca678', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}
                    >
                      Next <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {contactedLeads.length === 0 && (
                <div style={{ border: '2px dashed var(--border-light)', borderRadius: '12px', padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Columna vacía
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Meeting Booked */}
          <div 
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'MEETING')}
          >
            <div className="kanban-column-header">
              <span className="kanban-column-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0ca678' }}></span>
                Reunión Agendada (Meeting Booked)
              </span>
              <span className="kanban-column-count">{meetingLeads.length}</span>
            </div>

            <div className="kanban-cards" style={{ minHeight: '300px' }}>
              {meetingLeads.map((lead) => (
                <div 
                  key={lead.id} 
                  className="kanban-card"
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  onClick={() => setSelectedLead(lead)}
                  style={{ cursor: 'grab' }}
                >
                  <div className="kanban-card-header">
                    <span className="kanban-card-title">{lead.company_name}</span>
                    <span className="kanban-card-score" style={{ backgroundColor: '#e6fcf5', color: '#0ca678', borderColor: '#c3fae8' }}>{lead.score}</span>
                  </div>
                  <div className="kanban-card-location">
                    <MapPin size={12} />
                    Guadalajara, MX
                  </div>
                  <div className="kanban-card-contact">
                    <User size={12} />
                    {lead.contact_name || 'Sin contacto'}
                  </div>

                  {/* Actions row */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
                    <button 
                      onClick={(e) => markLost(lead, e)}
                      style={{ background: 'none', border: 'none', color: '#ff4d6d', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                    >
                      Perder
                  </button>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2b8a3e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> Reagendada
                    </span>
                  </div>
                </div>
              ))}
              {meetingLeads.length === 0 && (
                <div style={{ border: '2px dashed var(--border-light)', borderRadius: '12px', padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Columna vacía
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Closed / Lost */}
          <div 
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'CLOSED_LOST')}
          >
            <div className="kanban-column-header">
              <span className="kanban-column-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff4d6d' }}></span>
                Cerradas / Perdidas (Closed / Lost)
              </span>
              <span className="kanban-column-count">{lostLeads.length}</span>
            </div>

            <div className="kanban-cards" style={{ minHeight: '300px' }}>
              {lostLeads.map((lead) => (
                <div 
                  key={lead.id} 
                  className="kanban-card"
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  onClick={() => setSelectedLead(lead)}
                  style={{ cursor: 'grab' }}
                >
                  <div className="kanban-card-header">
                    <span className="kanban-card-title" style={{ color: 'var(--text-secondary)' }}>{lead.company_name}</span>
                    <span className="kanban-card-score" style={{ backgroundColor: '#f1f3f5', color: '#868e96', borderColor: '#e9ecef' }}>{lead.score}</span>
                  </div>
                  <div className="kanban-card-location">
                    <MapPin size={12} />
                    Guadalajara, MX
                  </div>
                  <div className="kanban-card-contact">
                    <User size={12} />
                    {lead.contact_name || 'Sin contacto'}
                  </div>

                  {/* Actions row */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
                    <button 
                      onClick={(e) => markNew(lead, e)}
                      style={{ background: 'none', border: 'none', color: '#7048e8', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                    >
                      Reactivar
                    </button>
                  </div>
                </div>
              ))}
              {lostLeads.length === 0 && (
                <div style={{ border: '2px dashed var(--border-light)', borderRadius: '12px', padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Columna vacía
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Modal para detalles y notas */}
      {selectedLead && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '550px',
            backgroundColor: '#1c1f22',
            border: '1px solid var(--border-light)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            color: 'var(--text-primary)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {selectedLead.company_name}
                </h3>
                <a href={selectedLead.website} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent-mint)' }}>
                  {selectedLead.website}
                </a>
              </div>
              <span className={`badge-status ${selectedLead.status.toLowerCase()}`}>
                {selectedLead.status}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Contacto</strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Nombre: {selectedLead.contact_name || 'No especificado'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Cargo: {selectedLead.contact_role || 'No especificado'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Email: {selectedLead.contact_email || 'No especificado'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Comentarios y Notas de Prospección
                </span>
              </div>
              <textarea
                rows={6}
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                placeholder="Escribe comentarios, notas de llamadas o estado actual..."
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-light)',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                  backgroundColor: '#2b2f33',
                  fontFamily: 'inherit',
                  lineHeight: '1.4',
                  resize: 'vertical',
                  outline: 'none'
                }}
              />
            </div>

            {selectedLead.validation_status !== 'QUALIFIED' && (
              <div style={{ backgroundColor: '#fff4e6', border: '1px solid #ffd8a8', color: '#d9480f', padding: '10px', borderRadius: '8px', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <span>Requiere aprobación para realizar outreach.</span>
                <button
                  onClick={async () => {
                    try {
                      await updateLeadStatus(selectedLead.id, selectedLead.status, 'QUALIFIED');
                      setSelectedLead(p => p ? { ...p, validation_status: 'QUALIFIED' } : null);
                    } catch (err) {
                      alert('Error al aprobar el prospecto');
                    }
                  }}
                  style={{
                    backgroundColor: '#d9480f',
                    color: 'white',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Aprobar
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
              <button
                onClick={() => setSelectedLead(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                Cerrar
              </button>
              <button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await updateLeadStatus(selectedLead.id, selectedLead.status, selectedLead.validation_status, localNotes);
                    setSelectedLead(null);
                  } catch (err) {
                    alert('Error al guardar los comentarios.');
                  } finally {
                    setSaving(false);
                  }
                }}
                style={{
                  backgroundColor: 'var(--accent-mint)',
                  color: '#1a1d20',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                {saving ? 'Guardando...' : 'Guardar Notas'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default FollowUps;
