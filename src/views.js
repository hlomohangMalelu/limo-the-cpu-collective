/*
 * Processor view: draws the pipeline state into the page.
 * No simulation logic here: it only reads the state made by src/pipeline.js.
 *
 *   renderProcessor(state, {decimal})  draws everything below
 *   - stage table            which instruction is in IF, ID, EX, MEM, WB
 *   - pipeline registers     IF/ID, ID/EX, EX/MEM, MEM/WB and their fields
 *   - instruction memory     every instruction and the stage it is in
 *   - data memory            words, the last write highlighted
 *   - execution info         cycles, instructions retired, CPI
 *   - datapath               the units of docs/DESIGN.md section 2.2; the ones
 *                            that worked this cycle are "(active)" with values
 *   - control                the control signals made in ID and those in flight
 */

(function (root, factory) {
    const isNode = typeof module === "object" && module.exports;
    const isa = isNode ? require("./isa.js") : root.LIMO;
    const assembler = isNode ? require("./assembler.js") : root.LIMO;
    const pipeline = isNode ? require("./pipeline.js") : root.LIMO;

    const api = factory(isa, assembler, pipeline);

    if (isNode) {
        module.exports = api;
    } else {
        Object.assign(root.LIMO, api);
    }
})(typeof self !== "undefined" ? self : this, function (isa, assembler, pipeline) {
    const { hex32 } = isa;
    const { disassemble } = assembler;
    const { STAGE_NAMES, stagesByAddress } = pipeline;

    const $ = (id) => document.getElementById(id);

    const escapeHtml = (text) =>
        String(text).replace(/[&<>"]/g, (c) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
        })[c]);

    const textOf = (word) =>
        word === null || word === undefined ? "–" : disassemble(word).text;

    // Fields of each pipeline register, in the order of docs/DESIGN.md section 3.
    const REGISTER_FIELDS = {
        "IF/ID": ["pc", "pcPlus4", "instr"],
        "ID/EX": ["pc", "instr", "rs1", "rs2", "rd", "rs1Val", "rs2Val", "imm", "funct3", "ctl"],
        "EX/MEM": ["pc", "instr", "rd", "aluResult", "storeData", "branchTaken", "branchTarget", "ctl"],
        "MEM/WB": ["pc", "instr", "rd", "aluResult", "memData", "ctl"],
    };

    // How to show a field: an address, a register number, or a 32-bit value.
    const ADDRESS_FIELDS = ["pc", "pcPlus4", "branchTarget", "instr"];
    const NUMBER_FIELDS = ["rs1", "rs2", "rd", "funct3"];

    function formatField(name, value, decimal) {
        if (name === "ctl") {
            return Object.entries(value)
                .map(([signal, v]) => `${signal}=${v}`)
                .join(" ");
        }

        if (name === "branchTaken") {
            return value ? "yes" : "no";
        }

        if (ADDRESS_FIELDS.includes(name)) {
            return hex32(value);
        }

        if (NUMBER_FIELDS.includes(name)) {
            return name === "funct3" ? value : `x${value}`;
        }

        return decimal ? value | 0 : hex32(value);
    }

    // ------------------------------------------------------------------

    function renderStages(state) {
        const trace = state.trace;

        $("stageTable").innerHTML = STAGE_NAMES.map((name, i) => {
            const active = trace && trace.active[i];
            const word = trace ? trace.instrs[i] : null;

            return `
                <tr class="${active ? "" : "bubble"}">
                    <td><b>${name}</b></td>
                    <td>${active ? escapeHtml(textOf(word)) : "bubble"}</td>
                </tr>
            `;
        }).join("");
    }

    function renderPipelineRegisters(state, decimal) {
        const registers = {
            "IF/ID": state.ifid,
            "ID/EX": state.idex,
            "EX/MEM": state.exmem,
            "MEM/WB": state.memwb,
        };

        $("pipeRegs").innerHTML = Object.entries(registers)
            .map(([name, register]) => {
                if (!register.valid) {
                    return `
                        <div class="preg empty">
                            <h3>${name}</h3>
                            <p>bubble</p>
                        </div>
                    `;
                }

                const rows = REGISTER_FIELDS[name]
                    .map(
                        (field) => `
                            <dt>${field}</dt>
                            <dd>${escapeHtml(formatField(field, register[field], decimal))}</dd>
                        `
                    )
                    .join("");

                return `
                    <div class="preg">
                        <h3>${name} <small>${escapeHtml(textOf(register.instr))}</small></h3>
                        <dl>${rows}</dl>
                    </div>
                `;
            })
            .join("");
    }

    function renderInstructionMemory(state, breakpoints) {
        const stages = stagesByAddress(state);

        $("imemTable").innerHTML = state.instructionMemory
            .map((word, index) => {
                const address = index * 4;
                const isBreakpoint = breakpoints.has(address);

                return `
                    <tr class="${stages[address] ? "current" : ""}">
                        <td><input type="checkbox" class="bp" data-address="${address}"
                            aria-label="Breakpoint at ${hex32(address)}" ${isBreakpoint ? "checked" : ""}></td>
                        <td>${hex32(address)}</td>
                        <td>${stages[address] || ""}</td>
                        <td>${escapeHtml(textOf(word))}</td>
                    </tr>
                `;
            })
            .join("");
    }

    /** The first 16 words, plus every higher address that was written. */
    function renderDataMemory(state, decimal) {
        const written = Object.keys(state.dataMemory).map(Number);
        const last = Math.max(60, ...written);
        let rows = "";

        for (let address = 0; address <= last; address += 4) {
            const isWritten = address in state.dataMemory;
            const value = state.dataMemory[address] | 0;

            rows += `
                <tr class="${address === state.changedAddress ? "changed" : ""}">
                    <td>${hex32(address)}</td>
                    <td>${decimal ? value : hex32(value)}</td>
                    <td>${isWritten ? "" : "·"}</td>
                </tr>
            `;
        }

        $("dmemTable").innerHTML = rows;
    }

    function renderInfo(state) {
        const { retired, stalls, flushes } = state.stats;
        const cpi = retired ? (state.cycle / retired).toFixed(2) : "–";

        $("info").innerHTML = [
            ["Cycles", state.cycle],
            ["Instrs. retired", retired],
            ["CPI", cpi],
            ["Stalls", stalls],
            ["Flushes", flushes],
        ]
            .map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`)
            .join("");
    }

 // Datapath: every unit of the block diagram, active ones outlined
    // ------------------------------------------------------------------

    /** A bar for a pipeline register, as in the block diagram. */
    const bar = (name) => `<div class="pbar" title="${name} pipeline register"><span>${name}</span></div>`;

    /** One unit. `lines` are its live values; it is drawn only as active when `active`. */
    function unit(name, active, lines = [], { later = "" } = {}) {
        const body = lines.length
            ? lines.map((line) => `<div class="uval">${escapeHtml(line)}</div>`).join("")
            : "";

        return `
            <div class="unit ${active ? "active" : ""} ${later ? "later" : ""}">
                <b>${escapeHtml(name)}${active ? " (active)" : ""}</b>
                ${body}
                ${later ? `<div class="uval">${later}</div>` : ""}
            </div>
        `;
    }

    function renderDatapath(state, decimal) {
        const trace = state.trace;
        const a = trace ? trace.active : [false, false, false, false, false];
        const v = trace ? trace.values : {};
        const num = (x) => (decimal ? x | 0 : hex32(x));
        const instr = (i) => (a[i] ? textOf(trace.instrs[i]) : "");
        const ex = a[2] ? disassemble(trace.instrs[2]) : {};

        const idUses2 = ["R", "S", "B"].includes(v.syntax);
        const activeSignals = v.ctl
            ? Object.entries(v.ctl).filter(([, value]) => value && value !== "-").map(([k, value]) => (value === 1 ? k : `${k}=${value}`))
            : [];

        const stage = (name, units) => `<div class="stage s-${name.toLowerCase()}"><h3>${name}</h3>${units.join("")}</div>`;

        $("datapath").innerHTML = `
            <div class="dp">
                ${stage("IF", [
                    unit("PC", a[0], a[0] ? [`pc ${hex32(v.pc)}`, `PC + 4 = ${hex32(v.pcPlus4)}`] : [`pc ${hex32(state.pc)}`]),
                    unit("Instr. memory", a[0], a[0] ? [instr(0)] : []),
                ])}
                ${bar("IF/ID")}
                ${stage("ID", [
                    unit("Register file", a[1] || !!v.wbWrites,
                        [
                            ...(a[1] ? [`rs1 x${v.rs1} = ${num(v.rs1Val)}`] : []),
                            ...(a[1] && idUses2 ? [`rs2 x${v.rs2} = ${num(v.rs2Val)}`] : []),
                            ...(v.wbWrites ? [`write x${v.wbRd} ← ${num(v.wbValue)}`] : []),
                        ]),
                    unit("Control", a[1], a[1] ? [activeSignals.join(" ") || "no signals"] : []),
                    unit("Immediate", a[1] && v.syntax !== "R", a[1] && v.syntax !== "R" ? [`imm ${v.imm}`] : []),
                ])}
                ${bar("ID/EX")}
                ${stage("EX", [
                    unit("Fwd muxes", false, [], { later: "M4" }),
                    unit("ALU", a[2], a[2] ? [`${v.aluOp}: ${num(v.aluA)}, ${num(v.aluB)}`, `result ${num(v.aluResult)}`] : []),
                    unit("Branch", a[2] && ex.syntax === "B",
                        a[2] && ex.syntax === "B" ? [v.branchTaken ? `taken → ${hex32(v.branchTarget)}` : "not taken"] : []),
                ])}
                ${bar("EX/MEM")}
                ${stage("MEM", [
                    unit("Data mem", a[3] && v.memOp !== "none",
                        a[3] && v.memOp !== "none" ? [`${v.memOp} [${v.address}]`, `value ${num(v.memValue)}`] : []),
                    unit("Hazard unit", false, [], { later: "M4: stall · flush" }),
                ])}
                ${bar("MEM/WB")}
                ${stage("WB", [
                    unit("WB mux", a[4] && !!v.wbWrites, a[4] && v.wbWrites ? [`x${v.wbRd} ← ${num(v.wbValue)}`] : []),
                ])}
            </div>
            <p class="dpnote">${trace ? `Cycle ${state.cycle}: ${a.filter(Boolean).length} of 5 stages busy.` : "Press Step to run the first clock cycle."}</p>
        `;
    }


     // Control: the signals the control unit made, and the ones in flight
    // ------------------------------------------------------------------

    const SIGNALS = ["RegWrite", "ALUSrc", "ALUctl", "MemRead", "MemWrite", "MemtoReg", "Branch"];

    // One line of meaning per control signal (handout B4), plus PCSrc, which is
    // not made in ID: it is decided in EX from Branch and the ALU result.
    const SIGNAL_MEANING = {
        RegWrite: "1: write the result into the destination register in WB.",
        ALUSrc: "0: the ALU's second input is register rs2. 1: it is the immediate.",
        ALUctl: "Which operation the ALU performs: ADD, SUB, SLL or SRL.",
        MemRead: "1: read a word from data memory in MEM (a load).",
        MemWrite: "1: write rs2 to data memory in MEM (a store).",
        MemtoReg: "0: write the ALU result back. 1: write the word read from memory.",
        Branch: "1: this is a conditional branch; EX compares rs1 and rs2.",
        PCSrc: "1: take the branch, so the PC becomes the branch target. 0: the PC goes to PC + 4. Decided in EX.",
    };

    function renderControl(state) {
        const trace = state.trace;
        const row = (label, text, ctl) => `
            <tr class="${text ? "" : "bubble"}">
                <td><b>${label}</b></td>
                <td>${escapeHtml(text || "bubble")}</td>
                ${SIGNALS.map((name) => `<td>${ctl && name in ctl ? ctl[name] : "–"}</td>`).join("")}
            </tr>
        `;
        const reg = (register) => (register.valid ? register : null);
        const idex = reg(state.idex);
        const exmem = reg(state.exmem);
        const memwb = reg(state.memwb);
        const idActive = trace && trace.active[1];
        const exActive = trace && trace.active[2];
        const heading = (name) => `<th title="${escapeHtml(SIGNAL_MEANING[name])}">${name}</th>`;
        const isBranch = exActive && disassemble(trace.instrs[2]).syntax === "B";

        $("controlView").innerHTML = `
            <table>
                <caption>Made by the control unit in ID this cycle</caption>
                <thead><tr><th>Stage</th><th>Instruction</th>${SIGNALS.map(heading).join("")}</tr></thead>
                <tbody>${row("ID", idActive ? textOf(trace.instrs[1]) : "", idActive ? trace.values.ctl : null)}</tbody>
            </table>
            <table>
                <caption>Travelling with the instructions (the signals each pipeline register holds)</caption>
                <thead><tr><th>Register</th><th>Instruction</th>${SIGNALS.map(heading).join("")}</tr></thead>
                <tbody>
                    ${row("ID/EX", idex && textOf(idex.instr), idex && idex.ctl)}
                    ${row("EX/MEM", exmem && textOf(exmem.instr), exmem && exmem.ctl)}
                    ${row("MEM/WB", memwb && textOf(memwb.instr), memwb && memwb.ctl)}
                </tbody>
            </table>
            <table>
                <caption>PCSrc, decided in EX this cycle</caption>
                <thead><tr><th>Stage</th><th>Instruction</th><th title="${escapeHtml(SIGNAL_MEANING.PCSrc)}">PCSrc</th><th>Why</th></tr></thead>
                <tbody>
                    <tr class="${exActive ? "" : "bubble"}">
                        <td><b>EX</b></td>
                        <td>${exActive ? escapeHtml(textOf(trace.instrs[2])) : "bubble"}</td>
                        <td>${exActive ? +!!trace.values.branchTaken : "–"}</td>
                        <td>${!exActive ? "" : !isBranch ? "not a branch" : trace.values.branchTaken ? `taken: PC ← ${hex32(trace.values.branchTarget)}` : "not taken: PC + 4"}</td>
                    </tr>
                </tbody>
            </table>
            <table>
                <caption>What each signal means</caption>
                <thead><tr><th>Signal</th><th>Meaning</th></tr></thead>
                <tbody>${[...SIGNALS, "PCSrc"].map((name) => `<tr><td><b>${name}</b></td><td class="mean">${escapeHtml(SIGNAL_MEANING[name])}</td></tr>`).join("")}</tbody>
            </table>
            <p class="dpnote">Each stage drops the signals it has finished with, so the later registers hold fewer. Hover a signal name for its meaning.</p>
        `;
    }

    function renderProcessor(state, { decimal = false, breakpoints = new Set() } = {}) {
        renderDatapath(state, decimal);
        renderControl(state);
        renderStages(state);
        renderPipelineRegisters(state, decimal);
        renderInstructionMemory(state, breakpoints);
        renderDataMemory(state, decimal);
        renderInfo(state);

        $("bpChip").textContent = breakpoints.size
            ? `${breakpoints.size} breakpoint${breakpoints.size === 1 ? "" : "s"}`
            : "no breakpoints";
    }

    return { renderProcessor, SIGNAL_MEANING };
    
});



