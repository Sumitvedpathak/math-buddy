# Step-by-Step Deployment: Math Buddy on Google Cloud Platform (Cloud Run)

This guide walks through deploying the backend API and frontend SPA to **Google Cloud Run**.

## Prerequisites
1.  **GCP Account**: A project with billing enabled.
2.  **Google Cloud CLI**: Installed (`gcloud`) and authenticated (`gcloud auth login`).
3.  **Docker**: Installed and running locally.
4.  **OpenRouter API Key**: A valid key for the LLM.

---

## 1. Project Initialization
Set your project ID and enable the required APIs:

```powershell
$PROJECT_ID = "your-project-id" # Replace with your real project id
gcloud config set project $PROJECT_ID

# Enable Cloud Run, Artifact Registry, and Secret Manager
gcloud services enable run.googleapis.com `
                       artifactregistry.googleapis.com `
                       secretmanager.googleapis.com
```

---

## 2. Secure Configuration (Secret Manager)
Store your OpenRouter API key securely instead of using environment variables in plain text.

```powershell
# Create the secret
echo "your-sk-or-v1-key" | gcloud secrets create OPENROUTER_API_KEY --data-file=-

# Grant the default compute service account access to read this secret
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
gcloud secrets add-iam-policy-binding OPENROUTER_API_KEY `
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" `
    --role="roles/secretmanager.secretAccessor"
```

---

## 3. Backend Deployment

### Create Artifact Registry
```powershell
gcloud artifacts repositories create math-buddy-repo `
    --repository-format=docker --location=us-central1
```

### Build and Push Backend
```powershell
cd backend
# Build for linux/amd64 (Cloud Run architecture)
docker build --platform linux/amd64 -t us-central1-docker.pkg.dev/$PROJECT_ID/math-buddy-repo/backend:v1 .
docker push us-central1-docker.pkg.dev/$PROJECT_ID/math-buddy-repo/backend:v1
```

### Deploy Backend to Cloud Run
Note how we map the secret from Secret Manager and set `LOG_FORMAT=json` for structured cloud logging.

```powershell
gcloud run deploy math-buddy-api `
    --image us-central1-docker.pkg.dev/$PROJECT_ID/math-buddy-repo/backend:v1 `
    --region us-central1 `
    --allow-unauthenticated `
    --set-env-vars="OPENROUTER_MODEL=google/gemini-2.0-flash-001,LOG_LEVEL=INFO,LOG_FORMAT=json" `
    --set-secrets="OPENROUTER_API_KEY=OPENROUTER_API_KEY:latest" `
    --port 8000

# Capture the backend URL for the frontend
$BACKEND_URL = gcloud run services describe math-buddy-api --region us-central1 --format="value(status.url)"
```

---

## 4. Frontend Deployment

The frontend image (`frontend/Dockerfile.prod`) builds the static app and serves it with nginx.
nginx also passes `/api/` on to the backend (`frontend/nginx.conf.template`), so the app and
its API share one address. Parent sign-in needs this: its refresh cookie is
`SameSite=Strict` with `Path=/api/v1/auth`, so it only works on the app's own address.
The browser never calls the backend's own URL.

- No `VITE_API_URL`: the app calls `/api/v1/...` on its own address.
- `VITE_GOOGLE_CLIENT_ID` (build arg): the **production** Google OAuth client. It is public
  (it ends up in the page). `frontend/.env.local` is not copied into the image.
- `API_UPSTREAM` (Cloud Run env var on `math-buddy-app`): where nginx sends `/api/`,
  e.g. `https://math-buddy-api-670264226001.us-central1.run.app`.
- Build on your own PC: the lesson page images in `frontend/public/lessons/` are
  git-ignored but must be in the build context.

### Build and Push Frontend
```powershell
cd ../frontend
docker build --platform linux/amd64 -f Dockerfile.prod `
    --build-arg VITE_GOOGLE_CLIENT_ID=<production OAuth client ID> `
    -t us-central1-docker.pkg.dev/$PROJECT_ID/math-buddy-repo/frontend:vN .

docker push us-central1-docker.pkg.dev/$PROJECT_ID/math-buddy-repo/frontend:vN
```

### Deploy Frontend to Cloud Run
```powershell
gcloud run deploy math-buddy-app `
    --image us-central1-docker.pkg.dev/$PROJECT_ID/math-buddy-repo/frontend:vN `
    --region us-central1 `
    --allow-unauthenticated `
    --port 80 `
    --update-env-vars=API_UPSTREAM=$BACKEND_URL
```

---

## 5. Backend settings for parent sign-in, and CORS

```powershell
# A random secret that signs the 15-minute access tokens. Write it to a file WITHOUT a
# trailing newline (PowerShell's echo adds one), then:
gcloud secrets create MATH_BUDDY_JWT_SECRET --replication-policy=automatic --data-file=jwt.txt

$FRONTEND_URL = gcloud run services describe math-buddy-app --region us-central1 --format="value(status.url)"

gcloud run services update math-buddy-api `
    --region us-central1 `
    --update-secrets=MATH_BUDDY_JWT_SECRET=MATH_BUDDY_JWT_SECRET:latest `
    --update-env-vars="^@^MATH_BUDDY_GOOGLE_CLIENT_IDS=<production OAuth client ID>@CORS_ORIGINS=<both frontend URLs, comma-separated>"
```

- Cloud Run gives each service **two** URLs. List both frontend URLs in `CORS_ORIGINS`
  (the sign-in endpoints check the `Origin` header against it) and as **Authorized
  JavaScript origins** on the production OAuth client (Google Cloud console > APIs &
  Services > Credentials). No redirect URIs are needed.
- Use `--update-*`, never `--set-*` (which replaces everything).

---

## 6. Database migrations

The container does not run migrations. Before deploying a schema change, from `backend/`
with `MATH_BUDDY_DATABASE_URL` set to the Neon **direct** (non-pooler) URL:

```powershell
uv run alembic upgrade head
```

---

## 7. Routine redeploy (new version)

Bump the tags (see the memory/notes for the current ones), keep the old images for rollback.
Deploy the backend first, then the frontend straight after. An image-only deploy keeps all
env vars and secrets:

```powershell
gcloud run deploy math-buddy-api --image .../backend:vN --region us-central1
gcloud run deploy math-buddy-app --image .../frontend:vM --region us-central1
```

Rollback = the same command with the previous tags.

---

## 8. Verification
1. Open the `$FRONTEND_URL`: "Who's here?" (or practice on a linked child's device).
2. `$FRONTEND_URL/api/v1/curriculum` answers `401 Not signed in` (nginx reached the backend).
3. `$FRONTEND_URL/parent`: Google sign-in works for a test user / any Google account.
4. Testing `POST`s with curl: send `-d ''` even without a body, otherwise Google's front
   end answers 411 (browsers always send a length).
5. In the GCP Console, **Cloud Run > math-buddy-api > Logs** shows JSON logs with
   `severity`, `elapsed_ms` and `request_id` (`LOG_FORMAT=json`).
