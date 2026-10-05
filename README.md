# City Complaint Backend — Enhanced for B7A7

Express + TypeScript + Prisma + PostgreSQL REST API.

## Roles
- CITIZEN
- STAFF
- ADMIN

## Added for Assignment 7
- Demo accounts for all 3 roles
- Admin analytics
- Complaint assignment/status workflow
- Feedback
- SSLCommerz sandbox payment initiation + success/fail/cancel redirects
- Production-friendly CORS/env setup

## Local
```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```
API: http://localhost:5000
