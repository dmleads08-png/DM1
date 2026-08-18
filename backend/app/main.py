import os
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import json
from dotenv import load_dotenv
import jwt
from jwt import PyJWKClient
import httpx

# Load environment variables
load_dotenv()

from backend.app.database import init_db, SessionLocal, Organization, User, Campaign, CampaignRun, Lead, AgentLog
from backend.app.agents.pipeline import execute_pipeline

# Initialize database tables
init_db()

app = FastAPI(title="DM Autonomous SDR Platform API")

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get db session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic schemas
class CampaignCreate(BaseModel):
    name: str
    prompt: str
    city: str
    organization_id: str = "default-tenant-id"
    max_leads: int = 12


class CampaignRunCreate(BaseModel):
    max_leads: Optional[int] = None
    city: Optional[str] = None
    zones: List[str] = []
    run_type: str = "expand"


class OrganizationCreate(BaseModel):
    name: str


class AdminUserCreate(BaseModel):
    email: str
    name: str
    organization_id: str
    role: str = "user"
    password: str

class CampaignResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    prompt: str
    city: str
    status: str
    progress: float
    created_at: str
    max_leads: int

    class Config:
        from_attributes = True

class LeadUpdate(BaseModel):
    status: Optional[str] = None
    validation_status: Optional[str] = None
    research_notes: Optional[str] = None


def auth_is_configured() -> bool:
    return bool(os.getenv("SUPABASE_URL") and (os.getenv("SUPABASE_JWT_SECRET") or os.getenv("SUPABASE_URL")))


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    # Local development remains usable until Supabase variables are configured.
    if not auth_is_configured() and os.getenv("APP_ENV", "development") != "production":
        user = db.query(User).filter(User.id == "default-user-id").first() or db.query(User).first()
        if user:
            return user

    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sesión requerida")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        secret = os.getenv("SUPABASE_JWT_SECRET")
        if secret:
            payload = jwt.decode(token, secret, algorithms=["HS256"], audience="authenticated")
        else:
            jwks_url = f"{os.environ['SUPABASE_URL'].rstrip('/')}/auth/v1/.well-known/jwks.json"
            signing_key = PyJWKClient(jwks_url).get_signing_key_from_jwt(token)
            payload = jwt.decode(token, signing_key.key, algorithms=["RS256", "ES256"], audience="authenticated")
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Token de sesión inválido") from exc

    user = db.query(User).filter(User.auth_user_id == payload.get("sub"), User.is_active != False).first()
    if not user:
        email = payload.get("email", "").lower().strip()
        if email:
            user = db.query(User).filter(User.email == email, User.is_active != False).first()
            if user:
                user.auth_user_id = payload.get("sub")
                bootstrap_email = os.getenv("SUPABASE_BOOTSTRAP_ADMIN_EMAIL", "").lower().strip()
                if email == bootstrap_email:
                    user.role = "admin"
                db.commit()
                
    if not user:
        print(f"DEBUG: User not found for payload: {payload}")
        raise HTTPException(status_code=403, detail="Usuario sin organización asignada")
    print(f"DEBUG: Authenticated user: {user.email}, role: {user.role}, auth_user_id: {user.auth_user_id}")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Se requiere rol admin")
    return current_user


def ensure_org_access(org_id: str, current_user: User):
    if org_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta organización")

# Endpoints
@app.get("/api/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "auth_user_id": current_user.auth_user_id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "organization_id": current_user.organization_id,
    }


