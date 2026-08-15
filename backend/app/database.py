import datetime
import uuid
import json
from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, ForeignKey, Text, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DATABASE_URL = "sqlite:///./dm_saas.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    plan = Column(String, default="free")  # "free" or "premium"
    leads_limit = Column(Integer, default=5)
    leads_used = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    campaigns = relationship("Campaign", back_populates="organization", cascade="all, delete-orphan")

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    role = Column(String, default="member")  # "admin" or "member"
    auth_user_id = Column(String, unique=True)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    organization = relationship("Organization", back_populates="users")

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    prompt = Column(Text, nullable=False)
    city = Column(String, default="")
    status = Column(String, default="draft")  # "draft", "running", "completed", "failed", "paused"
    progress = Column(Float, default=0.0)  # 0 to 100
    max_leads = Column(Integer, default=12)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    organization = relationship("Organization", back_populates="campaigns")
    leads = relationship("Lead", back_populates="campaign", cascade="all, delete-orphan")
    logs = relationship("AgentLog", back_populates="campaign", cascade="all, delete-orphan")
    runs = relationship("CampaignRun", back_populates="campaign", cascade="all, delete-orphan")


class CampaignRun(Base):
    __tablename__ = "campaign_runs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String, ForeignKey("campaigns.id"), nullable=False)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    run_type = Column(String, default="initial")
    status = Column(String, default="queued")
    city = Column(String, default="")
    zones = Column(Text)
    max_leads = Column(Integer, default=12)
    error_message = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    campaign = relationship("Campaign", back_populates="runs")
    leads = relationship("Lead", back_populates="campaign_run")

