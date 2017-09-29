function addWasmChildrenFuncs() {

    this.childrenPointer = 0;

    this._allocateChildren = function(vi, n) {
        let view = this.getWasmView(vi);
        view.children = this.childrenPointer;
        this.childrenPointer += n * 2;
        view._children = 0;
    }

    this._addChildAt = function(vi, child, index) {
        let view = this.getWasmView(vi);
        //@todo.
    }

    this._childrenSpaceAvailable = function(l) {
        return (this.childrenPointer + l < this.maxChildren);
    }


}

module.exports = addWasmChildrenFuncs;