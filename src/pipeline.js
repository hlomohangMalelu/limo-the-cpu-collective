/*
 * The five-stage pipeline: IF -> ID -> EX -> MEM -> WB.
 *
 * clock(state) runs ONE clock cycle. Every stage reads the OLD pipeline
 * registers and produces a NEW one; all four are swapped in at the end,
 * like a real clock edge. The shapes of the registers are in
 * docs/DESIGN.md section 3.
 *
 * M3 = the pipeline core. There are NO hazard units yet (forwarding, the
 * load-use stall and the branch flush arrive in M4 as src/hazards.js), so a
 * program must be hazard-free: a result is used at least 3 instructions
 * after it is produced (the register file is written in the first half of
 * WB, so ID sees it), and the 2 instructions after a taken branch still run.
 */

(function (root, factory) {
    const isNode = typeof module === "object" && module.exports;
    const isa = isNode ? require("./isa.js") : root.LIMO;
    const assembler = isNode ? require("./assembler.js") : root.LIMO;
    const control = isNode ? require("./control.js") : root.LIMO;

    const api = factory(isa, assembler, control);

    if (isNode) {
        module.exports = api;
    } else {
        Object.assign(root.LIMO, api);
    }
})(typeof self !== "undefined" ? self : this, function (isa, assembler, control) {

    const { NUM_REGS, hex32 } = isa;
    const { disassemble } = assembler;
    const { controlUnit } = control;

    // An empty pipeline register: every other field is ignored.
    const BUBBLE = Object.freeze({ valid: false });

    const STAGE_NAMES = ["IF", "ID", "EX", "MEM", "WB"];

    /** A fresh processor holding `words` (machine code) in instruction memory. */
    function createState(words = []) {
        return {
            pc: 0, // address of the next instruction to fetch
            cycle: 0,
            regs: Array(NUM_REGS).fill(0),
            instructionMemory: words.slice(),
            dataMemory: {}, // byte address (word aligned) -> 32-bit word
            ifid: BUBBLE,
            idex: BUBBLE,
            exmem: BUBBLE,
            memwb: BUBBLE,
            changedReg: -1, // register written in the last cycle (-1: none)
            changedAddress: -1, // data-memory address written in the last cycle
            stats: { retired: 0, stalls: 0, flushes: 0 },
            trace: null, // what happened in the last cycle (see clock)
        };
    }

    
    /** True when every instruction has left the pipeline. */
    function isFinished(state) {
        return (
            state.pc >> 2 >= state.instructionMemory.length &&
            !state.ifid.valid &&
            !state.idex.valid &&
            !state.exmem.valid &&
            !state.memwb.valid
        );
    }

    /** MEM: load or store a word. Returns MEM/WB. */
    function memoryAccess(state, exmem, trace) {
        if (!exmem.valid) {
            return BUBBLE;
        }

        trace.active[3] = true;
        trace.instrs[3] = exmem.instr;

        const { ctl, aluResult: address } = exmem;
        let memData = 0;

        if ((ctl.MemRead || ctl.MemWrite) && address & 3) {
            throw new Error(
                `Memory fault: address ${hex32(address)} is not word-aligned (it must be a multiple of 4).`
            );
        }

        if (ctl.MemRead) {
            memData = state.dataMemory[address] | 0;
        }

        if (ctl.MemWrite) {
            state.dataMemory[address] = exmem.storeData;
            state.changedAddress = address;
            trace.events.push(`memory[${address}] ← ${exmem.storeData}`);
        }

        Object.assign(trace.values, {
            memOp: ctl.MemRead ? "read" : ctl.MemWrite ? "write" : "none",
            address,
            memValue: ctl.MemRead ? memData : exmem.storeData,
        });

