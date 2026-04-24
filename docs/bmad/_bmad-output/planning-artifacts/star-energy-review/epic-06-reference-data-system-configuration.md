## Epic 6: Reference Data & System Configuration

Admin can manage the store reference database, maintain the compressor regression database without code changes, and manually enter weather data when external APIs are unavailable.

**FRs covered:** FR43 (admin-side), FR44, FR46, FR47

---

### Story 6.1: Store Reference Data Management

As an Admin,
I want to create, edit, and manage store reference records that auditors see when selecting a store,
So that new client locations can be onboarded and existing records kept accurate without engineering involvement.

**Acceptance Criteria:**

**Given** an Admin opens the Reference Data page and selects "Stores",
**When** GET `/api/v1/stores` is called,
**Then** all stores for the Admin's tenant are listed in a searchable table showing store number, name, banner, region, and assigned auditor count

**Given** an Admin submits POST `/api/v1/stores` with required store fields,
**When** the request is processed,
**Then** a new store record is created and immediately available to auditors in the Store Selector; Redis cache key `store_ref:{storeNumber}` is invalidated

**Given** an Admin edits an existing store record via PATCH `/api/v1/stores/:storeNumber`,
**When** the update is saved,
**Then** the store reference data is updated; the Redis cache entry is invalidated so auditors see fresh data on their next store selection

**Given** an Admin assigns auditors to a store,
**When** the assignment is saved,
**Then** those auditors see the store in their Store Selector; previously assigned auditors who are removed no longer see it

---

### Story 6.2: Compressor Regression Database Management

As an Admin,
I want to add, update, and retire compressor models in the regression database without any code deployments,
So that new compressor models discovered on-site are captured quickly and the calculation engine stays accurate.

**Acceptance Criteria:**

**Given** an Admin opens the Compressor Database section,
**When** GET `/api/v1/compressors` is called,
**Then** all compressor models are listed with model number, manufacturer, refrigerant type, capacity, EER, and status (active / retired)

**Given** an Admin submits POST `/api/v1/compressors` with a new model's regression coefficients,
**When** the request is processed,
**Then** the new model is added; Redis cache key `compressor_db:v{version}` is invalidated and a new version is created; future auditor lookups return the updated model

**Given** an Admin updates an existing compressor record via PATCH `/api/v1/compressors/:model`,
**When** the update is saved,
**Then** the change takes effect without a deployment; existing audits stamped with the previous `compressor_db_version` continue to use the version they were created with

**Given** an Admin retires a compressor model,
**When** the model status is set to "retired",
**Then** the model no longer appears in auditor lookups; existing calculation results using that model are unaffected

**Given** an auditor submitted a new compressor model on-site (Story 3.3),
**When** the Admin views the "Unknown Models" queue,
**Then** the submitted model's specs appear for review; Admin can promote it to the main database in one action

---

### Story 6.3: Weather Data Retrieval & Manual Fallback

As an Admin,
I want weather data to fetch automatically from external APIs, with a manual entry fallback when they're unavailable,
So that energy baseline calculations are never blocked by an external API outage.

**Acceptance Criteria:**

**Given** a calculation job requires degree-day data for a site's postal code,
**When** climate.weather.gc.ca and degreedays.net are called,
**Then** current outdoor temperature and CDD/HDD values are returned and cached in Redis (`weather:{postalCode}:{date}` TTL 6h)

**Given** both weather APIs fail or time out (>5 seconds per NFR-P6),
**When** the calculation job cannot retrieve degree-day data,
**Then** the audit is placed in a `WEATHER_DATA_PENDING` holding state; an in-app alert notifies Admin: "Degree-day data unavailable for [Site]. Enter manually to proceed."

**Given** the Admin enters degree-day values manually via the admin UI (FR47),
**When** PATCH `/api/v1/audits/:id/weather-data` is called,
**Then** the values are saved; the audit automatically re-queues for calculation; the holding state is cleared

**Given** manual degree-day data has been entered,
**When** the calculation runs using that data,
**Then** the calculation result is flagged as "Manual weather data used" in the calculation record — visible in the Admin's calc review panel

---

