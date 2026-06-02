$root = Split-Path -Parent $PSScriptRoot
$styles = @(
  @{
    file = "style-boho-bob-knotless.html"
    title = "Boho Bob Knotless Braids"
    slug = "boho-bob-knotless"
    img = "boho-bob-knotless.png"
    price = '$260 - $300'
    lead = "A shoulder-length knotless install with open, curly pieces for a soft boho finish - perfect when you want box parts and movement without the weight of long lengths."
    features = @("Knotless tension for a comfortable base","Clean box or hybrid parting", "Curly or wavy leave-out along the bob","Faster day-to-day styling than extra-long braids","Protective option with statement texture")
    care = @("Mist scalp lightly between washes","Use a silk scarf or bonnet at night","Avoid heavy oils that weigh curls down","Refresh edges with light gel if needed")
  },
  @{
    file = "style-boho-knotless-box.html"
    title = "Boho Knotless Box Braids"
    slug = "boho-knotless-box"
    img = "boho-knotless-box.png"
    price = '$250 - $300'
    lead = "Full-length knotless box braids with boho texture - loose curls blended through the ends for volume and an effortless, romantic look."
    features = @("Knotless feed-in for less tension at the root","Defined parts with curly detail","Great for color blends and ombré","Versatile styling (up or down)","Long-wearing protective style")
    care = @("Cleanse scalp gently with diluted shampoo","Dry braids thoroughly after washing","Keep curls hydrated with leave-in spray","Sleep with hair secured or wrapped")
  },
  @{
    file = "style-curly-knotless-boho-full.html"
    title = "Curly Knotless Braids / Boho Full"
    slug = "curly-knotless-boho-full"
    img = "curly-knotless-boho-full.png"
    price = '$260 - $310'
    lead = "Maximum curl leave-out and fullness on a knotless base - our fullest boho option when you want drama, texture, and movement top to bottom."
    features = @("Heavy boho / goddess curl integration","Knotless foundation for comfort","Ideal for clients who love volume","Pairs beautifully with highlights or ombré","Head-turning finished silhouette")
    care = @("Detangle curly sections carefully when damp","Use lightweight curl creams","Protect ends from friction on collars","Schedule touch-ups for parts as hair grows")
  },
  @{
    file = "style-goddess-knotless.html"
    title = "Goddess Knotless Braids"
    slug = "goddess-knotless"
    img = "goddess-knotless.png"
    price = '$250 - $300'
    lead = "The classic goddess knotless look - neat square parts, smooth roots, and curly ends (and optional color) for an elevated, polished finish."
    features = @("Curly or wavy ends as the signature detail","Knotless installation","Custom color and length options","Balances glam with everyday wear","Photography-ready finish")
    care = @("Separate curls gently after washing","Air-dry or diffuse on low if needed","Avoid tight ponytails that stress edges","Moisturize scalp regularly")
  },
  @{
    file = "style-passion-twists-havana.html"
    title = "Passion Twists / Havana Twists"
    slug = "passion-havana"
    img = "passion-twists-havana.png"
    price = '$240 - $280'
    lead = "Two-strand twists made with curly, textured hair for a soft, dimensional look - distinct from three-strand box braids and silkier than some twist types."
    features = @("Two-strand technique (not three-strand braids)","Full, textured aesthetic","Often quicker removal than braids","Great for medium to long lengths","Works with rich colors and blends")
    care = @("Reduce frizz with satin pillowcases","Spritz with braid spray as needed","Wash in sections to limit tangling","Have twists taken down professionally when ready")
  },
  @{
    file = "style-soft-locs-faux-locs.html"
    title = "Soft Locs / Faux Locs"
    slug = "soft-locs-faux"
    img = "soft-locs-faux-locs.png"
    price = '$280 - $350'
    lead = "Wrapped, loc-inspired extensions with a softer, more flexible feel than traditional hard locs - beautiful movement and an organic silhouette."
    features = @("Loc look without permanent commitment","Softer body than classic faux locs","Custom length and thickness","Strong protective option when maintained","Pairs well with ombré and earth tones")
    care = @("Do not over-scrub the wrapped surface","Dry completely after washing","Avoid excessive heat on synthetic fiber","Plan professional removal to protect natural hair")
  },
  @{
    file = "style-straight-braid-ends.html"
    title = "Straight braid ends"
    slug = "straight-braid-ends"
    img = "straight-braid-ends.png"
    price = '$220 - $280'
    lead = "Knotless or box braids finished with smooth, dipped ends - minimal curl leave-out for clients who want a sleek, defined line through the tips."
    features = @("Clean finish at the ends","Works with knotless or traditional box","Polished look for work or events","Easier to tuck into buns or ponytails","Straightforward daily upkeep")
    care = @("Seal ends lightly if recommended by your stylist","Avoid friction on tips from rough fabrics","Wrap hair at night to reduce frizz","Come in for touch-ups as regrowth shows")
  }
)

function Esc([string]$s) {
  if ($null -eq $s) { return "" }
  return ($s.Replace("&", "&amp;").Replace('"', "&quot;").Replace("<", "&lt;"))
}

