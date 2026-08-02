# Web app assets

Files in `public/` are copied verbatim into `dist/web` by Vite, so they are
served at the dashboard's root. This file lives outside it on purpose — anything
inside `public/` ships to users.

## Icons

The artwork is a helmeted sheep mid-leap over a deep green circuit-board field,
with the `herdr-f1` wordmark below it.

The PNGs are generated from a vectorised SVG of that illustration. That SVG is
deliberately **not** in `public/`: it is a ~1MB trace of thousands of paths, so
shipping it would cost more than every other asset here combined and no browser
would ever fetch it. Keep it wherever the design work lives and regenerate the
PNGs with the steps below.

Two variants, because launchers treat them differently:

- `icon-192.png`, `icon-512.png` — `purpose: any`. The rounded-square artwork as
  drawn. Used by desktop docks and by iOS, which reads `apple-touch-icon` and
  applies its own rounding.
- `icon-maskable-192.png`, `icon-maskable-512.png` — `purpose: maskable`.
  Android and others crop these to their own shape (circle, squircle, ...), so
  the artwork is inset to the centre 78% and the deep green runs edge to edge.
  Reusing the full-bleed version here would cut off the `herdr-f1` wordmark,
  which sits close to the bottom edge.

Regenerating (ImageMagick). `SRC` is the vectorised illustration — a 1024
viewBox with the rounded-square icon on a white ground:

```sh
SRC=/path/to/icon.svg

# 1. Render well above the target sizes, so the downscale does the antialiasing
#    rather than the SVG rasteriser.
magick "$SRC" -resize 2048x2048 -background white -alpha remove -alpha off /tmp/big.png

# 2. Find the icon body. Trimming on white overshoots vertically because the
#    illustration carries a drop shadow, so measure the dark body instead. At
#    2048 it is 1708x1708 at +172+172 — re-measure if the artwork changes.
magick /tmp/big.png -colorspace gray -threshold 60% -negate -trim \
  -format 'body: %wx%h at +%X+%Y\n' info:

# 3. Crop the body, then replace the white outside its rounded corners with the
#    backdrop colour — left white, it shows as light wedges on the corners.
#
#    Flood-filling inward from the four corners rather than masking with a
#    roundrectangle: the corner radius is not obvious (~250px at this scale) and
#    the artwork's edge is a soft gradient, so a mask drawn at a guessed radius
#    leaves a white sliver exactly along the diagonal. Flooding needs no radius
#    at all, and it cannot touch the white inside the artwork — the sheep and the
#    wordmark are enclosed by darker pixels.
magick /tmp/big.png -crop 1708x1708+172+172 +repage /tmp/body.png
magick /tmp/body.png -alpha set -fill none -fuzz 18% \
  -draw 'alpha 0,0 floodfill'       -draw 'alpha 1707,0 floodfill' \
  -draw 'alpha 0,1707 floodfill'    -draw 'alpha 1707,1707 floodfill' \
  /tmp/holes.png
magick -size 1708x1708 'xc:#052B2C' /tmp/holes.png -compose Over -composite -alpha off /tmp/base.png

#    Verify: the diagonal should be backdrop-coloured all the way in.
for I in 0 20 60 100; do magick /tmp/base.png -format "($I,$I)=%[pixel:p{$I,$I}]\n" info:; done

# 4. any
for S in 192 512; do
  magick /tmp/base.png -filter Lanczos -resize ${S}x${S}! \
    +dither -colors 256 -depth 8 -define png:compression-level=9 -strip "icon-$S.png"
done

# 5. maskable: same artwork inset to the safe zone on a flat backdrop
for S in 192 512; do
  INNER=$(( S * 78 / 100 ))
  magick -size ${S}x${S} 'xc:#052B2C' \
    \( /tmp/base.png -filter Mitchell -resize ${INNER}x${INNER}! \) \
    -gravity center -composite \
    +dither -colors 256 -depth 8 -define png:compression-level=9 -strip "icon-maskable-$S.png"
done
```

Three things that cost real file size or quality if dropped:

- `-depth 8`. Compositing onto an `xc:` canvas promotes the result to 16 bits,
  which quadrupled the maskable PNGs (275KB vs 67KB at 512) for no visible gain.
- `+dither` with `-colors 256`. Dithering scatters noise that defeats PNG's
  filters — the dithered 512 was over twice the size of the undithered one at
  the same palette. Undithered 256 measures ~0.9% RMSE against the original,
  i.e. no visible banding on these gradients.
- Checking the maskable safe zone after any change to the inset:
  `magick icon-maskable-512.png -colorspace gray -threshold 40% -trim`
  must report a box inside 51..461.

Keep `theme_color` in `manifest.webmanifest` and the `theme-color` meta in
`index.html` matching the icon backdrop — it tints the installed window's title
bar, and a mismatch shows as a seam above the page.

## Service worker

`sw.js` exists only so browsers offer to install the dashboard; it caches
nothing. See the comment at the top of that file for why offline support would
misreport the race rather than degrade gracefully.
