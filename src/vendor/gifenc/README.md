# gifenc 1.0.3

Source: https://github.com/mattdesl/gifenc
MIT license (LICENSE.md included).
Pinned npm distribution: https://registry.npmjs.org/gifenc/-/gifenc-1.0.3.tgz
Integrity: sha512-xdr6AdrfGBcfzncONUOlXMBuc5wJDtOueE3c5rdG0oNgtINLD+f2iFZltrBRZYzACRbKr+mSVU/x98zv2u3jmw==

Vendored ESM distribution with only the sourceMappingURL comment removed. No runtime dependencies, CDN requests, eval, or build tool required. Original build targets include Safari 11. This does not constitute physical iOS device testing. Latest npm release was 2021-03-07; maintenance is infrequent, so the exact version is pinned and encoding/decoding regression tests cover our use. Loaded lazily only for GIF generation, primarily inside a module worker.

Verified 2026-09-29 against the official npm registry: latest remains 1.0.3,
published 2021-03-07. Upstream's latest commit was 2024-09-19
(`27db5b982dba701ca440b55ea36fad3999040973`). The local tarball's SHA-512
matches the registry integrity and the vendored file matches its ESM build.
The JavaScript is 9,058 bytes excluding its trailing newline, 3,889 bytes gzip.

The application supplies its own single-worker protocol; gifenc does not include
a worker API. RGBA buffers are transferred one at a time, a shared 128-color
palette is sampled from the first and final cards, and the worker is terminated
on completion, abort, error or timeout. If module workers cannot start, the same
encoder runs locally with a yield between frames. No server conversion is used.
