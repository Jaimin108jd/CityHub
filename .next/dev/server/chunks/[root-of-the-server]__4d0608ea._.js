module.exports = [
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/lib/incremental-cache/tags-manifest.external.js [external] (next/dist/server/lib/incremental-cache/tags-manifest.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/lib/incremental-cache/tags-manifest.external.js", () => require("next/dist/server/lib/incremental-cache/tags-manifest.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[project]/lib/auth-server.ts [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fetchAuthAction",
    ()=>fetchAuthAction,
    "fetchAuthMutation",
    ()=>fetchAuthMutation,
    "fetchAuthQuery",
    ()=>fetchAuthQuery,
    "getToken",
    ()=>getToken,
    "handler",
    ()=>handler,
    "isAuthenticated",
    ()=>isAuthenticated,
    "preloadAuthQuery",
    ()=>preloadAuthQuery
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$convex$2d$dev$2f$better$2d$auth$2f$dist$2f$nextjs$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@convex-dev/better-auth/dist/nextjs/index.js [middleware] (ecmascript)");
;
const { handler, preloadAuthQuery, isAuthenticated, getToken, fetchAuthQuery, fetchAuthMutation, fetchAuthAction } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$convex$2d$dev$2f$better$2d$auth$2f$dist$2f$nextjs$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["convexBetterAuthNextJs"])({
    convexUrl: ("TURBOPACK compile-time value", "https://dazzling-chickadee-132.convex.cloud"),
    convexSiteUrl: ("TURBOPACK compile-time value", "https://dazzling-chickadee-132.convex.site")
});
}),
"[project]/proxy.ts [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "config",
    ()=>config,
    "proxy",
    ()=>proxy
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2d$server$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/auth-server.ts [middleware] (ecmascript)");
;
;
async function proxy(request) {
    const authenticated = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2d$server$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["isAuthenticated"])();
    // If not authenticated and trying to access protected routes, redirect to login
    if (!authenticated) {
        const loginUrl = new URL('/auth/login', request.url);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].redirect(loginUrl);
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].next();
}
const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - /auth/* (authentication routes)
         * - /api/* (API routes)
         * - /_next/* (Next.js internals)
         * - /favicon.ico, /sitemap.xml, /robots.txt (static files)
         */ '/((?!auth|api|_next|favicon.ico|sitemap.xml|robots.txt).*)'
    ]
};
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__4d0608ea._.js.map