class Lead(Base):
    __tablename__ = "leads"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String, ForeignKey("campaigns.id"), nullable=False)
    campaign_run_id = Column(String, ForeignKey("campaign_runs.id"), nullable=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    company_name = Column(String, nullable=False)
    website = Column(String)
    score = Column(Integer, default=0)
    priority = Column(String, default="LOW")  # "HOT", "MEDIUM", "LOW"
    contact_name = Column(String)
    contact_role = Column(String)
    contact_email = Column(String)
    research_notes = Column(Text)
    outreach_messages = Column(Text)  # JSON string
    status = Column(String, default="NEW")  # "NEW", "CONTACTED", "RESPONDED", "MEETING", "CLOSED_LOST"
    source_url = Column(Text)
    source_type = Column(String)
    source_checked_at = Column(DateTime)
    location_verified = Column(Integer, default=0)
    business_category_verified = Column(Integer, default=0)
    domain_verified = Column(Integer, default=0)
    contact_verified = Column(Integer, default=0)
    email_verified = Column(Integer, default=0)
    validation_status = Column(String, default="UNVERIFIED")
    validation_reason = Column(Text)
    confidence_score = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    campaign = relationship("Campaign", back_populates="leads")
    campaign_run = relationship("CampaignRun", back_populates="leads")

class AgentLog(Base):
    __tablename__ = "agent_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String, ForeignKey("campaigns.id"), nullable=False)
    agent_name = Column(String, nullable=False)
    status = Column(String, default="pending")  # "pending", "running", "completed", "failed"
    message = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    campaign = relationship("Campaign", back_populates="logs")

def init_db():
    Base.metadata.create_all(bind=engine)

    # SQLite create_all does not alter existing tables. Add new fields safely
    # so existing local/demo databases can use the validation workflow.
    migrations = {
        "campaigns": {
            "max_leads": "INTEGER DEFAULT 12",
            "city": "VARCHAR DEFAULT ''",
        },
        "campaign_runs": {
            "run_type": "VARCHAR DEFAULT 'initial'",
            "status": "VARCHAR DEFAULT 'queued'",
            "city": "VARCHAR DEFAULT ''",
            "zones": "TEXT",
            "max_leads": "INTEGER DEFAULT 12",
            "error_message": "TEXT",
            "started_at": "DATETIME",
            "completed_at": "DATETIME",
            "created_at": "DATETIME",
        },
        "users": {
            "auth_user_id": "VARCHAR",
            "is_active": "INTEGER DEFAULT 1",
        },
        "leads": {
            "campaign_run_id": "VARCHAR",
            "source_url": "TEXT",
            "source_type": "VARCHAR",
            "source_checked_at": "DATETIME",
            "location_verified": "INTEGER DEFAULT 0",
            "business_category_verified": "INTEGER DEFAULT 0",
            "domain_verified": "INTEGER DEFAULT 0",
            "contact_verified": "INTEGER DEFAULT 0",
            "email_verified": "INTEGER DEFAULT 0",
            "validation_status": "VARCHAR DEFAULT 'UNVERIFIED'",
            "validation_reason": "TEXT",
            "confidence_score": "INTEGER DEFAULT 0",
        },
    }
    with engine.begin() as connection:
        inspector = inspect(engine)
        for table_name, columns in migrations.items():
            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, definition in columns.items():
                if column_name not in existing_columns:
                    connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"))
    
    # Pre-populate some dummy data for the demonstration
    db = SessionLocal()
    try:
        # Backfill the initial run for campaigns created before campaign_runs
        # existed, preserving their current history.
        legacy_campaigns = db.query(Campaign).all()
        for campaign in legacy_campaigns:
            if not campaign.runs:
                run = CampaignRun(
                    campaign_id=campaign.id,
                    organization_id=campaign.organization_id,
                    run_type="initial",
                    status=campaign.status,
                    city=campaign.city or "",
                    max_leads=campaign.max_leads or 12,
                    created_at=campaign.created_at,
                    completed_at=campaign.created_at if campaign.status != "running" else None,
                )
                db.add(run)
                db.flush()
                for lead in campaign.leads:
                    lead.campaign_run_id = run.id
        db.commit()

        # Check if we already have data
        if db.query(Organization).first() is None:
            # Default Organization (DM Event Lovers - Free Plan)
            default_org = Organization(
                id="default-tenant-id",
                name="DM - Event Lovers",
                plan="free",
                leads_limit=5,
                leads_used=4  # Already used 4 leads to show proximity to limit
            )
            db.add(default_org)

            # Default User
            default_user = User(
                id="default-user-id",
                organization_id=default_org.id,
                name="Carlos Farias",
                email="carlos@dmeventlovers.com",
                role="admin"
            )
            db.add(default_user)

            # Completed Campaign
            completed_campaign = Campaign(
                id="campaign-completed-id",
                organization_id=default_org.id,
                name="Prospección de Restaurantes en Guadalajara para eventos",
                prompt="necesito crear una campaña para ofrecer nuestro servicio de organización de eventos corporativos a restaurantes top y salones en Guadalajara",
                status="completed",
                progress=100.0,
                max_leads=12
            )
            db.add(completed_campaign)

            # Leads for completed campaign
            leads_data = [
                {
                    "company_name": "La Chata Restaurante",
                    "website": "lachata.com.mx",
                    "score": 92,
                    "priority": "HOT",
                    "contact_name": "Santiago Sánchez",
                    "contact_role": "Director de Operaciones",
                    "contact_email": "santiago.sanchez@lachata.com.mx",
                    "status": "RESPONDED",
                    "research_notes": "Restaurante tradicional con alta afluencia. Interesados en banquetes y eventos privados de fin de año.",
                    "outreach_messages": json.dumps({
                        "email": "Hola Santiago, notamos que La Chata tiene un gran espacio para banquetes. ¿Han considerado potenciar eventos de fin de año?",
                        "whatsapp": "Hola Santiago! Te escribe Carlos de DM Event Lovers. ¿Tienen 5 min para ver cómo llenar su agenda de banquetes?",
                        "linkedin": "Estimado Santiago, un placer conectar. Veo que lideras la operación en La Chata..."
                    })
                },
                {
                    "company_name": "I Latina",
                    "website": "ilatina.com.mx",
                    "score": 92,
                    "priority": "HOT",
                    "contact_name": "Carlos Sánchez",
                    "contact_role": "Director de Operaciones",
                    "contact_email": "carlos.sanchez@ilatina.com.mx",
                    "status": "RESPONDED",
                    "research_notes": "Cocina fusión creativa. Espacio ideal para cenas corporativas de perfil premium.",
                    "outreach_messages": json.dumps({
                        "email": "Hola Carlos, te escribo porque sabemos que I Latina es referente en experiencias premium. Queremos ofrecerles alianzas para eventos.",
                        "whatsapp": "Hola Carlos, un gusto saludarte. ¿Tienen disponibilidad en I Latina para cotizar eventos corporativos privados?",
                        "linkedin": "Hola Carlos, felicitaciones por la trayectoria de I Latina. Me gustaría conversar sobre eventos..."
                    })
                },
                {
                    "company_name": "Sagrantino",
                    "website": "sagrantino.com.mx",
                    "score": 92,
                    "priority": "HOT",
                    "contact_name": "Carlos López",
                    "contact_role": "Director de Operaciones",
                    "contact_email": "c.lopez@sagrantino.com.mx",
                    "status": "MEETING",
                    "research_notes": "Restaurante italiano de alta gama. Cuenta con terraza privada perfecta para cócteles empresariales.",
                    "outreach_messages": json.dumps({
                        "email": "Hola Carlos, nos interesa agendar eventos corporativos en su terraza Sagrantino...",
                        "whatsapp": "Hola Carlos! ¿Tienen libre la terraza para eventos empresariales el próximo mes?",
                        "linkedin": "Hola Carlos, sigo de cerca la gastronomía de Sagrantino..."
                    })
                },
                {
                    "company_name": "Lulo Bistro",
                    "website": "lulobistro.com",
                    "score": 92,
                    "priority": "HOT",
                    "contact_name": "Alejandra Rodríguez",
                    "contact_role": "Gerente de Compras y Suministros",
                    "contact_email": "alejandra@lulobistro.com",
                    "status": "MEETING",
                    "research_notes": "Café bistro con excelente menú brunch y reuniones corporativas matutinas.",
                    "outreach_messages": json.dumps({
                        "email": "Hola Alejandra, queremos coordinar desayunos de negocios en Lulo Bistro...",
                        "whatsapp": "Hola Alejandra! Te contactamos de DM Event Lovers por su paquete de desayunos corporativos.",
                        "linkedin": "Hola Alejandra, un gusto saludarte..."
                    })
                }
            ]

            for l in leads_data:
                lead = Lead(
                    campaign_id=completed_campaign.id,
                    organization_id=default_org.id,
                    company_name=l["company_name"],
                    website=l["website"],
                    score=l["score"],
                    priority=l["priority"],
                    contact_name=l["contact_name"],
                    contact_role=l["contact_role"],
                    contact_email=l["contact_email"],
                    research_notes=l["research_notes"],
                    outreach_messages=l["outreach_messages"],
                    status=l["status"]
                )
                db.add(lead)

            # Add completed logs for the completed campaign
            agents_list = [
                ("Supervisor Planning", "completed", "Estrategia de campaña definida. Target: Restaurantes en Guadalajara para eventos. Tareas programadas."),
                ("Prospect Discovery", "completed", "Búsqueda web finalizada. Se descubrieron 4 restaurantes calificados en la zona metropolitana de Guadalajara."),
                ("Deep Research", "completed", "Análisis de dominio de La Chata, I Latina, Sagrantino y Lulo Bistro completado. Se identificaron capacidades de eventos corporativos."),
                ("Contact Discovery", "completed", "Identificación de directivos (S. Sánchez, C. Sánchez, C. López, A. Rodríguez) y obtención de sus correos electrónicos."),
                ("Fit Scoring Engine", "completed", "Cálculo de scoring ejecutado. Todas las empresas cumplen con el perfil ideal de cliente (ICP) con puntaje 92."),
                ("Sequence Writer", "completed", "Mensajes y secuencias personalizadas para Email, WhatsApp y LinkedIn redactadas en español."),
                ("Tracker & Follow-Up", "completed", "Registro de leads e inicialización en el pipeline del Kanban completado de manera exitosa.")
            ]

            for name, status, msg in agents_list:
                log = AgentLog(
                    campaign_id=completed_campaign.id,
                    agent_name=name,
                    status=status,
                    message=msg
                )
                db.add(log)

            db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
