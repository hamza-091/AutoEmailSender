# Email Genie

Job post paste karo → polished, recruiter-ready email milta hai → apni Gmail se seedha CV ke sath send kardo. Sab kuch responsive hai (Chrome + mobile).

## Kya kya lagega (3 cheezein)

1. **Anthropic API key** (email likhne ke liye) — https://console.anthropic.com/settings/keys
2. **Google OAuth credentials** (Gmail se bhejne ke liye) — Google Cloud Console se
3. **Vercel account** (deploy ke liye)

---

## Step 1 — Google Cloud Console setup (Gmail se bhejne ke liye)

Yeh zaroori hai kyunki Gmail se email bhejne ke liye Google ki permission chahiye hoti hai (OAuth). One-time setup hai, phir hamesha ke liye chalega.

1. Jao: https://console.cloud.google.com/
2. Naya project banao (upar left "Select a project" → "New Project")
3. Left menu → **APIs & Services → Library** → search karo "Gmail API" → **Enable** karo
4. Left menu → **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: "Email Genie" (ya jo bhi naam rakhna hai)
   - Support email: apna Gmail dalo
   - Scopes step pe: Add scope → `.../auth/gmail.send` search karke add karo
   - Test users step pe: apna khud ka Gmail add karo (jab tak app "verified" nahi hoti, sirf yeh test users hi login kar sakenge — solo use ke liye yeh perfect hai)
5. Left menu → **APIs & Services → Credentials** → **Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs mein add karo:
     - `http://localhost:3000/api/auth/callback/google` (local testing ke liye)
     - `https://YOUR-VERCEL-DOMAIN.vercel.app/api/auth/callback/google` (deploy ke baad iska asli domain daal dena — ek baar deploy kar liya to yahan wapas aake update kar dena)
6. **Client ID** aur **Client Secret** copy karke rakh lo — Vercel env vars mein daalne hain

---

## Step 2 — Deploy on Vercel

1. Yeh poora folder GitHub pe push karo (naya repo banao, code push karo)
2. https://vercel.com pe jao → **Add New Project** → apna GitHub repo import karo
3. Deploy hone se pehle, **Environment Variables** section mein yeh sab add karo:

   | Key | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | apni Claude API key |
   | `GOOGLE_CLIENT_ID` | Step 1 se |
   | `GOOGLE_CLIENT_SECRET` | Step 1 se |
   | `NEXTAUTH_SECRET` | koi bhi random 32-char string (terminal mein `openssl rand -base64 32` chala ke bana sakte ho) |
   | `NEXTAUTH_URL` | `https://YOUR-VERCEL-DOMAIN.vercel.app` (deploy hone ke baad jo domain milega wahi) |

4. **Deploy** dabao
5. Deploy hone ke baad jo `.vercel.app` domain mila hai, usko:
   - `NEXTAUTH_URL` env var mein update karo (agar pehle placeholder dala tha)
   - Google Cloud Console → Credentials → apne OAuth client mein **Authorized redirect URIs** mein bhi add karo: `https://YOUR-DOMAIN.vercel.app/api/auth/callback/google`
6. Vercel pe redeploy kardo (env var change ke baad redeploy zaroori hai)

Bas — ab app live hai.

---

## Use kaise karna hai

1. Job post paste karo
2. Apna naam, tone, aur (optional) relevant background daalo
3. **Generate email** dabao — polished subject + body milega, edit bhi kar sakte ho
4. **Connect Gmail** dabao (ek baar sign-in karna hoga)
5. Apni CV upload karo (yeh sirf tumhare browser mein save hoti hai, dobara upload nahi karni padegi)
6. Recruiter ka email daalo → **Send from Gmail** dabao

Email seedha tumhari Gmail se jaata hai (tumhari "Sent" folder mein bhi dikhega), CV attached ke sath.

---

## Local testing (optional, deploy se pehle check karna ho to)

```bash
npm install
cp .env.example .env.local   # phir isme apni keys bhar do
npm run dev
```

http://localhost:3000 pe khul jayega.

---

## Privacy note

Job post, background, aur generated email kahi save nahi hote — sirf request ke time use hote hain. CV sirf browser localStorage mein save hoti hai (server pe nahi jaati jab tak send nahi karte).
