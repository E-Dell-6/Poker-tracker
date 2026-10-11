# PokerFlow

[Visit PokerFlow](https://www.pokerflow.live)

PokerFlow is a full stack web application that allows players to track live poker sessions in real time. Users can clock in, record buy-ins, and manage session data through a structured interface backed by a cloud-hosted API.



## Tech Stack

**Frontend**
- React, HTML, CSS, JavaScript

**Backend**
- Node.js, Express

**Database**
- MongoDB

**DevOps & Cloud**
- Docker, Microsoft Azure Container Apps


## What Problem Does It Solve?

Many poker players rely on notes apps or spreadsheets to track sessions, which lack consistency and real-time structure. PokerFlow provides a centralized system to record sessions, track buy-ins, and maintain organized performance data that can later be analyzed for improvement.

## What I Learned

- Designing and structuring a full stack application from scratch
- Building and organizing RESTful APIs
- Connecting a production backend to MongoDB using environment variables
- Containerizing applications with Docker
- Deploying and debugging applications on Microsoft Azure
- Managing production issues such as routing errors, environment configuration, and container revisions

## Local Development on a Remote Server

`npm run dev` from the repo root starts the backend on `127.0.0.1:1111` and Vite on `localhost:5173`. Vite proxies `/api` and `/uploads` to the backend, so only the frontend port needs forwarding:

```bash
ssh -L 5173:localhost:5173 user@your-server
```

Then open http://localhost:5173 on your laptop. Leave `VITE_API_URL` unset in dev.
