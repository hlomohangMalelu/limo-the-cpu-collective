# LIMO – the CPU collective

LIMO is a Sesotho-language, RISC-V-derived 32-bit load–store ISA (CS3520 group project).
**Milestone 2** delivers the frozen ISA, the design documents, and a working assembler with unit tests.

Live site: 

## Run, test, deploy

| Task | How |
|---|---|
| Run locally | Double-click `index.html`. No server or build step. |
| Unit tests | `npm test` (Node 20+, no dependencies) |
| After editing `examples/*.limo` | `npm run examples` (refreshes `src/examples.js`; a test fails if you forget) |
| GitHub Pages | Settings → Pages → Source: **GitHub Actions**. Push to `main`; the workflow runs tests and deploys only if they pass. Verify the published URL in Actions → deploy job. |
| Create M2 tag | After committing the final M2 files, run `git tag m2` then `git push origin m2`. Verify with `git tag --list m2`. |

## What is in M2

| M2 item | Where |
|---|---|
| ISA frozen, D1 feedback applied | `docs/DESIGN.md` §1 and `src/isa.js` |
| Architecture and block diagram | `docs/DESIGN.md` §2 |
| Pipeline-register data model | `docs/DESIGN.md` §3 |
| Interface wireframes | `docs/DESIGN.md` §4 |
| Working assembler with unit tests | `src/assembler.js`, `tests/assembler.test.js`, live Editor page |
| GitHub Pages deployment workflow | `.github/workflows/pages.yml` (deployment must be verified online) |

## Folder map

```
index.html, style.css     the Editor page (assembler and machine-code view)
src/isa.js                ISA table, register names, field layouts   <- change the ISA here
src/assembler.js          assemble() / disassemble()  (no DOM)
src/examples.js           generated from examples/*.limo
src/app.js                page wiring
tests/                    unit tests          examples/   .limo programs
docs/DESIGN.md            ISA, architecture, pipeline-register model, wireframes
```

The pipeline, hazard unit, datapath and control views belong to later milestones and are not in this repository yet.
