import os
import json
import re
import datetime
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from backend.app.database import Campaign, CampaignRun, Lead, AgentLog, Organization, SessionLocal
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from dotenv import load_dotenv

# Try to load API keys dynamically
def get_api_keys():
    load_dotenv()
    tavily_key = os.getenv("TAVILY_API_KEY")
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    deepseek_base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    
    # Strip any spaces or line breaks
    if tavily_key:
        tavily_key = tavily_key.strip()
    if deepseek_key:
        deepseek_key = deepseek_key.strip()
    if deepseek_base_url:
        deepseek_base_url = deepseek_base_url.strip()
        
    return tavily_key, deepseek_key, deepseek_base_url

def call_deepseek(system_prompt: str, user_prompt: str, api_key: str, base_url: str) -> str:
    llm = ChatOpenAI(
        api_key=api_key,
        base_url=base_url,
        model="deepseek-chat",
        temperature=0.2
    )
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
    ]
    response = llm.invoke(messages)
    return response.content


BLOCKED_DOMAIN_PARTS = (
    "maps.apple.com", "maps.google.", "google.com/maps", "tripadvisor", "yelp.",
    "opentable", "facebook.com", "instagram.com", "foursquare", "booking.com",
    "yellowpages", "paginasamarillas", "linkedin.com", "tiktok.com", "youtube.com",
    "research.cs.", "wikipedia.org", "oponeo", "michelin", "castrol", "wanderboat",
    "kompass", "resy.com", "wanderlog", "grubbio", "patxis", "berettaweb"
)


def extract_domain(url: str) -> str:
    parsed = urlparse(url if url.startswith(("http://", "https://")) else f"https://{url}")
    return parsed.netloc.lower().split(":")[0].removeprefix("www.")


def is_blocked_source(url: str) -> bool:
    normalized = url.lower()
    domain = extract_domain(url)
    path = urlparse(url if url.startswith(("http://", "https://")) else f"https://{url}").path.lower()
    blocked_extension = bool(re.search(r"\.(pdf|txt|doc|docx|xls|xlsx|csv)(?:$|[?#])", path))
    academic_domain = domain.endswith((".edu", ".edu.mx", ".ac.uk", ".ac.nz"))
    return academic_domain or blocked_extension or any(part in normalized for part in BLOCKED_DOMAIN_PARTS)


