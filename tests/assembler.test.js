
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
    assemble,
    disassemble,
    encode,
} = require("../src/assembler.js");

const {
    INSTRUCTIONS,
    FIELDS_BY_SYNTAX,
    splitFields,
    hex32,
    normalizeName,
} = require("../src/isa.js");

const { EXAMPLES } = require("../src/examples.js");

/**
 * Assemble one line and return its single machine word.
 * Fails the test on any error.
 */
function word(line) {
    const result = assemble(line);

    assert.deepEqual(
        result.errors,
        [],
        `unexpected errors for "${line}"`
    );

    assert.equal(result.words.length, 1);

    return result.words[0];
}

/**
 * Assemble bad source and return the plain-language errors.
 */
const errorsOf = (source) => {
    const result = assemble(source);

    assert.equal(
        result.ok,
        false,
        `expected an error for: ${source}`
    );

    return result.errors;
};

// ------------------------------------------------------------------
// Encoding: one hand-encoded word per format
// ------------------------------------------------------------------

test("R-format: kopanya x7, x5, x6 = 0x001943B3", () => {
    // funct7=0
    // rs2=6 << 18 (0x180000)
    // rs1=5 << 14 (0x14000)
    // funct3=0
    // rd=7 << 7 (0x380)
    // opcode=0x33

    assert.equal(word("kopanya x7, x5, x6"), 0x001943b3);
});

test("R-format: tlosa differs from kopanya only by funct7 = 32", () => {
    assert.equal(
        word("tlosa x7, x5, x6"),
        0x001943b3 + (32 << 22)
    ); // 0x081943B3

    assert.equal(word("tlosa x7, x5, x6"), 0x081943b3);
});

test("R-format: ritsisa_t has funct3 = 1", () => {
    assert.equal(
        word("ritsisa_t x7, x5, x6"),
        0x001943b3 | (1 << 11)
    );
});

test("I-format: kopanya_h x5, x0, 10 = 0x00280293", () => {
    // imm=10 << 18 (0x280000)
    // rd=5 << 7 (0x280)
    // opcode=0x13

    assert.equal(word("kopanya_h x5, x0, 10"), 0x00280293);
});

test("I-format: negative immediate is stored as 14-bit two's complement", () => {
    // imm=-1 -> 0x3FFF << 18 = 0xFFFC0000
    // rd=1 << 7 (0x80)
    // opcode=0x13

    assert.equal(word("kopanya_h x1, x0, -1"), 0xfffc0093);
});

test("I-format: shifts use funct3 1 (left) and 5 (right)", () => {
    assert.equal(
        word("ritsisa_ht x2, x3, 4"),
        (4 << 18) |
            (3 << 14) |
            (1 << 11) |
            (2 << 7) |
            0x13
    );

    assert.equal(
        word("ritsisa_hl x2, x3, 4"),
        (4 << 18) |
            (3 << 14) |
            (5 << 11) |
            (2 << 7) |
            0x13
    );
});

test("Load: nka x8, 4(x2) = 0x00109403", () => {
    // imm=4 << 18 (0x100000)
    // rs1=2 << 14 (0x8000)
    // funct3=2 << 11 (0x1000)
    // rd=8 << 7 (0x400)
    // opcode=3

    assert.equal(word("nka x8, 4(x2)"), 0x00109403);
});

test("S-format: beha x7, 8(x2) = 0x001C9423", () => {
    // imm[13:4]=0
    // rs2=7 << 18 (0x1C0000)
    // rs1=2 << 14 (0x8000)
    // funct3=2 << 11 (0x1000)
    // imm[3:0]=8 << 7 (0x400)
    // opcode=0x23

    assert.equal(word("beha x7, 8(x2)"), 0x001c9423);
});

test("S-format: a large offset is split across imm[13:4] and imm[3:0]", () => {
    const w = word("beha x1, 0x123(x0)");

    // 0x123 = 0b00_0001_0010_0011
    // imm[13:4]=0x12, imm[3:0]=3

    assert.equal(w >>> 22, 0x12);
    assert.equal((w >> 7) & 15, 3);
});

test("B-format: lekana x1, x2, +8 = 0x00084463", () => {
    // imm=8 (label two instructions ahead)
    // rs1=1 << 14 (0x4000)
    // rs2=2 << 18 (0x80000)
    // imm[3:0]=8 << 7 (0x400)
    // opcode=0x63

    const result = assemble(
        "lekana x1, x2, target\n" +
        "kopanya x0, x0, x0\n" +
        "target: kopanya x0, x0, x0"
    );

    assert.deepEqual(result.errors, []);
    assert.equal(result.words[0], 0x00084463);
});

