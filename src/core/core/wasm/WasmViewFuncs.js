function addWasmViewFuncs() {

    // Mimic C struct (this.views[vi]).
    this.getWasmView = function(vi) {
        return new WasmView(vi);
    }

    this._allocate = function() {
        if (this.slotOffset === this.maxViews) {
            // Out of memory: expand immediately.
            this._outOfViewsMemory();
        }

        let vi = this.slots[this.slotOffset++];

        this.used[vi] = 1;

        return vi;
    }

    this._free = function(vi) {
        // Allow slot to be reused.
        this.slots[--this.slotOffset] = vi;
        this.used[vi] = 0;

        // Release children slots.
        this._freeChildren(vi);
        this._freeZIndexedChildren(vi);

        //@todo: also check for z-indexes:
        // - gather all contexts that have changes
        // - finally, for all contexts: loop through all zIndexedChildren lists, and filter by 'used' flags.
    }


}

let WasmView = require('./WasmView');

module.exports = addWasmViewFuncs;