// functions/_middleware.js

export async function onRequest(context) {
  const { request, next } = context;

  const rangeHeader = request.headers.get("Range");
  if (!rangeHeader) {
    return next();
  }

  const url = new URL(request.url);
  if (!url.pathname.endsWith(".jar")) {
    return next();
  }

  const response = await next();

  // Kalau origin sudah 206 → jangan diubah
  if (response.status === 206) {
    return response;
  }

  const buffer = await response.arrayBuffer();
  const size = buffer.byteLength;

  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) {
    return response;
  }

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;

  if (start >= size || end >= size) {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${size}`,
      },
    });
  }

  const sliced = buffer.slice(start, end + 1);

  return new Response(sliced, {
    status: 206,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/java-archive",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": sliced.byteLength.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000",
    },
  });
}