foreach ($s in $styles) {
  $featLi = ($s.features | ForEach-Object { "                <li>$_</li>" }) -join "`n"
  $careLi = ($s.care | ForEach-Object { "                <li>$_</li>" }) -join "`n"
  $titleEsc = Esc $s.title
  $path = Join-Path $root $s.file
  $html = @"
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="$titleEsc | Your Salon Name." />
    <title>$($s.title) | Your Salon Name</title>
    <link rel="icon" href="assets/favicon-32.png?v=4" type="image/png" sizes="32x32" />
    <link rel="apple-touch-icon" href="assets/apple-touch-icon.png?v=4" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="css/styles.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand-link header-brand" href="index.html">
          <img class="logo-img" src="assets/placeholders/logo.svg" width="72" height="72" alt="Your Salon Name logo" />
          <span class="brand-text">
            <strong>Your Salon Name</strong>
            <span>yoursalon.com</span>
          </span>
        </a>
        <nav class="nav-main nav-main--full" aria-label="Main">
          <a href="index.html">Home</a>
          <a href="styles-catalog.html">Styles</a>
          <a href="gallery.html">Gallery</a>
        </nav>
        <div class="header-actions">
          <a class="btn btn-primary" href="booking.html?style=$($s.slug)">Book Now</a>
          <a class="header-lookup" href="booking-lookup.html">Lookup Booking</a>
        </div>
      </div>
    </header>

    <main class="style-detail-main">
      <div class="container">
        <nav class="style-detail-breadcrumb" aria-label="Breadcrumb">
          <a href="styles-catalog.html">&larr; All styles</a>
        </nav>

        <div class="style-detail-layout">
          <div class="style-detail-col style-detail-col--media">
            <div class="style-detail-card">
              <div class="style-detail-carousel" data-carousel>
                <div class="style-detail-carousel__viewport">
                  <div class="style-detail-carousel__track">
                    <figure class="style-detail-carousel__slide">
                      <img src="assets/catalog/$($s.img)" width="480" height="600" alt="$titleEsc - example 1" loading="eager" />
                    </figure>
                    <figure class="style-detail-carousel__slide">
                      <img src="assets/catalog/$($s.img)" width="480" height="600" alt="$titleEsc - example 2" loading="lazy" />
                    </figure>
                  </div>
                </div>
                <button type="button" class="style-detail-carousel__btn style-detail-carousel__btn--prev" aria-label="Previous photo">&lsaquo;</button>
                <button type="button" class="style-detail-carousel__btn style-detail-carousel__btn--next" aria-label="Next photo">&rsaquo;</button>
                <div class="style-detail-carousel__dots" role="tablist" aria-label="Photo indicators"></div>
              </div>

              <div class="style-detail-booking-block">
                <p class="style-detail-price">$($s.price)</p>
                <p class="style-detail-price-note">Price varies by length. Human hair option available for +`$50.</p>
                <p class="style-detail-price-note">*All styles can include a wash service for +`$20.</p>
                <a class="btn btn-primary style-detail-book-btn" href="booking.html?style=$($s.slug)">Book Now</a>
              </div>
            </div>
          </div>

          <div class="style-detail-col style-detail-col--copy">
            <div class="style-detail-card">
              <h1>$($s.title)</h1>
              <p class="style-detail-lead">$($s.lead)</p>

              <div class="style-detail-panel">
                <h2>
                  <svg class="style-detail-icon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  Features
                </h2>
                <ul class="style-detail-checklist">
$featLi
                </ul>
              </div>

              <div class="style-detail-panel">
                <h2>
                  <svg class="style-detail-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                  </svg>
                  Maintenance tips
                </h2>
                <ul class="style-detail-checklist">
$careLi
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer class="site-footer">
      <div class="container">
        <div class="footer-main">
          <div class="footer-brand">
            <a class="footer-brand__link" href="index.html">
              <img
                class="footer-brand__logo"
                src="assets/placeholders/logo.svg"
                width="80"
                height="80"
                alt="Your Salon Name logo"
                decoding="async"
              />
              <span class="footer-brand__text">
                <span class="footer-brand__name">Your Salon Name</span>
                <span class="footer-brand__tagline">Neat, fast &amp; affordable braids · Flawless styles</span>
                <span class="footer-brand__meta">yoursalon.com</span>
              </span>
            </a>
            <p class="footer-brand__address">By appointment — studio details shared when you book</p>
            <p class="footer-social">
              <a href="https://www.instagram.com/yourinstagram/" target="_blank" rel="noopener noreferrer">Instagram</a>
            </p>
          </div>
          <div class="footer-col">
            <h3 class="footer-heading">Contact</h3>
            <p><a href="tel:+15550100199">(555) 010-0199</a></p>
            <p><a href="mailto:bookings@yoursalon.com">bookings@yoursalon.com</a></p>
          </div>
          <div class="footer-col">
            <h3 class="footer-heading">Explore</h3>
            <ul class="footer-links">
              <li><a href="index.html">Home</a></li>
              <li><a href="styles-catalog.html">Style catalog</a></li>
              <li><a href="gallery.html">Gallery</a></li>
              <li><a href="schedule.html">Schedule (Cal)</a></li>
              <li><a href="booking.html">Book appointment</a></li>
            </ul>
          </div>
        </div>
      </div>
      <div class="container footer-bottom">
        <p>&copy; 2026 Your Salon Name. All rights reserved.</p>
        <p class="footer-built-by">
          <span class="footer-built-by__link" style="opacity: 0.75;">Add footer credit here</span>
        </p>
      </div>
    </footer>
    <script src="js/style-carousel.js"></script>
  </body>
</html>
"@
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($path, $html, $utf8)
  Write-Host "Wrote $($s.file)"
}
