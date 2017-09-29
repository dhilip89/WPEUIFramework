function addWasmViewFuncs() {

    // Mimic C struct (this.views[vi]).
    this.getWasmView = function(vi) {
        return new WasmView(this, vi);
    }

    this._allocate = function() {
        if (this.slotOffset === this.maxViews) {
            // Out of memory: expand immediately.
            this._outOfMemory();
        }

        let vi = this.slots[this.slotOffset++];

        this.used[vi] = 1;

        return vi;
    }

    this._free = function(vi) {
        // Allow slot to be reused.
        this.slots[--this.slotOffset] = vi;
        this.used[vi] = 0;

        // We do not release any children slots: we simply wait until we're out of children spaces and then defragment.
        //@todo: also check for z-indexes:
        // - gather all contexts that have changes
        // - finally, for all contexts: loop through all zIndexedChildren lists, and filter by 'used' flags.
    }

}

let WasmView = require('./WasmView');

module.exports = addWasmViewFuncs;