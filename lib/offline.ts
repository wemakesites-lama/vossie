// The offline page (community actions spec 2.20, plan decision 25): one self-contained HTML document, with inline
// styles, no scripts, no images and no outside files, under 4 KB, so it works when the site's hashed files can't be
// fetched. "Vossie" is text (the crest PNG is 35 KB), in the system fonts the brand faces fall back to (app/fonts.ts),
// set once as --vos-font-*. Try again is a link to the same address: the worker shows this page in place of the one
// asked for, so "" is that page. The words beyond the spec's are samples for Lama to change.

export const OFFLINE_PATH = "/offline";

export const OFFLINE_PAGE = `<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#15305d">
<title>You're offline · Vossie</title>
<style>
:root{--vos-font-display:"Arial Narrow",sans-serif;--vos-font-text:ui-sans-serif,system-ui,sans-serif;--navy:#15305d;--ink:#373f41}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:#fff;color:var(--ink);font-family:var(--vos-font-text);line-height:1.5}
main{max-width:30rem}
.brand{margin:0 0 24px;color:var(--navy);font-family:var(--vos-font-display);font-size:28px;font-weight:700;letter-spacing:.5px;text-transform:uppercase}
h1{margin:0;color:var(--navy);font-family:var(--vos-font-display);font-size:40px;line-height:1;text-transform:uppercase}
p{margin:16px 0 0;font-size:17px}
a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin-top:24px;padding:0 28px;border-radius:999px;background:var(--navy);color:#fff;font-weight:600;text-decoration:none}
a:focus-visible{outline:2.5px solid var(--navy);outline-offset:3px}
</style>
</head>
<body>
<main>
<p class="brand">Vossie</p>
<h1>You're offline</h1>
<p>Vossie needs a connection to show listings and messages. Check your data or Wi-Fi.</p>
<a href="">Try again</a>
</main>
</body>
</html>`;
