function addWasmChildrenFuncs() {

    this.childrenPointer = 0;

    this._allocateChildren = function(n) {
        if (!this._hasChildrenSpace(n * 2)) {
            // Defragment!
            this._defragChildren();
        }
        let ptr = this.childrenPointer;
        this.childrenPointer += n * 2;
        return ptr;
    }

    this.__addChildAt = function(offset, l, index, child) {
        let i = offset;
        let n = offset + l;

        let j = i + index;

        if (this.children[n]) {
            // Out of space in children array: copy to end.
            while (i < j) {
                this.children[this.childrenPointer++] = this.children[i];
                i++;
            }
            this.children[this.childrenPointer++] = child;
            while (i < n) {
                this.children[this.childrenPointer++] = this.children[i];
                // @note: we could free up the previously used slots here, but this would cost performance while it
                // wouldn't help much to prevent children defragments.
                i++;
            }

            // Reserve some additional memory for newly added children.
            this.childrenPointer += l;
        } else {
            // Make space for new item.
            n++;
            while(n > j) {
                this.children[n] = this.children[n - 1];
                n--;
            }
            this.children[j] = child;
        }
    }

    this.__removeChildAt = function(offset, l, index) {
        let i = offset + index;
        let n = offset + l;
        while(i < n - 1) {
            this.children[i] = this.children[i + 1];
        }

        // When adding another child, we need to be able to reuse the released child slot.
        this.children[n - 1] = 0;
    }

    this._defragChildren = function() {
        // Use buffer as temporary space for the new children array.
        let newPtr = this._getBufferMemoryOffset() / 4;

        for (let i = 0; i < this.maxViews; i++) {
            if (this.used[i]) {
                let offset = this._getViewStructMemoryOffset(i) / 4;
                let cptr = this.uptr[offset + 46];
                let cn = this.uptr[offset + 47];
            }
        }
    }

    this._hasChildrenSpace = function(l) {
        return this.childrenPointer + l < this.maxChildren * 6;
    }

}

module.exports = addWasmChildrenFuncs;