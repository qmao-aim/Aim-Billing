/** Charcoal band matching production: teal info link far left, centred
 *  copyright. The build number stands in for production's session id. */
export function Footer() {
  return (
    <footer className="relative mt-auto bg-footer px-6 py-3">
      <a
        href="mailto:AnalyticsInstitute@ankura.com"
        className="absolute left-6 top-1/2 -translate-y-1/2 text-[13px] text-footer-link underline underline-offset-2"
      >
        Info
      </a>
      <p className="text-center text-[13px] text-footer-text">
        Copyright © 2026 Ankura Consulting Group, LLC. All rights reserved.
      </p>
    </footer>
  )
}
