# SAHYAK CRM — Production Environment Configuration Contract

## Environment Variable Matrix

| Variable Name | Location | Required in Prod | Secret? | Purpose / Validation |
|---|---|---|---|---|
| `PORT` | Backend | Optional (Default 5000) | No | TCP Port for Express server |
| `NODE_ENV` | Backend | **Yes** (`production`) | No | Toggles strict validation, security error suppression |
| `MONGO_URI` / `MONGODB_URI` | Backend | **Yes** | **Yes** | MongoDB Atlas connection string (`mongodb+srv://...`) |
| `JWT_SECRET` | Backend | **Yes** | **Yes** | Min 16-char secret for HS256 JWT tokens. Insecure defaults rejected. |
| `FRONTEND_URL` | Backend | **Yes** | No | Canonical origin for CORS allowed origins (`https://crm.sahyak.com`) |
| `BACKEND_URL` | Backend | **Yes** | No | Canonical API URL for OAuth redirects (`https://api.sahyak.com`) |
| `CLOUDINARY_CLOUD_NAME` | Backend | Integration | No | Cloudinary cloud identifier for durable asset storage |
| `CLOUDINARY_API_KEY` | Backend | Integration | **Yes** | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | Backend | Integration | **Yes** | Cloudinary API Secret |
| `RAZORPAY_KEY_ID` | Backend | Integration | No | Razorpay Key ID |
| `RAZORPAY_KEY_SECRET` | Backend | Integration | **Yes** | Razorpay Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | Backend | Integration | **Yes** | Webhook HMAC SHA256 signature verification key |
| `META_APP_ID` | Backend | Integration | No | Meta Developer App ID |
| `META_APP_SECRET` | Backend | Integration | **Yes** | Meta Developer App Secret |
| `META_VERIFY_TOKEN` | Backend | Integration | **Yes** | Meta Webhook Verification Token |
| `META_REDIRECT_URI` | Backend | Integration | No | OAuth callback redirect URL |
| `GOOGLE_CLIENT_ID` | Backend | Integration | No | Google Cloud OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Backend | Integration | **Yes** | Google Cloud OAuth Client Secret |
| `GOOGLE_WEBHOOK_SECRET` | Backend | Integration | **Yes** | Google Ads Lead Form webhook secret token |
| `NEXT_PUBLIC_API_URL` | Frontend | Optional | No | Public backend API endpoint (`https://api.sahyak.com/api`) |

---

## Fail-Fast Validation
The production validator (`backend/src/config/envValidator.js`) evaluates required environment variables immediately upon startup when `NODE_ENV=production`. If `JWT_SECRET` is missing, short (< 16 chars), or set to default placeholders, or if `MONGO_URI` is invalid, the process terminates immediately with Exit Code 1.
