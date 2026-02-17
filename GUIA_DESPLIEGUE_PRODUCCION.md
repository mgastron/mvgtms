# Guía de despliegue a producción — TMS Llegue (AWS)

Objetivo: dejar **frontend** y **backend** online en **AWS**, con dominio **mvgtms.com.ar**, pensado para escalar y con alta disponibilidad (múltiples clientes, decenas de miles de envíos diarios).

Stack: **AWS Amplify** (frontend), **ECS Fargate + ALB** (backend), **RDS PostgreSQL** (base de datos).

---

## 1. Visión general

| Componente | Servicio AWS | URL final |
|------------|--------------|-----------|
| **Frontend** (Next.js) | AWS Amplify | https://mvgtms.com.ar |
| **Backend** (Spring Boot) | ECS Fargate + ALB | https://api.mvgtms.com.ar |
| **Base de datos** | RDS PostgreSQL (Multi-AZ) | — |

---

## 2. Orden recomendado de tareas

1. Repo en GitHub y primer push (qué subir y qué no).
2. RDS PostgreSQL (base de datos).
3. Imagen Docker del backend y ECR (repositorio de imágenes).
4. Cluster ECS, ALB, target group, task definition y servicio (backend).
5. Dominio api.mvgtms.com.ar al ALB (DNS).
6. Frontend en Amplify y dominio mvgtms.com.ar.
7. Variables de entorno (ECS y Amplify).
8. Redirect URIs en Shopify, Mercado Libre y Tienda Nube.
9. Pruebas.

---

## 3. Paso a paso detallado

---

### 3.1 Repositorio Git (qué subir, cómo y desde dónde)

Objetivo: tener el código en GitHub para que AWS (Amplify y ECR/ECS) pueda usarlo, **sin subir secretos ni archivos sensibles**.

#### 3.1.1 Cuenta y repositorio en GitHub

