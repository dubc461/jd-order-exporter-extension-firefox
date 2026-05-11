# Privacy

JD Order Exporter Local runs entirely inside the user's local Chrome browser.

## Data Access

The extension can access only the following JD domains declared in `manifest.json`:

- `order.jd.com`
- `details.jd.com`
- `details.yiyaojd.com`

It reads order list pages and optional order detail pages visible to the currently signed-in user.

## Data Storage

The extension does not upload, sync, or persist order data through any remote service. Exported data is downloaded locally as `CSV` and `JSONL` files.

The extension does not use `chrome.storage`, `localStorage`, IndexedDB, analytics, telemetry, or third-party APIs.

## Sensitive Data

Exports may contain personal order data, including recipient name, address, phone number, product names, amounts, payment metadata, shipping carrier, and tracking number.

Recipient name, address, and phone number are masked by default. Users can opt out only from the extension popup.

Generated export files match `jd-orders-*` and should not be committed to public repositories.

## Cookies And Session

The extension does not read or export cookies. Network requests use the active Chrome JD session through standard browser credential handling so JD can return pages the user is already allowed to view.
