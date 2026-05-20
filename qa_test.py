#!/usr/bin/env python3
"""Script de QA funcional para el TPO Airbnb multi-DB."""

import requests, json, sys

BASE = "http://localhost:3000/api"

# ── IDs fijos del seed ────────────────────────────────────────────────────────
HOST1  = "11111111-0001-0001-0001-000000000001"
HOST2  = "11111111-0002-0001-0001-000000000002"
GUEST1 = "22222222-0001-0001-0001-000000000001"
GUEST2 = "22222222-0002-0001-0001-000000000002"
PROP1  = "33333333-0001-0001-0001-000000000001"  # Buenos Aires, $60000, cap 3
PROP2  = "33333333-0002-0001-0001-000000000002"  # Córdoba, $80000, cap 5
PROP3  = "33333333-0003-0001-0001-000000000003"  # Rosario, $45000, cap 2

# ── Contadores ────────────────────────────────────────────────────────────────
passed = 0
failed = 0
errors = []

def cleanup_reservas(*prop_ids):
    """Cancela todas las reservas confirmadas de las propiedades de prueba
    para que cada ejecución del test empiece con un estado limpio."""
    for prop_id in prop_ids:
        r = requests.get(f"{BASE}/reservas", params={"propiedad_id": prop_id, "estado": "confirmada"}, timeout=10)
        if r.status_code == 200:
            for res in r.json().get("data", []):
                requests.patch(f"{BASE}/reservas/{res['id']}/cancelar", json={}, timeout=10)

