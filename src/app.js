/*
 * Page wiring for the assembler view.
 * All assembling is done by src/assembler.js; this file only draws.
 */

(function () {
    const {
        assemble,
        disassemble,
        INSTRUCTIONS,
        REG_ALIASES,
        REG_SESOTHO,
        splitFields,
        hex32,
        EXAMPLES,
        createState,
        createHistory,
        narrate,
        clock,
        isFinished,
        renderProcessor,
    } = window.LIMO;

    const $ = (id) => document.getElementById(id);

    const escapeHtml = (text) =>
        text.replace(/[&<>"]/g, (c) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
        })[c]);

    let mode = "hex";

    // The processor: registers, memories and pipeline registers all live in
    // this one state object (see src/pipeline.js). It is rebuilt whenever the
    // source assembles, and by Reset.
    let machine = createState();

    // The source text that was last assembled, and the timer of Run.
    let lastSource = null;
    let lastAssembly = { ok: false, words: [] };
    let runTimer = null;

    // Step Back: earlier copies of the state. Breakpoints: addresses where Run pauses.
    const history = createHistory();
    const breakpoints = new Set();

    let timer = null;

    const OPERANDS = {
        R: "rd, rs1, rs2",
        I: "rd, rs1, imm",
        L: "rd, imm(rs1)",
        S: "rs2, imm(rs1)",
        B: "rs1, rs2, label",
    };

    // ------------------------------------------------------------------
    // Source editor helpers
    // ------------------------------------------------------------------

    function updateLineNumbers() {
        const count = $("src").value.split("\n").length;

        $("lines").textContent = Array.from(
            { length: count },
            (_, i) => i + 1
        ).join("\n");
    }

    function message(text, className = "", line = 0) {
        const row = document.createElement("div");
        row.className = className;

        if (line) {
            const link = document.createElement("button");

            link.className = "linkish";
            link.textContent = text;
            link.onclick = () => jumpToLine(line);

            row.append(link);
        } else {
            row.textContent = text;
        }

        $("output").append(row);
    }

    function jumpToLine(line) {
        const area = $("src");
        const lines = area.value.split("\n");

        const start =
            lines.slice(0, line - 1).join("\n").length +
            (line > 1 ? 1 : 0);

        area.focus();
        area.setSelectionRange(
            start,
            start + lines[line - 1].length
        );

        const lineHeight =
            parseFloat(getComputedStyle(area).lineHeight) || 20;

        area.scrollTop = Math.max(0, (line - 3) * lineHeight);
        $("lines").scrollTop = area.scrollTop;
    }

    // ------------------------------------------------------------------
    // Machine-code display
    // ------------------------------------------------------------------

    function renderCode(result) {
        const box = $("code");

        if (!result.ok || !result.instructions.length) {
            box.innerHTML = `
                <div class="empty">
                    ${
                        result.ok
                            ? "Nothing to assemble yet."
                            : "Fix the errors to see machine code."
                    }
                </div>
            `;

            return;
        }

        const labelAt = {};

        Object.entries(result.labels).forEach(([name, address]) => {
            (labelAt[address] ??= []).push(name);
        });

        box.innerHTML = result.instructions
            .map((inst) => {
                const fields = splitFields(inst.word, inst.syntax);

                const bits =
                    mode === "hex"
                        ? `<span>${hex32(inst.word)}</span>`
                        : fields
                              .map(
                                  (field) => `
                                      <span
                                          class="f-${field.cls}"
                                          title="${field.label}"
                                      >${field.bits}</span>
                                  `
                              )
                              .join("");

                const label = labelAt[inst.address]
                    ? `
                        <span class="lbl">
                            ${escapeHtml(
                                labelAt[inst.address].join(", ")
                            )}:
                        </span>
                    `
                    : "";

                return (
                    `<div class="coderow ${mode}">` +
                    `<span class="addr">${inst.address
                        .toString(16)
                        .padStart(4, "0")}</span>` +
                    `<span class="word">${bits}</span>` +
                    `<span class="dis">${label}${escapeHtml(
                        disassemble(inst.word).text
                    )}</span>` +
                    `<span class="ln" title="source line">L${inst.line}</span>` +
                    `</div>`
                );
            })
            .join("");

        if (mode === "hex") {
            // In hex mode, field details are shown on hover/tap.
            box.querySelectorAll(".coderow").forEach((row, i) => {
                row.title = splitFields(
                    result.instructions[i].word,
                    result.instructions[i].syntax
                )
                    .map((field) => `${field.label}=${field.bits}`)
                    .join("  ");
            });
        }
    }

    // ------------------------------------------------------------------
    // Assembly execution and status display
    // ------------------------------------------------------------------

    function run() {
        clearTimeout(timer);

        const result = assemble($("src").value);

        $("output").innerHTML = "";

        renderCode(result);

        lastSource = $("src").value;
        lastAssembly = result;
        stopRunning();
        machine = createState(result.ok ? result.words : []);
        history.clear();
        $("narration").innerHTML = "";
        [...breakpoints].forEach((address) => {
            if (address >> 2 >= machine.instructionMemory.length) {
                breakpoints.delete(address);
            }
        });
        renderMachine();

        if (result.ok) {
            const n = result.words.length;

            $("count").textContent =
                `${n} instruction${n === 1 ? "" : "s"} · ${n * 4} bytes`;

            $("asmStatus").textContent = n ? "Assembled ✓" : "Ready";
            $("asmStatus").className =
                "status-chip " + (n ? "ok" : "");

            $("status").textContent = n
                ? `Assembled ${n} instruction${
                      n === 1 ? "" : "s"
                  } with no errors.`
                : "Ready";

            if (n) {
                const labelCount = Object.keys(result.labels).length;

                message(
                    `Assembled ${n} instruction${
                        n === 1 ? "" : "s"
                    }, ${labelCount} label${
                        labelCount === 1 ? "" : "s"
                    }. No errors.`,
                    "okmsg"
                );
            }
        } else {
            $("count").textContent = "0 instructions";

            const errorCount = result.errors.length;

            $("asmStatus").textContent =
                `${errorCount} error${errorCount === 1 ? "" : "s"} ✗`;

            $("asmStatus").className = "status-chip bad";

            $("status").textContent =
                `${errorCount} error${
                    errorCount === 1 ? "" : "s"
                }: click a message to jump to the line.`;

            result.errors.forEach((error) => {
                message(
                    `Line ${error.line}: ${error.message}`,
                    "err",
                    error.line
                );
            });
        }
    }

    const runSoon = () => {
        clearTimeout(timer);
        timer = setTimeout(run, 250);
    };

    function load(text) {
        $("src").value = text;

        updateLineNumbers();
        run();
    }

    // ------------------------------------------------------------------
    // ISA reference table
    // ------------------------------------------------------------------

    // Generate the reference table from the ISA so it cannot drift from it.
    $("isaTable").innerHTML = Object.entries(INSTRUCTIONS)
        .map(
            ([name, instruction]) => `
                <tr>
                    <td>${name}</td>
                    <td>${instruction.syntax}</td>
                    <td>${OPERANDS[instruction.syntax]}</td>
                    <td>${instruction.rv32i}</td>
                </tr>
            `
        )
        .join("");

    // ------------------------------------------------------------------
    // Register table
    // ------------------------------------------------------------------

    /**
     * Draw the GPR table, followed by the PC (sebaka).
     *
     * @param {number[]} values Register values.
     * @param {number} changed Register written in the last cycle,
     *                         highlighted; -1 means none.
     */
    function renderRegs(values, changed = -1) {
        const decimal = $("regFormat").value === "dec";

        const gprRows = REG_ALIASES
            .map(
                (alias, n) => `
                    <tr class="${n === changed ? "changed" : ""}">
                        <td>x${n}</td>
                        <td>${alias} · ${REG_SESOTHO[n]}</td>
                        <td>${
                            decimal
                                ? values[n] | 0
                                : hex32(values[n])
                        }</td>
                    </tr>
                `
            )
            .join("");

        // The PC is not in the register file, so it gets its own row.
        const pcRow = `
            <tr class="pcrow">
                <td>PC</td>
                <td>sebaka</td>
                <td>${decimal ? machine.pc : hex32(machine.pc)}</td>
            </tr>
        `;

        $("regTable").innerHTML = gprRows + pcRow;
        $("regTable2").innerHTML = gprRows + pcRow;
    }

    // Draw the registers and the whole processor view
    function renderMachine() {
        renderRegs(machine.regs, machine.changedReg);

        renderProcessor(machine, {
            decimal: $("regFormat").value === "dec",
            breakpoints,
        });

        $("back").disabled = history.size === 0;
    }

    $("regFormat").onchange = renderMachine;

    renderMachine();

    // ------------------------------------------------------------------
    // UI event wiring
    // ------------------------------------------------------------------

    Object.keys(EXAMPLES).forEach((name) => {
        $("example").add(
            new Option(`${name}.limo`, name)
        );
    });

    $("example").onchange = () => {
        if ($("example").value) {
            load(EXAMPLES[$("example").value]);
        }

        $("example").value = "";
    };

    $("assemble").onclick = run;

    $("open").onclick = () => {
        $("file").click();
    };

    $("file").onchange = (event) => {
        const file = event.target.files[0];

        if (file) {
            file.text().then(load);
        }

        event.target.value = "";
    };

    document
        .querySelectorAll('[name="mode"]')
        .forEach((radio) => {
            radio.onchange = () => {
                mode = radio.value;
                run();
            };
        });

    $("src").addEventListener("input", () => {
        updateLineNumbers();

        $("asmStatus").textContent = "Editing…";
        $("asmStatus").className = "status-chip";

        runSoon();
    });

    $("src").addEventListener("scroll", () => {
        $("lines").scrollTop = $("src").scrollTop;
    });

    document.addEventListener("keydown", (event) => {
        if (
            (event.ctrlKey || event.metaKey) &&
            event.key === "Enter"
        ) {
            event.preventDefault();
            run();
        }
    });

    // ------------------------------------------------------------------
    // Processor controls: Step, Run / Pause, Reset
    // ------------------------------------------------------------------

    function showView(name) {
        const processor = name === "processor";

        $("viewEditor").hidden = processor;
        $("viewProc").hidden = !processor;
        $("toolsEditor").hidden = processor;
        $("toolsProc").hidden = !processor;
        $("msgPane").hidden = processor;
        $("narrPane").hidden = !processor;

        $("tabEditor").classList.toggle("on", !processor);
        $("tabProc").classList.toggle("on", processor);
        $("tabEditor").setAttribute("aria-pressed", String(!processor));
        $("tabProc").setAttribute("aria-pressed", String(processor));
    }

    // The Datapath, Control and Pipeline registers tabs of the Processor view
    function showSub(name) {
        [
            ["datapath", "datapath", "subDatapath"],
            ["control", "controlView", "subControl"], 
            ["pipe", "pipeView", "subPipe"]

        ].forEach(([key, id, button]) => {
            $(id).hidden = key !== name;
            $(button).classList.toggle("on", key === name);
            $(button).setAttribute("aria-pressed", String(key === name));
        });
    }

    // Assemble first if the source changed since the last assembly
    function ensureAssembled() {
        if ($("src").value !== lastSource) {
            clearTimeout(timer);
            run();
        }

        return lastAssembly.ok && lastAssembly.words.length > 0;
    }

    // Add the narration of one cycle to the console (one block per cycle)
    function narrateCycle(trace) {
        const block = document.createElement("div");

        block.className = "cyc";
        block.dataset.cycle = machine.cycle;

        const lines = narrate(trace).map(
            ({ stage, text }) => `<div><span class="st">${stage}</span>${escapeHtml(text)}</div>`
        );

        if (trace.events.length) {
            lines.push(`<div class="evt"><span class="st">⇒</span>${escapeHtml(trace.events.join("; "))}</div>`);
        }

        block.innerHTML = `<b>Cycle ${machine.cycle}</b>${lines.join("")}`;
        $("narration").append(block);
        $("narration").scrollTop = $("narration").scrollHeight;
    }

    function narrationNote(text, className) {
        const row = document.createElement("div");

        row.className = className;
        row.textContent = text;
        $("narration").append(row);
        $("narration").scrollTop = $("narration").scrollHeight;
    }

    // Run one clock cycle. Returns false when nothing more can run
    function stepOnce() {
        if (!ensureAssembled()) {
            message("There is no assembled program to run. Fix the errors first.", "err");
            narrationNote("There is no assembled program to run. Fix the errors in the Editor first.", "stop");
            return false;
        }

        if (isFinished(machine)) {
            $("status").textContent = `Program complete after ${machine.cycle} cycles.`;
            return false;
        }

        const before = structuredClone(machine); // to recover from a fault

        try {
            const trace = clock(machine);

            history.push(before);
            narrateCycle(trace);
        } catch (error) {
            machine = before;
            message(error.message, "err");
            narrationNote(error.message, "stop");
            renderMachine();
            return false;
        }

        renderMachine();

        if (isFinished(machine)) {
            $("status").textContent = `Program complete after ${machine.cycle} cycles.`;
            message(`Program complete after ${machine.cycle} cycles.`, "okmsg");
            narrationNote(`Program complete after ${machine.cycle} cycles.`, "done");
            return false;
        }

        $("status").textContent = `Cycle ${machine.cycle}`;

        return true;
    }

    function stopRunning() {
        clearInterval(runTimer);
        runTimer = null;
        document.querySelector(".runBtn").textContent = "Run";
    }

    function toggleRun() {
        if (runTimer) {
            stopRunning();
            return;
        }

        document.querySelector(".runBtn").textContent = "Pause";

        let first = true; // Run always moves at least one cycle, so it can leave a breakpoint

        runTimer = setInterval(() => {
            if (!first && breakpoints.has(machine.pc) && machine.pc >> 2 < machine.instructionMemory.length) {
                stopRunning();
                $("status").textContent = `Paused at breakpoint ${hex32(machine.pc)} (cycle ${machine.cycle}).`;
                narrationNote(`Paused: the next instruction to fetch, at ${hex32(machine.pc)}, has a breakpoint.`, "stop");
                return;
            }

            first = false;

            if (!stepOnce()) {
                stopRunning();
            }
        }, Math.max(10, +$("delay").value || 300));
    }


    // Step Back: restore the state from before the last clock cycle.
    function stepBack() {
        stopRunning();

        const previous = history.back();

        if (!previous) {
            $("status").textContent = "Already at cycle 0: nothing to step back to.";
            return;
        }

        machine = previous;

        // Remove the narration of the cycle that was undone, and any notes after it.
        const last = [...$("narration").querySelectorAll(".cyc")].pop();

        if (last) {
            while (last.nextElementSibling) {
                last.nextElementSibling.remove();
            }

            last.remove();
        }

        $("status").textContent = `Stepped back to cycle ${machine.cycle}`;
        renderMachine();
    }

    function resetProcessor() {
        stopRunning();

        if ($("src").value !== lastSource) {
            clearTimeout(timer);
            run();
            return;
        }

        machine = createState(lastAssembly.ok ? lastAssembly.words : []);
        history.clear();
        renderMachine();
        $("output").innerHTML = "";
        $("narration").innerHTML = "";
        message("Processor reset: registers, memory and pipeline cleared.", "okmsg");
        narrationNote("Processor reset: registers, memory and pipeline cleared. Press Step or Run.", "done");
        $("status").textContent = "Processor reset";
    }

    $("tabEditor").onclick = () => showView("editor");
    $("tabProc").onclick = () => showView("processor");
    $("subDatapath").onclick = () => showSub("datapath");
    $("subControl").onclick = () => showSub("control");
    $("subPipe").onclick = () => showSub("pipe");
    $("assemble2").onclick = run;
    $("back").onclick = stepBack;

    // A breakpoint checkbox in instruction memory (one listener for the whole table).
    $("imemTable").addEventListener("change", (event) => {
        const box = event.target.closest(".bp");

        if (!box) {
            return;
        }

        const address = +box.dataset.address;

        if (box.checked) {
            breakpoints.add(address);
        } else {
            breakpoints.delete(address);
        }

        renderMachine();
    });
    $("step").onclick = () => {
        stopRunning();
        stepOnce();
    };

    document.querySelectorAll(".runBtn").forEach((btn) => {
        btn.onclick = toggleRun;
    });
   
    $("reset").onclick = resetProcessor;

    // Load the default example: M3 has no hazard units, so it must be hazard-free.
    load(EXAMPLES["hazard-free"]);
})();