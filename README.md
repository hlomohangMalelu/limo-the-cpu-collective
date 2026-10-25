# LIMO – the CPU collective

LIMO is a Sesotho-language, RISC-V-derived 32-bit load–store ISA 

Live site:


## Run, test, deploy

| Task | How |
|---|---|
| Run locally | Double-click `index.html`. No server or build step. |
| Unit tests | `npm test` (Node 20+, no dependencies) |
| After editing `examples/*.limo` | `npm run examples` (refreshes `src/examples.js`; a test fails if you forget) |
| GitHub Pages | Settings → Pages → Source: **GitHub Actions**. Push to `main`; the workflow runs tests and deploys only if they pass. Verify the published URL in Actions → deploy job. |
| Create M2 tag | After committing the final M2 files, run `git tag m2` then `git push origin m2`. Verify with `git tag --list m2`. |



## Folder structure

```
index.html, style.css     the Editor page (assembler and machine-code view)
src/isa.js                ISA table, register names, field layouts   <- change the ISA here
src/assembler.js          assemble() / disassemble()  (no DOM)
src/examples.js           generated from examples/*.limo
src/app.js                page wiring
tests/                    unit tests          examples/   .limo programs
docs/DESIGN.md            ISA, architecture, pipeline-register model, wireframes
```


