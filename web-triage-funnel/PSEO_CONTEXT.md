# pSEO Integration Context

## 1. Summary of Changes
- **Data Migration**: Copied `~3,600` JSON pages from `pSEO` project to `src/data/pages/`.
- **Dependencies**: Installed `@tailwindcss/typography` and configured it in `src/app/globals.css`.
- **Dynamic Route**: Created `src/app/check/[slug]/page.tsx` as a Server Component.
- **Verification**: Successfully ran `npm run build` with Node 20. All pages are statically generated.

## 2. File Structure
- **Content Source**: `src/data/pages/[slug].json`
    - Contains title, meta_desc, content_html, etc.
- **Page Component**: `src/app/check/[slug]/page.tsx`
    - Handles data fetching (`generateStaticParams`, `getPageData`).
    - Handles SEO metadata (`generateMetadata`).
    - Handles UI rendering (Hero, Prose content, Footer).

## 3. How to modify the Layout
The layout for these pages is defined entirely within `src/app/check/[slug]/page.tsx`.

- **To Change the Hero Section**:
    - Locate the `<section className="bg-blue-50 ...">` block.
    - Modify the title `<h1>` or subtitle `<p>`.
    - Modify the "Upload Photo" widget placeholder.

- **To Change the Content Area**:
    - Locate `<article className="prose prose-lg prose-blue mx-auto">`.
    - This uses `@tailwindcss/typography` to style the raw HTML content from the JSON.
    - To change prose styles (e.g., font size, colors), modify the `prose-*` classes.

- **To Change the Global App Layout**:
    - These pages inherit from the root layout at `src/app/layout.tsx`. modifications there will affect *all* pages, including these.

## 4. Next Steps
- **Verify**: Open `http://localhost:3000/check/cat-abdomen-feels-hard-and-bloated` to see a sample page.
- **Iterate**: Adjust the design in `page.tsx` as needed.
