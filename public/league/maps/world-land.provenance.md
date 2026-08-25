# World land SVG provenance

`world-land.svg` is a geographic base-map asset generated from Natural Earth's
**Physical / Land** polygons. It contains no Natural Earth Cultural, Admin-0,
country, disputed-boundary, or map-unit layer.

## Source

- Publisher: [Natural Earth](https://www.naturalearthdata.com/)
- Catalog: [1:110m Physical Vectors](https://www.naturalearthdata.com/downloads/110m-physical-vectors/)
- Dataset: `ne_110m_land`
- Official archive: <https://naturalearth.s3.amazonaws.com/110m_physical/ne_110m_land.zip>
- Downloaded: 2026-08-25
- Archive SHA-256: `1926c621afd6ac67c3f36639bb1236134a48d82226dc675d3e3df53d02d2a3de`
- Source `.shp` SHA-256: `8689e6932b8e370e2ca4587cf3ba21e460b1235db37b6ed3c172c35b4a6088de`
- License: Natural Earth data is public domain; see its [Terms of Use](https://www.naturalearthdata.com/about/terms-of-use/).

The downloaded archive's `ne_110m_land.VERSION.txt` reads `4.1.0`, while the
Natural Earth catalog currently labels the Land theme `4.0.0`. The archive URL,
download date, and SHA-256 above are the reproducibility authority for this asset.

## Projection and conversion

The source `.prj` declares geographic WGS 84 coordinates. The SVG uses Plate
Carree (equirectangular / equidistant cylindrical with standard parallel 0 deg and
central meridian 0 deg) on a fixed `viewBox="0 0 360 180"`:

```text
x = longitude + 180
y = 90 - latitude
```

SVG y increases downward. Frontend point placement on the same view box is:

```text
xPercent = (longitude + 180) / 360 * 100
yPercent = (90 - latitude) / 180 * 100
```

Conversion did not simplify or redraw the source geometry. It removed each
shapefile ring's duplicated closing coordinate, used SVG `Z` to close that ring,
and rounded projected coordinates to 0.001 degree. The output has 128 closed
rings and 5,015 emitted vertices in one even-odd-filled land path. The SVG has no
stroke and therefore draws neither national borders nor a separate coastline
line; the polygon edge itself is the coast.

The land path uses `currentColor` with a neutral fallback set on the root SVG, so
the asset can be used directly or as an alpha mask.
