# Hampton Ledger

An independent, open-source fiscal transparency project for Hampton, New Hampshire. Follow public money, explore original records, and see where evidence is missing.

## Principles

- Every published financial figure has a source and reporting period.
- Distinguish budgets, actual expenses, encumbrances, and payments.
- A missing document is an evidence gap, not proof of misconduct.
- Preserve original records, content hashes, and reproducible calculations.
- Protect personal information. No automatic public accusations or AI-generated findings.

## Development

Requires Node.js 22 or later. No frontend dependencies.

```sh
npm run dev
npm test
```

## Scope

Initial release: 2025 tax-rate explorer, sourced 2024 and 2025 town operating-finance summaries, searchable public-record archive, and a transparent collection roadmap. This is not a transaction-level audit. See docs/methodology.md.

## License

Application code: MIT. Public records retain their original legal status; inclusion does not imply town endorsement.

## Live site

https://hampton.brandonbryant.io

See [methodology](docs/methodology.md), [deployment and collection](docs/deployment.md), and [contributing](CONTRIBUTING.md). The weekly collector saves review artifacts; it does not automatically publish claims or send records requests.
