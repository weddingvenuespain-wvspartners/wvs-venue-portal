# 🗄️ Backups automáticos — Guía de configuración

## ⚠️ Qué va a GitHub y qué NO

### ✅ SÍ va a GitHub (es código, no datos)
- El archivo `.github/workflows/backup.yml` — solo instrucciones de automatización
- El código fuente de la aplicación (sin datos de usuarios)

### ❌ NUNCA va a GitHub
- Los archivos `wvs-backup-*.json` — contienen datos personales de venues y parejas
- Las variables de entorno (`.env`, `.env.local`) — ya están en `.gitignore`
- Las service role keys de Supabase
- Cualquier dato de clientes

El workflow descarga el backup en la **memoria temporal** del servidor de GitHub
(un runner que se destruye al terminar el job). Los datos van directamente de
tu app → Supabase Storage / Google Drive. **Nunca quedan guardados en GitHub.**

---

## Cómo funciona

```
GitHub Actions (solo código, gratis)
        │
        │ 1. Llama a tu API con API Key
        ▼
Tu app en Vercel
        │
        │ 2. Descarga el JSON (memoria temporal del runner)
        ▼
Supabase Storage ← opción por defecto (bucket privado, ya tienes cuenta)
Google Drive     ← alternativa (requiere configuración extra)
```

---

## PASO 1 — Generar una API Key para los backups

Esta clave permite que GitHub Actions llame al endpoint de backup de forma
automática. Es independiente de cualquier cuenta de usuario.

Genera una clave aleatoria en tu terminal:

```bash
# Mac / Linux
openssl rand -hex 32

# Windows PowerShell
[System.Web.Security.Membership]::GeneratePassword(64, 0)
```

Copia el resultado. Ejemplo: `a3f9c2e1b8d74f6a2c9e0b3d5f1a7e4c...`

---

## PASO 2 — Añadir la API Key en Vercel

1. Ve a **Vercel → tu proyecto → Settings → Environment Variables**
2. Añade la variable:
   - Nombre: `BACKUP_API_KEY`
   - Valor: la clave del paso 1
   - Entorno: Production
3. **Redeploy** la aplicación para que tome efecto

---

## PASO 3 — Añadir secrets en GitHub

Ve a: **GitHub → tu repo → Settings → Secrets and variables → Actions → New repository secret**

Crea estos tres secrets:

| Secret | Valor |
|---|---|
| `BACKUP_API_KEY` | La misma clave del paso 1 |
| `APP_URL` | URL de tu app en Vercel, ej: `https://wvs-venue-portal.vercel.app` |
| `SUPABASE_URL` | La URL de tu proyecto Supabase, ej: `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | La **service_role** key de Supabase (Settings → API) |

---

## PASO 4 — Crear el bucket de backups en Supabase

1. Ve a **Supabase → Storage → New bucket**
2. Nombre: `backups`
3. **Public bucket: NO** (desactivado — los backups son privados)
4. Haz clic en "Create bucket"

Los backups se guardarán ahí con el nombre `wvs-backup-YYYY-MM-DD.json`.
Solo tú (con la service key) puedes acceder a ellos.

---

## PASO 5 — Probar que funciona

1. Ve a **GitHub → tu repo → Actions → "Backup diario WVS"**
2. Haz clic en **"Run workflow"** (botón gris arriba a la derecha)
3. Espera ~30 segundos
4. Comprueba que aparece ✅ verde
5. Ve a Supabase → Storage → backups → verás el archivo `wvs-backup-YYYY-MM-DD.json`

---

## Alternativa: Google Drive en lugar de Supabase Storage

Si prefieres Google Drive, sigue estos pasos adicionales:

### Crear cuenta de servicio en Google Cloud

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un proyecto nuevo → **"WVS Backups"**
3. Biblioteca → busca **"Google Drive API"** → Activar
4. Credenciales → **Crear credenciales → Cuenta de servicio**
5. Nombre: `wvs-backup-bot` → Crear
6. En la cuenta de servicio → **Claves → Añadir clave → JSON** → Descarga el archivo

### Compartir carpeta de Drive

1. En Google Drive, crea una carpeta **"WVS-Backups"**
2. Clic derecho → Compartir
3. Añade el email de la cuenta de servicio (algo como `wvs-backup-bot@tu-proyecto.iam.gserviceaccount.com`)
4. Permiso: **Editor**

### Configurar rclone localmente

```bash
# Instalar rclone
# Mac:
brew install rclone
# Linux/Windows: https://rclone.org/downloads/

# Configurar
rclone config
# Responde:
#   n → nombre: gdrive
#   tipo: drive (escribe "drive")
#   client_id: (vacío, Enter)
#   client_secret: (vacío, Enter)
#   scope: 1
#   service_account_file: /ruta/al/archivo-descargado.json
#   root_folder_id: (vacío, Enter)
#   Edit advanced: n
#   auto config: n
#   y (confirmar)
```

### Añadir secret de rclone en GitHub

```bash
cat ~/.config/rclone/rclone.conf
```

Copia todo el contenido → GitHub Secrets → nuevo secret:
- Nombre: `RCLONE_CONF`
- Valor: el contenido del rclone.conf

### Activar en el workflow

Abre `.github/workflows/backup.yml`:
1. **Comenta** o elimina el bloque "2a. Supabase Storage"
2. **Descomenta** el bloque "2b. Google Drive" (elimina los `#`)
3. Commit y push

---

## Frecuencia de backups

Por defecto: **diario a las 03:00 UTC** (05:00 hora España).

Para cambiarla, edita la línea `cron:` en `.github/workflows/backup.yml`:

| Frecuencia | Valor cron |
|---|---|
| Cada día a las 3am UTC | `'0 3 * * *'` |
| Cada 12 horas | `'0 3,15 * * *'` |
| Solo los lunes | `'0 3 * * 1'` |

---

## Coste

| Servicio | Coste |
|---|---|
| GitHub Actions | **Gratis** (2.000 min/mes, usas ~30) |
| Supabase Storage | **Gratis** hasta 1 GB (plan free) |
| Google Drive | **Gratis** hasta 15 GB |
