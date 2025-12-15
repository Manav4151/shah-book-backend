# Shah Book House — Backend

A Node.js (Express) backend for Shah Book House. Provides APIs for managing books, authors, quotations, templates, company profiles and Google OAuth integration for Gmail operations.

**Tech stack**: Node.js, Express, MongoDB (Mongoose), Google APIs

---

**Prerequisites**:
- Node.js 18+ (or compatible)
- NPM (comes with Node.js)
- A MongoDB instance (Atlas or local)

**Environment variables** (create a `.env` file in project root):
- `MONGODB_ATLAS_URL` : MongoDB connection URL (e.g. `mongodb+srv://user:pass@cluster0.mongodb.net`)
- `MONGODB_ATLAS_NAME` : Database name (default: `demo`)
- `PORT` : (optional) Server port (default: `8000`)

Google OAuth (if using Google routes/features):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

You may also have other optional variables depending on features you use (email providers, Resend API keys, etc.). Check `config/` and `config/googleClient.js` for specifics.

---

**Install**

```powershell
cd path/to/shah_book_house_backend
npm install
```

**Run (development)**

```powershell
npm run dev
```

`npm run dev` runs `nodemon index.js` (see `package.json`).

**Available npm scripts** (from `package.json`):
- `start` : `nodemon index.js` (same as `dev` in this project)
- `dev` : `nodemon index.js`
- `test` : placeholder

---

**API (overview)**
The app mounts a number of route groups under `/api`:

- `POST /api/auth` — authentication handler (mounted via `better-auth` at `/api/auth`).
- `GET/POST/PUT/DELETE /api/books` — book-related operations (see `routes/book.routes.js`).
- `/api/templates` — template operations (`routes/template.routes.js`).
- `/api/quotations` — quotation operations (`routes/quotation.routes.js`).
- `/api/company-profiles` — company profile operations (`routes/company.profile.routes.js`).
- `/api/google` — Google OAuth / Gmail related endpoints (`routes/google.routes.js`).
- `/api` — additional common routes (`routes/common.routes.js`).

Refer to the `routes/` and `controllers/` directories for the full list of endpoints and expected request/response bodies.

---

**Project structure (top-level)**

- `index.js` — application entry point
- `config/` — configuration helpers (DB, Google client)
- `controllers/` — request handlers and business logic
- `routes/` — API route definitions
- `models/` — Mongoose schemas and models
- `middleware/` — Express middleware (auth, error handling, uploads)
- `lib/` — utilities and auth glue
- `utils/` — helpers (excel import, ISBN validator)
- `public/` — static assets
- `uploads/` — uploaded files
- `logs/` — application logs

---

**Development tips**
- Keep a `.env` file at project root with the required environment variables.
- Use Postman or curl to test endpoints.
- Static files are served at `/public`.

---

**Logging & uploads**
- Uploaded files are stored under `uploads/` by default (see `middleware/upload.middleware.js`).
- Application logging uses `winston` and logs are kept under `logs/`.

---


