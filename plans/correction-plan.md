# Plan de correccion del pipeline SDR

## Objetivo

Convertir el pipeline actual en un sistema de prospeccion confiable antes de permitir que los resultados se utilicen para contacto comercial. El sistema debe distinguir claramente entre:

- Datos encontrados y verificados.
- Datos encontrados pero pendientes de validacion.
- Inferencias generadas por el modelo.
- Datos que no deben utilizarse para outreach.

La campana solo debe aparecer como completada cuando termine el procesamiento y la validacion minima de calidad, no solo cuando se hayan insertado registros en la base de datos.

## Hallazgos que deben corregirse

1. Contact Discovery inventa nombres y cargos de decisores.
2. Los correos se construyen por inferencia a partir del nombre y el dominio.
3. Se aceptan agregadores, mapas y directorios como si fueran sitios oficiales.
4. Se generan dominios de respaldo aunque no hayan sido encontrados.
5. Deep Research trabaja principalmente con snippets y no con contenido verificado del sitio.
6. El Fit Score utiliza valores aleatorios como fallback y no tiene criterios reproducibles.
7. El Sequence Writer puede utilizar mensajes genericos de eventos aunque la campana tenga otro objetivo.
8. La campana se marca como completada aunque los leads no esten validados.
9. La interfaz afirma utilizar LangGraph y seis agentes, pero el backend ejecuta una funcion secuencial con siete etapas incluyendo al supervisor.
10. La cantidad de prospectos esta limitada de facto a un numero fijo aproximado, sin relacion con la poblacion, el mercado o la evidencia encontrada.

## Principios de diseño

- No inventar datos de contacto.
- No crear un email guessed como si fuera un email verificado.
- La fuente y la fecha deben acompañar cada dato importante.
- La calidad debe prevalecer sobre el numero de leads.
- Un modelo puede extraer o resumir evidencia, pero no sustituye la validacion.
- Los fallbacks deben ser seguros y visibles, nunca silenciosos.
- El sistema debe poder terminar con menos leads si no existen suficientes prospectos validos.

## Plan por fases

### Fase 0: Contrato de datos y estados

Definir un esquema explicito para la evidencia del lead. Como minimo, agregar o modelar:

- `source_url`: URL de donde se obtuvo el dato.
- `source_type`: sitio oficial, directorio, mapa, red social u otra fuente.
- `source_checked_at`: fecha de consulta.
- `location_verified`: ciudad y pais confirmados.
- `business_category_verified`: categoria confirmada.
- `domain_verified`: dominio resolvio y corresponde al negocio.
- `contact_verified`: el contacto fue encontrado en una fuente.
- `email_verified`: el correo fue publicado o confirmado por una fuente.
- `validation_status`: `UNVERIFIED`, `NEEDS_REVIEW`, `QUALIFIED` o `REJECTED`.
- `confidence_score`: confianza de los datos, separada del fit comercial.

Separar estos conceptos:

- `fit_score`: que tan buen prospecto parece para la campana.
- `data_confidence`: que tan confiables son los datos.
- `priority`: prioridad comercial calculada a partir de ambos.

### Fase 1: Discovery confiable

Reemplazar el flujo actual de "nombre -> dominio supuesto" por un flujo con evidencia:

1. Usar Tavily para descubrir candidatos.
2. Eliminar dominios de mapas, redes sociales, agregadores, directorios y reservas.
3. Resolver el dominio por HTTP/HTTPS y comprobar que el sitio responde.
4. Verificar que el contenido mencione el nombre del negocio o una marca claramente relacionada.
5. Verificar la ciudad y el pais mediante el sitio, datos estructurados, pagina de contacto o una segunda fuente.
6. Guardar la URL exacta y el texto que sustenta la inclusion.
7. Rechazar el candidato si solo existe una coincidencia debil o un dominio no relacionado.

No debe existir un fallback que construya `nombre.mx` o cualquier otro dominio supuesto. Si no se encuentra un sitio oficial, el candidato puede quedar como `NEEDS_REVIEW`, pero no debe presentarse como prospecto calificado.

### Fase 2: Deep Research con fuentes

Implementar una extraccion controlada del sitio oficial:

- Titulo y meta descripcion.
- Nombre comercial.
- Ciudad, direccion y cobertura geografica.
- Categoria del negocio.
- Numero de sucursales cuando exista evidencia.
- Servicios, productos o senales relevantes para la campana.
- Datos de contacto publicados.
- URL de cada pagina consultada.

