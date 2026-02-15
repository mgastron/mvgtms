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

#### 3.2.4 Tamaño y almacenamiento

1. **Instance configuration**:  
   - Dev/Test: puede servir **Burstable classes** (ej. `db.t3.micro` o `db.t4g.micro`) para bajar costo.  
   - Producción: mínimo `db.t3.small` o superior (ej. `db.t3.medium`).
2. **Storage**:  
   - **Allocated storage**: ej. 20 GB (podés subir después).  
   - Marcá **Enable storage autoscaling** y poné un máximo (ej. 100 GB) para que crezca solo si hace falta.

#### 3.2.5 Conectividad (VPC y seguridad)

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

#### 3.2.6 Nombre de la base

1. En **Additional configuration** (expandir si está colapsado):  
   - **Initial database name**: ej. `tmsdb`. Es el nombre de la base que Spring Boot usará en la URL JDBC.  
   - El resto podés dejarlo por defecto (backups, mantenimiento, etc.). Para producción conviene tener **Enable automated backups** activado.

#### 3.2.7 Crear y anotar datos de conexión

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
6. Entrá al repo que creaste. Arriba verás la **URI** de la imagen, algo como:  
   `123456789012.dkr.ecr.sa-east-1.amazonaws.com/tms-backend`  
   Anotá: **REGION** (ej. `sa-east-1`) y **ACCOUNT_ID** (el número de 12 dígitos, ej. `123456789012`). Los vas a usar en los comandos siguientes.

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

1. Reemplazá **REGION** y **ACCOUNT_ID** por los que anotaste (ej. `sa-east-1` y `123456789012`).  
2. Login en ECR:
   ```bash
   aws ecr get-login-password --region REGION | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com
   ```
   Ejemplo:
   ```bash
   aws ecr get-login-password --region sa-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.sa-east-1.amazonaws.com
   ```
   Debe decir “Login Succeeded”.  
3. Etiquetar la imagen para ECR:
   ```bash
   docker tag tms-backend:latest ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/tms-backend:latest
   ```
   Ejemplo:
   ```bash
   docker tag tms-backend:latest 123456789012.dkr.ecr.sa-east-1.amazonaws.com/tms-backend:latest
   ```
4. Subir la imagen:
   ```bash
   docker push ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/tms-backend:latest
   ```
   Ejemplo:
   ```bash
   docker push 123456789012.dkr.ecr.sa-east-1.amazonaws.com/tms-backend:latest
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
Anotá el **ID** del security group (ej. `sg-0abc123`).

#### 3.4.3 Security group para ECS (backend)

1. De nuevo **Security Groups** → **Create security group**.  
2. **Name**: ej. `ecs-tms-sg`. **Description**: “Tareas ECS del backend TMS”.  
3. **VPC**: la misma que RDS y ALB.  
4. **Inbound rules** → **Add rule**:  
   - Type: Custom TCP, Port: 8080, Source: el **security group del ALB** (`alb-tms-sg`). Así solo el ALB puede hablar con las tareas en el puerto 8080.  
5. **Outbound**: por defecto permite todo; las tareas necesitan salida a internet (APIs externas) y al puerto 5432 de RDS.  
6. **Create security group**.  
Anotá el **ID** (ej. `sg-0def456`).  
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
9. Anotá el **DNS name** del ALB (ej. `tms-alb-1234567890.sa-east-1.elb.amazonaws.com`). Ese nombre es al que apuntará después el CNAME `api.mvgtms.com.ar`.

#### 3.4.6 Task definition (definición de la tarea ECS)

1. **ECS** → **Task definitions** → **Create new task definition** → **Create new task definition with JSON** o el formulario.  
2. **Family**: ej. `tms-backend`.  
3. **Launch type**: AWS Fargate.  
4. **Task execution role**: si ya existe **ecsTaskExecutionRole**, usalo (permite descargar la imagen de ECR y escribir logs). Si no, creá un rol con la política `AmazonECSTaskExecutionRolePolicy` y asignalo.  
5. **Task size**: **CPU** ej. 0.5 vCPU, **Memory** ej. 1 GB (para producción podés subir a 1 vCPU y 2 GB).  
6. **Container - Add container**:  
   - **Name**: `tms-backend`.  
   - **Image URI**: la URI completa de tu imagen en ECR, ej. `ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/tms-backend:latest`.  
   - **Port mappings**: 8080, TCP.  
   - **Environment variables**: agregá todas las de la **sección 4.1** de esta guía (SPRING_DATASOURCE_URL, SPRING_DATASOURCE_USERNAME, SPRING_DATASOURCE_PASSWORD, MERCADOLIBRE_REDIRECT_URI, FRONTEND_BASE_URL, etc.). Reemplazá ENDPOINT_RDS por el endpoint real de RDS que anotaste en 3.2.  
   - **Log configuration**: **Log driver** = awslogs; **awslogs-group** = `/ecs/tms-backend`; **awslogs-region** = tu región. Si el grupo no existe, en **CloudWatch** → **Log groups** → **Create log group** con nombre `/ecs/tms-backend`.  
7. **Create** (task definition).  
Quedó definida la “receta” de la tarea; ahora hay que crear el servicio que la ejecute.

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

Donde tengas el dominio (panel del registrador o Route 53):

| Qué | Tipo | Nombre / Host | Valor / Apunta a |
|-----|------|----------------|-------------------|
| Frontend | CNAME (o lo que pida Amplify) | Lo que te indique Amplify (ej. raíz o `www`) | El valor que te dio Amplify (ej. `xxxxx.cloudfront.net`) |
| Backend | CNAME | `api` | DNS name del ALB (ej. `tms-alb-1234567890.sa-east-1.elb.amazonaws.com`) |

- Para **api.mvgtms.com.ar**: en tu DNS creás un registro **CNAME** con nombre `api` (o `api.mvgtms.com.ar` según el panel) y valor = DNS del ALB.  
- Para **HTTPS en el backend**: en **ACM** (Certificate Manager) pedís un certificado para `api.mvgtms.com.ar`, validás el dominio (DNS o email), y en el ALB agregás un listener **443** que use ese certificado y envíe el tráfico al mismo target group.  
La propagación DNS puede tardar unos minutos u horas.

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
