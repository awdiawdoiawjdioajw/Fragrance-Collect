# Prompt for CJ ProductFeeds GraphQL API Integration

This document outlines the step-by-step process to integrate the Commission Junction (CJ) `productFeeds` GraphQL API into the Fragrance-Collect website.

## 1. Authentication and Configuration Update

The `productFeeds` query uses CJ's GraphQL API, which requires a **Personal Access Token (PAT)** for authentication, not the Developer Key used by the existing Product Search (REST) API.

### Required Credentials:
- **Personal Access Token (PAT):** Generate this from the CJ Developer Portal under "Authentication".
- **Company ID:** This is your Publisher ID, found in the CJ Publisher Dashboard.

### Task: Update Backend Configuration
- Modify `api/index.js` to include new configuration variables for the PAT, Company ID, and the GraphQL API endpoint.
- These will be read from environment variables (`process.env`).

```javascript
// In api/index.js
const config = {
  CJ_DEV_KEY: process.env.CJ_DEV_KEY,
  CJ_PERSONAL_ACCESS_TOKEN: process.env.CJ_PERSONAL_ACCESS_TOKEN, // For GraphQL
  CJ_COMPANY_ID: process.env.CJ_COMPANY_ID, // Your publisher/company ID
  CJ_WEBSITE_ID: process.env.CJ_WEBSITE_ID,
  // ...
  CJ_GQL_API_BASE: 'https://ads.api.cj.com/query', // GraphQL endpoint
  // ...
};
```

## 2. Backend API Implementation (`api/index.js`)

The backend needs to be able to fetch the list of available product feeds and then use the advertiser IDs from those feeds to search for products.

### Task 2.1: Create a GraphQL `getProductFeeds` Function
- Implement a new `async` function `getProductFeeds` in `api/index.js`.
- This function will:
    - Check for the required `CJ_PERSONAL_ACCESS_TOKEN` and `CJ_COMPANY_ID`.
    - Construct the GraphQL query for `productFeeds`.
    - Make a `POST` request to the `CJ_GQL_API_BASE` endpoint.
    - Include the `Authorization: Bearer <token>` header.
    - Handle potential errors from the API response.
    - Return the `resultList` from the response.

### Task 2.2: Create a New `/feeds` Endpoint
- Add a new route handler in the `http.createServer` callback for the path `/feeds`.
- This endpoint will call `getProductFeeds()` and return the list of feeds as a JSON response.

### Task 2.3: Modify Product Search to Filter by Advertiser
- Update the `searchCJProducts` function to accept an `advertiserIds` parameter.
- If `advertiserIds` are provided, use them in the `advertiser-ids` query parameter for the CJ Product Search API call. Otherwise, fall back to the existing `scope` parameter.
- Update the `/products` endpoint to accept an `advertiserIds` query parameter and pass it to the `searchCJProducts` function.

## 3. Frontend Implementation (`script.js`)

The frontend needs to fetch the list of advertisers from the new `/feeds` endpoint, display them in a filter, and allow the user to search for products from a selected advertiser.

### Task 3.1: Update Global State
- Add new global variables to `script.js`:
    - `availableFeeds = []` to store the feed data.
    - Add `advertiserIds: []` to the `currentFilters` object.

### Task 3.2: Implement Feed Loading and UI Population
- Create a new `async` function `loadAvailableFeeds` that fetches data from the `/feeds` endpoint and stores it in `availableFeeds`.
- Create a function `populateAdvertiserFilter` that:
    - Takes the data from `availableFeeds`.
    - De-duplicates advertisers (since one advertiser can have multiple feeds).
    - Calculates the total product count per advertiser.
    - Populates the advertiser `<select>` dropdown in the HTML.

### Task 3.3: Update Product Fetching Logic
- Modify `fetchCJProducts` to accept an `advertiserIds` array. If the array is not empty, it should be added as a query parameter (`advertiserIds=111,222`) to the `/products` API request.
- The `loadCJProducts` function should also be updated to accept and pass `advertiserIds`.

### Task 3.4: Integrate into Application Flow
- Update `initializeApp` to call a new function, `loadFeedsAndInitialProducts`, which first calls `loadAvailableFeeds` and then loads the initial set of products.
- Modify the filter handling functions (`applyFilters`, `clearFilters`) and the search function (`performSearch`) to:
    - Read the selected advertiser ID from the new dropdown.
    - Update `currentFilters.advertiserIds`.
    - Trigger a new product load by calling `loadCJProducts` with the selected advertiser ID(s) and search term. This will re-fetch data from the server.
    - After fetching, apply any client-side filters (like price range, brand) by calling `filterPerfumes`.

## 4. HTML Changes (`index.html` or `main.html`)

A new UI element is needed for the user to select an advertiser.

### Task 4.1: Add Advertiser Filter Dropdown
- Add a `<select>` element to the filters section of the HTML.
- Give it an `id` of `advertiser-filter`.
- Include a default "Loading..." or "All Advertisers" option.

```html
<div class="filter-group">
    <label for="advertiser-filter">Advertiser</label>
    <select id="advertiser-filter">
        <option value="">All Advertisers</option>
    </select>
</div>
```
