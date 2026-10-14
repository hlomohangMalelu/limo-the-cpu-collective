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




##2.4 Instruction Set

| class      | Mnemonic                 | Meaning                     | Syntax                        | operation                              | Format | RV321 |
| ---------- | ------------------------ | --------------------------- | ----------------------------- | -------------------------------------- | ------ | ----- |
| Arithmetic | kopanya                  | Add; increase               | kopanya rd, rs1, rs2          | R\[rd\]=R\[rs1\] + R\[rs2\]            | R      | add   |
| Arithmetic | kopanya_h (h=hang)       | Add constant                | kopanya_h rd, rs1, immediate  | R\[rd\] + SignExt(imm)                 | I      | addi  |
| Arithmetic | tlosa                    | Subtract                    | tlosa rd, rs1, rs2            | R\[rd\]=R\[rs1\] – R\[rs2\]            | R      | sub   |
| Logic      | ritsisa_hl (l=lehoja)    | Shift right logic immediate | ritsisa_hl rd, rs1, immediate | R\[rd\]=R\[rs1\]\>\>imm                | I      | srli  |
| Logic      | ritsisa_ht (t=ts\`ehali) | Shift left logic immediate  | ritsisa_ht rd,rs1,imm         | R\[rd\]=R\[rs1\] \<\<imm               | I      | slli  |
| Logic      | ritsisa_t                | Shift left logic            | ritsisa_t rd,rs1, rs2         | R\[rd\]=R\[rs1\]\<\<R\[rs2\]           | R      | sll   |
| Memory     | beha                     | store                       | beha                          | M\[R\[rs1\] + SignExt(imm)\] =R\[rs2\] |        | sw    |
| Memory     | nka                      | load                        | nka rd, offset immediate(rs1) | R\[rd\]=M\[R\[rs1\] + SignExt(imm)\]   |        | lw    |
| Branch     | lekana                   | equal                       | Lekana, rs1, rs2, label       | R\[rs1\] == R\[rs2\]                   | B      | beq   |
| Branch     | fapana                   | Not equal                   | fapana rs1, rs2, label        | (R\[rs1\]! = R\[rs2\])? 1:0            | B      | bne   |

