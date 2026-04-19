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

### Update Frontend for Production
Currently, the frontend `Dockerfile` uses `npm run dev`. For production, we must build static files and serve them via Nginx.

1. Create `frontend/nginx.conf`:
```nginx
server {
    listen 80;
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

2. Create `frontend/Dockerfile.prod`:
```dockerfile
# Build stage
FROM node:20-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Production stage
FROM nginx:stable-alpine
COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Build and Push Frontend
```powershell
cd ../frontend
# IMPORTANT: Ensure $BACKEND_URL is set from the step above
docker build --platform linux/amd64 -f Dockerfile.prod `
    --build-arg VITE_API_URL=$BACKEND_URL `
    -t us-central1-docker.pkg.dev/$PROJECT_ID/math-buddy-repo/frontend:v1 .

docker push us-central1-docker.pkg.dev/$PROJECT_ID/math-buddy-repo/frontend:v1
```

### Deploy Frontend to Cloud Run
```powershell
gcloud run deploy math-buddy-app `
    --image us-central1-docker.pkg.dev/$PROJECT_ID/math-buddy-repo/frontend:v1 `
    --region us-central1 `
    --allow-unauthenticated `
    --port 80
```

---

## 5. Post-Deployment: CORS Update
Now that the frontend has a public URL, update the backend to allow it.

```powershell
$FRONTEND_URL = gcloud run services describe math-buddy-app --region us-central1 --format="value(status.url)"

gcloud run services update math-buddy-api `
    --region us-central1 `
    --update-env-vars="CORS_ORIGINS=$FRONTEND_URL"
```

---

## 6. Verification
1. Open the `$FRONTEND_URL` in your browser.
2. In the GCP Console, go to **Cloud Run > math-buddy-api > Logs**.
3. Because we set `LOG_FORMAT=json`, you should see perfectly parsed structured logs with `severity`, `elapsed_ms`, and `request_id`.
