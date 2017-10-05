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

    this._addChildAt = function(vi, child, index) {
        let offset = this._getViewStructMemoryOffset(vi) / 4;
        let n = this.uptr[offset + 47];

        if (!this._hasChildrenSpace(2 * (n + 1))) {
            // Possibly out of children memory: defragment.
            this._defragChildren();
        }

        let ptr = this.uptr[offset + 46];
        this.__addChildAt(ptr, n, index, child);
    }

    this._freeBranch = function(vi) {
        // Frees the complete branch.

    }

    this._free = function(vi) {
        // Allow slot to be reused.
        this.slots[--this.slotOffset] = vi;
        this.used[vi] = 0;

        // @note: we do not release any children slots: we simply wait until we're out of children spaces and then
        // defragment, because setting the slots (probably in the middel of the children array) back to 0 is unlikely
        // to prevent an overflow anyway.
    }

}

let WasmView = require('./WasmView');

module.exports = addWasmViewFuncs;