El LLM debe recibir contenido extraido y sus fuentes, no solo un resumen de Tavily. Cada afirmacion de research debe poder relacionarse con una fuente. Si no hay evidencia suficiente, el texto debe indicar `No verificado` en lugar de completar la informacion por inferencia.

### Fase 3: Contact Discovery sin invencion

Eliminar cualquier instruccion que pida inventar nombres. El agente solo debe extraer contactos que aparezcan en fuentes verificables:

- Pagina oficial del negocio.
- Pagina oficial de equipo o contacto.
- LinkedIn u otra fuente profesional, si se integra formalmente.
- Registro o directorio autorizado, si se decide utilizarlo.

Reglas:

- Si no se encuentra una persona, usar `contact_name = null`.
- Si solo se conoce un cargo generico, guardar el cargo sin inventar el nombre.
- Si no existe un email publicado, usar un canal institucional verificado o dejar el campo vacio.
- Nunca fabricar un correo con `nombre.apellido@dominio`.
- No permitir outreach automatico con `email_verified = false`.

### Fase 4: Validacion de email y dominio

Antes de guardar un lead como `QUALIFIED`:

- Normalizar el dominio quitando `www.` del email, pero conservar la URL original.
- Comprobar que el dominio del email coincida con el dominio oficial o con un dominio corporativo relacionado documentado.
- Rechazar emails con dominios de mapas, directorios o plataformas.
- Validar formato y, cuando sea legal y tecnicamente viable, comprobar DNS/MX.
- Marcar como no verificado cualquier email inferido.

La validacion de correo no debe intentar enviar mensajes reales. La verificacion de existencia de un buzón requiere un proveedor especifico y debe tratarse como una decision separada.

### Fase 5: Fit Scoring reproducible

Eliminar `random.randint()` del flujo de produccion. Definir un score basado en criterios visibles y ponderados. Ejemplo inicial:

- 25 puntos: coincide la ciudad y zona objetivo.
- 20 puntos: coincide la categoria solicitada.
- 15 puntos: existe evidencia de capacidad, tamaño o segmento deseado.
- 15 puntos: existe un pain point respaldado por evidencia.
- 15 puntos: existe un sitio oficial valido y activo.
- 10 puntos: existe contacto o canal institucional verificable.

Guardar el desglose y la justificacion, no solo el total. La prioridad debe considerar la confianza:

- `HOT`: fit alto y datos suficientemente confiables.
- `MEDIUM`: fit razonable o datos incompletos.
- `NEEDS_REVIEW`: buen candidato, pero falta evidencia.
- `REJECTED`: no coincide con la campana o la fuente es invalida.

El modelo puede sugerir un score, pero las reglas deterministas deben imponer los limites y evitar que una respuesta del LLM convierta un lead sin dominio o sin ciudad verificada en `HOT`.

### Fase 6: Sequence Writer alineado con la campana

El mensaje debe construirse a partir de:

- Objetivo exacto de la campana.
- Producto o servicio que se quiere vender.
- Evidencia concreta del prospecto.
- Canal permitido y nivel de confianza.

Si falta evidencia, el mensaje debe usar una formulacion prudente y no afirmar hechos no comprobados. El fallback no debe mencionar eventos, banquetes o cualquier otro servicio fijo si no esta presente en la campana.

Validaciones del resultado del LLM:

- JSON con esquema estricto.
- Campos obligatorios por canal.
- Longitud y tono validos.
- Sin afirmaciones que no esten en la evidencia.
- Sin promesas de resultados no sustentadas.

### Fase 7: Quality Control y estados del pipeline

Agregar una etapa entre Sequence Writer y Tracker:

`Quality Control -> Tracker & Follow-Up`

El control debe verificar:

- Dominio oficial.
- Ubicacion.
- Categoria.
- Duplicados.
- Evidencia de contacto.
- Validez del email.
- Coherencia del score.
- Coherencia de los mensajes con la campana.

La campana debe terminar con uno de estos estados:

- `completed`: ejecucion terminada y leads validos guardados.
- `completed_with_review`: ejecucion terminada, pero quedan candidatos pendientes.
- `completed_empty`: no se encontraron suficientes leads validos.
- `failed`: error tecnico que impidio continuar.

El log debe indicar cuantos candidatos fueron encontrados, rechazados, pendientes y calificados. No debe decir "prospectos calificados" si solo fueron insertados en la base de datos.

## Cantidad de prospectos

### Problema

