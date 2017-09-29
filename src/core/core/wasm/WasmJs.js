function WasmJs() {

    const env = {_setMemory: bytes => {
        return this.setMemory(bytes)
    }}

    this.wasm = new Wasm({env: env});

    this.wasmBuffer = null;
    this.wasmFloat32 = null;
    this.wasmUint32 = null;

    this.setMemory = function(bytes) {
        let toGrow = bytes - this.wasmBuffer ? this.wasmBuffer.byteLength : 0;
        if (toGrow > 0) {
            let pages = Math.ceil(toGrow / 65536);
            this.wasm.grow(pages);
        }
        this.updateWasmBuffer();
        return this.wasmBuffer.byteLength;
    }

    this.updateWasmBuffer = function() {
        this.wasmBuffer = this.wasm.getMemory();
        this.wasmFloat32 = new Float32Array(this.wasmBuffer);
        this.wasmUint32 = new Uint32Array(this.wasmBuffer);
    }

    /**
     * After a branch is added to the render tree, updates wasm.
     * @param {View} view
     */
    this.attachBranch = function(view) {
        this._attachBranchRecursive(view);

        //@todo: add children recursively.
        //@todo: init z contexts/sort/etc.
        //@todo: trigger proper recalc on mountpoint.
    }

    this._attachBranchRecursive = function(view) {
        view.wasmId = this.wasm._allocate();

        let w = view._getRenderWidth();
        let h = view._getRenderHeight();

        let a, b, c, d;
        if (view._rotation) {
            let _sr = Math.sin(view._rotation);
            let _cr = Math.cos(view._rotation);

            a = _cr * view._scaleX;
            b = -_sr * view._scaleY;
            c = _sr * view._scaleX;
            d = _cr * view._scaleY;
        } else {
            a = view._scaleX;
            b = 0;
            c = 0;
            d = view._scaleY
        }
        let pivotXMul = view._pivotX * w;
        let pivotYMul = view._pivotY * h;
        let x = view._x - (pivotXMul * a + pivotYMul * b) + pivotXMul - view._mountX * w;
        let y = view._y - (pivotXMul * c + pivotYMul * d) + pivotYMul - view._mountY * h;

        // Init basic WASM properties.
        let memOffset = this.wasm._getViewStructMemoryOffset(view.wasmId) / 4;
        this.wasmUint32[memOffset] = view.parent ? view.parent.wasmId : 0;
        this.wasmUint32[memOffset+1] = 1; // Has updates
        this.wasmUint32[memOffset+2] = 3; // Has render updates
        this.wasmUint32[memOffset+3] = 0; // Has visit entry hook
        this.wasmUint32[memOffset+4] = 0; // Has visit exit hook
        this.wasmUint32[memOffset+5] = 0xFFFFFFFF; // Recalc everything
        this.wasmUint32[memOffset+6] = 0; // Update tree order
        this.wasmFloat32[memOffset+7] = w;
        this.wasmFloat32[memOffset+8] = h;
        this.wasmFloat32[memOffset+9] = view._getLocalAlpha();
        this.wasmFloat32[memOffset+10] = x;
        this.wasmFloat32[memOffset+11] = y;
        this.wasmFloat32[memOffset+12] = a;
        this.wasmFloat32[memOffset+13] = b;
        this.wasmFloat32[memOffset+14] = c;
        this.wasmFloat32[memOffset+15] = d;
        // this.wasmUint32[memOffset+31] = view._clipping ? 1 : 0;
        this.wasmUint32[memOffset+32] = view._displayedTextureSource ? 1 : 0;
        // this.wasmUint32[memOffset+33] = view._colorUl;
        // this.wasmUint32[memOffset+34] = view._colorUr;
        // this.wasmUint32[memOffset+35] = view._colorBr;
        // this.wasmUint32[memOffset+36] = view._colorBl;
        // this.wasmFloat32[memOffset+41] = view._zIndex;
        // this.wasmUint32[memOffset+42] = view._forceZIndexContext;
        // this.wasmUint32[memOffset+50] = view._shader ? 1 : 0;
        this.wasmUint32[memOffset+51] = (view._texturizer && (view._texturizer._hasFilters() || view._texturizer._enabled)) || view._clipping ? 1 : 0;
        this.wasmUint32[memOffset+54] = (view._texturizer && view._texturizer.colorize) ? 1 : 0;

        if (view._displayedTextureSource) {
            // Because the logic is so complex, we wish to keep it on one place.
            view._updateTextureCoords();
        }

        let children = view._children.get();
        if (children) {
            let m = children.length;
            if (m > 0) {
                for (let i = 0; i < m; i++) {
                    children[i]._attachBranchRecursive();
                }
            }
        }
    }

    this.detachBranch = function(view) {
        this._detachBranchRecursive(view);
    }

    this._detachBranchRecursive = function(view) {
        view.wasmId = this.wasm._free(view.wasmId);

        let children = view._children.get();
        if (children) {
            let m = children.length;
            if (m > 0) {
                for (let i = 0; i < m; i++) {
                    children[i]._detachBranchRecursive();
                }
            }
        }
    }

    this.wasm._main();

}


