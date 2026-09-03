import React, { useState } from 'react';
import { useApp, Lead } from '../App';
import { Search, Filter, Download, ExternalLink, Mail, Phone, User, Eye, X } from 'lucide-react';

const LeedsList: React.FC = () => {
  const { activeCampaign, leads } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Filter leads
  const campaignLeads = activeCampaign 
    ? leads.filter(l => l.campaign_id === activeCampaign.id) 
    : leads;

  const filteredLeads = campaignLeads.filter(lead => {
    const matchesSearch = lead.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.contact_name && lead.contact_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesPriority = priorityFilter ? lead.priority === priorityFilter : true;
    const matchesStatus = statusFilter ? lead.status === statusFilter : true;
    
    return matchesSearch && matchesPriority && matchesStatus;
  });

  const exportCSV = () => {
    if (filteredLeads.length === 0) return;
    
    const headers = [
      "Company", "Website", "Score", "Priority", "Contact Name", 
      "Contact Role", "Contact Email", "Status", "Research Notes", 
      "Validation Status", "Confidence Score", "Email Draft", 
      "WhatsApp Draft", "LinkedIn Draft"
    ];
    
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filteredLeads.map(l => [
      l.company_name, l.website, l.score, l.priority, l.contact_name, 
      l.contact_role, l.contact_email, l.status, l.research_notes,
      l.validation_status, l.confidence_score,
      l.outreach_messages?.email || '',
      l.outreach_messages?.whatsapp || '',
      l.outreach_messages?.linkedin || ''
    ]);
    
    // We don't use encodeURI for the whole content because it can fail on large strings
    const bom = "\uFEFF";
    const csvContent = bom + [headers.join(","), ...rows.map(e => e.map(escapeCsv).join(","))].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_${activeCampaign ? activeCampaign.id : 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Title & Filters Panel */}
      <div className="glass-panel" style={{ border: '1px solid rgba(0, 0, 0, 0.05)', padding: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Search bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '8px 14px', width: '320px' }}>
            <Search size={18} style={{ color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Buscar por empresa, contacto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.9rem', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Selector filters */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            
            {/* Priority filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '6px 12px' }}>
              <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
              <select 
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: '0.85rem', color: 'var(--text-primary)', backgroundColor: 'transparent', cursor: 'pointer' }}
              >
                <option value="">Prioridades (Todas)</option>
                <option value="HOT">🔥 HOT</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            {/* Status filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '6px 12px' }}>
              <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: '0.85rem', color: 'var(--text-primary)', backgroundColor: 'transparent', cursor: 'pointer' }}
              >
                <option value="">Estatus (Todos)</option>
                <option value="NEW">Nuevos</option>
                <option value="CONTACTED">Contactados</option>
                <option value="RESPONDED">Respondieron</option>
                <option value="MEETING">Reunión Agendada</option>
                <option value="CLOSED_LOST">Perdidos</option>
              </select>
            </div>

            {/* Export CSV Button */}
            <button 
              onClick={exportCSV}
              className="btn-dark"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.85rem' }}
            >
              <Download size={14} />
              Exportar CSV
            </button>

          </div>

        </div>
      </div>

      {/* Table Panel */}
      <div className="glass-panel" style={{ border: '1px solid rgba(0, 0, 0, 0.05)', padding: '0', overflow: 'hidden' }}>
        {filteredLeads.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No se encontraron leads para esta campaña. Inicia una búsqueda o ajusta los filtros.
          </div>
        ) : (
          <div className="table-container">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>EMPRESA</th>
                  <th>SCORE</th>
                  <th>PRIORIDAD</th>
                  <th>CONTACTO</th>
                  <th>ESTATUS</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block', color: 'var(--text-primary)' }}>
                          {lead.company_name}
                        </span>
                        {lead.website && (
                          <a 
                            href={`https://${lead.website}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                          >
                            {lead.website}
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="score-container">
                        <span className="score-num">{lead.score}</span>
                        <div className="score-bar-bg">
                          <div className="score-bar-fill" style={{ width: `${lead.score}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge-priority ${lead.priority.toLowerCase()}`}>
                        {lead.priority === 'HOT' ? '🔥 HOT' : lead.priority}
                      </span>
                    </td>
                    <td>
                      <div>
                        <span style={{ fontWeight: 600, display: 'block', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                          {lead.contact_name || 'No identificado'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                          {lead.contact_role || 'Puesto N/A'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className={`badge-status ${lead.status.toLowerCase()}`}>
                          {lead.status === 'MEETING' ? 'MEETING' : lead.status === 'RESPONDED' ? 'RESPONDED' : lead.status}
                        </span>
                        <small style={{ color: lead.validation_status === 'QUALIFIED' ? '#2f9e44' : '#f08c00' }}>
                          {lead.validation_status || 'UNVERIFIED'}
                        </small>
                      </div>
                    </td>
                    <td>
                      <button 
                        onClick={() => setSelectedLead(lead)}
                        className="btn-dark"
                        style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Eye size={12} />
                        Detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedLead && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '750px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '30px',
            backgroundColor: '#ffffff',
            position: 'relative'
          }}>
            {/* Close Button */}
            <button 
              onClick={() => setSelectedLead(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)'
              }}
            >
              <X size={24} />
            </button>

            {/* Modal Header */}
            <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <h2 style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{selectedLead.company_name}</h2>
                <span className={`badge-priority ${selectedLead.priority.toLowerCase()}`}>
                  {selectedLead.priority === 'HOT' ? '🔥 HOT' : selectedLead.priority}
                </span>
                <span className="score-num" style={{
                  backgroundColor: 'rgba(118, 232, 167, 0.15)',
                  color: 'var(--text-primary)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 800
                }}>
                  Score: {selectedLead.score}
                </span>
              </div>
              <a 
                href={`https://${selectedLead.website}`} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {selectedLead.website}
                <ExternalLink size={12} />
              </a>
            </div>

            {/* Modal Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Contact Information */}
              <div>
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Contacto Identificado
                </h4>
                <div style={{ backgroundColor: '#f8f9fa', borderRadius: '10px', padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <User size={16} style={{ color: 'var(--text-secondary)' }} />
                    <div>
                      <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nombre:</span>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{selectedLead.contact_name}</span>
                    </div>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Puesto:</span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{selectedLead.contact_role}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', gridColumn: 'span 2' }}>
                    <Mail size={16} style={{ color: 'var(--text-secondary)' }} />
                    <div>
                      <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Email:</span>
                      <a href={`mailto:${selectedLead.contact_email}`} style={{ fontWeight: 600, fontSize: '0.9rem', color: '#7048e8', textDecoration: 'none' }}>
                        {selectedLead.contact_email}
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Research Notes */}
              <div style={{ backgroundColor: selectedLead.validation_status === 'QUALIFIED' ? '#ebfbee' : '#fff4e6', borderRadius: '10px', padding: '14px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Validación: {selectedLead.validation_status || 'UNVERIFIED'}</strong>
                <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {selectedLead.validation_reason || 'Sin motivo registrado.'}
                </p>
                {selectedLead.source_url && (
                  <a href={selectedLead.source_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '8px', color: '#7048e8', fontSize: '0.85rem' }}>
                    Fuente: {selectedLead.source_url}
                  </a>
                )}
              </div>

              {/* Research Notes */}
              <div>
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Análisis del Dominio (Deep Research)
                </h4>
                <p style={{ backgroundColor: '#f8f9fa', borderRadius: '10px', padding: '16px', color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  {selectedLead.research_notes || 'No se han registrado notas de investigación.'}
                </p>
              </div>

              {/* Outreach Sequences */}
              <div>
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Secuencias de Salida Generadas (En Español)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedLead.outreach_messages.email && (
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: '10px', padding: '14px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1c7ed6', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
                        ✉️ SECUENCIA DE EMAIL
                      </span>
                      <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                        {selectedLead.outreach_messages.email}
                      </p>
                    </div>
                  )}

                  {selectedLead.outreach_messages.whatsapp && (
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: '10px', padding: '14px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0ca678', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
                        💬 MENSAJE DE WHATSAPP
                      </span>
                      <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                        {selectedLead.outreach_messages.whatsapp}
                      </p>
                    </div>
                  )}

                  {selectedLead.outreach_messages.linkedin && (
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: '10px', padding: '14px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#7048e8', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
                        🔗 MENSAJE DE LINKEDIN
                      </span>
                      <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                        {selectedLead.outreach_messages.linkedin}
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LeedsList;
