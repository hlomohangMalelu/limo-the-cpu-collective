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



