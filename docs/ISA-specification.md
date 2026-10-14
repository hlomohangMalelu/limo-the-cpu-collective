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
## Lexical rule

<u>How the assembler treats apostrophes</u>: In JavaScript, apostrophes are used to show that a character is a string; so to accommodate Sesotho words in this assembler apostrophe (\`), single quote (’) and underscore (\_) are considered to be equivalent, this means they are all valid syntax and will regulated using this JavaScript function -

```javascript
const LookFor_Regex = /^[a-zA-z][a-zA-z0-9`_]*$/;

function regulateMnemonic(token) {
  return token.toLowerCase().replace(/[`‘]/g, '_');
}
```

## 2.5 Encoding Worked Example

| Instruction              | Format | Field values                      | Binary (bit 31...0)                     | Hexadecimal |
| ------------------------ | ------ | --------------------------------- | --------------------------------------- | ----------- |
| kopanya x10, x5, x6      | R      | x6=0110<br>x5=0101<br>x10=1010    | 00000000 0110 00 0101 000 1010 0110011  | 0x00614533  |
| kopanya_h x8, x5,2       | I      | x8=1000<br>x5=0101                | 00000000001000 0101000100000 10011      | 0x00214413  |
| beha x5, 8(x6)           | S      |                                   |                                         |             |
| lekana x5, x6, t’soana   | B      |                                   |                                         |             |


## Design-Decision Log

### a) Register-file size

LIMO uses 16 registers instead of RISC-V’s 32 registers, reducing each register specifier from 5 bits to 4 bits. This saves 3 bits in a three-register instruction, which can be reallocated to increase immediate fields from 12 bits to 14 bits, extending the sign range from -2,048 - 2,047 to -8,192 – 8,191.

> Smaller 4 bits register IDs also reduce hazard detection and comparison width is reduced from 5 bits to 4 bits, while reducing register-file multiplexing complexity. The main cost is higher register pressure; programs with many simultaneously live variable may require more spills and reloads to memory, increasing memory traffic, instruction count, and potentially execution time. Thus, 16 register trade register capacity for simpler encoding and hardware and large immediate.
>
> A signed number with n bits the range is -2^(n-1) to 2^(n-1)-1
>
> for 12 bits: -2^(12-1) to 2^((12-1)) -1
>
> new 14 bits: -2^(14-1) to 2^((14-1)) -1

-2^(13) to 2^((13)) -1

=> -8192 to 8191

### b) Architectural or microarchitectural

Architecture registers include x0-x15 and PC, which can be seen by the programmer. Micro-architectural registers like IR and pipeline registers like IF/ID, ID/EX, EX/MEM, MEM/WB cannot be seen by the programmer and are used to hold and control signals between clock cycles. Micro-architectural registers must not be specific to the ISA because the ISA defines the software and hardware interface not the physical implementation. Pipeline registers cannot be specified according to a fixed 5 stage pipeline as well, because it will prevent hardware architects from modifying, building single-cycle models, or using out-of-order execution without breaking compatibility.

### c) Branch resolution

Resolution happens at ‘execute’ in LIMO, it requires branch comparison and target-address hardware in this stage of the 5-stage pipeline. It, however, avoids waiting until a later stage, which costs the work and hardware needed to resolve the branch issue in execute plus the lost cycles when branch is taken, and with a taken branch, IF and ID are flushed (if not used, because they are included in the pipeline before the exact branch execution).