def has_business_evidence(company_name: str, evidence: str) -> bool:
    name_tokens = [token for token in re.findall(r"[\wáéíóúñ]+", company_name.lower()) if len(token) > 3]
    evidence_lower = evidence.lower()
    return bool(name_tokens) and sum(token in evidence_lower for token in name_tokens) >= max(1, len(name_tokens) // 2)


def has_category_evidence(target_niche: str, evidence: str) -> bool:
    niche = target_niche.lower()
    category_groups = {
        "pizzer": ("pizza", "pizzer", "italian", "italiana"),
        "cafeter": ("cafe", "coffee", "cafeter"),
        "restaurant": ("restaurant", "restaurante", "cocina", "menu"),
        "salon": ("salon", "salón", "eventos", "banquete"),
    }
    terms = next((terms for key, terms in category_groups.items() if key in niche), tuple(re.findall(r"[\wáéíóúñ]+", niche)))
    evidence_lower = evidence.lower()
    return any(term in evidence_lower for term in terms if len(term) > 3)


def is_likely_official_site(company_name: str, domain: str, evidence: str) -> bool:
    name_tokens = [token for token in re.findall(r"[\wáéíóúñ]+", company_name.lower()) if len(token) > 3]
    domain_lower = domain.lower().removeprefix("www.")
    domain_match = any(token in domain_lower for token in name_tokens)
    official_markers = (
        "contact", "contacto", "menu", "menú", "order online", "pedido", "reserv", "hours", "horario",
        "address", "dirección", "ubicación", "location", "delivery"
    )
    marker_count = sum(marker in evidence.lower() for marker in official_markers)
    return domain_match or marker_count >= 3


def has_location_evidence(target_location: str, evidence: str) -> bool:
    evidence_lower = evidence.lower()
    location_markers = (
        "address", "dirección", "ubicación", "location", "calle", "avenida", "av.",
        "street", "colonia", "cp ", "c.p.", "zip", "phone", "teléfono", "tel."
    )
    return target_location.lower() in evidence_lower and any(marker in evidence_lower for marker in location_markers)


def verify_domain(url: str, company_name: str, target_location: str, raw_content: str):
    domain = extract_domain(url)
    if not domain or is_blocked_source(url):
        return False, False, ""

    evidence = f"{company_name} {raw_content}".lower()
    location_verified = has_location_evidence(target_location, evidence)
    try:
        request = Request(url, headers={"User-Agent": "DM-SDR-Research/1.0"})
        with urlopen(request, timeout=8) as response:
            if response.status >= 400:
                return False, location_verified, domain, ""
            page_text = response.read(250_000).decode("utf-8", errors="ignore")
            page_text = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", page_text, flags=re.I)
            page_text = re.sub(r"<[^>]+>", " ", page_text)
            page_text = re.sub(r"\s+", " ", page_text).strip()
    except Exception:
        # A search result can still be reviewed, but it is not a verified domain.
        return False, location_verified, domain, ""
    page_evidence = f"{company_name} {raw_content} {page_text}".lower()
    return True, has_location_evidence(target_location, page_evidence), domain, page_text[:20_000]


def extract_public_contact(text: str):
    emails = sorted(set(re.findall(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text or "", re.I)))
    return emails[0] if emails else None


def calculate_fit(comp: dict, target_niche: str, target_location: str):
    evidence = f"{comp.get('name', '')} {comp.get('raw_content', '')} {comp.get('research_notes', '')}".lower()
    location = target_location.lower() in evidence
    niche_terms = [term for term in re.findall(r"[\wáéíóúñ]+", target_niche.lower()) if len(term) > 3]
    category = any(term in evidence for term in niche_terms)
    score = 0
    score += 25 if location else 0
    score += 20 if category else 0
    score += 15 if comp.get("domain_verified") else 0
    score += 15 if comp.get("research_notes") and "no verificado" not in comp["research_notes"].lower() else 0
    score += 15 if comp.get("contact_verified") or comp.get("email_verified") else 0
    score += 10 if comp.get("source_url") else 0
    confidence = sum([
        bool(comp.get("domain_verified")),
        bool(comp.get("location_verified")),
        bool(comp.get("business_category_verified")),
        bool(comp.get("source_url")),
        bool(comp.get("email_verified")),
    ]) * 20
    if score >= 80 and confidence >= 70:
        priority = "HOT"
    elif score >= 50:
        priority = "MEDIUM"
    else:
        priority = "NEEDS_REVIEW"
    return score, confidence, priority


def validation_reason(comp: dict) -> str:
    missing = []
    if not comp.get("domain_verified"):
        missing.append("sitio oficial no verificado")
    if not comp.get("location_verified"):
        missing.append("ubicación no confirmada")
    if not comp.get("business_category_verified"):
        missing.append("categoría no confirmada")
    if not comp.get("contact_verified") and not comp.get("email_verified"):
        missing.append("contacto institucional no encontrado")
    return ", ".join(missing) or "Validaciones mínimas completadas"


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (value or "").lower())