// ------------------------------------------------------------------
// Labels and branch offsets
// ------------------------------------------------------------------

test("forward branch offset is bytes from the branch itself", () => {
    const { instructions } = assemble(
        "lekana x1, x2, end\n" +
        "kopanya x0, x0, x0\n" +
        "end: kopanya x0, x0, x0"
    );

    assert.equal(instructions[0].imm, 8);
});

test("backward branch offset is negative and decodes back to the same number", () => {
    const result = assemble(
        "top: kopanya x1, x1, x1\n" +
        "fapana x1, x0, top"
    );

    assert.equal(result.instructions[1].imm, -4);
    assert.equal(disassemble(result.words[1]).imm, -4);
});

test("a label may stand alone on its line or share it with an instruction", () => {
    const alone = assemble(
        "start:\n" +
        "  kopanya x1, x1, x1\n" +
        "  lekana x0, x0, start"
    );

    const shared = assemble(
        "start: kopanya x1, x1, x1\n" +
        "  lekana x0, x0, start"
    );

    assert.deepEqual(alone.words, shared.words);
    assert.equal(alone.labels.start, 0);
});

test("a label can be used before it is defined", () => {
    const result = assemble(
        "lekana x0, x0, later\n" +
        "kopanya x1, x1, x1\n" +
        "later: kopanya x2, x2, x2"
    );

    assert.equal(result.ok, true);
});

test("a branch to itself has offset 0", () => {
    assert.equal(
        assemble("here: lekana x0, x0, here").instructions[0].imm,
        0
    );
});

test("a branch more than 14 bits away is rejected with its distance", () => {
    const filler = "kopanya x0, x0, x0\n".repeat(2100);
    // 8400 bytes > 8191

    const [error] = errorsOf(
        `lekana x0, x0, far\n${filler}far: kopanya x0, x0, x0`
    );

    assert.equal(error.line, 1);
    assert.match(error.message, /too far away/);
});

test("a branch exactly at the limit (8188 bytes) is accepted", () => {
    const filler = "kopanya x0, x0, x0\n".repeat(2046);
    // Target is 4 * 2047 = 8188 bytes ahead.

    assert.equal(
        assemble(
            `lekana x0, x0, far\n${filler}far: kopanya x0, x0, x0`
        ).ok,
        true
    );
});

// ------------------------------------------------------------------
// The apostrophe rule (A4)
// ------------------------------------------------------------------

test("apostrophe, backtick, curly quotes and underscore are the same character in a mnemonic", () => {
    const expected = word("kopanya_h x1, x0, 5");

    for (const variant of [
        "kopanya'h",
        "kopanya`h",
        "kopanya’h",
        "kopanya‘h",
    ]) {
        assert.equal(word(`${variant} x1, x0, 5`), expected, variant);
    }
});

test("the same rule applies to labels", () => {
    const result = assemble(
        "ts'oara: kopanya x1, x1, x1\n" +
        "lekana x0, x0, ts_oara"
    );

    assert.equal(result.ok, true);
    assert.equal(result.instructions[1].imm, -4);
    assert.equal(normalizeName("ts'ch’"), "ts_ch_");
});

test("mnemonics are not case sensitive", () => {
    assert.equal(
        word("KOPANYA X7, X5, X6"),
        word("kopanya x7, x5, x6")
    );
});

// ------------------------------------------------------------------
// Numbers and registers
// ------------------------------------------------------------------

test("decimal, hex and signed immediates all work", () => {
    assert.equal(
        word("kopanya_h x1, x0, 255"),
        word("kopanya_h x1, x0, 0xFF")
    );

    assert.equal(
        word("kopanya_h x1, x0, +7"),
        word("kopanya_h x1, x0, 7")
    );

    assert.equal(
        word("kopanya_h x1, x0, -0x10"),
        word("kopanya_h x1, x0, -16")
    );
});

test("immediate limits are -8192 to 8191", () => {
    assert.equal(assemble("kopanya_h x1, x0, 8191").ok, true);
    assert.equal(assemble("kopanya_h x1, x0, -8192").ok, true);

    assert.match(
        errorsOf("kopanya_h x1, x0, 8192")[0].message,
        /does not fit in 14 bits/
    );

    assert.match(
        errorsOf("kopanya_h x1, x0, -8193")[0].message,
        /does not fit in 14 bits/
    );
});

