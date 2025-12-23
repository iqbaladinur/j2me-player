// Cloudflare Pages Functions middleware
// Ensures proper Range request handling for CheerpJ compatibility

export async function onRequest(context) {
  const { request, next, env } = context;

  // Get the response from the next middleware/asset
  const response = await next();

  // Only process Range requests
  const rangeHeader = request.headers.get('Range');
  if (!rangeHeader) {
    return response;
  }

  // Only process specific file types that need Range support
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Check if this is a file that needs Range support
  const needsRangeSupport =
    pathname.endsWith('.jar') ||
    pathname.endsWith('.wasm') ||
    pathname.endsWith('.js');

  if (!needsRangeSupport) {
    return response;
  }

  // If response is already 206, return as-is
  if (response.status === 206) {
    return response;
  }

  // Clone response to get the body
  const responseClone = response.clone();
  const arrayBuffer = await responseClone.arrayBuffer();
  const totalLength = arrayBuffer.byteLength;

  // Parse Range header (e.g., "bytes=0-1023")
  const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!rangeMatch) {
    return response;
  }

  const start = parseInt(rangeMatch[1]);
  const end = rangeMatch[2] ? parseInt(rangeMatch[2]) : totalLength - 1;

  // Validate range
  if (start >= totalLength || start < 0 || end >= totalLength) {
    return new Response('Range Not Satisfiable', {
      status: 416,
      headers: {
        'Content-Range': `bytes */${totalLength}`
      }
    });
  }

  // Calculate content length
  const contentLength = end - start + 1;

  // Slice the buffer
  const slicedBuffer = arrayBuffer.slice(start, end + 1);

  // Create new response with 206 status
  const headers = new Headers(response.headers);
  headers.set('Content-Length', contentLength.toString());
  headers.set('Content-Range', `bytes ${start}-${end}/${totalLength}`);
  headers.set('Accept-Ranges', 'bytes');

  return new Response(slicedBuffer, {
    status: 206,
    statusText: 'Partial Content',
    headers: headers
  });
}
