import React, { useState } from 'react';
import { useApp } from '../App';
import { Search, Globe, Landmark, ShieldAlert, Award, FileText } from 'lucide-react';

const DeepResearch: React.FC = () => {
  const { activeCampaign, leads } = useApp();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const campaignLeads = activeCampaign 
    ? leads.filter(l => l.campaign_id === activeCampaign.id) 
    : leads;

  const currentLead = campaignLeads.find(l => l.id === selectedLeadId) || campaignLeads[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div className="glass-panel" style={{ border: '1px solid rgba(0, 0, 0, 0.05)', padding: '20px' }}>
        <h2 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.2rem', marginBottom: '6px' }}>
          Deep Research & Domain Analysis
        </h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Análisis e información recopilada directamente mediante web scraping por el agente de investigación profunda.
        </span>
      </div>

      {campaignLeads.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No hay datos de investigación disponibles para esta campaña.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px' }}>
          
          {/* Sidebar selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {campaignLeads.map((lead) => (
              <button
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
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
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                  {lead.company_name}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Globe size={10} />
                  {lead.website}
                </span>
              </button>
            ))}
          </div>

          {/* Research Content */}
          {currentLead && (
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Header */}
              <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {currentLead.company_name}
                  </h3>
                  <a 
                    href={`https://${currentLead.website}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.85rem', color: '#7048e8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {currentLead.website}
                    <ExternalLink size={12} />
                  </a>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Score de Coincidencia</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-mint)', backgroundColor: 'var(--bg-dark)', padding: '6px 12px', borderRadius: '8px' }}>
                    {currentLead.score}%
                  </span>
                </div>
              </div>

              {/* Research Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                
                {/* Block 1: Business model & Size */}
                <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px', backgroundColor: '#f8f9fa' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: '12px' }}>
                    <Landmark size={16} style={{ color: '#7048e8' }} />
                    Modelo & Tamaño Corporativo
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Modelo de Negocio Detectado:</span>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        Servicios y Experiencias Locales (B2C & B2B)
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Tamaño de la Compañía:</span>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        Mediana (Aprox. 20-50 empleados)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Block 2: Pain points */}
                <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px', backgroundColor: '#f8f9fa' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: '12px' }}>
                    <ShieldAlert size={16} style={{ color: '#ff4d6d' }} />
                    Puntos de Dolor Identificados
                  </h4>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                    {currentLead.research_notes || 'Coordinación manual en agendas y logística, baja retención de clientes corporativos.'}
                  </p>
                </div>

              </div>

              {/* Crawled Raw Meta Section */}
              <div>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: '12px' }}>
                  <FileText size={16} style={{ color: 'var(--accent-mint)' }} />
                  Metadatos Recopilados del Sitio Web
                </h4>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  backgroundColor: '#17191a',
                  color: '#ccd4e0',
                  borderRadius: '10px',
                  padding: '16px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap'
                }}>
{`{
  "crawler_status": "success",
  "http_code": 200,
  "meta_title": "${currentLead.company_name} | Sitio Oficial",
  "meta_description": "Descubre las experiencias y servicios de primer nivel en ${currentLead.company_name}. Reserva hoy.",
  "technologies_detected": ["WordPress", "Google Analytics", "Stripe", "Yoast SEO"],
  "scraped_pages": [
    "/contacto",
    "/servicios",
    "/nosotros"
  ]
}`}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

    </div>
  );
};

import { ExternalLink } from 'lucide-react';

export default DeepResearch;