test("shift amounts must be 0 to 31", () => {
    assert.equal(assemble("ritsisa_ht x1, x1, 31").ok, true);

    assert.match(
        errorsOf("ritsisa_ht x1, x1, 32")[0].message,
        /between 0 and 31/
    );

    assert.match(
        errorsOf("ritsisa_hl x1, x1, -1")[0].message,
        /between 0 and 31/
    );
});

test("x0 to x15 and the aliases are accepted; x16 is not", () => {
    assert.equal(
        word("kopanya x15, x0, x1"),
        word("kopanya s6, zero, ra")
    );

    assert.equal(
        word("kopanya sp, a0, t3"),
        word("kopanya x2, x3, x8")
    );

    assert.match(
        errorsOf("kopanya x16, x0, x1")[0].message,
        /does not exist; LIMO has x0 to x15/
    );
});

// ------------------------------------------------------------------
// Error reporting (B1)
// ------------------------------------------------------------------

test("errors carry the right line number, counting blank and comment lines", () => {
    const errors = errorsOf(
        "# header\n\n" +
        "kopanya x1, x2, x3\n" +
        "bogus x1\n"
    );

    assert.equal(errors.length, 1);
    assert.equal(errors[0].line, 4);

    assert.match(
        errors[0].message,
        /"bogus" is not a LIMO instruction/
    );
});

test("every error is reported, not just the first, in line order", () => {
    const errors = errorsOf(
        "kopanya x1, x2\n" +
        "nka x1, x2\n" +
        "lekana x1, x2, nowhere\n" +
        "kopanya x1, x2, x99"
    );

    assert.deepEqual(
        errors.map((error) => error.line),
        [1, 2, 3, 4]
    );
});

test("wrong operand count says what was expected", () => {
    assert.match(
        errorsOf("kopanya x1, x2")[0].message,
        /kopanya needs 3 operands \(rd, rs1, rs2\) but you wrote 2/
    );

    assert.match(
        errorsOf("beha x1")[0].message,
        /beha needs 2 operands/
    );
});

test("a bad memory operand explains the offset(register) form", () => {
    assert.match(
        errorsOf("nka x1, x2")[0].message,
        /offset\(register\)/
    );
});

test("unknown and duplicate labels are explained", () => {
    assert.match(
        errorsOf("lekana x0, x0, missing")[0].message,
        /unknown label "missing"/
    );

    const [duplicate] = errorsOf(
        "a: kopanya x0, x0, x0\n" +
        "a: kopanya x0, x0, x0"
    );

    assert.equal(duplicate.line, 2);
    assert.match(duplicate.message, /defined twice/);
});

test("a non-number immediate is reported", () => {
    assert.match(
        errorsOf("kopanya_h x1, x0, ten")[0].message,
        /"ten" is not a number/
    );
});

test("a bad line does not shift the addresses (and so the offsets) of later lines", () => {
    const result = assemble(
        "bogus\n" +
        "top: kopanya x1, x1, x1\n" +
        "lekana x0, x0, top"
    );

    assert.equal(result.ok, false);
    assert.equal(result.errors.length, 1);
    // Only the bogus line; no spurious branch error.
});

test("failed assembly returns no machine code", () => {
    const result = assemble("kopanya x1, x2");

    assert.deepEqual(result.words, []);
    assert.deepEqual(result.instructions, []);
});

// Comments, blanks, and empty input
// ------------------------------------------------------------------

test("# and // comments and blank lines are ignored", () => {
    const result = assemble(
        "# full line\n\n" +
        "  kopanya x1, x2, x3  # trailing\n" +
        "// another\n" +
        "kopanya x1, x2, x3 // trailing too"
    );

    assert.equal(result.words.length, 2);
    assert.equal(result.words[0], result.words[1]);
});

test("empty source assembles to nothing without error", () => {
    const result = assemble("");

    assert.equal(result.ok, true);
    assert.deepEqual(result.words, []);
});

test("Windows line endings are handled", () => {
    assert.equal(
        assemble(
            "kopanya x1, x2, x3\r\n" +
            "kopanya x1, x2, x3\r\n"
        ).words.length,
        2
    );
});

test("instruction addresses go up in steps of 4", () => {
    const { instructions } = assemble(
        "kopanya x1, x1, x1\n" +
        "kopanya x1, x1, x1\n" +
        "kopanya x1, x1, x1"
    );

    assert.deepEqual(
        instructions.map((instruction) => instruction.address),
        [0, 4, 8]
    );
});

// ------------------------------------------------------------------
// Round trips and field layout
// ------------------------------------------------------------------

