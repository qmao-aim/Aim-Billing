using System;
using System.Collections.Generic;
using System.IO;
using System.Web;
using System.Web.Mvc;

namespace Billing.Controllers
{
    // Serves the built React SPA — both its shell (index.html) and every static
    // asset it references (JS/CSS/fonts/images). Vite's relative asset paths
    // (base: './') resolve against whatever URL served index.html's content —
    // since that's always this action, "path" covers both the shell itself
    // (empty) and every asset path baked into it, so both need to come from
    // here for the relative references to actually resolve to real files.
    //
    // Auth/role gating (global filters) applies to this whole action, so the
    // entire SPA — shell and assets alike — is one uniformly protected resource.
    public class HomeController : Controller
    {
        public ActionResult Index(string path)
        {
            var spaRoot = Server.MapPath("~/Billing-SPA/");
            var relative = string.IsNullOrEmpty(path) ? "index.html" : path;

            string fullPath;
            try
            {
                fullPath = Path.GetFullPath(Path.Combine(spaRoot, relative));
            }
            catch
            {
                fullPath = null;
            }

            // Not a real asset (or an attempted path-traversal escape) — this is an
            // in-app route, e.g. a deep link; the SPA's own HashRouter handles it
            // client-side once the shell loads, so just serve the shell.
            if (fullPath == null
                || !fullPath.StartsWith(spaRoot, StringComparison.OrdinalIgnoreCase)
                || !System.IO.File.Exists(fullPath))
            {
                fullPath = Path.Combine(spaRoot, "index.html");
            }

            return File(fullPath, GetContentType(fullPath));
        }

        // System.Web.MimeMapping is unreliable for a Vite build's own output: it maps
        // .js to the legacy "application/x-javascript", which fails the browser's
        // strict MIME check for <script type="module"> (the exact error this exists
        // to prevent), and maps .svg/.woff2/.json to generic "application/octet-stream".
        private static readonly Dictionary<string, string> ExtensionContentTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { ".html", "text/html" },
            { ".js", "text/javascript" },
            { ".mjs", "text/javascript" },
            { ".css", "text/css" },
            { ".json", "application/json" },
            { ".map", "application/json" },
            { ".svg", "image/svg+xml" },
            { ".png", "image/png" },
            { ".jpg", "image/jpeg" },
            { ".jpeg", "image/jpeg" },
            { ".gif", "image/gif" },
            { ".ico", "image/x-icon" },
            { ".woff", "font/woff" },
            { ".woff2", "font/woff2" },
            { ".ttf", "font/ttf" },
        };

        private static string GetContentType(string path)
        {
            var extension = Path.GetExtension(path);
            return ExtensionContentTypes.TryGetValue(extension, out var contentType)
                ? contentType
                : MimeMapping.GetMimeMapping(path);
        }
    }
}
