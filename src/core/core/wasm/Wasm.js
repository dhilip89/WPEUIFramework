/**
 * Todo:
 * - test
 */


function Wasm(env) {
    var SIZEOF_VIEW_STRUCT = 216;
    var C_MEMORY = 1024;

    this.maxViews = 0;
    this.buffer = 0;

    // Memory layout:
    // C memory: 1kB
    // Slots: 4B * maxViews
    // Used: 4B * maxViews
    // View structs: 220B * maxViews
    // Children: 16B * maxViews
    // Buffer: remaining (both GPU and general purpose buffer)

    var memory = null;

    this.slots = null;
    this.slotOffset = 0;
    this.used = null;
    this.children = null;

    this.getMemory = function() {
        return memory;
    }

    this._getViewStructMemoryOffset = function(vi) {
        return C_MEMORY + (4 * this.maxViews) + (4 * this.maxViews) + (vi * SIZEOF_VIEW_STRUCT);
    }

    // Initialize memory layout.
    // @pre: _maxViews > maxViews && _buffer > buffer (only grow).
    this._setMemory = function(_maxViews, _buffer) {
        let viewsMemory = _maxViews * (SIZEOF_VIEW_STRUCT + 24);
        let requiredMemory = viewsMemory + _buffer + C_MEMORY; // Reserve first 1024 bytes for C-managed memory locations.
        env.setMemory(requiredMemory);

        if (this.buffer) {
            // Copy buffer.
            this.memmove(
                C_MEMORY + ((24 + SIZEOF_VIEW_STRUCT) * _maxViews),
                C_MEMORY + ((24 + SIZEOF_VIEW_STRUCT) * this.maxViews),
                this.buffer
            );
        }

        if (this.maxViews) {
            // Copy children.
            this.memmove(
                C_MEMORY + ((8 + SIZEOF_VIEW_STRUCT) * _maxViews),
                C_MEMORY + ((8 + SIZEOF_VIEW_STRUCT) * this.maxViews),
                16 * this.maxViews
            );

            // Copy view structs.
            this.memmove(
                C_MEMORY + (8 * _maxViews),
                C_MEMORY + (8 * this.maxViews),
                SIZEOF_VIEW_STRUCT * this.maxViews
            );

            // Copy used flags.
            this.memmove(
                C_MEMORY + (4 * _maxViews),
                C_MEMORY + (4 * this.maxViews),
                4 * this.maxViews
            );
        }

        // Init children array items.
        this.memset(
            C_MEMORY + ((8 + SIZEOF_VIEW_STRUCT) * _maxViews) + 16 * this.maxViews,
            0,
            16 * (_maxViews - this.maxViews)
        );

        // Init used flags.
        this.memset(
            C_MEMORY + (4 * this.maxViews),
            0,
            4 * (_maxViews - this.maxViews)
        );

        // Init newly added slots.
        this.slots = new Uint32Array(memory, C_MEMORY, _maxViews);
        for (let i = this.maxViews; i < _maxViews; i++) {
            this.slots[i] = i;
        }

        this.used = new Uint32Array(memory, C_MEMORY + 4 * _maxViews, _maxViews);

        // In C, we need to set the view struct pointer as well.
        this.children = new Uint32Array(memory, C_MEMORY + (8 + SIZEOF_VIEW_STRUCT) * _maxViews, _maxViews * 4);

        this.maxViews = _maxViews;
        this.buffer = _buffer;
    }

    this._outOfViewsMemory = function() {
        this._setMemory(this.maxViews * 2, this.buffer);
    }

    this._outOfBufferMemory = function() {
        this._setMemory(this.maxViews, this.buffer * 2);
    }

    // JS-only: wasm provides its own implementation.
    this.grow = function(pages) {
        if (memory) {
            let newMemory = new ArrayBuffer(memory.byteLength + pages * 65536);

            // Copy all data.
            (new Uint8Array(newMemory)).set(new Uint8Array(memory));

            memory = newMemory;
        } else {
            memory = new ArrayBuffer(pages * 65536);
        }
    }

    this.memmove = function(dest, src, len) {
        // @pre: dest, src and len are 4B aligned.
        let target = new Uint32Array(memory);
        src = src / 4;
        dest = dest / 4;
        len = len / 4;

        if (src + len > dest) {
            // Overlap: copy backwards.
            for (let i = len; i >= 0; i--) {
                target[dest + i] = target[src + i];
            }
        } else {
            // Forwards.
        }
    }

    this.memset = function(dest, value, len) {
        value = value & 0xFF;
        let v = value + (value << 8) + (value << 16) + (value << 24);

        // @pre: dest and src are 4B aligned.
        let target = new Uint32Array(memory, dest);
        let n = len / 4;

        for (let i = 0; i < n; i++) {
            target[i] = v;
        }
    }


    this._main = function() {
        // Set initial memory. It will be grown automatically when needed.
        // @todo: initialize with more memory pages (40 or so?).
        this._setMemory(10, 1024);
    }

    addWasmViewFuncs.apply(this);
    addWasmChildrenFuncs.apply(this);
}

let addWasmChildrenFuncs = require('./WasmChildrenFuncs');
let addWasmViewFuncs = require('./WasmViewFuncs');

module.exports = Wasm;