El pipeline actual limita el procesamiento a aproximadamente 12 empresas mediante cortes fijos como `extracted_names[:12]`. Esto no tiene relacion con:

- Poblacion de la ciudad.
- Tamano del nicho.
- Cobertura geografica.
- Densidad de negocios.
- Calidad de los resultados.
- Limites reales del plan.

Una ciudad pequena puede tener menos de 12 negocios validos y una ciudad grande puede tener cientos o miles. El sistema no debe rellenar el resultado con candidatos inventados solo para alcanzar una cifra.

### Decision recomendada ahora

No agregar todavia un recuadro para que el usuario configure manualmente el numero de prospectos. Primero debe corregirse la calidad del discovery y definirse una politica de cobertura. Un selector sin un mecanismo de busqueda y validacion adecuado solo haria que el sistema produjera mas datos dudosos.

### Comportamiento recomendado

Implementar discovery adaptativo:

1. Generar consultas por zona, categoria y tipo de negocio.
2. Recolectar candidatos hasta agotar las consultas o llegar a un limite tecnico seguro.
3. Deduplicar por dominio normalizado y nombre comercial.
4. Validar cada candidato.
5. Detenerse cuando se alcance una cantidad de leads calificados o cuando ya no aparezcan candidatos nuevos.
6. Permitir terminar con menos leads que el objetivo si no hay suficiente evidencia.

Como primera version, puede existir una configuracion interna no visible para el usuario:

- `min_qualified_leads`: objetivo minimo, no garantia.
- `max_candidates_to_process`: proteccion de coste y tiempo.
- `max_qualified_leads`: cantidad maxima de prospectos calificados que se pueden devolver.

La interfaz podria mostrar posteriormente un campo llamado "Cantidad maxima de prospectos". Este valor debe funcionar como limite superior, no como cantidad garantizada. La respuesta debe informar, por ejemplo:

`Se procesaron 47 candidatos, se rechazaron 21, quedaron 8 en revision y se calificaron 18.`

### Futura configuracion de usuario

Cuando la calidad este resuelta, se puede agregar un recuadro avanzado con:

- Cantidad maxima de prospectos.
- Zonas o colonias.
- Radio geografico.
- Tamano del negocio.
- Tipos de negocio.
- Presupuesto o limite de busqueda.

El valor elegido debe controlar el esfuerzo de busqueda, no forzar la creacion de prospectos. Si el usuario establece una cantidad maxima de 100 y solo hay 23 leads validos, el sistema debe devolver 23 y explicarlo.

## Alineacion tecnica y de producto

1. Decidir si se va a implementar LangGraph de verdad o si el producto se mantendra como pipeline secuencial.
2. Eliminar de la interfaz cualquier afirmacion que no corresponda con el backend.
3. Alinear el conteo y los nombres de agentes entre backend y frontend.
4. Mostrar modo de ejecucion: real, parcial o fallback.
5. Mostrar fuentes y nivel de confianza por lead.
6. Evitar que el frontend presente un log de sistema con una fecha fija.
7. Registrar errores de cada etapa con contexto y no continuar silenciosamente cuando falle una validacion critica.

## Criterios de aceptacion

- Ningun nombre de contacto se genera por invencion.
- Ningun correo inferido se marca como verificado.
- Ningun mapa, agregador o directorio se guarda como sitio oficial.
- Ningun dominio se crea por slug automatico.
- Cada lead calificado tiene fuente, ciudad y categoria verificadas.
- El score es reproducible con los mismos datos.
- El mensaje corresponde al objetivo real de la campana.
- Una ciudad con pocos negocios puede devolver menos leads sin rellenar artificialmente.
- Una ciudad grande puede procesar mas candidatos sin detenerse arbitrariamente en 10 o 12.
- La interfaz refleja el numero real de etapas y el modo real de ejecucion.

## Orden de implementacion

1. Eliminar invencion de contactos, emails y dominios.
2. Agregar validacion de dominio, ciudad, categoria y fuentes.
3. Agregar estados `NEEDS_REVIEW`, `QUALIFIED` y `REJECTED`.
4. Sustituir scoring aleatorio por reglas deterministas.
5. Corregir los fallbacks de mensajes y hacerlos dependientes de la campana.
6. Implementar Quality Control y nuevos estados finales.
7. Hacer discovery adaptativo sin limite fijo de 12.
8. Alinear frontend, logs y nomenclatura de agentes.
9. Evaluar posteriormente un selector de objetivo de prospectos.
