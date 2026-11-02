
(function (root, factory) {
    const isNode = typeof module === "object" && module.exports;
    const isa = isNode ? require("./isa.js") : root.LIMO;
    const assembler = isNode ? require("./assembler.js") : root.LIMO;

    const api = factory(isa, assembler);

    if (isNode) {
        module.exports = api;
    } else {
        Object.assign(root.LIMO, api);
    }
})(typeof self !== "undefined" ? self : this, function (isa, assembler) {
    const { hex32 } = isa;
    const { disassemble } = assembler;

    const VERB = { ADD: "adds", SUB: "subtracts", SLL: "shifts left", SRL: "shifts right" };
    const SYMBOL = { ADD: "+", SUB: "−", SLL: "<<", SRL: ">>" };

    /**
     * @param {object} trace the result of clock() in src/pipeline.js
     * @returns {{stage: string, text: string}[]} one entry per stage that held an instruction
     */
    function narrate(trace) {
        const v = trace.values;
        const lines = [];

        const say = (index, stage, text) => lines.push({ stage, text });

        if (trace.active[0]) {
            say(0, "IF", `Fetched ${disassemble(trace.instrs[0]).text} from ${hex32(v.pc)}; the next PC is ${hex32(v.pcPlus4)}.`);
        }

        if (trace.active[1]) {
            const reads = [`x${v.rs1} = ${v.rs1Val}`];

            if (v.syntax === "R" || v.syntax === "S" || v.syntax === "B") {
                reads.push(`x${v.rs2} = ${v.rs2Val}`);
            }

            const immediate = v.syntax === "R" ? "" : `, immediate ${v.imm}`;

            say(1, "ID", `Decoded ${disassemble(trace.instrs[1]).text}: read ${reads.join(" and ")}${immediate}.`);
        }

        if (trace.active[2]) {
            const { syntax, mnemonic } = disassemble(trace.instrs[2]);
            const op = v.aluOp;

            if (syntax === "B") {
                say(2, "EX", `ALU subtracts ${v.aluA} − ${v.aluB} = ${v.aluResult}: ${mnemonic} ${v.branchTaken ? `is taken, so the PC becomes ${hex32(v.branchTarget)}` : "is not taken"}.`);
            } else if (syntax === "L" || syntax === "S") {
                say(2, "EX", `ALU adds ${v.aluA} + ${v.aluB} = ${v.aluResult}, the memory address.`);
            } else {
                say(2, "EX", `ALU ${VERB[op]} ${v.aluA} ${SYMBOL[op]} ${v.aluB} = ${v.aluResult}.`);
            }
        }

        if (trace.active[3]) {
            say(3, "MEM",
                v.memOp === "read" ? `Read ${v.memValue} from memory[${v.address}].`
                : v.memOp === "write" ? `Wrote ${v.memValue} to memory[${v.address}].`
                : "No memory access.");
        }

        if (trace.active[4]) {
            say(4, "WB", v.wbWrites ? `Wrote ${v.wbValue} into x${v.wbRd}.` : "No register is written.");
        }

        return lines;
    }

    return { narrate };
});
