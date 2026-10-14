# LIMO ISA --- Instruction Set Architecture


## 2.1 overview

|                               | Specification                                                                                                   | Rationale                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Architecture style            | 32-bit load-store                                                                                               | Restriction of memory access strictly to nka and beha to ensure complete operations in EX stage with multiple stalls                       |
| Register bank                 | 16 register files                                                                                               | Reduction of required multiplexers and, an increase in immediate bits                                                                      |
| Addressing modes              | Register direct, immediate, and register offset                                                                 | Does not require complex incrementing and keeps hardware ALU simple                                                                        |
| Memory, endianness, alignment | Byte-addressed, little-endian, word-aligned                                                                     | Enforces strict word alignment eliminates unaligned-access and multicycle memory cycle reads                                               |
| Instruction formats           | Fixed 32-bit length across the 4 instruction formats                                                            | Fixed instruction width and fixed register/opcode bit allow the ID stage to fetch source registers and decode opcode bits at the same time |
| Departures from RV321         | Reduced register file, increased immediate fields, omitted formats and lexical rule (orthography normalization) | Reuses saved register bits to expand immediate offsets for wider branch reach and simplifies logic for pipelining  



## 2.2 Register File

| Number | Sesotho name | Alias           | Type | Purpose and convention              |
| ------ | ------------ | --------------- | ---- | ----------------------------------- |
| x0     | khoamo       | Zero            | SPR  | Hard-wired to 0, writes are ignored |
| x1     | Bolulo       | ra              | SPR  | Return address                      |
| x2     | Khetsi       | sp              | SPR  | Stack pointer                       |
| x3-x4  | Karabo       | a0-a1           | SPR  | Return argument                     |
| x5-x8  | Nakoana      | t0-t3           | GPR  | temporaries                         |
| x9-x15 | boloka       | s0-s6           | GPR  | Saved                               |
| PC     | sebaka       | Program counter | SPR  | Address of current instruction      |



## 2.3 Instruction Formats

| 31 22            | 21 18 | 17 14 | 13 11  | 10 7            | 6 0    |
| ---------------- | ----- | ----- | ------ | --------------- | ------ |
| Funct7           | rs2   | rs1   | Funct3 | rd              | Opcode |
| Imm \[13:0\]     |       | rs1   | Funct3 | rd              | opcode |
| Imm \[13:7\]     | rs2   | rs1   | Funct3 | Imm \[6:0\]     | opcode |
| Imm \[13\|11:5\] | rs2   | rs1   | Funct3 | Imm \[4:1\|12\] | opcode |


### d) Load-use

The dependent instruction depends on the value fetched by the load instruction which can only be done after passing the memory stage, hence a stall is introduced in the dependent instruction after decoding so that execution takes place with the load instruction’s value. Full forwarding does not imply no stalls at all.

|                |     |     |     |       |     |     |     |
| -------------- | --- | --- | --- | ----- | --- | --- | --- |
| cycles         | 1   | 2   | 3   | 4     | 5   | 6   | 7   |
| lw t0,0(s1)    | IF  | ID  | EX  | MEM   | WB  |     |     |
|                |     |     |     |       |     |     |     |
| add t2, t0, t3 |     | IF  | ID  | STALL | EX  | MEM | WB  |

### e) Flag register

A flag register stores information about the result of an operation, which may be helpful in some cases but it creates data dependencies between instructions and the branches that use them, which in turn creates extra hazards and additional forwarding and stalls so it would not benefit LIMO as small processor because it cannot accommodate extra data.

### f) What breaks first

As programs grow, branch reach breaks first because branch instructions have a limited offset range, causing a hard error when the code grows too large.