@app.get("/api/organizations/{org_id}")
def get_organization(org_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    target_org_id = org_id
    if org_id == "default-tenant-id" and current_user.organization_id != "default-tenant-id":
        target_org_id = current_user.organization_id
    ensure_org_access(target_org_id, current_user)
    org = db.query(Organization).filter(Organization.id == target_org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    return {
        "id": org.id,
        "name": org.name,
        "plan": org.plan,
        "leads_limit": org.leads_limit,
        "leads_used": org.leads_used,
        "created_at": org.created_at
    }

@app.post("/api/billing/upgrade")
def upgrade_organization(org_id: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    target_org_id = org_id or current_user.organization_id
    if target_org_id == "default-tenant-id" and current_user.organization_id != "default-tenant-id":
        target_org_id = current_user.organization_id
    ensure_org_access(target_org_id, current_user)
    org = db.query(Organization).filter(Organization.id == target_org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    org.plan = "premium"
    org.leads_limit = 999999
    db.commit()
    
    return {
        "status": "success",
        "message": "Organización actualizada a Plan Premium con procesamiento ilimitado.",
        "plan": org.plan,
        "leads_limit": org.leads_limit
    }

@app.post("/api/campaigns")
def create_campaign(campaign_in: CampaignCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    organization_id = current_user.organization_id
    # Verify organization exists
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # SAAS limit check
    if org.plan == "free" and org.leads_used >= org.leads_limit:
        raise HTTPException(
            status_code=403, 
            detail="Límite de leads excedido en Plan Gratuito (máximo 5 leads). Por favor, actualiza a Premium."
        )

    # Create campaign
    new_campaign = Campaign(
        name=campaign_in.name,
        prompt=campaign_in.prompt,
        city=campaign_in.city.strip(),
        organization_id=organization_id,
        user_id=current_user.id,
        status="draft",
        progress=0.0,
        max_leads=max(1, min(campaign_in.max_leads, 100))
    )
    db.add(new_campaign)
    db.commit()
    db.refresh(new_campaign)

    run = CampaignRun(
        campaign_id=new_campaign.id,
        organization_id=new_campaign.organization_id,
        run_type="initial",
        status="queued",
        city=new_campaign.city,
        max_leads=new_campaign.max_leads,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # Launch pipeline in background task
    background_tasks.add_task(execute_pipeline, new_campaign.id, run.id)

    return {
        "id": new_campaign.id,
        "name": new_campaign.name,
        "prompt": new_campaign.prompt,
        "city": new_campaign.city,
        "status": "running",  # pipeline.py immediately sets status to running
        "progress": 0.0,
        "max_leads": new_campaign.max_leads,
        "run_id": run.id,
        "created_at": new_campaign.created_at.isoformat()
    }

@app.get("/api/campaigns")
def get_campaigns(org_id: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    target_org_id = org_id or current_user.organization_id
    if target_org_id == "default-tenant-id" and current_user.organization_id != "default-tenant-id":
        target_org_id = current_user.organization_id
    ensure_org_access(target_org_id, current_user)
    campaigns = db.query(Campaign).filter(
        Campaign.organization_id == target_org_id,
        Campaign.user_id == current_user.id
    ).order_by(Campaign.created_at.desc()).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "prompt": c.prompt,
            "city": c.city or "",
            "status": c.status,
            "progress": c.progress,
            "created_at": c.created_at.isoformat(),
            "max_leads": c.max_leads or 12
            ,"run_count": len(c.runs)
        } for c in campaigns
    ]

@app.get("/api/campaigns/{campaign_id}")
def get_campaign(campaign_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    ensure_org_access(campaign.organization_id, current_user)
    
    # Get associated logs
    logs = db.query(AgentLog).filter(AgentLog.campaign_id == campaign_id).order_by(AgentLog.created_at.asc()).all()
    
    return {
        "id": campaign.id,
        "name": campaign.name,
        "prompt": campaign.prompt,
        "city": campaign.city or "",
        "status": campaign.status,
        "progress": campaign.progress,
        "created_at": campaign.created_at.isoformat(),
        "max_leads": campaign.max_leads or 12,
        "logs": [
            {
                "id": l.id,
                "agent_name": l.agent_name,
                "status": l.status,
                "message": l.message,
                "created_at": l.created_at.isoformat()
            } for l in logs
        ],
        "runs": [
            {
                "id": run.id,
                "run_type": run.run_type,
                "status": run.status,
                "city": run.city,
                "zones": json.loads(run.zones) if run.zones else [],
                "max_leads": run.max_leads,
                "started_at": run.started_at.isoformat() if run.started_at else None,
                "completed_at": run.completed_at.isoformat() if run.completed_at else None,
                "created_at": run.created_at.isoformat(),
            } for run in campaign.runs
        ]
    }


@app.get("/api/campaigns/{campaign_id}/runs")
def get_campaign_runs(campaign_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    ensure_org_access(campaign.organization_id, current_user)
    runs = db.query(CampaignRun).filter(CampaignRun.campaign_id == campaign_id).order_by(CampaignRun.created_at.desc()).all()
    return [
        {
            "id": run.id,
            "campaign_id": run.campaign_id,
            "run_type": run.run_type,
            "status": run.status,
            "city": run.city,
            "zones": json.loads(run.zones) if run.zones else [],
            "max_leads": run.max_leads,
            "error_message": run.error_message,
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
            "created_at": run.created_at.isoformat(),
        } for run in runs
    ]


@app.post("/api/campaigns/{campaign_id}/runs")
def create_campaign_run(campaign_id: str, run_in: CampaignRunCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    ensure_org_access(campaign.organization_id, current_user)
    max_leads = max(1, min(run_in.max_leads or campaign.max_leads or 12, 100))
    run = CampaignRun(
        campaign_id=campaign.id,
        organization_id=campaign.organization_id,
        run_type=run_in.run_type if run_in.run_type in {"expand", "retry"} else "expand",
        status="queued",
        city=(run_in.city or campaign.city or "").strip(),
        zones=json.dumps(run_in.zones),
        max_leads=max_leads,
    )
    db.add(run)
    campaign.status = "running"
    campaign.progress = 0.0
    db.commit()
    db.refresh(run)
    background_tasks.add_task(execute_pipeline, campaign.id, run.id)
    return {"id": run.id, "campaign_id": campaign.id, "status": run.status, "max_leads": run.max_leads}


@app.post("/api/campaigns/{campaign_id}/duplicate")
def duplicate_campaign(campaign_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    ensure_org_access(campaign.organization_id, current_user)
    duplicate = Campaign(
        organization_id=campaign.organization_id,
        name=f"{campaign.name} (copia)",
        prompt=campaign.prompt,
        city=campaign.city,
        max_leads=campaign.max_leads,
        status="draft",
        progress=0.0,
    )
    db.add(duplicate)
    db.commit()
    db.refresh(duplicate)
    run = CampaignRun(campaign_id=duplicate.id, organization_id=duplicate.organization_id, run_type="initial", status="queued", city=duplicate.city, max_leads=duplicate.max_leads)
    db.add(run)
    db.commit()
    db.refresh(run)
    background_tasks.add_task(execute_pipeline, duplicate.id, run.id)
    return {"id": duplicate.id, "run_id": run.id, "name": duplicate.name, "status": "running"}


@app.patch("/api/campaigns/{campaign_id}/archive")
def archive_campaign(campaign_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    ensure_org_access(campaign.organization_id, current_user)
    campaign.status = "archived"
    db.commit()
    return {"status": "archived", "campaign_id": campaign.id}

@app.get("/api/leads")
def get_leads(
    org_id: Optional[str] = None, 
    campaign_id: Optional[str] = None, 
    priority: Optional[str] = None, 
    status: Optional[str] = None, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_org_id = org_id or current_user.organization_id
    if target_org_id == "default-tenant-id" and current_user.organization_id != "default-tenant-id":
        target_org_id = current_user.organization_id
    ensure_org_access(target_org_id, current_user)
    query = db.query(Lead).filter(Lead.organization_id == target_org_id)
    if current_user.role != "admin":
        query = query.join(Campaign).filter(Campaign.user_id == current_user.id)
        
    if campaign_id:
        query = query.filter(Lead.campaign_id == campaign_id)
    if priority:
        query = query.filter(Lead.priority == priority)
    if status:
        query = query.filter(Lead.status == status)
        
    leads = query.order_by(Lead.score.desc()).all()
    
    result = []
    for l in leads:
        outreach = {}
        if l.outreach_messages:
            try:
                outreach = json.loads(l.outreach_messages)
            except Exception:
                outreach = {"email": l.outreach_messages}
                
        result.append({
            "id": l.id,
            "campaign_id": l.campaign_id,
            "company_name": l.company_name,
            "website": l.website,
            "score": l.score,
            "priority": l.priority,
            "contact_name": l.contact_name,
            "contact_role": l.contact_role,
            "contact_email": l.contact_email,
            "research_notes": l.research_notes,
            "outreach_messages": outreach,
            "status": l.status,
            "created_at": l.created_at.isoformat(),
            "source_url": l.source_url,
            "source_type": l.source_type,
            "location_verified": bool(l.location_verified),
            "business_category_verified": bool(l.business_category_verified),
            "domain_verified": bool(l.domain_verified),
            "contact_verified": bool(l.contact_verified),
            "email_verified": bool(l.email_verified),
            "validation_status": l.validation_status or "UNVERIFIED",
            "validation_reason": l.validation_reason,
            "confidence_score": l.confidence_score or 0
        })
    return result

@app.patch("/api/leads/{lead_id}")
def update_lead(lead_id: str, lead_update: LeadUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    ensure_org_access(lead.organization_id, current_user)
    
    if lead_update.validation_status is not None:
        lead.validation_status = lead_update.validation_status
        
    if lead_update.research_notes is not None:
        lead.research_notes = lead_update.research_notes
        
    if lead_update.status is not None:
        current_val_status = lead_update.validation_status if lead_update.validation_status is not None else lead.validation_status
        if lead_update.status in {"CONTACTED", "RESPONDED", "MEETING"} and current_val_status != "QUALIFIED":
            raise HTTPException(status_code=409, detail="Este prospecto requiere validación antes de iniciar outreach.")
        lead.status = lead_update.status
        
    db.commit()
    return {"status": "success", "lead_id": lead.id, "new_status": lead.status, "validation_status": lead.validation_status, "research_notes": lead.research_notes}


@app.post("/api/admin/organizations")
def create_organization(org_in: OrganizationCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    organization = Organization(name=org_in.name.strip(), plan="free", leads_limit=5, leads_used=0)
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return {"id": organization.id, "name": organization.name, "plan": organization.plan}


@app.get("/api/admin/organizations")
def list_organizations(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    orgs = db.query(Organization).all()
    return [{"id": o.id, "name": o.name, "plan": o.plan} for o in orgs]


@app.post("/api/admin/users")
def create_admin_user(user_in: AdminUserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if user_in.role not in {"admin", "user"}:
        raise HTTPException(status_code=422, detail="Rol inválido")
    organization = db.query(Organization).filter(Organization.id == user_in.organization_id).first()
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    supabase_url = os.getenv("SUPABASE_URL")
    auth_user_id = None
    if supabase_url and service_key:
        try:
            response = httpx.post(
                f"{supabase_url.rstrip('/')}/auth/v1/admin/users",
                headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
                json={
                    "email": user_in.email,
                    "password": user_in.password,
                    "email_confirm": True,
                    "user_metadata": {"name": user_in.name, "role": user_in.role}
                },
                timeout=15,
            )
            response.raise_for_status()
            auth_user_id = response.json().get("id")
        except httpx.HTTPError as exc:
            detail = "No se pudo crear el usuario en Supabase"
            if exc.response is not None:
                try:
                    detail = exc.response.json().get("msg", detail)
                except ValueError:
                    pass
            raise HTTPException(status_code=502, detail=detail) from exc
    elif os.getenv("APP_ENV", "development") == "production":
        raise HTTPException(status_code=503, detail="SUPABASE_SERVICE_ROLE_KEY no está configurada")

    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="El email ya está registrado")
    user = User(
        organization_id=organization.id,
        name=user_in.name.strip(),
        email=user_in.email.lower().strip(),
        role=user_in.role,
        auth_user_id=auth_user_id,
        is_active=1,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "name": user.name, "role": user.role, "organization_id": user.organization_id}


@app.get("/api/admin/users")
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    users = db.query(User).all()
    result = []
    for u in users:
        org = db.query(Organization).filter(Organization.id == u.organization_id).first()
        result.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "organization_id": u.organization_id,
            "organization_name": org.name if org else "Desconocida",
            "is_active": u.is_active == 1,
            "created_at": u.created_at.isoformat() if u.created_at else None
        })
    return result


@app.patch("/api/admin/users/{user_id}")
def update_admin_user_status(user_id: str, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if "is_active" in payload:
        u.is_active = 1 if payload["is_active"] else 0
    db.commit()
    return {"status": "success", "is_active": u.is_active == 1}


@app.delete("/api/admin/users/{user_id}")
def delete_admin_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    supabase_url = os.getenv("SUPABASE_URL")
    if supabase_url and service_key and u.auth_user_id:
        try:
            response = httpx.delete(
                f"{supabase_url.rstrip('/')}/auth/v1/admin/users/{u.auth_user_id}",
                headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
                timeout=15,
            )
            response.raise_for_status()
        except Exception as e:
            print(f"Supabase delete auth user warning: {e}")
    db.delete(u)
    db.commit()
    return {"status": "success"}

# Serve React static files in production mode
# First check if the directory exists to avoid crashes in dev mode before building the frontend
frontend_dist_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")

if os.path.exists(frontend_dist_path):
    app.mount("/", StaticFiles(directory=frontend_dist_path, html=True), name="static")
    
    # Catch-all route to redirect all unknown routes to React's index.html for client-side routing
    @app.exception_handler(404)
    async def custom_404_handler(request, exc):
        return FileResponse(os.path.join(frontend_dist_path, "index.html"))
else:
    @app.get("/")
    def read_root():
        return {
            "message": "FastAPI is running. Build the frontend in frontend/dist to serve it here, or run Vite dev server."
        }