def execute_pipeline(campaign_id: str, run_id: str | None = None):
    db = SessionLocal()
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            print(f"Campaign {campaign_id} not found")
            return

        run = db.query(CampaignRun).filter(CampaignRun.id == run_id).first() if run_id else None
        if run:
            run.status = "running"
            run.started_at = datetime.datetime.utcnow()
            db.commit()

        org = db.query(Organization).filter(Organization.id == campaign.organization_id).first()
        if not org:
            print(f"Organization not found for campaign")
            return

        # 1. SAAS LIMIT CHECK
        if org.plan == "free" and org.leads_used >= org.leads_limit:
            campaign.status = "failed"
            db.commit()
            
            error_log = AgentLog(
                campaign_id=campaign_id,
                agent_name="Supervisor Planning",
                status="failed",
                message="Error: Límite de leads alcanzado en tu Plan Gratuito (máximo 5 leads). Por favor, actualiza a Plan Premium para desbloquear ejecuciones ilimitadas."
            )
            db.add(error_log)
            db.commit()
            return

        # Initialize progress
        campaign.status = "running"
        campaign.progress = 0.0
        db.commit()

        # Load fresh keys at runtime
        tavily_key, deepseek_key, deepseek_base_url = get_api_keys()
        
        # Decide if we can run real APIs or fallback to mock
        has_keys = bool(tavily_key and deepseek_key)
        app_env = os.environ.get("APP_ENV", "development")
        
        if app_env == "production" and not has_keys:
            campaign.status = "failed"
            db.commit()
            error_log = AgentLog(
                campaign_id=campaign_id,
                agent_name="Supervisor Planning",
                status="failed",
                message="Error crítico: No hay saldo o llaves API configuradas. En producción no se permite la simulación de respaldo."
            )
            db.add(error_log)
            db.commit()
            return
        
        # We parse the prompt for fallbacks
        prompt_lower = campaign.prompt.lower()
        explicit_city = ((run.city if run else "") or campaign.city or "").strip()
        
        # Intelligent defaults
        target_niche = "Gimnasios"
        target_location = "Bogotá"
        search_queries = ["Gimnasios Bogotá websites", "Centros fitness Bogotá"]
        max_leads = max(1, min((run.max_leads if run else campaign.max_leads) or 12, 100))
        
        # Hardcoded templates as fallbacks
        if "restaurante" in prompt_lower or "comida" in prompt_lower:
            target_niche = "Restaurantes"
            target_location = "Guadalajara"
        elif "salon" in prompt_lower or "salón" in prompt_lower or "eventos" in prompt_lower:
            target_niche = "Salones de Eventos"
            target_location = "Guadalajara"
        elif "clinica" in prompt_lower or "dental" in prompt_lower or "dentista" in prompt_lower:
            target_niche = "Clínicas Dentales"
            target_location = "Madrid"
        elif "tecnologia" in prompt_lower or "software" in prompt_lower or "saas" in prompt_lower:
            target_niche = "Compañías de Software"
            target_location = "Ciudad de México"

        if explicit_city:
            target_location = explicit_city

        # STEP 1: SUPERVISOR PLANNING (14% Done)
        log1 = AgentLog(campaign_id=campaign_id, agent_name="Supervisor Planning", status="running")
        db.add(log1)
        db.commit()

        plan_message = ""
        is_using_real = False
        
        if has_keys:
            try:
                # Use DeepSeek as a smart parameter extractor
                extraction_system = (
                    "Eres un asistente de inteligencia de ventas SDR. Tu tarea es analizar el prompt de campaña del usuario "
                    "y extraer el nicho de negocio objetivo (target_niche) y la ubicación geográfica (target_location), además de "
                    "generar 3 consultas de búsqueda específicas para Tavily. Devuelve la respuesta en formato JSON estricto con las llaves "
                    "\"target_niche\", \"target_location\" y \"search_queries\" (lista de strings)."
                )
                extraction_user = f"Campaña: {campaign.name}\nCiudad explícita: {target_location}\nPrompt: {campaign.prompt}"
                extraction_res = call_deepseek(extraction_system, extraction_user, deepseek_key, deepseek_base_url)
                
                json_match = re.search(r'\{.*\}', extraction_res, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group(0))
                    target_niche = parsed.get("target_niche", target_niche)
                    target_location = explicit_city or parsed.get("target_location", target_location)
                    search_queries = parsed.get("search_queries", search_queries)
                    if explicit_city:
                        search_queries = [
                            query if explicit_city.lower() in query.lower() else f"{query} {explicit_city}"
                            for query in search_queries
                        ]

                if run and run.zones:
                    zones = json.loads(run.zones)
                    search_queries = search_queries + [
                        f"{target_niche} {zone} {target_location} sitio oficial" for zone in zones
                    ]
                elif "guadalajara" in target_location.lower():
                    zones = ["Centro", "Providencia", "Chapultepec", "Chapalita", "Zapopan", "Tlaquepaque", "Andares"]
                    search_queries = search_queries + [
                        f"{target_niche} {zone} {target_location} sitio oficial" for zone in zones
                    ]
                
                # Now invoke DeepSeek to write the planning strategy
                system_p = "Eres el Supervisor de Planificación de DM SDR. Tu tarea es analizar la necesidad de campaña del usuario (en español) y trazar una estrategia estructurada de prospección dividida en 6 pasos de ejecución."
                user_p = f"Campaña: {campaign.name}\nCiudad objetivo: {target_location}\nNecesidad: {campaign.prompt}"
                plan_message = call_deepseek(system_p, user_p, deepseek_key, deepseek_base_url)
                is_using_real = True
            except Exception as e:
                if app_env == "production":
                    campaign.status = "failed"
                    db.commit()
                    log1.status = "failed"
                    log1.message = f"Error crítico: Falló la API de DeepSeek en producción. ({str(e)})"
                    db.commit()
                    return
                plan_message = f"[ADVERTENCIA: Falló la API real de DeepSeek ({str(e)}). Activando simulación inteligente de respaldo...]\n\n"
        
        if not plan_message or not is_using_real:
            plan_message += (
                f"Estrategia de campaña definida para el nicho '{target_niche}' en '{target_location}'.\n"
                f"1. Prospect Discovery: Identificar hasta 12 sitios web objetivo en {target_location}.\n"
                f"2. Deep Research: Analizar tamaño, propuesta de valor y pain points de cada prospecto.\n"
                f"3. Contact Discovery: Localizar decisores clave ({target_niche}).\n"
                f"4. Fit Scoring Engine: Evaluar coincidencia matemática con el perfil de cliente ideal (ICP).\n"
                f"5. Sequence Writer: Redactar correos, mensajes de WhatsApp y LinkedIn personalizados en español.\n"
                f"6. Tracker: Guardar los prospectos calificados en la base de datos."
            )

        log1.status = "completed"
        log1.message = plan_message
        campaign.progress = 14.0
        db.commit()

        # STEP 2: PROSPECT DISCOVERY (28% Done)
        log2 = AgentLog(campaign_id=campaign_id, agent_name="Prospect Discovery", status="running")
        db.add(log2)
        db.commit()

        found_companies = []
        is_using_tavily = False
        
        if is_using_real:
            try:
                from tavily import TavilyClient
                tavily = TavilyClient(api_key=tavily_key)
                
                # Stage 1: Search directories or lists of best companies in the niche
                raw_search_findings = []
                for q in search_queries[:8]:
                    tavily_res = tavily.search(query=q, max_results=8) # Get up to 8 results per query
                    raw_search_findings.extend(tavily_res.get("results", []))
                
                # Stage 2: Pass search page snippets to DeepSeek to extract ACTUAL INDIVIDUAL companies
                context_text = ""
                for idx, item in enumerate(raw_search_findings, 1):
                    context_text += f"Resultado {idx}: Título: {item.get('title')}, URL: {item.get('url')}, Resumen: {item.get('content')}\n\n"
                
                extraction_prompt = (
                    f"A continuación tienes resultados de búsqueda sobre '{target_niche}' en '{target_location}'.\n"
                    f"Tu tarea es extraer nombres de negocios INDIVIDUALES reales (hasta {max_leads} candidatos) "
                    f"mencionados en estos textos. \n"
                    f"REGLA CRÍTICA: Debes descartar de forma estricta directorios generales de opiniones, agregadores, guías, listados generales y plataformas de reservas o viajes "
                    f"(por ejemplo TripAdvisor, Yelp, OpenTable, Páginas Amarillas, OpenTable.com.mx, yelp.com, tripadvisor.es, opentable.com, booking.com, etc.). Solo queremos los establecimientos locales reales.\n"
                    f"Devuelve un objeto JSON estricto con la llave \"companies\" conteniendo una lista de strings con los nombres limpios de los negocios.\n\n"
                    f"RESULTADOS DE BÚSQUEDA:\n{context_text}"
                )
                
                companies_res = call_deepseek(
                    "Eres un extractor de datos de prospección SDR. Extrae los nombres de establecimientos locales independientes, filtrando agregadores y directorios web.",
                    extraction_prompt, deepseek_key, deepseek_base_url
                )
                
                json_match = re.search(r'\{.*\}', companies_res, re.DOTALL)
                extracted_names = []
                if json_match:
                    parsed = json.loads(json_match.group(0))
                    extracted_names = parsed.get("companies", [])

                # A malformed or empty LLM extraction must not erase all search
                # results. Titles are retained only for manual review.
                if not extracted_names:
                    for item in raw_search_findings:
                        title = (item.get("title") or "").strip()
                        url = item.get("url") or ""
                        if title and url and not is_blocked_source(url):
                            extracted_names.append(title)
                        if len(extracted_names) >= max_leads:
                            break
                
                # Deduplicate names
                extracted_names = list(set(extracted_names))
                
                # Stage 3: For each individual company name, perform a targeted query to find its OFFICIAL website
                found_companies_dict = {}
                for name in extracted_names[:max_leads]:
                    # Query Tavily specifically for this company's official website
                    targeted_query = f"{name} {target_location} official website domain"
                    site_res = tavily.search(query=targeted_query, max_results=2)
                    
                    # Find a valid domain that is NOT a social directory or aggregator.
                    official_url = ""
                    official_domain = ""
                    snippet_content = ""
                    
                    for r in site_res.get("results", []):
                        url = r.get("url", "")
                        domain_match = re.search(r'https?://([^/]+)', url)
                        domain = domain_match.group(1) if domain_match else ""
                        
                        if domain and not is_blocked_source(url):
                            scheme = urlparse(url).scheme or "https"
                            official_url = f"{scheme}://{domain}"
                            official_domain = domain
                            snippet_content = f"{r.get('title', '')} {r.get('content', '')}"
                            break

                    if not official_url:
                        # Keep the discovered name for manual review instead of
                        # silently dropping it when no official site is found.
                        review_key = f"review:{name.lower()}"
                        found_companies_dict[review_key] = {
                            "name": name,
                            "domain": "",
                            "url": "",
                            "source_url": "",
                            "source_type": "search_result",
                            "raw_content": "No se encontró un sitio oficial verificable.",
                            "domain_verified": False,
                            "location_verified": False,
                            "business_category_verified": False,
                            "contact_verified": False,
                            "email_verified": False,
                            "validation_status": "NEEDS_REVIEW",
                        }
                        continue

                    domain_verified, location_verified, official_domain, page_text = verify_domain(
                        official_url, name, target_location, snippet_content
                    )
                    evidence = f"{snippet_content} {page_text}".strip()
                    business_match = has_business_evidence(name, evidence)
                    category_match = has_category_evidence(target_niche, evidence)
                    official_match = business_match and is_likely_official_site(name, official_domain, evidence)
                    domain_verified = domain_verified and official_match
                    found_companies_dict[official_domain] = {
                        "name": name,
                        "domain": official_domain,
                        "url": official_url,
                        "source_url": official_url,
                        "source_type": "official_site" if domain_verified else "search_result",
                        "raw_content": evidence,
                        "domain_verified": domain_verified,
                        "location_verified": location_verified,
                        "business_category_verified": category_match,
                        "business_match": business_match,
                        "official_match": official_match,
                        "contact_verified": False,
                        "email_verified": False,
                        "validation_status": "NEEDS_REVIEW",
                    }
                
                found_companies = list(found_companies_dict.values())
                is_using_tavily = True
            except Exception as e:
                if app_env == "production":
                    campaign.status = "failed"
                    db.commit()
                    log2.status = "failed"
                    log2.message = f"Error crítico: Falló la búsqueda de Tavily en producción. ({str(e)})"
                    db.commit()
                    return
                print(f"Directory filtering search error: {e}")
        discovery_message = f"Búsqueda finalizada. Se encontraron {len(found_companies)} candidatos verificables o pendientes de revisión en {target_location} (máximo solicitado: {max_leads}):\n"
        for idx, comp in enumerate(found_companies, 1):
            discovery_message += f"{idx}. {comp['name']} ({comp['domain']})\n"
        
        log2.status = "completed"
        log2.message = discovery_message
        campaign.progress = 28.0
        db.commit()

        # STEP 3: DEEP RESEARCH (42% Done)
        log3 = AgentLog(campaign_id=campaign_id, agent_name="Deep Research", status="running")
        db.add(log3)
        db.commit()

        research_message = "Análisis profundo de dominios finalizado:\n"
        for comp in found_companies:
            if is_using_real:
                try:
                    system_p = "Eres el Agente de Deep Research de DM. Analiza únicamente la evidencia proporcionada. Devuelve en español: 1. Modelo de negocio, 2. Tamaño aproximado y 3. Principal pain point comercial. Si un dato no está respaldado por la evidencia, escribe 'No verificado'. No inventes información."
                    user_p = f"Compañía: {comp['name']}\nUbicación objetivo: {target_location}\nFuente: {comp.get('source_url', '')}\nContenido: {comp.get('raw_content', '')}"
                    response = call_deepseek(system_p, user_p, deepseek_key, deepseek_base_url)
                    
                    comp["research_notes"] = response
                    research_message += f"- {comp['name']}: {response[:150]}...\n"
                    continue
                except Exception as e:
                    if app_env == "production":
                        campaign.status = "failed"
                        db.commit()
                        log3.status = "failed"
                        log3.message = f"Error crítico: Falló Deep Research en producción. ({str(e)})"
                        db.commit()
                        return
                    print(f"DeepSeek research error: {e}")

            comp["research_notes"] = "No verificado: no fue posible obtener evidencia suficiente del sitio o del proveedor de research."
            research_message += f"- {comp['name']}: No verificado; requiere revisión manual.\n"

        log3.status = "completed"
        log3.message = research_message
        campaign.progress = 42.0
        db.commit()

        # STEP 4: CONTACT DISCOVERY (56% Done)
        log4 = AgentLog(campaign_id=campaign_id, agent_name="Contact Discovery", status="running")
        db.add(log4)
        db.commit()

        contact_message = "Búsqueda de tomadores de decisiones completada:\n"
        for comp in found_companies:
            public_email = extract_public_contact(comp.get("raw_content", ""))
            comp["email"] = public_email
            comp["contact_name"] = None
            comp["contact_role"] = None
            comp["contact_verified"] = False
            email_domain = public_email.rsplit("@", 1)[-1].lower().removeprefix("www.") if public_email else ""
            comp["email_verified"] = bool(
                public_email
                and comp.get("domain_verified")
                and (email_domain == comp.get("domain", "").lower().removeprefix("www.")
                     or email_domain.endswith(f".{comp.get('domain', '').lower().removeprefix('www.')}"))
            )
            contact_message += f"- {comp['name']}: contacto personal no verificado; correo público: {public_email or 'no encontrado'}\n"

        log4.status = "completed"
        log4.message = contact_message
        campaign.progress = 56.0
        db.commit()

        # STEP 5: FIT SCORING ENGINE (70% Done)
        log5 = AgentLog(campaign_id=campaign_id, agent_name="Fit Scoring Engine", status="running")
        db.add(log5)
        db.commit()

        scoring_message = "Cálculo matemático de Fit Score completado (ICP ideal):\n"
        for comp in found_companies:
            score, confidence, priority = calculate_fit(comp, target_niche, target_location)
            comp["score"] = score
            comp["confidence_score"] = confidence
            comp["priority"] = priority
            comp["validation_status"] = (
                "QUALIFIED" if (
                    comp.get("domain_verified")
                    and comp.get("location_verified")
                    and comp.get("business_category_verified")
                    and comp.get("source_type") == "official_site"
                    and score >= 50
                )
                else "NEEDS_REVIEW"
            )
            comp["validation_reason"] = validation_reason(comp)
            scoring_message += f"- {comp['name']}: Fit {score}/100, confianza {confidence}/100 -> {priority} ({comp['validation_status']})\n"

        log5.status = "completed"
        log5.message = scoring_message
        campaign.progress = 70.0
        db.commit()

        # STEP 6: SEQUENCE WRITER (86% Done)
        log6 = AgentLog(campaign_id=campaign_id, agent_name="Sequence Writer", status="running")
        db.add(log6)
        db.commit()

        writer_message = "Mensajes y secuencias personalizadas redactadas en español:\n"
        for comp in found_companies:
            contact_label = comp.get("contact_name") or f"equipo de {comp['name']}"
            outreach = {
                "email": (
                    f"Asunto: Una idea para {comp['name']}\n\n"
                    f"Hola, {contact_label}.\n\n"
                    f"Estamos explorando una colaboración con negocios de {target_niche} en {target_location}. "
                    f"Vimos su presencia pública y nos gustaría compartir una idea relacionada con: {campaign.prompt}.\n\n"
                    f"¿Te parece si te comparto algunos detalles?\n\nSaludos,\nCarlos Farias"
                ),
                "whatsapp": (
                    f"Hola. Te escribe Carlos de DM Event Lovers. Vimos a {comp['name']} en nuestra investigación de {target_niche} en {target_location}. "
                    f"La campaña busca: {campaign.prompt} ¿Con quién podríamos conversar sobre esto?"
                ),
                "linkedin": (
                    f"Hola, me gustaría contactar a la persona responsable de {comp['name']}. "
                    f"Estamos trabajando una iniciativa para {target_niche} en {target_location}: {campaign.prompt}"
                )
            }
            
            if is_using_real:
                try:
                    system_p = "Eres el Agente Sequence Writer de DM. Redacta copys persuasivos en español para 3 canales: Email, WhatsApp y LinkedIn. Devuelve únicamente el contenido estructurado en JSON con las llaves 'email', 'whatsapp' y 'linkedin'."
                    user_p = f"Contacto verificado: {contact_label}\nEmpresa: {comp['name']}\nCampaña: {campaign.prompt}\nEvidencia: {comp.get('raw_content', '')}\nResearch: {comp.get('research_notes', '')}"
                    response = call_deepseek(system_p, user_p, deepseek_key, deepseek_base_url)
                    
                    try:
                        json_match = re.search(r'\{.*\}', response, re.DOTALL)
                        if json_match:
                            parsed_outreach = json.loads(json_match.group(0))
                            if all(k in parsed_outreach for k in ['email', 'whatsapp', 'linkedin']):
                                outreach = parsed_outreach
                    except Exception:
                        pass
                except Exception as e:
                    if app_env == "production":
                        campaign.status = "failed"
                        db.commit()
                        log6.status = "failed"
                        log6.message = f"Error crítico: Falló DeepSeek en Sequence Writer en producción. ({str(e)})"
                        db.commit()
                        return
                    print(f"DeepSeek writing error: {e}")
                    
            comp["outreach"] = outreach
            writer_message += f"- Secuencia redactada para {comp['name']} (Email, WhatsApp, LinkedIn).\n"

        log6.status = "completed"
        log6.message = writer_message
        campaign.progress = 86.0
        db.commit()

        # STEP 7: TRACKER & FOLLOW-UP (100% Done)
        log7 = AgentLog(campaign_id=campaign_id, agent_name="Tracker & Follow-Up", status="running")
        db.add(log7)
        db.commit()

        # Deduplicate candidates against previous runs in the organization.
        existing_leads = db.query(Lead).filter(Lead.organization_id == campaign.organization_id).all()
        existing_keys = {
            normalize_key(lead.website) if lead.website else normalize_key(lead.company_name)
            for lead in existing_leads
        }
        unique_companies = []
        for comp in found_companies:
            candidate_key = normalize_key(comp.get("domain")) if comp.get("domain") else normalize_key(comp.get("name"))
            if candidate_key and candidate_key in existing_keys:
                continue
            if candidate_key:
                existing_keys.add(candidate_key)
            unique_companies.append(comp)
        found_companies = unique_companies

        # Save Leads into DB
        qualified_count = sum(1 for comp in found_companies if comp["validation_status"] == "QUALIFIED")
        review_count = sum(1 for comp in found_companies if comp["validation_status"] == "NEEDS_REVIEW")
        for comp in found_companies:
            new_lead = Lead(
                campaign_id=campaign_id,
                campaign_run_id=run_id,
                organization_id=campaign.organization_id,
                company_name=comp["name"],
                website=comp["domain"],
                score=comp["score"],
                priority=comp["priority"],
                contact_name=comp.get("contact_name"),
                contact_role=comp.get("contact_role"),
                contact_email=comp.get("email"),
                research_notes=comp.get("research_notes", "Identificado en prospección real."),
                outreach_messages=json.dumps(comp["outreach"]),
                status="NEW",
                source_url=comp.get("source_url"),
                source_type=comp.get("source_type"),
                source_checked_at=datetime.datetime.utcnow(),
                location_verified=int(bool(comp.get("location_verified"))),
                business_category_verified=int(bool(comp.get("business_category_verified"))),
                domain_verified=int(bool(comp.get("domain_verified"))),
                contact_verified=int(bool(comp.get("contact_verified"))),
                email_verified=int(bool(comp.get("email_verified"))),
                validation_status=comp.get("validation_status", "NEEDS_REVIEW"),
                validation_reason=comp.get("validation_reason"),
                confidence_score=comp.get("confidence_score", 0),
            )
            db.add(new_lead)

        org.leads_used += qualified_count

        tracker_message = (
            f"Control de calidad completado: {len(found_companies)} candidatos procesados, "
            f"{qualified_count} calificados y {review_count} pendientes de revisión. "
            f"Se guardaron los resultados en la base de datos."
        )

        log7.status = "completed"
        log7.message = tracker_message
        campaign.status = (
            "completed" if qualified_count and not review_count
            else "completed_with_review" if found_companies
            else "completed_empty"
        )
        campaign.progress = 100.0
        if run:
            run.status = campaign.status
            run.completed_at = datetime.datetime.utcnow()
        db.commit()

    except Exception as e:
        db.rollback()
        campaign.status = "failed"
        if run:
            run.status = "failed"
            run.error_message = str(e)
            run.completed_at = datetime.datetime.utcnow()
        db.commit()
        
        err_log = AgentLog(
            campaign_id=campaign_id,
            agent_name="Tracker & Follow-Up",
            status="failed",
            message=f"Error en la ejecución del pipeline: {str(e)}"
        )
        db.add(err_log)
        db.commit()
    finally:
        db.close()
