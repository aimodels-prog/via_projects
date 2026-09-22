# Project Hub

Internal reporting and password-protected client dashboards. See [deployment and backup instructions](DEPLOYMENT.md) for the PostgreSQL/Contabo setup.

Internal workflow: upload a source PDF for review, paste/import CSV, upload original images, correct validation issues, save a draft, preview the exact dashboard and approve publication. Image-based PDF OCR is review evidence only. Unreadable chart tables can use the original S-curve image without estimating data.

Validation: `npm run typecheck`, `npm test`, `npm run build`, and `npx playwright test`. The test suite uses isolated temporary project storage.

We want to create a dashboard for all our projects

Each projects will will be on the dashboard like a page for we have the domain/the name of the projects.

How can we make this posible 

We want a world class landing page

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/90655d2d-c3e3-4c3f-a091-72cdc9110dcf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
