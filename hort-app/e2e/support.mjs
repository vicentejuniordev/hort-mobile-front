export async function connectAPI(page, writes = []) {
  // Forward browser requests to the real isolated Django service. This is a
  // loopback transport bridge for web CORS; no API responses are mocked.
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        },
      });
      return;
    }
    const headers = { ...request.headers() };
    delete headers.host;
    delete headers.origin;
    const response = await fetch(
      `http://127.0.0.1:8214${url.pathname}${url.search}`,
      {
        method: request.method(),
        headers,
        body: request.postData() ?? undefined,
      },
    );
    const body = await response.text();
    if (
      !['GET', 'HEAD'].includes(request.method()) &&
      !url.pathname.includes('/auth/')
    ) {
      writes.push({
        method: request.method(),
        path: url.pathname,
        status: response.status,
        input: request.postDataJSON(),
        body: body ? JSON.parse(body) : null,
      });
    }
    await route.fulfill({
      status: response.status,
      headers: {
        'content-type':
          response.headers.get('content-type') ?? 'application/json',
        'access-control-allow-origin': '*',
      },
      body,
    });
  });
}
