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





git add src/service/SubmissionService.h
git commit -m "submission: add SubmissionService interface"

git add src/service/SubmissionService.cpp
git commit -m "submission: implement submission and extension handling"

git add src/service/AuthService.h
git commit -m "auth: add AuthService interface"

git add src/service/AuthService.cpp
git commit -m "auth: implement login and password changes"

git add src/service/AdminService.h
git commit -m "admin: add AdminService interface"

git add src/service/AdminService.cpp
git commit -m "admin: implement user and course administration"