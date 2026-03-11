# Política: CP de la planilla vs CP que devuelve Google

Cuando se cargan envíos (modelo Excel o subir individual), el **código postal (CP)** puede venir de dos fuentes:

1. **CP de la columna** – Lo que ingresó el cliente/operador en el Excel (o en el formulario).
2. **CP de Google** – El que devuelve la API de Geocoding al interpretar la dirección (si en algún momento geocodificamos y extraemos el CP del resultado).

Si en el futuro se geocodifica al cargar (o en otro momento) y el CP de Google **no coincide** con el de la columna, hay que tener una regla clara.

---

## Los dos casos que planteás

### Caso A: La dirección con el CP de la columna no existe (pusieron mal el CP)

- En la práctica: la dirección “correcta” (la que encuentra Google) está en **otro** CP.
- Ejemplo: en la planilla dice “Av. Corrientes 1234, CP 1043” pero ese número en Corrientes corresponde en realidad a CP 1042. Google devuelve 1042.

**Recomendación:**  
- **Usar el CP de Google** para zona y costo (y guardarlo como CP “oficial” del envío).  
- Motivo: el CP de la columna es **erróneo**; si seguimos usándolo, la zona y el precio pueden ser incorrectos.  
- Opcional: guardar el CP original de la columna en un campo tipo “CP informado” y marcar el envío con una advertencia (“CP corregido por geocodificación”) para auditoría.

---

### Caso B: La dirección existe con el CP de la columna, pero Google devuelve otro CP

- Puede pasar cuando:
  - Una calle toca dos CP (límite entre zonas).
  - La dirección es ambigua y Google elige una interpretación.
  - Hay diferencias entre cómo el cliente define “zona” y cómo lo hace Google.

**Recomendación:**  
- **Mantener el CP de la columna** para zona y tarifa (no reemplazarlo por el de Google).  
- Motivo: el cliente ya “eligió” un CP (por su sistema, contrato o convención). Cambiarlo automáticamente podría mover el envío a otra zona y cambiar el precio o la lógica comercial.  
- Opcional: guardar también el CP que devolvió Google (ej. en un campo “CP según geocode”) y **marcar el envío** con una advertencia tipo “CP difiere del devuelto por Google” para que alguien pueda revisar si hace falta.

---

## Resumen de la política propuesta

| Situación | Qué usar para zona/costo | Acción extra |
|-----------|---------------------------|--------------|
| **A** – Dirección con CP de columna no existe / Google devuelve otro CP “correcto” | **CP de Google** | Opcional: guardar CP original y flag “CP corregido por geocode”. |
| **B** – Dirección válida con ambos CP; columna y Google difieren | **CP de la columna** | Opcional: guardar CP de Google y flag “CP distinto al de Google” para revisión. |

En ambos casos, para **ubicación en mapa y ruta** conviene usar siempre las coordenadas (y, si se quiere, la dirección formateada) que devuelve Google; el tema del CP afecta sobre todo **zona y facturación**.

---

## Cómo distinguir A de B en la práctica

No siempre se puede saber con certeza si “la dirección con el CP de la columna existe o no”. Se puede aproximar así:

1. **Geocodificar la dirección tal como está** (incluyendo el CP de la columna en el string).
2. **Geocodificar solo calle + localidad** (sin CP), o la dirección “sin CP” que use el sistema.
3. Del resultado de Google, **extraer el CP** (componente `postal_code` en la respuesta).

Regla operativa:

- Si el **CP que devuelve Google** es **distinto** al de la columna:
  - **Opción conservadora (recomendada si no hay geocode al subir):**  
    Dejar siempre el **CP de la columna** para zona/costo y, si en el futuro se guarda un “CP geocode”, usarlo solo para **avisos** (“atención: Google sugiere CP X”) y no para cambiar zona ni precio automáticamente.
  - **Opción más agresiva:**  
    Si tenés un flujo donde geocodificás al cargar:
    - Si el CP de la columna está **vacío o inválido** → usar CP de Google.
    - Si ambos son válidos pero **distintos** → mantener CP de columna y guardar el de Google + flag de discrepancia.

---

## Implementación (solo Subir envíos / Excel)

La política está implementada **solo en Subir envíos** (carga por Excel), donde sí existe la columna CP. En **Subir individual** no hay campo de CP en el formulario y se deja tal cual.

1. **Campos en el envío (backend):**
   - `codigoPostal` – Sigue siendo el que define zona/costo (columna o el que decida la política).
   - `codigoPostalGeocode` (opcional) – CP extraído del resultado de Google.
   - `cpDiferenciado` (boolean, opcional) – `true` si columna y Google difieren (o si se “corrigió” el CP).

2. **Al geocodificar (en carga masiva o al guardar):**
   - Extraer `postal_code` del resultado de Google.
   - Comparar con el CP de la columna.
   - Aplicar la política (A: usar Google; B: mantener columna, guardar Google y marcar).

3. **En la UI:**
   - Mostrar una advertencia o ícono cuando `cpDiferenciado` es true (o cuando hay “CP corregido”), por ejemplo en la lista de envíos o en el detalle.

Así tenés una política clara (qué CP “gana” en cada caso) y, si lo implementás, un camino concreto sin pisar la lógica comercial actual.
