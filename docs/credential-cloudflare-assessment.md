# Cloudflare assessment for private credential rendering

Assessment date: 2026-11-17. This is an architectural assessment, not a
verified deployment. The user chose not to connect the Cloudflare account yet;
the account's plan, quota, access and billing status remain unknown. The
credential backend has not been deployed or tested on Cloudflare.

## Existing implementation

The private service is a Node HTTP server; its worker runs a persistent polling
loop and starts local Playwright Chromium processes. The approved HTML and
signature files are private runtime inputs. This design cannot simply be copied
into the existing Workers configurations: it needs a compatible runtime,
private asset provisioning, authenticated routing and reliable background jobs.
The existing site configurations are a mail worker and a Supabase gateway;
neither is the credential renderer.

## Option A: Cloudflare Browser Run

Workers with Browser Run can generate screenshots and PDFs. Adapting the service
would require implementing a Workers-specific request handler and browser
binding, plus an independently tested queue or scheduled job architecture for
batch verification and PDF exports. The present worker process and local
Chromium launch cannot be assumed to run unchanged.

The published free-plan limit is 10 browser minutes per day and one new browser
session per 20 seconds. A batch design should reuse sessions and must respect
account limits, handle 429 responses, and verify the real required workload.
Paid-plan billing and limits depend on usage and the actual account. See the
[Browser Run limits](https://developers.cloudflare.com/browser-run/limits/)
and [pricing](https://developers.cloudflare.com/browser-run/pricing/).

The approved HTML requests Apple Chancery and Baskerville among its font
families; those names do not appear in Cloudflare's published pre-installed
font list. Browser fallback can change line breaks and visual layout. The
original visual baseline must be tested on the actual runtime. Do not bypass
the existing baseline gate or upload font files without confirming rights to
use them. See [supported fonts](https://developers.cloudflare.com/browser-run/reference/supported-fonts/).

## Option B: Cloudflare Containers

Cloudflare Containers can host software requiring a full Linux-style runtime,
but the service still needs a container definition, a supported private asset
and secret delivery design, worker lifecycle/recovery, routing and real
environment testing. The original Mac font and rasterization baseline is not
guaranteed in a Linux container. Cloudflare documents Containers as available
on Workers Paid plans; the current account's eligibility and cost have not been
checked. See [Cloudflare Containers](https://developers.cloudflare.com/containers/).

## Release decision

Neither option is ready to deploy from the current evidence. First establish
the intended authenticated account and verify its plan and available capacity;
then prototype the private rendering path with synthetic data, validate the
approved visual baseline in that exact environment, and complete authorization,
storage and batch failure-recovery tests. A Cloudflare deployment does not by
itself authorize publishing personal signatures or template files publicly.
