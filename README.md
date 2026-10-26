# LIMO – the CPU collective

LIMO is a Sesotho-language, RISC-V-derived 32-bit load–store ISA 

Live site:https://hlomohangmalelu.github.io/limo-the-cpu-collective/



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