test("every instruction in the ISA survives assemble -> disassemble", () => {
    const sample = {
        R: (m) => `${m} x3, x4, x5`,
        I: (m) => `${m} x3, x4, 6`,
        L: (m) => `${m} x3, 12(x4)`,
        S: (m) => `${m} x5, -12(x4)`,
        B: (m) => `${m} x4, x5, t\nt: kopanya x0, x0, x0`,
    };

    for (const [mnemonic, spec] of Object.entries(INSTRUCTIONS)) {
        const result = assemble(sample[spec.syntax](mnemonic));

        assert.equal(result.ok, true, mnemonic);

        const back = disassemble(result.words[0]);

        assert.equal(back.mnemonic, mnemonic);
        assert.equal(back.syntax, spec.syntax);
    }
});

test("disassemble gives readable text for each format", () => {
    assert.equal(
        disassemble(word("kopanya x7, x5, x6")).text,
        "kopanya x7, x5, x6"
    );

    assert.equal(
        disassemble(word("kopanya_h x1, x0, -1")).text,
        "kopanya_h x1, x0, -1"
    );

    assert.equal(
        disassemble(word("nka x8, 4(x2)")).text,
        "nka x8, 4(x2)"
    );

    assert.equal(
        disassemble(word("beha x7, -12(x2)")).text,
        "beha x7, -12(x2)"
    );
});

test('an unknown opcode disassembles to "?" instead of throwing', () => {
    assert.equal(disassemble(0xffffffff).mnemonic, null);
});

test("the colour-coded fields of every word are contiguous and rebuild the word", () => {
    const sources = [
        "kopanya x7, x5, x6",
        "kopanya_h x1, x0, -1",
        "nka x8, 4(x2)",
        "beha x7, -12(x2)",
    ];

    for (const source of sources) {
        const { instructions, words } = assemble(source);
        const fields = splitFields(words[0], instructions[0].syntax);

        assert.equal(
            fields.map((field) => field.bits).join(""),
            words[0].toString(2).padStart(32, "0")
        );

        assert.equal(
            fields.reduce((total, field) => total + field.bits.length, 0),
            32
        );
    }
});

test("each format layout covers bits 31..0 exactly once", () => {
    for (const [syntax, fields] of Object.entries(FIELDS_BY_SYNTAX)) {
        const used = Array(32).fill(0);

        fields.forEach(([hi, lo]) => {
            for (let bit = lo; bit <= hi; bit++) {
                used[bit]++;
            }
        });

        assert.ok(used.every((count) => count === 1), `format ${syntax}`);
    }
});

test("no two instructions share the same opcode / funct3 / funct7 (the encoding is decodable)", () => {
    const seen = new Set();

    for (const [name, instruction] of Object.entries(INSTRUCTIONS)) {
        const key = [
            instruction.opcode,
            instruction.funct3,
            instruction.syntax === "R" ? instruction.funct7 : "-",
        ].join("/");

        assert.ok(!seen.has(key), `${name} duplicates another encoding`);
        seen.add(key);
    }
});

test("encode() masks a negative immediate to 14 bits", () => {
    assert.equal(
        encode({
            syntax: "I",
            opcode: 0x13,
            funct3: 0,
            rd: 1,
            imm: -1,
        }) >>> 18,
        0x3fff
    );
});

test("hex32 pads to eight digits", () => {
    assert.equal(hex32(0x293), "0x00000293");
});

// ------------------------------------------------------------------
// The shipped example programs
// ------------------------------------------------------------------

for (const name of Object.keys(EXAMPLES)) {
    test(`example ${name}.limo assembles without errors`, () => {
        assert.deepEqual(assemble(EXAMPLES[name]).errors, []);
    });

    test(
        `src/examples.js matches examples/${name}.limo (run "npm run examples" if this fails)`,
        () => {
            // Compare with Windows line endings (CRLF) turned into LF,
            // because that is what the generated template literals hold.
            const onDisk = fs
                .readFileSync(
                    path.join(__dirname, "..", "examples", `${name}.limo`),
                    "utf8"
                )
                .replace(/\r\n/g, "\n");

            assert.equal(EXAMPLES[name], onDisk);
        }
    );
}

test("sum.limo: the loop branches back 8 bytes and the program is 6 instructions", () => {
    const result = assemble(EXAMPLES.sum);

    assert.equal(result.words.length, 6);
    assert.equal(result.instructions[4].imm, -8);
});

test("branch.limo: both forward branches skip one instruction (+8)", () => {
    const { instructions } = assemble(EXAMPLES.branch);

    assert.equal(instructions[3].imm, 8);
    assert.equal(instructions[4].imm, 8);
});