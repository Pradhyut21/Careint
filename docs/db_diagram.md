# CareLoop Data Model & Concurrency Guarantee

This document contains the Entity-Relationship (ER) diagram for CareLoop, illustrating the database structure and the concurrency guarantee enforced at the database level.

## Mermaid ER Diagram

```mermaid
erDiagram
    doctors {
        uuid id PK
        varchar name
        varchar email UK
        varchar specialization
        varchar location
        integer fee
        text photo_url
        text bio
        integer years_experience
    }

    patients {
        uuid id PK
        varchar name
        integer age
        varchar phone UK
        varchar blood_group
        text conditions
        text medications
    }

    slots {
        uuid id PK
        uuid doctor_id FK
        date date
        time start_time
        time end_time
        varchar status "available | blocked | booked"
    }

    appointments {
        uuid id PK
        uuid slot_id FK "UNIQUE NOT NULL"
        uuid patient_id FK
        uuid doctor_id FK
        varchar booking_id UK
        text diagnosis_notes
        text prescription
        timestamp created_at
    }

    whatsapp_sessions {
        varchar phone PK
        varchar step
        varchar language
        varchar specialization
        uuid doctor_id
        uuid slot_id
        varchar patient_name
        integer patient_age
        timestamp updated_at
    }

    user {
        text id PK
        varchar name
        varchar email UK
        boolean email_verified
        text image
        timestamp created_at
        timestamp updated_at
        text role
    }

    session {
        text id PK
        timestamp expires_at
        text token UK
        timestamp created_at
        timestamp updated_at
        text ip_address
        text user_agent
        text user_id FK
    }

    account {
        text id PK
        text account_id
        text provider_id
        text user_id FK
        text access_token
        text refresh_token
        text id_token
        timestamp access_token_expires_at
        timestamp refresh_token_expires_at
        text scope
        text password
        timestamp created_at
        timestamp updated_at
    }

    doctors ||--o{ slots : "generates"
    doctors ||--o{ appointments : "attends"
    patients ||--o{ appointments : "books"
    slots ||--o| appointments : "1:1 Concurrency Guarantee (slot_id UNIQUE)"
    user ||--o{ session : "has"
    user ||--o{ account : "auth_via"
```

## Concurrency Guarantee Explanation

As shown in the diagram:
- Each `slot` can have at most **one** corresponding `appointment` because of the `UNIQUE` constraint on `appointments.slot_id` at the database level.
- When two parallel booking requests for the same `slot_id` are fired, both will attempt to execute an `INSERT` into `appointments`.
- The database engine evaluates the `UNIQUE` constraint atomically. The transaction that is processed first will successfully insert the record.
- The second transaction will immediately fail with a Postgres error code `23505` (unique_violation).
- This ensures absolute data integrity and prevents double-booking under high concurrency without requiring application-level locking (mutexes, Redis locks) or slow `SELECT-then-INSERT` checks.
