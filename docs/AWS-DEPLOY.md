# Deploy to AWS

Your local IAM user (`aws sts get-caller-identity`) must be allowed to use the services you pick below. If you see `AccessDenied` on ECR or CloudFormation, an admin should attach a policy (see **IAM permissions** at the end).

## Option A — Amplify Hosting (simplest if you use GitHub)

1. In [AWS Amplify console](https://console.aws.amazon.com/amplify/) → **Host web app** → connect **GitHub** → select this repository and branch `main`.
2. Amplify detects `amplify.yml` and runs `npm ci` / `npm run build`.
3. Under **App settings → Environment variables**, add at least:
   - `NEXT_PUBLIC_VAPI_PUBLIC_KEY`
   - `NEXT_PUBLIC_VAPI_ASSISTANT_ID`
   - Optional: `OPENAI_API_KEY`, `OPENAI_SUMMARY_MODEL`, `VAPI_WEBHOOK_SECRET`
4. Save and deploy. Your app URL will look like `https://main.xxxxx.amplifyapp.com`.

Use this URL in Vapi if you need the **Server URL** for webhooks: `https://<host>/api/vapi/webhook`.

## Option B — Docker + ECR + App Runner

Good when you want a container URL and **auto-deploy** when a new image is pushed.

### 1. Create the ECR repository

Either in the [ECR console](https://console.aws.amazon.com/ecr/) (repository name `voice-personal-assistant`) or with CloudFormation (needs `cloudformation:*` on the template and stack):

```bash
aws cloudformation deploy \
  --stack-name voice-pa-ecr \
  --template-file infrastructure/ecr.yaml \
  --region us-east-1
```

Note the **RepositoryUri** in stack outputs.

### 2. Build and push the image

Requires [Docker](https://docs.docker.com/get-docker/) and ECR permissions (`ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:PutImage`, etc.):

```bash
cd /path/to/Voice-personal-assistant
export AWS_REGION=us-east-1
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

docker build -t voice-personal-assistant .
docker tag voice-personal-assistant:latest $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/voice-personal-assistant:latest
docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/voice-personal-assistant:latest
```

### 3. Create the App Runner service

After the image exists in ECR:

```bash
export IMAGE_URI=$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/voice-personal-assistant:latest

aws cloudformation deploy \
  --stack-name voice-pa-apprunner \
  --template-file infrastructure/apprunner.yaml \
  --parameter-overrides ImageUri=$IMAGE_URI \
  --capabilities CAPABILITY_NAMED_IAM \
  --region $AWS_REGION
```

In the [App Runner console](https://console.aws.amazon.com/apprunner/), open the service → **Configuration** → **Environment variables** and add the same `NEXT_PUBLIC_*` and optional server keys as in `.env.example`.

### 4. GitHub Actions (optional)

Workflow: `.github/workflows/deploy-aws-ecr.yml`

Add repository **Secrets**:

| Secret | Purpose |
|--------|--------|
| `AWS_ACCESS_KEY_ID` | IAM user access key with ECR push rights |
| `AWS_SECRET_ACCESS_KEY` | Matching secret |
| `AWS_REGION` | e.g. `us-east-1` (optional if default is fine) |
| `AWS_APP_RUNNER_SERVICE_ARN` | Optional; if set, each push runs `apprunner start-deployment` |

## IAM permissions (for `cybergrid-deploy` or CI user)

Example actions (scope ARNs to your account/region):

- **ECR**: `ecr:*` on `arn:aws:ecr:REGION:ACCOUNT:repository/voice-personal-assistant` plus `ecr:GetAuthorizationToken` (resource `*`).
- **CloudFormation**: `cloudformation:*` on `arn:aws:cloudformation:REGION:ACCOUNT:stack/voice-pa-*/*` and pass role for `CAPABILITY_NAMED_IAM`.
- **App Runner**: `apprunner:*` as needed for `CreateService` / `StartDeployment`.
- **IAM** (for App Runner stack): `iam:CreateRole`, `iam:AttachRolePolicy`, `iam:GetRole` for roles created by `infrastructure/apprunner.yaml`.

Attach via a custom policy or use broader **PowerUser** / **AdministratorAccess** only in non-production accounts.

## Project files

| File | Role |
|------|------|
| `Dockerfile` | Production image (`next build` standalone) |
| `next.config.ts` | `output: "standalone"` for Docker |
| `amplify.yml` | Amplify Hosting build |
| `infrastructure/ecr.yaml` | ECR repository stack |
| `infrastructure/apprunner.yaml` | App Runner + ECR pull role |