1. Entrá a [github.com](https://github.com) e iniciá sesión (o creá una cuenta).
2. Clic en el **+** (arriba a la derecha) → **New repository**.
3. **Repository name**: por ejemplo `tms-llegue` (o el nombre que uses).
4. Dejalo **Private** o **Public** según prefieras. No marques “Add a README” si ya tenés el proyecto en tu PC.
5. Clic en **Create repository**. Dejá abierta la página; vas a necesitar la URL del repo (ej. `https://github.com/tu-usuario/tms-llegue.git`).

#### 3.1.2 Qué NO debe subirse nunca

- **`.env`**, **`.env.local`**, **`.env.production`**: tienen claves, URLs de túnel, contraseñas. El frontend en Amplify usará variables que configurás en la consola de AWS.
- **`backend/data/`**: base H2 local; en producción usás RDS.
- **`backend/logs/`**: logs locales.
- **`backend/target/`**: compilados; se generan en el build.
- Cualquier archivo con contraseñas, API keys o tokens.

Tu `.gitignore` ya debería incluir la mayoría. **Revisá** que existan estas líneas (en la raíz del proyecto, archivo `.gitignore`):

```gitignore
.env*.local
.env
backend/target/
backend/data/
backend/logs/
```

Si `backend/data/` o `backend/logs/` no están, agregalos en una nueva línea, guardá el archivo y seguí.

#### 3.1.3 Qué SÍ se sube

- Toda la carpeta del proyecto: **frontend** (carpeta raíz con `package.json`, `app/`, `components/`, etc.), **backend** (carpeta `backend/` con `pom.xml`, `src/`, `Dockerfile`, `.dockerignore`), **mobile** si lo tenés, y archivos como `README.md`, `GUIA_DESPLIEGUE_PRODUCCION.md`, etc.  
- No hace falta subir `node_modules/` ni `backend/target/` porque ya están en `.gitignore`; Git los ignorará.

#### 3.1.4 Cómo subir (desde la terminal, en tu máquina)

1. Abrí una **terminal** (en la carpeta del proyecto, ej. `Documents/tms-llegue`).
2. Comprobá que estés en la raíz del proyecto (donde está `package.json` y la carpeta `backend`):
   ```bash
   ls
   ```
   Deberías ver `package.json`, `backend`, `app`, etc.
3. Verificá si ya hay un repo Git:
   ```bash
   git status
   ```
   - Si dice “not a git repository”: inicializá con `git init`.
   - Si ya es un repo, seguí al paso 4.
4. Si acabás de hacer `git init`, agregá el remoto (reemplazá por tu URL de GitHub):
   ```bash
   git remote add origin https://github.com/TU_USUARIO/tms-llegue.git
   ```
5. Ver qué se va a subir (sin incluir lo que está en `.gitignore`):
   ```bash
   git add .
   git status
   ```
   Revisá la lista: **no** deberían aparecer `.env.local`, `backend/data/`, `backend/target/`, `node_modules/`. Si aparece algo sensible, agregalo a `.gitignore` y volvé a `git status`.
6. Primer commit:
   ```bash
   git commit -m "Preparar proyecto para despliegue en AWS"
   ```
7. Subir a GitHub (si la rama se llama `main`):
   ```bash
   git push -u origin main
   ```
   Si tu rama se llama `master`:
   ```bash
   git push -u origin master
   ```
   Te pedirá usuario y contraseña de GitHub (o token si tenés 2FA). Si usás SSH, el `origin` sería `git@github.com:TU_USUARIO/tms-llegue.git`.
8. **Comprobar**: entrá al repo en GitHub en el navegador y verificá que veas las carpetas `app`, `backend`, `components`, `package.json`, `backend/pom.xml`, `backend/Dockerfile`, etc. **No** debe verse ningún archivo `.env` ni la carpeta `backend/data/`.

Con esto el repositorio está listo para conectar con Amplify (frontend) y para construir la imagen del backend (desde tu PC hacia ECR, o desde un pipeline si más adelante lo armás).

---

### 3.2 Base de datos: RDS PostgreSQL

Objetivo: crear la base PostgreSQL en AWS que usará el backend en producción. Todo desde la **consola de AWS**.

#### 3.2.1 Entrar a RDS

1. Iniciá sesión en la [consola de AWS](https://console.aws.amazon.com).
2. Arriba, en la barra de búsqueda, escribí **RDS** y entrá a **RDS**.
3. En el panel izquierdo, **Databases**.
4. Clic en **Create database**.

#### 3.2.2 Motor y plantilla

1. **Engine type**: PostgreSQL.
2. **Engine Version**: 15.x o 16.x (la que marque como recomendada).
3. **Templates**:  
   - Para probar primero: **Dev/Test**.  
   - Para producción seria: **Production** (incluye Multi-AZ).  
   Elegí según tu etapa; podés cambiar después.

#### 3.2.3 Configuración (nombre, usuario, contraseña)

1. **DB instance identifier**: nombre que identifica la instancia, ej. `tms-db`.
2. **Master username**: ej. `tmsadmin` (o el que quieras; anotalo).
3. **Master password** y **Confirm password**: contraseña segura. **Anotala en un gestor de contraseñas**; la vas a usar en las variables de entorno del backend. No la compartas ni la subas a Git.

#### 3.2.4 Instance configuration (clase e instancia)

En **DB instance class** solo suelen aparecer tres opciones: **Standard classes (m)**, **Memory optimized (r)** y **Compute optimized (c)**. La opción "Burstable (t classes)" a veces no está según región o versión de PostgreSQL.

- **Recomendado para este proyecto**: dejá **Standard classes (includes m classes)** y en **Instance type** elegí **db.m5d.large** (2 vCPUs, 8 GiB RAM). Sirve bien para producción y no necesitás r (más memoria) ni c (más CPU).
- Si en el dropdown ves **db.m6gd.large** (misma idea que m5d), también vale. No hace falta subir a xlarge salvo que más adelante necesites más capacidad.
- **Memory optimized (r)** y **Compute optimized (c)** son para cargas muy específicas; para un TMS tipo CRUD con PostgreSQL alcanza con Standard (m).

#### 3.2.5 Storage (tipo, tamaño, IOPS y autoscaling)

1. **Storage type**  
   - **Recomendado**: **General Purpose SSD (gp3)** si está disponible. Es más barato y para este tipo de app suele sobrar.  
   - Si solo ves **Provisioned IOPS SSD (io2)**: también sirve, pero es más caro; usalo si gp3 no aparece para tu motor/región.

2. **Allocated storage**  
   - Con **gp3**: podés poner el mínimo que te deje la consola (a veces 20 GiB). Para arrancar, 20–50 GiB está bien.  
   - Con **io2**: el mínimo suele ser **100 GiB**. Poné **100** si es lo único que acepta; podés ampliar después desde la consola.

3. **Provisioned IOPS** (solo si elegiste **io2**)  
   - La consola pide entre 1.000 y 80.000 IOPS, y que la relación IOPS/GiB esté entre 0,5 y 1.000.  
   - Para 100 GiB: poné **1.000 IOPS** (el mínimo). Para este TMS no hace falta más al inicio.

4. **Enable storage autoscaling**  
   - Si la casilla aparece **deshabilitada** con el texto "(not available for Multi-AZ DB cluster)", es porque elegiste despliegue tipo **Multi-AZ DB cluster**. En ese modo no se puede activar autoscaling.  
   - Opciones:  
     - Dejar **100 GiB** (o el mínimo) sin autoscaling y ampliar manualmente si hace falta (RDS → Modify).  
     - O, si querés autoscaling, en el paso inicial de "Create database" elegir **Multi-AZ DB instance deployment** (una instancia principal + una standby) en lugar de "Multi-AZ DB cluster"; en ese modo la opción "Enable storage autoscaling" suele estar disponible.  
   - Para arrancar, 100 GiB fijos sin autoscaling es aceptable.

#### 3.2.6 Conectividad (VPC y seguridad)

1. **Connectivity**:  
   - **Compute resource**: Don't connect to an EC2 compute resource (el backend irá en ECS, no en una EC2 suelta).  
   - **VPC**: dejá la **Default VPC** (o una VPC que ya uses). Anotá qué VPC es; la vas a usar para ECS y ALB.  
   - **Subnet group**: default.  
   - **Public access**: **No**. La base no tendrá IP pública; solo se accede desde dentro de la VPC (desde las tareas ECS).
2. **VPC security group**:  
   - Elegí **Create new**.  
   - **Name**: ej. `rds-tms-sg`.  
   - Por ahora no agregues reglas de entrada; después de crear el security group del backend (ECS), volverás a editar este y permitirás **entrada en puerto 5432** solo desde ese SG. Si querés poder conectar desde tu PC para probar (con un túnel o una EC2 bastion), podés agregar después una regla temporal; para producción lo ideal es solo ECS → RDS.
3. **Availability Zone**: dejá **No preference** (o elegí una si querés fijar la AZ).
4. **Database authentication**: **Password authentication**.

#### 3.2.7 Monitoring (opcional pero recomendado)

Esta sección define cómo se monitorea la base (métricas, logs, detección de anomalías). No es obligatoria para que la base funcione, pero conviene dejar algo útil sin pasarse de costo.

**Database Insights**

- **Database Insights - Standard** vs **Advanced**:  
  - **Standard**: guarda 7 días de historial de rendimiento (suficiente para investigar problemas recientes). Más barato.  
  - **Advanced**: 15 meses de historial, monitoreo a nivel “flota” e integración con CloudWatch Application Signals. Más caro.  
  **Recomendación:** para arrancar elegí **Standard**. Si más adelante necesitás más historial, se puede cambiar (o pagar retención extra en Standard).

- **Enable Performance Insights**: dejalo **marcado**. Sirve para ver carga de la base, consultas lentas, etc. desde el dashboard de RDS.

- **Retention period**: si elegiste Standard, suele venir 7 días; si Advanced, 15 months. Dejá el valor por defecto que aparezca.

- **AWS KMS key**: dejá **(default) aws/rds**. No lo cambies a menos que tengas una política de seguridad que exija una clave propia. **Importante:** después de crear la base no se puede cambiar esta clave para estos datos de monitoreo.

**Additional monitoring settings (Enhanced Monitoring, Log exports, DevOps Guru)**

- **Enable Enhanced monitoring**: podés **marcarlo**. Métricas de CPU por proceso a nivel SO; útil para depurar. Granularidad **60 seconds** y rol **default** (que RDS cree `rds-monitoring-role`) está bien.

- **Log exports**:  
  - Marcá **PostgreSQL log**. Eso publica los logs de PostgreSQL en CloudWatch (errores, consultas lentas, etc.) y ayuda mucho a depurar.  
  - `iam-db-auth-error` y `Upgrade log` son opcionales; podés dejarlos sin marcar.

- **Turn on DevOps Guru**: **desmarcalo** al principio. DevOps Guru detecta anomalías y da recomendaciones pero tiene costo por recurso por hora (~USD 3/mes por instancia). Podés activarlo más adelante si querés monitoreo proactivo.

**Resumen rápido:** Database Insights **Standard**, Performance Insights **activado**, KMS **default**, Enhanced Monitoring **activado** (60 s, default role), **PostgreSQL log** exportado a CloudWatch, DevOps Guru **desactivado**. Con eso tenés monitoreo útil sin pasarte de costo.

#### 3.2.8 Nombre de la base

1. En **Additional configuration** (expandir si está colapsado):  
   - **Initial database name**: ej. `tmsdb`. Es el nombre de la base que Spring Boot usará en la URL JDBC.  
   - El resto podés dejarlo por defecto (backups, mantenimiento, etc.). Para producción conviene tener **Enable automated backups** activado.

#### 3.2.9 Crear y anotar datos de conexión

1. Clic en **Create database**.  
2. Esperá a que el **Status** pase a **Available** (puede tardar varios minutos).  
3. En la lista de bases, clic en el **identifier** de tu base (ej. `tms-db`).  
4. Anotá:  
   - **Endpoint** (hostname, ej. `tms-db.xxxxx.sa-east-1.rds.amazonaws.com`).  
   - **Port**: normalmente **5432**.  
   - **Master username** y la contraseña que definiste.  
   La URL JDBC para Spring Boot será:  
   `jdbc:postgresql://ENDPOINT_ANOTADO:5432/tmsdb`  
   Ejemplo: `jdbc:postgresql://tms-db.abc123.sa-east-1.rds.amazonaws.com:5432/tmsdb`

**Recordatorio:** cuando tengas el security group del backend (ECS), editá el security group de RDS (`rds-tms-sg`) y agregá una regla **Inbound**: tipo PostgreSQL, puerto 5432, origen = security group del backend (ECS). Así solo el backend podrá conectarse.

**Datos de conexión de tu instancia RDS (Status: Available):**

| Campo        | Valor |
|-------------|--------|
| **Endpoint** | `database-1.cz46kskaun36.eu-north-1.rds.amazonaws.com` |
| **Port**     | 5432 |
| **Database** | tmsdb |
| **User**     | tmsadmin |
| **Password** | (la que definiste al crear la base; guardala solo en tu gestor de contraseñas) |

**URL JDBC para Spring Boot (variables de entorno en ECS):**  
`jdbc:postgresql://database-1.cz46kskaun36.eu-north-1.rds.amazonaws.com:5432/tmsdb`

**Región:** eu-north-1 (anotala; la vas a usar para ECR, ECS y ALB en la misma región).

---

### 3.3 Backend: imagen Docker y ECR

Objetivo: construir la imagen Docker del backend y subirla a **Amazon ECR** para que ECS la use.

#### 3.3.1 Tener Docker y AWS CLI

- **Docker**: instalado y funcionando (`docker --version`). En Mac: Docker Desktop.  
- **AWS CLI**: instalado y configurado con `aws configure` (Access Key y región). Probá con `aws sts get-caller-identity`.

#### 3.3.2 Dockerfile en el repo

El proyecto ya tiene un **Dockerfile** en `backend/Dockerfile` (multi-stage: compila con Maven dentro de la imagen y luego corre el JAR). No hace falta crearlo; solo asegurate de que esté en el repo y subido a GitHub (ya lo hiciste en 3.1).

#### 3.3.3 Crear el repositorio en ECR

1. En la consola AWS, buscá **ECR** (Elastic Container Registry).  
2. **Repositories** → **Create repository**.  
3. **Visibility**: Private.  
4. **Repository name**: ej. `tms-backend`.  
5. Dejá el resto por defecto → **Create repository**.  
6. Entrá al repo que creaste. Arriba verás la **URI** de la imagen; anotá **REGION** y **ACCOUNT_ID** para los comandos de login, tag y push.

**Datos de tu repositorio ECR:**

| Campo | Valor |
|-------|--------|
| **URI** | `708750714395.dkr.ecr.eu-north-1.amazonaws.com/tms-backend` |
| **ACCOUNT_ID** | 708750714395 |
| **REGION** | eu-north-1 |

#### 3.3.4 Construir la imagen en tu PC

1. Abrí la terminal y andá a la **raíz del proyecto** (donde está la carpeta `backend`), no dentro de `backend`:
   ```bash
   cd /ruta/completa/a/tms-llegue
   ```
2. Construir la imagen (el Dockerfile está en `backend/` y hace el build de Maven dentro):
   ```bash
   docker build -t tms-backend ./backend
   ```
   Si algo falla, revisá que existan `backend/pom.xml`, `backend/src/` y `backend/Dockerfile`.  
3. Verificá que la imagen exista:
   ```bash
   docker images | grep tms-backend
   ```

#### 3.3.5 Conectar Docker con ECR y subir la imagen

1. Usá **REGION** = `eu-north-1` y **ACCOUNT_ID** = `708750714395` (o los que anotaste en 3.3.3).  
2. Login en ECR:
   ```bash
   aws ecr get-login-password --region eu-north-1 | docker login --username AWS --password-stdin 708750714395.dkr.ecr.eu-north-1.amazonaws.com
   ```
   Debe decir “Login Succeeded”.  
3. Etiquetar la imagen para ECR:
   ```bash
   docker tag tms-backend:latest 708750714395.dkr.ecr.eu-north-1.amazonaws.com/tms-backend:latest
   ```
4. Subir la imagen:
   ```bash
   docker push 708750714395.dkr.ecr.eu-north-1.amazonaws.com/tms-backend:latest
   ```
5. En la consola AWS, en ECR → **Repositories** → **tms-backend**, deberías ver la imagen con tag `latest`.  
Cada vez que cambies el backend, repetí: `docker build`, `docker tag`, `docker push` y después actualizá el servicio ECS para que tome la nueva imagen.

---

### 3.4 Backend: ECS Fargate + ALB

Objetivo: que el backend corra en contenedores (ECS Fargate) detrás de un balanceador (ALB), con una URL estable y health checks.

#### 3.4.1 Cluster ECS

1. En la consola AWS, buscá **ECS** (Elastic Container Service).  
2. **Clusters** → **Create cluster**.  
3. **Cluster name**: ej. `tms-cluster`.  
4. **Infrastructure**: AWS Fargate (serverless).  
5. **Create**.  
Anotá la **VPC** y las **subnets** que use el cluster (si no ves detalles, las verás al crear el servicio; la VPC debe ser la misma que RDS).

#### 3.4.2 Security group para el ALB

1. **EC2** (buscá “EC2” en la consola) → en el panel izquierdo **Security Groups** → **Create security group**.  
2. **Name**: ej. `alb-tms-sg`. **Description**: “ALB para TMS backend”.  
3. **VPC**: la misma que RDS (default o la que uses).  
4. **Inbound rules** → **Add rule**:  
   - Type: HTTP, Port: 80, Source: **Anywhere-IPv4** (0.0.0.0/0).  
   - Otra regla: HTTPS, Port: 443, Source: **Anywhere-IPv4**.  
5. **Create security group**.  
Anotá el **ID** del security group (ej. `sg-0abc123`): sg-005ecb58ad4334e98

#### 3.4.3 Security group para ECS (backend)

1. De nuevo **Security Groups** → **Create security group**.  
2. **Name**: ej. `ecs-tms-sg`. **Description**: “Tareas ECS del backend TMS”.  
3. **VPC**: la misma que RDS y ALB.  
4. **Inbound rules** → **Add rule**:  
   - Type: Custom TCP, Port: 8080, Source: el **security group del ALB** (`alb-tms-sg`). Así solo el ALB puede hablar con las tareas en el puerto 8080.  
5. **Outbound**: por defecto permite todo; las tareas necesitan salida a internet (APIs externas) y al puerto 5432 de RDS.  
6. **Create security group**.  
Anotá el **ID** (ej. `sg-0def456`): sg-0b3624f8e2cb71298
**Importante:** volvé a **RDS** → tu base de datos → **Security group** (VPC security group) → editar **Inbound rules** y agregar: Type PostgreSQL, Port 5432, Source = **ecs-tms-sg** (el que acabás de crear). Así solo el backend ECS puede conectarse a RDS.

#### 3.4.4 Target group (para el ALB)

1. **EC2** → **Target Groups** (en el panel izquierdo, bajo Load Balancing) → **Create target group**.  
2. **Target type**: **IP** (necesario para Fargate).  
3. **Target group name**: ej. `tms-backend-tg`.  
4. **Protocol**: HTTP, **Port**: 8080.  
5. **VPC**: la misma que todo lo anterior.  
6. **Health check**:  
   - **Protocol**: HTTP. **Path**: `/actuator/health` (si tu backend expone Actuator; si no, más adelante podés usar otro path o agregar Actuator).  
   - **Advanced**: interval y timeout según prefieras (ej. 30 s interval, 5 s timeout).  
7. **Create target group**.  
Dejá esta ventana abierta; vas a asociar el target group al ALB.

#### 3.4.5 Application Load Balancer

1. **EC2** → **Load Balancers** → **Create Load Balancer**.  
2. Elegí **Application Load Balancer**.  
3. **Name**: ej. `tms-alb`.  
4. **Scheme**: Internet-facing. **IP address type**: IPv4.  
5. **Network mapping**: **VPC** misma de siempre; **Mappings**: elegí **al menos 2 subnets** (de distintas AZ si es posible).  
6. **Security groups**: elegí **alb-tms-sg** (el que creaste para el ALB).  
7. **Listeners and routing**:  
   - **Listener 1**: HTTP, 80. **Default action**: Forward to → **tms-backend-tg** (el target group).  
   - **Listener 2**: HTTPS, 443. Para este necesitás un certificado SSL (ACM). Si ya tenés uno para `api.mvgtms.com.ar`, seleccionalo y Forward to **tms-backend-tg**. Si aún no tenés certificado, podés crear el ALB solo con el listener 80 y después agregar el 443 cuando tengas el certificado en ACM.  
8. **Create load balancer**.  
9. Anotá el **DNS name** del ALB (ej. `tms-alb-1234567890.sa-east-1.elb.amazonaws.com`). Ese nombre es al que apuntará después el CNAME `api.mvgtms.com.ar`: tms-alb-1410389913.eu-north-1.elb.amazonaws.com

#### 3.4.6 Task definition (definición de la tarea ECS)

La task definition es la “receta” de un contenedor: qué imagen correr, cuánta CPU/memoria, qué variables de entorno y logs. No ejecuta nada por sí sola; el **servicio** (3.4.7) es el que lanza las tareas usando esta definición.

**Paso A: Crear el log group en CloudWatch (si no existe)**

Así las tareas pueden escribir logs y podés depurar si algo falla.

1. En la consola AWS, buscá **CloudWatch**.  
2. Menú izquierdo → **Logs** → **Log Management**. Ahí se gestionan los log groups (en algunas cuentas aparece directamente “Log groups” bajo Logs).  
3. **Create log group** (o “Create”).  
4. **Log group name**: `/ecs/tms-backend` (exactamente así).  
5. **Create log group**.  
Dejá la retención por defecto o la que prefieras.

**Paso B: Abrir el asistente de task definition**

1. Consola AWS → **ECS** (buscá “ECS” o “Elastic Container Service”).  
2. En el menú izquierdo, **Task definitions**.  
3. **Create new task definition**.  
4. Elegí **Create new task definition with form** (formulario visual). No uses JSON a menos que ya lo conozcas.

**Paso C: Sección “Task definition configuration”**

1. **Task definition family**: nombre que identifica esta definición, ej. `tms-backend`. Todas las revisiones compartirán este nombre.  
2. **Launch type**: **AWS Fargate** (serverless; no elegir EC2).  
3. **Task execution role**:  
   - Si en el desplegable aparece **ecsTaskExecutionRole**, seleccionalo. Ese rol permite a ECS descargar la imagen de ECR y escribir en CloudWatch Logs.  
   - **Si no aparece o “Create new role” se traba**, crealo desde IAM y después seleccionalo acá:  
     - Consola AWS → **IAM** → **Roles** → **Create role**.  
     - **Trusted entity**: AWS service. **Use case**: buscá **Elastic Container Service** y elegí la opción para **Task** (Elastic Container Service - Task).  
     - Next → debe quedar marcada la política **AmazonECSTaskExecutionRolePolicy** → Next.  
     - **Role name**: `ecsTaskExecutionRole` (exactamente así). Create role.  
     - Volvé a ECS → Task definitions → en **Task execution role** elegí **ecsTaskExecutionRole**.  
4. **Task role** (opcional): dejalo en “None” por ahora. Solo lo necesitás si la app accede a otros servicios AWS (Secrets Manager, S3, etc.).  
5. **Task size**:  
   - **CPU**: ej. **0.5 vCPU**.  
   - **Memory**: ej. **1 GB**.  
   Para producción con más carga podés subir después a 1 vCPU y 2 GB.  
6. No cambies “Operating system / Architecture” salvo que sepas lo que hacés (dejá el valor por defecto).

**Paso D: Contenedor – datos básicos**

1. En la sección **Container - 1**, hacé clic en **Add container** (o “Configure” si ya hay un contenedor placeholder).  
2. **Container name**: `tms-backend` (nombre interno; puede ser cualquiera, pero usalo consistente para el load balancer después).  
3. **Image URI**: la URI completa de tu imagen en ECR. En tu caso:  
   `708750714395.dkr.ecr.eu-north-1.amazonaws.com/tms-backend:latest`  
   Podés pegar tal cual o elegir “Browse” y buscar el repo **tms-backend** en ECR y el tag **latest**.  
4. **Port mappings**:  
   - **Container port**: **8080**.  
   - **Protocol**: **TCP**.  
   - **App protocol**: podés dejarlo en blanco o **HTTP**.  
5. Dejá el resto de opciones del contenedor (health check, etc.) por defecto por ahora.

**Paso E: Variables de entorno del contenedor**

En la misma pantalla del contenedor, bajá hasta **Environment variables** (o “Environment”). Ahí vas a agregar una por una (o en bloque si la consola lo permite).

- **Environment type**: **Key-value** (no “ValueFrom” salvo que uses Secrets Manager).  
- Agregá cada fila con **Key** y **Value** según la tabla. Los **Client ID** que figuran abajo son los que usa este proyecto en desarrollo; si en tu cuenta son otros, reemplazá. Los **Client secret** y la contraseña de mail no van en la guía: copialos de tu archivo `backend/src/main/resources/application-local.properties` (desarrollo) o del panel de cada proveedor.

| Key | Valor |
|-----|--------|
| SPRING_DATASOURCE_URL | `jdbc:postgresql://database-1.cz46kskaun36.eu-north-1.rds.amazonaws.com:5432/tmsdb` |
| SPRING_DATASOURCE_USERNAME | tmsadmin |
| SPRING_DATASOURCE_PASSWORD | Elefante488! |
| SPRING_DATASOURCE_DRIVER_CLASS_NAME | `org.postgresql.Driver` |
| SPRING_H2_CONSOLE_ENABLED | `false` |
| MERCADOLIBRE_REDIRECT_URI | `https://mvgtms.com.ar/auth/mercadolibre/callback` |
| TIENDANUBE_REDIRECT_URI | `https://mvgtms.com.ar/auth/tiendanube/callback` |
| SHOPIFY_REDIRECT_URI | `https://api.mvgtms.com.ar/api/clientes/shopify/callback` |
| FRONTEND_BASE_URL | `https://mvgtms.com.ar` |
| MERCADOLIBRE_CLIENT_ID | `5552011749820676` (Mercado Libre; si usás otro app, poné el que tengas) |
| MERCADOLIBRE_CLIENT_SECRET | Copiar de `application-local.properties` o de [desarrolladores.mercadolibre.com](https://developers.mercadolibre.com.ar) → tu app → Client secret |
| TIENDANUBE_CLIENT_ID | `25636` (Tienda Nube; si usás otro app, poné el que tengas) |
| TIENDANUBE_CLIENT_SECRET | Copiar de `application-local.properties` o del Dev Dashboard de Tienda Nube → tu app → Credentials |
| SHOPIFY_CLIENT_ID | `b1865e06d2c94f72c8af76cde5f91fae` (Shopify; si usás otra app, poné el que tengas) |
| SHOPIFY_CLIENT_SECRET | Copiar de `application-local.properties` o de [partners.shopify.com](https://partners.shopify.com) → tu app → Settings → Client credentials |
| SPRING_MAIL_USERNAME | matiasgastron@gmail.com |
| SPRING_MAIL_PASSWORD | Contraseña de aplicación del correo. Copiar de `application-local.properties` o generarla de nuevo en la cuenta de Gmail (Seguridad → Contraseñas de aplicaciones). |

**Si olvidaste el usuario o la contraseña de RDS**

- **SPRING_DATASOURCE_USERNAME (usuario):** Podés verlo en la consola AWS. Entrá a **RDS** → **Databases** → clic en tu base (**database-1**) → pestaña **Configuration**. Ahí aparece **Master username** (ej. `tmsadmin`).  
- **SPRING_DATASOURCE_PASSWORD (contraseña):** AWS no la muestra nunca. Si no la tenés anotada ni en `application-local.properties`, tenés que **cambiarla**: RDS → **Databases** → seleccioná la base → **Modify** → en **Settings** buscá **Master password** → elegí **Self managed** y poné una contraseña nueva → **Continue** → **Apply immediately** → **Modify DB instance**. Usá esa contraseña nueva en la variable de entorno.

Si el endpoint de RDS que anotaste en 3.2 es distinto al de la tabla, usá tu endpoint en `SPRING_DATASOURCE_URL`.  
En la consola suele haber “Add environment variable” o un botón “+” para cada nueva fila; completá Key y Value y repetí hasta tener todas.

**Paso F: Configuración de logs del contenedor**

En el mismo contenedor, buscá **Log configuration** (o “Logging”).

1. **Log driver**: **awslogs**.  
2. **awslogs-group**: `/ecs/tms-backend` (el grupo que creaste en el Paso A).  
3. **awslogs-region**: **eu-north-1** (la región donde está el cluster y el log group).  
4. **awslogs-stream-prefix**: podés poner `ecs` o dejarlo en blanco.  
Dejá el resto por defecto. Así los logs del backend aparecerán en CloudWatch → Log groups → `/ecs/tms-backend`.

**Paso G: Crear la task definition**

1. Revisá que no quede ningún campo obligatorio en rojo.  
2. Clic en **Create** (abajo del formulario).  
3. Deberías ver la nueva task definition con familia **tms-backend** y revisión **1** (o la siguiente disponible).  
Listo: la “receta” está guardada. El siguiente paso es crear el **servicio** ECS (3.4.7) que use esta task definition y la conecte al ALB.

#### 3.4.7 Servicio ECS

1. **ECS** → **Clusters** → **tms-cluster** → **Create service**.  
2. **Compute options**: Launch type = Fargate.  
3. **Task definition**: familia **tms-backend**, revisión **latest**.  
4. **Service name**: ej. `tms-backend-service`.  
5. **Number of tasks**: 1 para empezar (2 o más para alta disponibilidad).  
6. **Networking**:  
   - **VPC**: la misma que RDS y ALB.  
   - **Subnets**: elegí **subnets privadas** si las tenés (recomendado para producción) o las públicas; tienen que permitir que las tareas salgan a internet (para ECR y APIs externas) y que el ALB pueda alcanzarlas. Para Fargate con ALB suelen usarse subnets públicas o con NAT.  
   - **Security group**: **ecs-tms-sg**.  
   - **Public IP**: si las subnets son públicas, podés usar “Turn on”; si son privadas con NAT, “Turn off” está bien.  
7. **Load balancing**:  
   - **Load balancer type**: Application Load Balancer.  
   - **Load balancer**: **tms-alb**.  
   - **Container to load balance**: elegí **tms-backend:8080** y **Add to load balancer**.  
   - **Target group**: **tms-backend-tg**.  
   - **Health check** (del target group): que el path coincida con lo que responda tu app (ej. `/actuator/health`).  
8. **Create service**.  
9. En **Services** del cluster, abrí el servicio y mirá **Tasks**. Esperá a que el **Last status** sea **RUNNING** y que en **Target group** (EC2 → Target Groups → tms-backend-tg) los targets aparezcan **Healthy**. Si quedan Unhealthy, revisá los logs en CloudWatch (`/ecs/tms-backend`) y que las variables de entorno (sobre todo la URL de RDS) estén bien.

La URL del backend por ahora es: `http://DNS_DEL_ALB` (ej. `http://tms-alb-1234567890.sa-east-1.elb.amazonaws.com`). Para usar `https://api.mvgtms.com.ar` necesitás crear el registro DNS y, si querés HTTPS, el certificado en ACM (ver 3.6).

---

### 3.5 Frontend: AWS Amplify

Objetivo: desplegar el frontend Next.js desde GitHub y asignarle el dominio **mvgtms.com.ar**.

#### 3.5.1 Conectar GitHub y elegir repo

1. Consola AWS → buscá **Amplify** → **Amplify**.  
2. **New app** → **Host web app**.  
3. **Get started** con **GitHub** (o GitHub Enterprise si usás eso). Autorizá a AWS para acceder a tus repos.  
4. **Repository**: elegí el repo (ej. `tms-llegue`). **Branch**: ej. `main` o `master`.  
5. **Next**.

#### 3.5.2 Configuración del build (Next.js)

1. Amplify suele **detectar** Next.js. Si aparece “Next.js - SSR” o similar, dejalo.  
2. **Build settings**: si te muestra un `amplify.yml`, podés dejarlo o usar algo como (ajustado a tu estructura):
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```
   Para Next.js con App Router, la documentación oficial de Amplify indica usar su detección automática; si falla el build, revisá la [doc de Amplify para Next.js](https://docs.aws.amazon.com/amplify/latest/userguide/server-side-rendering-amplify.html).  
3. **Advanced settings** → **Environment variables** → **Add variable**:  
   - **Key**: `NEXT_PUBLIC_BACKEND_TUNNEL_URL`  
   - **Value**: `https://api.mvgtms.com.ar`  
   (Sin `/api` al final; el código del front ya agrega `/api`.)  
4. **Save and deploy**.  
Amplify va a clonar el repo, ejecutar `npm ci` y `npm run build`, y desplegar. Esperá a que el **Provision**, **Build** y **Deploy** estén en verde. Si el build falla, mirá los logs en la pestaña **Build** del job.

#### 3.5.3 URL temporal de Amplify

Al terminar el deploy, Amplify te da una URL tipo `https://main.xxxxx.amplifyapp.com`. Probá abrirla y que cargue el front; después podés asignar el dominio custom.

#### 3.5.4 Dominio custom (mvgtms.com.ar)

1. En la app de Amplify, menú izquierdo **Hosting** → **Custom domains** (o **Domain management**).  
2. **Add domain** → ingresá `mvgtms.com.ar`.  
3. Amplify te va a pedir **verificar** el dominio. Si el dominio está en **Route 53** en la misma cuenta, Amplify puede crear/actualizar el registro por vos. Si el dominio está en otro proveedor (NIC Argentina, DonWeb, Cloudflare, etc.), Amplify te dará un **CNAME** (o un registro tipo CNAME) que tenés que crear en ese proveedor. Ejemplo: **Name**: `mvgtms.com.ar` (o el subdominio que te indique), **Value**: algo como `xxxxx.cloudfront.net`.  
4. Cuando el dominio esté verificado, Amplify gestiona el certificado SSL para HTTPS.  
5. Opcional: agregar también `www.mvgtms.com.ar` como alias o redirección.

---

### 3.6 DNS (mvgtms.com.ar y api.mvgtms.com.ar)

El frontend **mvgtms.com.ar** ya está en Amplify con dominio custom. Para que el backend responda en **https://api.mvgtms.com.ar** hay que hacer cuatro cosas: certificado SSL (ACM), registro DNS en Route 53, listener HTTPS en el ALB y variable de entorno en Amplify.

**Datos que vas a usar:**

| Recurso | Valor (eu-north-1) |
|--------|---------------------|
| ALB DNS name | `tms-alb-1410389913.eu-north-1.elb.amazonaws.com` |
| Target group | `tms-backend-tg` |
| Hosted zone | La de `mvgtms.com.ar` (creada por Amplify al agregar el dominio) |

---

#### 3.6.1 Certificado SSL para api.mvgtms.com.ar (ACM)

1. En la consola AWS, región **eu-north-1**, buscá **Certificate Manager** (ACM).  
2. **Request certificate**.  
3. **Certificate type**: Request a public certificate.  
4. **Domain names**: agregá `api.mvgtms.com.ar` (solo ese).  
5. **Validation method**: DNS validation.  
6. **Request**.  
7. En la lista, abrí el certificado y en **Domains** verás un **CNAME name** y **CNAME value** para validar. Anotalos.

CNAMe name: _9ce067074aa142ad3c587614ef16271b.api.mvgtms.com.ar.
CNAME value: _b2631595086ef170d0511214bb483edc.jkddzztszm.acm-validations.aws.
---

#### 3.6.2 Registrar el CNAME de validación en Route 53

1. **Route 53** → **Hosted zones** → hosted zone de **mvgtms.com.ar**.  
2. **Create record**: **Record name** = solo la parte del CNAME name de ACM antes de `.mvgtms.com.ar` (ej. si ACM dice `_abc123.api.mvgtms.com.ar`, poné `_abc123.api`). **Type** = CNAME. **Value** = CNAME value de ACM. **Create records**.  
3. En ACM, en unos minutos el certificado pasará a **Issued**.

---

#### 3.6.3 Registro DNS api → ALB (Route 53)

En la misma hosted zone **mvgtms.com.ar**:

1. **Create record**. **Record name**: `api`. **Record type**: **A**. Activá **Alias**.  
2. **Route traffic to**: Alias to Application and Classic Load Balancer → **Region** eu-north-1 → ALB **tms-alb**. **Create records**.  
3. Si no ves Alias a ALB: creá un **CNAME** name `api`, value `tms-alb-1410389913.eu-north-1.elb.amazonaws.com`.

---

#### 3.6.4 Listener HTTPS (443) en el ALB

1. **EC2** → **Load Balancers** → **tms-alb** → pestaña **Listeners** → **Add listener**.  
2. **Protocol**: HTTPS. **Port**: 443. **Default action**: Forward to **tms-backend-tg**. **Certificate**: el de ACM para api.mvgtms.com.ar. **Add**.

---

#### 3.6.5 Variable de entorno en Amplify (frontend)

1. **Amplify** → app **mvgtms** → **Environment variables**.  
2. Agregá: **Key** `NEXT_PUBLIC_BACKEND_TUNNEL_URL`, **Value** `https://api.mvgtms.com.ar` (sin `/api`). Guardá y **Redeploy** del branch **main**.

---

#### 3.6.6 Comprobar

- `https://api.mvgtms.com.ar/actuator/health` debe responder.  
- En **https://mvgtms.com.ar** las tablas que usan el backend deben cargar datos.

Orden: **ACM** → **CNAME validación en Route 53** → **registro A (alias) o CNAME api en Route 53** → **listener 443 en ALB** → **variable en Amplify + redeploy**.

---

## 4. Variables de entorno en producción

### 4.1 Backend (ECS task definition)

En la **task definition** de ECS, en el contenedor `tms-backend`, en **Environment variables**, tenés que tener (reemplazá los valores reales):

| Key | Valor (ejemplo) |
|-----|------------------|
| SPRING_DATASOURCE_URL | jdbc:postgresql://ENDPOINT_RDS:5432/tmsdb |
| SPRING_DATASOURCE_USERNAME | tmsadmin |
| SPRING_DATASOURCE_PASSWORD | tu_contraseña_rds |
| SPRING_DATASOURCE_DRIVER_CLASS_NAME | org.postgresql.Driver |
| SPRING_H2_CONSOLE_ENABLED | false |
| MERCADOLIBRE_REDIRECT_URI | https://mvgtms.com.ar/auth/mercadolibre/callback |
| TIENDANUBE_REDIRECT_URI | https://mvgtms.com.ar/auth/tiendanube/callback |
| SHOPIFY_REDIRECT_URI | https://api.mvgtms.com.ar/api/clientes/shopify/callback |
| FRONTEND_BASE_URL | https://mvgtms.com.ar |
| MERCADOLIBRE_CLIENT_ID | (tu client id) |
| MERCADOLIBRE_CLIENT_SECRET | (tu secret) |
| TIENDANUBE_CLIENT_ID | (tu client id) |
| TIENDANUBE_CLIENT_SECRET | (tu secret) |
| SHOPIFY_CLIENT_ID | (tu client id) |
| SHOPIFY_CLIENT_SECRET | (tu secret) |
| SPRING_MAIL_USERNAME | (email para envío) |
| SPRING_MAIL_PASSWORD | (contraseña de aplicación del mail) |

Si cambiás alguna variable después, creá una **nueva revisión** de la task definition y actualizá el **servicio** ECS para que use la nueva revisión (force new deployment).

### 4.2 Frontend (Amplify)

En **Amplify** → tu app → **Environment variables** (en el menú izquierdo, bajo “Build settings” o en la configuración del entorno):

| Key | Value |
|-----|--------|
| NEXT_PUBLIC_BACKEND_TUNNEL_URL | https://api.mvgtms.com.ar |

Guardá y hacé un **Redeploy** del branch para que tome el valor.

---

## 5. Actualizar OAuth y callbacks (después del deploy)

Cuando **mvgtms.com.ar** y **api.mvgtms.com.ar** estén respondiendo:

1. **Mercado Libre** (panel de desarrolladores): Redirect URI → `https://mvgtms.com.ar/auth/mercadolibre/callback`  
2. **Tienda Nube**: URL de callback de la app → `https://mvgtms.com.ar/auth/tiendanube/callback`  
3. **Shopify**: URL de callback del backend → `https://api.mvgtms.com.ar/api/clientes/shopify/callback`  
4. **Flex (Mercado Libre)**: la que use el front → `https://mvgtms.com.ar/auth/mercadolibre/callback`

Así evitás errores de “redirect_uri no coincide” en producción.

---

## 6. ClienteService y URLs hardcodeadas

En producción el backend debe usar las variables de entorno. Si configuraste bien **MERCADOLIBRE_REDIRECT_URI** (y el resto) en la task definition, los fallbacks hardcodeados del código no se usan. No hace falta tocar código.

---

## 7. Resumen de checklist

- [ ] Repo en GitHub; .gitignore con .env*, backend/data/, backend/target/, backend/logs/; primer push sin archivos sensibles.
- [ ] RDS PostgreSQL creado; endpoint, usuario, contraseña y nombre de base anotados; security group de RDS con entrada 5432 solo desde el SG de ECS.
- [ ] Imagen Docker del backend construida y subida a ECR (tag latest).
- [ ] Cluster ECS creado; security groups ALB y ECS creados y configurados.
- [ ] Target group (puerto 8080, health check /actuator/health o el que use tu app); ALB creado con listener 80 (y 443 si tenés certificado).
- [ ] Task definition con imagen ECR y todas las variables de la sección 4.1; servicio ECS creado y tareas Running; targets Healthy.
- [ ] DNS: api.mvgtms.com.ar → CNAME al ALB; certificado ACM para api si usás HTTPS.
- [ ] Amplify: app conectada al repo, build correcto, variable NEXT_PUBLIC_BACKEND_TUNNEL_URL=https://api.mvgtms.com.ar; dominio mvgtms.com.ar agregado y verificado.
- [ ] Redirect URIs actualizadas en Shopify, Mercado Libre y Tienda Nube.
- [ ] Pruebas: login, envíos, OAuth, link de tracking en mail.

Cuando tengas todo en AWS funcionando, si querés podemos revisar un paso concreto (por ejemplo health check, Actuator o Secrets Manager) o el siguiente ajuste que necesites.