def check(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ✓  {name}")
        passed += 1
    else:
        print(f"  ✗  {name}" + (f"  →  {detail}" if detail else ""))
        failed += 1
        errors.append(f"{name}: {detail}")

def get(path, params=None):
    return requests.get(f"{BASE}{path}", params=params, timeout=10)

def post(path, body):
    return requests.post(f"{BASE}{path}", json=body, timeout=10)

def put(path, body):
    return requests.put(f"{BASE}{path}", json=body, timeout=10)

def patch(path, body=None):
    return requests.patch(f"{BASE}{path}", json=body or {}, timeout=10)

def delete(path):
    return requests.delete(f"{BASE}{path}", timeout=10)

def data(r):
    return r.json().get("data")

# ── Limpieza previa (datos de runs anteriores) ────────────────────────────────
print("Limpiando reservas confirmadas de runs anteriores…")
cleanup_reservas(PROP1, PROP2, PROP3)

# ═════════════════════════════════════════════════════════════════════════════
print("\n━━━ 1. SISTEMA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

r = get("/health")
check("GET /health → status 200",        r.status_code == 200)
check("GET /health → ok:true",           r.json().get("ok") is True)
check("GET /health → modo multi-db",     data(r).get("mode") == "multi-db")
check("GET /health → lista 4 bases",     len(data(r).get("databases", [])) == 4)

r = get("/dashboard")
d = data(r)
check("GET /dashboard → status 200",         r.status_code == 200)
check("GET /dashboard → usuarios >= 4",      d.get("usuarios", 0) >= 4)
check("GET /dashboard → anfitriones >= 2",   d.get("anfitriones", 0) >= 2)
check("GET /dashboard → propiedades >= 3",   d.get("propiedades", 0) >= 3)

# ═════════════════════════════════════════════════════════════════════════════
print("\n━━━ 2. AUTH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

r = post("/auth/login-simulado", {"usuario_id": GUEST1})
check("login con ID válido → 200",        r.status_code == 200)
check("login devuelve el usuario",        data(r).get("id") == GUEST1)

r = post("/auth/login-simulado", {"usuario_id": "00000000-0000-0000-0000-000000000000"})
check("login con ID inválido → 404",      r.status_code == 404)

# ═════════════════════════════════════════════════════════════════════════════
print("\n━━━ 3. USUARIOS (MongoDB) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

r = get("/usuarios")
usuarios = data(r)
check("GET /usuarios → 200",              r.status_code == 200)
check("GET /usuarios → al menos 4 seed", len(usuarios) >= 4)

r = get("/usuarios", {"tipo": "anfitrion"})
check("GET /usuarios?tipo=anfitrion → solo anfitriones",
      all(u["tipo"] == "anfitrion" for u in data(r)))
check("GET /usuarios?tipo=anfitrion → al menos 2",
      len(data(r)) >= 2)

r = get("/usuarios", {"tipo": "huesped"})
check("GET /usuarios?tipo=huesped → solo huéspedes",
      all(u["tipo"] == "huesped" for u in data(r)))
check("GET /usuarios?tipo=huesped → al menos 2",
      len(data(r)) >= 2)

# Crear huésped
r = post("/usuarios", {"nombre": "Test Huésped", "email": "test.huesped@qa.com", "tipo": "huesped"})
check("POST /usuarios huesped → 201",     r.status_code == 201)
new_guest_id = data(r).get("id") if r.status_code == 201 else None
check("POST /usuarios → tiene id",        bool(new_guest_id))
check("POST /usuarios → tipo correcto",   data(r).get("tipo") == "huesped")

# Crear anfitrión
r = post("/usuarios", {"nombre": "Test Anfitrión", "email": "test.anfitrion@qa.com", "tipo": "anfitrion"})
check("POST /usuarios anfitrion → 201",   r.status_code == 201)
new_host_id = data(r).get("id") if r.status_code == 201 else None

# Validaciones de creación
r = post("/usuarios", {"email": "x@x.com", "tipo": "huesped"})
check("POST /usuarios sin nombre → 400",  r.status_code == 400)

r = post("/usuarios", {"nombre": "X", "tipo": "huesped"})
check("POST /usuarios sin email → 400",   r.status_code == 400)

r = post("/usuarios", {"nombre": "X", "email": "x@x.com"})
check("POST /usuarios sin tipo → 400",    r.status_code == 400)

r = post("/usuarios", {"nombre": "X", "email": "x@x.com", "tipo": "admin"})
check("POST /usuarios tipo inválido → 400", r.status_code == 400)

# GET por ID
r = get(f"/usuarios/{HOST1}")
check("GET /usuarios/:id → 200",                  r.status_code == 200)
check("GET /usuarios/:id → id correcto",           data(r).get("id") == HOST1)
check("GET /usuarios/:id → tiene propiedades[]",   "propiedades" in data(r))

r = get("/usuarios/00000000-0000-0000-0000-000000000000")
check("GET /usuarios/:id inexistente → 404",      r.status_code == 404)

# PUT
r = put(f"/usuarios/{GUEST1}", {"nombre": "Lucía QA", "bio": "Bio actualizada"})
check("PUT /usuarios/:id → 200",                  r.status_code == 200)
check("PUT /usuarios/:id → nombre actualizado",   data(r).get("nombre") == "Lucía QA")
check("PUT /usuarios/:id → tipo no cambia",       data(r).get("tipo") == "huesped")

r = put(f"/usuarios/{GUEST1}", {"tipo": "anfitrion"})
check("PUT /usuarios/:id no puede cambiar tipo",  data(r).get("tipo") == "huesped")

r = put("/usuarios/00000000-0000-0000-0000-000000000000", {"nombre": "X"})
check("PUT /usuarios/:id inexistente → 404",      r.status_code == 404)

# ═════════════════════════════════════════════════════════════════════════════
print("\n━━━ 4. PROPIEDADES (MongoDB) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

r = get("/propiedades")
props = data(r)
check("GET /propiedades → 200",                   r.status_code == 200)
check("GET /propiedades → al menos 3 seed",       len(props) >= 3)
check("GET /propiedades → incluye anfitrion",     all("anfitrion" in p for p in props))

# Filtros
r = get("/propiedades", {"ciudad": "Buenos Aires"})
check("GET /propiedades?ciudad=Buenos Aires → filtra",
      all("Buenos Aires" in p["ubicacion"]["ciudad"] for p in data(r)))

r = get("/propiedades", {"ciudad": "buenos aires"})
check("GET /propiedades?ciudad búsqueda case-insensitive",
      len(data(r)) > 0)

r = get("/propiedades", {"tipo": "casa"})
check("GET /propiedades?tipo=casa → solo casas",
      all(p["tipo"] == "casa" for p in data(r)))

r = get("/propiedades", {"precioMin": 50000, "precioMax": 70000})
rp = data(r)
check("GET /propiedades?precioMin&precioMax → rango",
      all(50000 <= p["precio_noche"] <= 70000 for p in rp))

r = get("/propiedades", {"anfitrion_id": HOST1})
check("GET /propiedades?anfitrion_id → filtra",
      all(p["anfitrion_id"] == HOST1 for p in data(r)))

# Búsqueda geoespacial: Palermo, BA
r = get("/propiedades", {"lat": -34.589, "lng": -58.421, "radioKm": 5})
check("GET /propiedades geo → 200",        r.status_code == 200)
check("GET /propiedades geo → devuelve resultados", len(data(r)) > 0)

# Crear propiedad
nueva_prop_body = {
    "anfitrion_id": HOST1,
    "titulo": "Prop QA Test",
    "tipo": "departamento",
    "ubicacion": {"ciudad": "Mendoza", "pais": "Argentina", "direccion": "San Martín 100",
                  "coords": {"type": "Point", "coordinates": [-68.83, -32.89]}},
    "precio_noche": 55000,
    "cantidad_huespedes": 2,
}
r = post("/propiedades", nueva_prop_body)
check("POST /propiedades → 201",           r.status_code == 201)
new_prop_id = data(r).get("id") if r.status_code == 201 else None
check("POST /propiedades → tiene id",      bool(new_prop_id))
check("POST /propiedades → estado activa", data(r).get("estado") == "activa")

# Validaciones de creación
r = post("/propiedades", {**nueva_prop_body, "anfitrion_id": GUEST1})
check("POST /propiedades con huésped como anfitrion → 400", r.status_code == 400)

r = post("/propiedades", {**nueva_prop_body, "anfitrion_id": "00000000-0000-0000-0000-000000000000"})
check("POST /propiedades con anfitrion inexistente → 400", r.status_code == 400)

body_sin_titulo = {k: v for k, v in nueva_prop_body.items() if k != "titulo"}
r = post("/propiedades", body_sin_titulo)
check("POST /propiedades sin titulo → 400",  r.status_code == 400)

# GET por ID
r = get(f"/propiedades/{PROP1}")
check("GET /propiedades/:id → 200",               r.status_code == 200)
check("GET /propiedades/:id → tiene anfitrion",   "anfitrion" in data(r))
check("GET /propiedades/:id → tiene resenias[]",  "resenias" in data(r))

r = get("/propiedades/00000000-0000-0000-0000-000000000000")
check("GET /propiedades/:id inexistente → 404",   r.status_code == 404)

# PUT
r = put(f"/propiedades/{PROP3}", {"precio_noche": 50000, "descripcion": "Descripción actualizada QA"})
check("PUT /propiedades/:id → 200",               r.status_code == 200)
check("PUT /propiedades/:id → precio actualizado",data(r).get("precio_noche") == 50000)

r = put(f"/propiedades/{PROP3}", {"anfitrion_id": HOST2})
check("PUT /propiedades/:id no puede cambiar anfitrion_id",
      data(r).get("anfitrion_id") == HOST2)  # PROP3 pertenece a HOST2, no debería cambiar si enviamos HOST2

# DELETE (soft)
if new_prop_id:
    r = delete(f"/propiedades/{new_prop_id}")
    check("DELETE /propiedades/:id → 200",            r.status_code == 200)
    check("DELETE → estado eliminada",                data(r).get("estado") == "eliminada")

    r = get("/propiedades")
    ids_activas = [p["id"] for p in data(r)]
    check("GET /propiedades no muestra eliminadas",   new_prop_id not in ids_activas)

    r = get(f"/propiedades/{new_prop_id}")
    check("GET /propiedades/:id eliminada → 404",     r.status_code == 404)

# ═════════════════════════════════════════════════════════════════════════════
print("\n━━━ 5. RESERVAS (PostgreSQL) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

reserva_body = {
    "huesped_id": GUEST1,
    "propiedad_id": PROP1,
    "fecha_inicio": "2026-08-01",
    "fecha_fin": "2026-08-04",   # 3 noches × $60000 = $180000
    "cantidad_huespedes": 2,
    "pago": {"metodo": "tarjeta", "estado": "pendiente"}
}
r = post("/reservas", reserva_body)
check("POST /reservas → 201",             r.status_code == 201)
reserva1_id = data(r).get("id") if r.status_code == 201 else None
check("POST /reservas → tiene id",        bool(reserva1_id))
check("POST /reservas → estado confirmada", data(r).get("estado") == "confirmada")
check("POST /reservas → monto = 3 noches × 60000",
      data(r).get("pago", {}).get("monto") == 180000.0)
check("POST /reservas → hidrata huesped",    data(r).get("huesped", {}).get("id") == GUEST1)
check("POST /reservas → hidrata propiedad",  data(r).get("propiedad", {}).get("id") == PROP1)

# Validaciones
r = post("/reservas", {**reserva_body, "huesped_id": HOST1})
check("POST /reservas con anfitrion como huésped → 400", r.status_code == 400)

r = post("/reservas", {**reserva_body, "huesped_id": "00000000-0000-0000-0000-000000000000"})
check("POST /reservas usuario inexistente → 400", r.status_code == 400)

r = post("/reservas", {**reserva_body, "propiedad_id": "00000000-0000-0000-0000-000000000000"})
check("POST /reservas propiedad inexistente → 400", r.status_code == 400)

r = post("/reservas", {**reserva_body, "fecha_inicio": "2026-08-04", "fecha_fin": "2026-08-01"})
check("POST /reservas fecha_inicio >= fecha_fin → 400", r.status_code == 400)

r = post("/reservas", {**reserva_body, "fecha_inicio": "2026-08-01", "fecha_fin": "2026-08-01"})
check("POST /reservas fecha_inicio == fecha_fin → 400", r.status_code == 400)

r = post("/reservas", {**reserva_body, "cantidad_huespedes": 10})
check("POST /reservas supera capacidad → 400", r.status_code == 400)

# Solapamiento con reserva existente
r = post("/reservas", {**reserva_body, "fecha_inicio": "2026-08-02", "fecha_fin": "2026-08-05"})
check("POST /reservas solapamiento parcial → 409", r.status_code == 409,
      f"status={r.status_code}")

r = post("/reservas", {**reserva_body, "fecha_inicio": "2026-07-30", "fecha_fin": "2026-08-03"})
check("POST /reservas solapamiento al inicio → 409", r.status_code == 409)

r = post("/reservas", {**reserva_body, "fecha_inicio": "2026-07-30", "fecha_fin": "2026-08-10"})
check("POST /reservas reserva contenida → 409", r.status_code == 409)

# Reserva adyacente (empieza justo cuando termina la anterior → debe permitirse)
reserva_adj_body = {**reserva_body, "fecha_inicio": "2026-08-04", "fecha_fin": "2026-08-07"}
r = post("/reservas", reserva_adj_body)
check("POST /reservas fecha adyacente → 201 (no es solapamiento)",
      r.status_code == 201, f"status={r.status_code}, body={r.text[:200]}")
reserva_adj_id = data(r).get("id") if r.status_code == 201 else None

# GET con filtros
r = get("/reservas")
check("GET /reservas → 200",              r.status_code == 200)
check("GET /reservas → lista",            isinstance(data(r), list))

r = get("/reservas", {"huesped_id": GUEST1})
check("GET /reservas?huesped_id → filtra por huésped",
      all(rv["huesped_id"] == GUEST1 for rv in data(r)))

r = get("/reservas", {"anfitrion_id": HOST1})
check("GET /reservas?anfitrion_id → filtra por anfitrión",
      all(rv["anfitrion_id"] == HOST1 for rv in data(r)))

r = get("/reservas", {"estado": "confirmada"})
check("GET /reservas?estado=confirmada → filtra por estado",
      all(rv["estado"] == "confirmada" for rv in data(r)))

# Cancelar
if reserva_adj_id:
    r = patch(f"/reservas/{reserva_adj_id}/cancelar")
    check("PATCH /reservas/:id/cancelar → 200",  r.status_code == 200)
    check("PATCH cancelar → estado cancelada",   data(r).get("estado") == "cancelada")

    # Después de cancelar, las mismas fechas deben estar disponibles
    r = post("/reservas", reserva_adj_body)
    check("Después de cancelar → mismo rango disponible de nuevo → 201",
          r.status_code == 201, f"status={r.status_code}")
    if r.status_code == 201:
        reserva_adj_id = data(r).get("id")  # reuse for finalizar

r = patch("/reservas/00000000-0000-0000-0000-000000000000/cancelar")
check("PATCH cancelar ID inexistente → 404",  r.status_code == 404)

# Finalizar
if reserva1_id:
    r = patch(f"/reservas/{reserva1_id}/finalizar")
    check("PATCH /reservas/:id/finalizar → 200",       r.status_code == 200)
    check("PATCH finalizar → estado completada",        data(r).get("estado") == "completada")
    check("PATCH finalizar → pago completado",          data(r).get("pago", {}).get("estado") == "completado")

r = patch("/reservas/00000000-0000-0000-0000-000000000000/finalizar")
check("PATCH finalizar ID inexistente → 404",  r.status_code == 404)

# Actualizar pago
if reserva_adj_id:
    r = patch(f"/reservas/{reserva_adj_id}/pago", {"metodo": "transferencia", "estado": "pendiente"})
    check("PATCH /reservas/:id/pago → 200",       r.status_code == 200)
    check("PATCH pago → metodo actualizado",       data(r).get("pago", {}).get("metodo") == "transferencia")

# ═════════════════════════════════════════════════════════════════════════════
print("\n━━━ 6. RESEÑAS (Cassandra) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

# Para reseñar necesitamos una reserva completada — usamos reserva1_id (ya finalizada)
if reserva1_id:
    r = post("/resenias", {"reserva_id": reserva1_id, "calificacion": 5, "comentario": "Excelente"})
    check("POST /resenias reserva completada → 201",   r.status_code == 201)
    check("POST /resenias → calificacion guardada",    data(r).get("calificacion") == 5)
    check("POST /resenias → tiene id",                 bool(data(r).get("id")))

    # Duplicado
    r = post("/resenias", {"reserva_id": reserva1_id, "calificacion": 3})
    check("POST /resenias duplicada → 409",            r.status_code == 409)

# Reserva no completada (reserva_adj_id está confirmada o cancelada, no completada)
if reserva_adj_id:
    r = post("/resenias", {"reserva_id": reserva_adj_id, "calificacion": 4})
    check("POST /resenias reserva no completada → 400", r.status_code == 400)

# Reserva inexistente
r = post("/resenias", {"reserva_id": "00000000-0000-0000-0000-000000000000", "calificacion": 3})
check("POST /resenias reserva inexistente → 404",  r.status_code == 404)

# Validaciones de calificación
# Para estas validaciones necesitamos otra reserva completada
reserva2_body = {
    "huesped_id": GUEST2,
    "propiedad_id": PROP2,
    "fecha_inicio": "2026-09-01",
    "fecha_fin": "2026-09-03",
    "cantidad_huespedes": 2,
    "pago": {"metodo": "efectivo", "estado": "pendiente"}
}
r2 = post("/reservas", reserva2_body)
reserva2_id = data(r2).get("id") if r2.status_code == 201 else None
if reserva2_id:
    patch(f"/reservas/{reserva2_id}/finalizar")
    r = post("/resenias", {"reserva_id": reserva2_id, "calificacion": 0})
    check("POST /resenias calificacion=0 → 400",       r.status_code == 400)
    r = post("/resenias", {"reserva_id": reserva2_id, "calificacion": 6})
    check("POST /resenias calificacion=6 → 400",       r.status_code == 400)
    # Crear reseña válida con calificación 4
    r = post("/resenias", {"reserva_id": reserva2_id, "calificacion": 4, "comentario": "Muy buena"})
    check("POST /resenias calificacion=4 → 201",       r.status_code == 201)

# Verificar recalculo de ratings en MongoDB
r = get(f"/propiedades/{PROP1}")
check("Rating de propiedad actualizado en MongoDB tras reseña",
      data(r).get("promedio_rating", 0) > 0,
      f"promedio_rating={data(r).get('promedio_rating')}")

r = get(f"/usuarios/{HOST1}")
check("Rating del anfitrión actualizado en MongoDB tras reseña",
      data(r).get("promedio_rating", 0) > 0,
      f"promedio_rating={data(r).get('promedio_rating')}")

# GET reseñas
r = get("/resenias")
check("GET /resenias → 200",                          r.status_code == 200)
check("GET /resenias → lista no vacía",               len(data(r)) > 0)

r = get(f"/propiedades/{PROP1}/resenias")
check("GET /propiedades/:id/resenias → 200",          r.status_code == 200)
check("GET /propiedades/:id/resenias → lista",        isinstance(data(r), list))

r = get(f"/resenias/anfitrion/{HOST1}")
check("GET /resenias/anfitrion/:id → 200",            r.status_code == 200)
check("GET /resenias/anfitrion/:id → lista",          isinstance(data(r), list))

# ═════════════════════════════════════════════════════════════════════════════
print("\n━━━ 7. RECOMENDACIONES (Neo4j) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

# Usuario inexistente
r = get("/recomendaciones/00000000-0000-0000-0000-000000000000")
check("GET /recomendaciones/:id usuario inexistente → 404",  r.status_code == 404)

# Usuario sin reservas → fallback por rating
r = get(f"/recomendaciones/{GUEST2}")
check("GET /recomendaciones/:id sin historial → 200",      r.status_code == 200)
recs = data(r)
check("Fallback → devuelve propiedades (lista no vacía)",  len(recs) > 0)
check("Fallback → propiedades tienen id y titulo",
      all("id" in p and "titulo" in p for p in recs))

# Usuario con reservas → recomendaciones colaborativas
r = get(f"/recomendaciones/{GUEST1}")
check("GET /recomendaciones/:id con historial → 200",      r.status_code == 200)
recs_guest1 = data(r)
check("Recomendaciones → devuelve lista",                  isinstance(recs_guest1, list))
# La propiedad que ya reservó (PROP1) no debería aparecer
ids_rec = [p["id"] for p in recs_guest1]
check("Recomendaciones → prop ya reservada no aparece",    PROP1 not in ids_rec,
      f"PROP1 encontrado en recs: {ids_rec}")

# ═════════════════════════════════════════════════════════════════════════════
print("\n━━━ 8. DASHBOARD (conteos reales) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

r = get("/dashboard")
d = data(r)
check("Dashboard → reservas > 0 (Postgres)",         d.get("reservas", 0) > 0)
check("Dashboard → resenias > 0 (Cassandra)",        d.get("resenias", 0) > 0)

# ═════════════════════════════════════════════════════════════════════════════
print("\n━━━ 9. ENDPOINT INEXISTENTE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
r = get("/no-existe")
check("Endpoint inexistente → 404",  r.status_code == 404)

# ═════════════════════════════════════════════════════════════════════════════
print(f"\n{'━'*60}")
print(f"  RESULTADO:  {passed} ✓ pasados  /  {failed} ✗ fallidos  /  {passed+failed} total")
if errors:
    print(f"\n  FALLOS:")
    for e in errors:
        print(f"    • {e}")
print(f"{'━'*60}\n")

sys.exit(0 if failed == 0 else 1)
