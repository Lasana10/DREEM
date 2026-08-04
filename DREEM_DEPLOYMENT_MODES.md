# DREEM Deployment Modes

## Goal

DREEM must work for schools with different budgets, internet quality, and technical maturity.

That means deployment should not depend only on Raspberry Pi.

## Mode 1: Cloud-First Pilot

Best for:

- quick demos
- early pilot schools
- schools with stable internet

Stack:

- frontend web app
- Supabase auth
- Supabase Postgres
- Supabase storage
- notifications and edge functions

## Mode 2: Local School Computer Node

Best for:

- real schools without Pi hardware yet
- partially offline environments
- office-machine deployment

Stack:

- web app
- local service on Windows or Linux computer
- local database
- sync connector to Supabase
- local file storage

## Mode 3: Raspberry Pi Edge Node

Best for:

- stronger offline resilience
- school-owned local control
- always-on local operations

Stack:

- Raspberry Pi 5
- local database
- local API
- sync agent
- hardware sentinel
- optional local AI routing

## Recommended Rollout

1. Present with Cloud-First Pilot mode.
2. Build Local School Computer Node mode for practical adoption.
3. Mature the Raspberry Pi Edge Node for resilience and differentiation.

## Why This Is Best

This reduces friction.

Schools can start with ordinary hardware and only later move to edge deployment when they are ready.

